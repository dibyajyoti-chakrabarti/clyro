"""Tests for deploy.py — the AWS provisioning state machine. Kept separate from
app/tests.py given the size of this suite. Priority order follows the audit's
own framing (highest-risk first):

1. recreate()'s _has_been_live gate — "a bug here would let a rebuild destroy
   live customer data."
2. start()'s create_stack retry-on-race loop.
3. teardown()'s _empty_undeletable_resources.
4. poll()'s race-guarded BUILDING transition.
5. _apply_stack_update's stateful-resource-change refusal (_unsafe_changes).
"""

from __future__ import annotations

import time
from unittest.mock import patch

import boto3
from botocore.exceptions import ClientError
from django.test import SimpleTestCase, TestCase
from moto import mock_aws

from app.provisioning import deploy
from core.models import AWSAccountConnection, CanvasVersion, Deployment, IntentRecord, Project, User


def _access_denied():
    return ClientError({"Error": {"Code": "AccessDenied", "Message": "denied"}}, "AssumeRole")


def _already_exists():
    return ClientError({"Error": {"Code": "AlreadyExistsException", "Message": "Stack already exists"}}, "CreateStack")


class _DeploymentFixtureMixin:
    def _make_project_with_deployment(self, deployment_status, **deployment_kwargs):
        user = User.objects.create(cognito_sub=f"sub-{time.time_ns()}", email=f"{time.time_ns()}@example.com", name="T")
        project = Project.objects.create(user=user, name="taskboard")
        connection = AWSAccountConnection.objects.create(
            project=project, aws_account_id="123456789012", iam_role_arn="arn:aws:iam::123:role/clyro",
            bootstrap_stack_id="clyro-bootstrap", connected_at=None,
        )
        intent = IntentRecord.objects.create(project=project)
        canvas = CanvasVersion.objects.create(
            project=project, intent_record=intent, version_number=1,
            canvas_yaml="version: 1\nnodes: []\nconnections: []\n", canvas_snapshot={},
        )
        defaults = dict(
            project=project, canvas_version=canvas, intent_record=intent, aws_connection=connection,
            environment=Deployment.Environment.PRODUCTION, status=deployment_status,
            cloudformation_template="Resources: {}\n",
        )
        defaults.update(deployment_kwargs)
        return project, Deployment.objects.create(**defaults)


class RecreateHasBeenLiveGateTests(_DeploymentFixtureMixin, TestCase):
    """The audit's explicitly flagged highest-risk path: a bug here would let
    a rebuild destroy live customer data."""

    def test_project_with_complete_deployment_refuses_to_recreate(self):
        project, _first_deployment = self._make_project_with_deployment(Deployment.Status.COMPLETE)
        # A second, currently-failed deployment is the one recreate() would
        # normally act on — but project history includes a COMPLETE one.
        _project2, failed_deployment = project, Deployment.objects.create(
            project=project, canvas_version=_first_deployment.canvas_version,
            intent_record=_first_deployment.intent_record, aws_connection=_first_deployment.aws_connection,
            environment=Deployment.Environment.PRODUCTION, status=Deployment.Status.FAILED,
            cloudformation_template="Resources: {}\n",
        )
        with patch.object(deploy, "teardown") as mock_teardown, \
             patch.object(deploy, "start") as mock_start, \
             patch.object(deploy, "provision_with_feedback") as mock_provision:
            with self.assertRaises(deploy.DeployError):
                deploy.recreate(project)
        mock_teardown.assert_not_called()
        mock_start.assert_not_called()
        mock_provision.assert_not_called()

    def test_project_status_live_refuses_to_recreate_even_without_complete_deployment(self):
        project, deployment = self._make_project_with_deployment(Deployment.Status.FAILED)
        project.status = Project.Status.LIVE
        project.save(update_fields=["status"])
        with patch.object(deploy, "teardown") as mock_teardown, \
             patch.object(deploy, "start") as mock_start, \
             patch.object(deploy, "provision_with_feedback") as mock_provision:
            with self.assertRaises(deploy.DeployError):
                deploy.recreate(project)
        mock_teardown.assert_not_called()
        mock_start.assert_not_called()
        mock_provision.assert_not_called()

    @patch.object(deploy, "provision_with_feedback")
    @patch.object(deploy, "start")
    @patch.object(deploy, "_wait_stack_deleted")
    @patch.object(deploy, "teardown")
    def test_never_been_live_project_proceeds_through_teardown_and_start(
        self, mock_teardown, mock_wait, mock_start, mock_provision,
    ):
        project, deployment = self._make_project_with_deployment(
            Deployment.Status.FAILED, cloudformation_stack_id="arn:aws:cloudformation:...:stack/x/y",
        )
        with patch("app.provisioning.iac._spec_for", return_value={}), \
             patch("app.provisioning.iac._apply_enforcers", side_effect=lambda t, s: t):
            deploy.recreate(project)
        mock_teardown.assert_called_once()
        mock_wait.assert_called_once()
        mock_start.assert_called_once()
        mock_provision.assert_called_once()


class StartRetryOnRaceTests(_DeploymentFixtureMixin, TestCase):
    """Found live: delete_stack() is fire-and-forget, so a moments-later
    create_stack() can race it and fail with 'already exists' even though the
    delete is genuinely still in flight, not stuck."""

    def _ready(self):
        return self._make_project_with_deployment(Deployment.Status.IAC_READY)

    @patch("app.provisioning.deploy.time.sleep")
    @patch("app.provisioning.deploy.aws_client.create_stack")
    @patch("app.provisioning.deploy.aws_client.find_stack")
    @patch.object(deploy, "_assume")
    def test_retries_on_already_exists_then_succeeds(self, mock_assume, mock_find_stack, mock_create_stack, mock_sleep):
        project, deployment = self._ready()
        mock_assume.return_value = ({"AccessKeyId": "a", "SecretAccessKey": "b", "SessionToken": "c"}, "us-east-1")
        mock_find_stack.return_value = None
        mock_create_stack.side_effect = [_already_exists(), _already_exists(), "arn:aws:cloudformation:...:stack/x/y"]
        with patch("app.provisioning.iac._spec_for", return_value={}), \
             patch("app.provisioning.iac._collect_findings", return_value=[]):
            result = deploy.start(project)
        self.assertEqual(mock_create_stack.call_count, 3)
        self.assertEqual(mock_sleep.call_count, 2)
        deployment.refresh_from_db()
        self.assertEqual(deployment.status, Deployment.Status.IN_PROGRESS)
        self.assertEqual(result["status"], Deployment.Status.IN_PROGRESS)

    @patch("app.provisioning.deploy.time.sleep")
    @patch("app.provisioning.deploy.aws_client.create_stack")
    @patch("app.provisioning.deploy.aws_client.find_stack")
    @patch.object(deploy, "_assume")
    def test_persistent_already_exists_restores_iac_ready_for_another_try(
        self, mock_assume, mock_find_stack, mock_create_stack, mock_sleep,
    ):
        project, deployment = self._ready()
        mock_assume.return_value = ({"AccessKeyId": "a", "SecretAccessKey": "b", "SessionToken": "c"}, "us-east-1")
        mock_find_stack.return_value = None
        mock_create_stack.side_effect = _already_exists()
        with patch("app.provisioning.iac._spec_for", return_value={}), \
             patch("app.provisioning.iac._collect_findings", return_value=[]):
            with self.assertRaises(deploy.DeployError):
                deploy.start(project)
        self.assertEqual(mock_create_stack.call_count, 4)
        deployment.refresh_from_db()
        self.assertEqual(deployment.status, Deployment.Status.IAC_READY)

    @patch("app.provisioning.deploy.aws_client.create_stack")
    @patch("app.provisioning.deploy.aws_client.find_stack")
    @patch.object(deploy, "_assume")
    def test_non_race_client_error_is_not_retried(self, mock_assume, mock_find_stack, mock_create_stack):
        project, deployment = self._ready()
        mock_assume.return_value = ({"AccessKeyId": "a", "SecretAccessKey": "b", "SessionToken": "c"}, "us-east-1")
        mock_find_stack.return_value = None
        mock_create_stack.side_effect = ClientError(
            {"Error": {"Code": "ValidationError", "Message": "Template format error"}}, "CreateStack",
        )
        with patch("app.provisioning.iac._spec_for", return_value={}), \
             patch("app.provisioning.iac._collect_findings", return_value=[]):
            with self.assertRaises(deploy.DeployError):
                deploy.start(project)
        self.assertEqual(mock_create_stack.call_count, 1)


class EmptyUndeletableResourcesTests(SimpleTestCase):
    """CloudFormation refuses to delete a non-empty S3 bucket or ECR
    repository — found live: teardown hit DELETE_FAILED on both."""

    @mock_aws
    def test_empties_bucket_and_tolerates_a_failing_resource(self):
        creds = {"AccessKeyId": "a", "SecretAccessKey": "b", "SessionToken": "c"}
        region = "us-east-1"
        s3 = boto3.client("s3", region_name=region, aws_access_key_id="a", aws_secret_access_key="b")
        s3.create_bucket(Bucket="clyro-test-bucket")
        s3.put_object(Bucket="clyro-test-bucket", Key="file.txt", Body=b"hello")

        resources = [
            {"resource_type": "AWS::S3::Bucket", "physical_id": "clyro-test-bucket"},
            {"resource_type": "AWS::S3::Bucket", "physical_id": "clyro-bucket-does-not-exist"},
            {"resource_type": "AWS::ECR::Repository", "physical_id": None},
        ]
        with patch("app.provisioning.deploy.aws_client.list_stack_resources", return_value=resources):
            deploy._empty_undeletable_resources(creds, region, "clyro-test-stack")

        objects = s3.list_objects_v2(Bucket="clyro-test-bucket")
        self.assertNotIn("Contents", objects)


class PollRaceGuardTests(_DeploymentFixtureMixin, TestCase):
    """Found live testing the migration-failure path: a stale IN_PROGRESS read
    inside poll() could clobber a FAILED status written by a concurrent build
    task between poll()'s initial read and its status update."""

    @patch("app.provisioning.deploy.aws_client.describe_stack_events")
    @patch("app.provisioning.deploy.aws_client.describe_stack")
    @patch.object(deploy, "_assume")
    def test_concurrent_failed_write_is_not_clobbered_back_to_building(
        self, mock_assume, mock_describe_stack, mock_describe_events,
    ):
        project, deployment = self._make_project_with_deployment(
            Deployment.Status.IN_PROGRESS, cloudformation_stack_id="arn:...", cloudformation_stack_name="clyro-x",
        )
        mock_assume.return_value = ({"AccessKeyId": "a", "SecretAccessKey": "b", "SessionToken": "c"}, "us-east-1")
        mock_describe_events.return_value = []

        def _describe_stack_side_effect(creds, region, stack_name):
            # Simulate the build task (a separate Celery task/connection in
            # prod) writing FAILED in the window between poll()'s initial
            # fetch and its row-locked re-read.
            Deployment.objects.filter(pk=deployment.pk).update(status=Deployment.Status.FAILED)
            return {"status": "CREATE_COMPLETE", "outputs": []}

        mock_describe_stack.side_effect = _describe_stack_side_effect
        result = deploy.poll(project)

        deployment.refresh_from_db()
        self.assertEqual(deployment.status, Deployment.Status.FAILED)
        self.assertEqual(result["status"], Deployment.Status.FAILED)

    @patch("app.provisioning.deploy.aws_client.describe_stack_events")
    @patch("app.provisioning.deploy.aws_client.describe_stack")
    @patch.object(deploy, "_assume")
    def test_normal_case_still_flips_to_building(self, mock_assume, mock_describe_stack, mock_describe_events):
        project, deployment = self._make_project_with_deployment(
            Deployment.Status.IN_PROGRESS, cloudformation_stack_id="arn:...", cloudformation_stack_name="clyro-x",
        )
        mock_assume.return_value = ({"AccessKeyId": "a", "SecretAccessKey": "b", "SessionToken": "c"}, "us-east-1")
        mock_describe_events.return_value = []
        mock_describe_stack.return_value = {"status": "CREATE_COMPLETE", "outputs": []}

        result = deploy.poll(project)

        deployment.refresh_from_db()
        self.assertEqual(deployment.status, Deployment.Status.BUILDING)
        self.assertEqual(result["status"], Deployment.Status.BUILDING)


class UnsafeChangesTests(SimpleTestCase):
    """_apply_stack_update refuses any change that would replace or remove a
    stateful resource, so an in-place update can never silently drop data."""

    def test_rds_replacement_is_unsafe(self):
        changes = [{"resource_type": "AWS::RDS::DBInstance", "action": "Modify", "replacement": "True"}]
        unsafe = deploy._unsafe_changes(changes)
        self.assertEqual(len(unsafe), 1)

    def test_rds_removal_is_unsafe(self):
        changes = [{"resource_type": "AWS::RDS::DBInstance", "action": "Remove", "replacement": "False"}]
        unsafe = deploy._unsafe_changes(changes)
        self.assertEqual(len(unsafe), 1)

    def test_conditional_replacement_is_unsafe(self):
        changes = [{"resource_type": "AWS::S3::Bucket", "action": "Modify", "replacement": "Conditional"}]
        unsafe = deploy._unsafe_changes(changes)
        self.assertEqual(len(unsafe), 1)

    def test_stateless_resource_change_is_not_flagged(self):
        changes = [{"resource_type": "AWS::ECS::TaskDefinition", "action": "Modify", "replacement": "True"}]
        unsafe = deploy._unsafe_changes(changes)
        self.assertEqual(unsafe, [])

    def test_in_place_stateful_modify_is_safe(self):
        changes = [{"resource_type": "AWS::RDS::DBInstance", "action": "Modify", "replacement": "False"}]
        unsafe = deploy._unsafe_changes(changes)
        self.assertEqual(unsafe, [])

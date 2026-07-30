from unittest.mock import patch

from botocore.exceptions import ClientError
from cfnlint import api as cfnlint_api
from cfnlint.config import ManualArgs
from django.db.utils import IntegrityError
from django.test import SimpleTestCase, TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIRequestFactory, force_authenticate

from app import views as app_views
from app.provisioning import aws_client as aws_client_module
from app.provisioning import cfn_events, cfn_generator, deploy, iac
from app.provisioning import views as provisioning_views
from app.provisioning import reconcile
from app.scanner import classify, clyro_md, compliance
from canvas_core import canvas_builder, cost_engine
from core.models import (
    AgentJob, AWSAccountConnection, CanvasVersion, Deployment, EnvVarKey,
    GitHubInstallation, IntentRecord, Project, ProvisioningLogEntry, User,
)


def _spec(account_type="free_tier"):
    return {
        "project": "taskboard",
        "environment": "staging",
        "account_type": account_type,
        "naming_prefix": "taskboard-staging",
        "iam_scoped_prefix": "clyro-taskboard-staging",
        "short_prefix": "taskboard-staging",
        "region": "us-east-1",
        "networking": {
            "vpc_cidr": "10.0.0.0/16",
            "nat_gateway": account_type != "free_tier",
            "task_placement": "public" if account_type == "free_tier" else "private",
        },
        "resources": [
            {"node_id": "frontend", "type": "static", "build_path": "./frontend"},
            {
                "node_id": "backend", "type": "service", "image": "ecr",
                "container_port": 8000, "security_group": "backend-sg",
                "build_path": "./backend",
                "sizing": {"fargate_vcpu": 0.25, "fargate_gb": 0.5, "tasks": 1},
            },
            {
                "node_id": "worker", "type": "worker", "image": "ecr",
                "container_port": 8000, "security_group": "worker-sg",
                "build_path": "./backend",
                "sizing": {"fargate_vcpu": 0.25, "fargate_gb": 0.5, "tasks": 1},
            },
            {
                "node_id": "db", "type": "database", "aws_service": "rds_postgres",
                "security_group": "db-sg", "instance_class": "db.t3.micro",
                "multi_az": False,
            },
            {
                "node_id": "cache", "type": "cache", "aws_service": "elasticache",
                "security_group": "cache-sg", "node_class": "cache.t3.micro",
                "replicas": 0,
            },
            {"node_id": "queue", "type": "queue", "aws_service": "sqs"},
        ],
        "network_edges": [
            {
                "kind": "alb", "from": "frontend", "to": "backend",
                "alb_sg": "taskboard-staging-alb-sg", "target_sg": "backend-sg",
                "listener_port": 80, "redirect_http": False, "target_port": 8000,
                "description": "frontend -> backend",
            },
            {
                "kind": "sg_ingress", "from": "backend", "to": "db",
                "from_sg": "backend-sg", "to_sg": "db-sg", "port": 5432,
                "protocol": "tcp", "description": "backend -> db",
            },
            {
                "kind": "sg_ingress", "from": "worker", "to": "cache",
                "from_sg": "worker-sg", "to_sg": "cache-sg", "port": 6379,
                "protocol": "tcp", "description": "worker -> cache",
            },
        ],
        "health_check_path": "/health",
        "broker": {"transport": "redis"},
        "generated_env": [
            {"key_name": "DATABASE_URL"},
            {"key_name": "REDIS_URL"},
            {"key_name": "CELERY_BROKER_URL"},
            {"key_name": "AWS_S3_BUCKET_NAME"},
            {"key_name": "ALLOWED_HOSTS", "value": "*"},
        ],
        "secrets": [{
            "key_name": "SECRET_KEY",
            "secretsmanager_arn": "arn:aws:secretsmanager:us-east-1:123456789012:secret:clyro/test/SECRET_KEY-abc",
        }],
    }


class DeterministicCfnGeneratorTests(SimpleTestCase):
    def test_free_tier_template_lints_without_errors(self):
        template = cfn_generator.generate_template(_spec("free_tier"))
        matches = cfnlint_api.lint(template, config=ManualArgs(regions=["us-east-1"]))
        errors = [m for m in matches if m.rule.severity == "error"]
        self.assertEqual([], errors)
        self.assertIn("BackupRetentionPeriod: 1", template)
        self.assertIn("DesiredCount: 0", template)
        self.assertIn("HealthCheckPath: /health", template)
        self.assertIn("PathPattern: /api/*", template)
        self.assertIn("TargetOriginId: BackendAlbOrigin", template)
        self.assertNotIn("CELERY_BROKER_URL\n          Value: arn:aws:", template)

    def test_paid_template_uses_private_tasks_and_nat(self):
        template = cfn_generator.generate_template(_spec("paid"))
        matches = cfnlint_api.lint(template, config=ManualArgs(regions=["us-east-1"]))
        errors = [m for m in matches if m.rule.severity == "error"]
        self.assertEqual([], errors)
        self.assertIn("NatGateway:", template)
        self.assertIn("AssignPublicIp: DISABLED", template)
        self.assertIn("BackupRetentionPeriod: 7", template)


class CfnEventMappingTests(SimpleTestCase):
    def test_rollback_events_are_not_done(self):
        self.assertEqual("rolled_back", cfn_events.status_kind("DELETE_COMPLETE"))
        self.assertEqual("rolled_back", cfn_events.status_kind("ROLLBACK_IN_PROGRESS"))
        event = cfn_events.translate_event({
            "ResourceType": "AWS::RDS::DBInstance",
            "LogicalResourceId": "DbInstance",
            "ResourceStatus": "DELETE_COMPLETE",
            "Timestamp": "now",
            "EventId": "1",
        }, 7)
        self.assertEqual("rolled_back", event["status"])
        self.assertIn("removed", event["plain_message"])

    def test_stack_rolling_back_detection(self):
        self.assertTrue(cfn_events.is_rolling_back("ROLLBACK_IN_PROGRESS"))
        self.assertTrue(cfn_events.is_rolling_back("DELETE_IN_PROGRESS"))
        self.assertFalse(cfn_events.is_rolling_back("CREATE_COMPLETE"))

    def test_delete_failed_remains_failed(self):
        self.assertEqual("failed", cfn_events.status_kind("DELETE_FAILED"))


class _FakeGithubUtils:
    """Stub for the `github_utils` module passed into compliance check
    functions (dependency injection) — no real GitHub API calls needed."""

    def __init__(self, files: dict[str, str]):
        self._files = files

    def get_file_content(self, token, repo_full_name, path, branch):
        return self._files.get(path)


def _detected_resources(*, backend_framework="django", frontend=True, database=True, dockerfile=False):
    return {
        "services": {
            "backend": {"detected": True, "framework": backend_framework, "path": "backend", "dockerfile_found": dockerfile},
            "frontend": {"detected": frontend, "framework": "react", "path": "frontend"},
        },
        "infrastructure": {
            "database": {"detected": database},
        },
    }


class ComplianceChecksTests(SimpleTestCase):
    def test_workspace_monorepo_lockfile_at_root_passes(self):
        # frontend/package.json exists but the lockfile is committed at the repo
        # root (npm/pnpm workspaces) — must not be a false blocker.
        finding = compliance._check_frontend_lockfile("frontend", {"pnpm-lock.yaml", "frontend/package.json"})
        self.assertTrue(finding["passed"])

    def test_db_less_backend_not_flagged(self):
        tree = {"backend/manage.py", "backend/app/models.py", "backend/app/migrations/0001_initial.py"}
        with patch("app.github_utils.get_repo_tree", return_value=list(tree)):
            findings = compliance.run_compliance_checks(
                "token", "org/repo", "main",
                _detected_resources(database=False, frontend=False),
                env_vars=[],
            )
        self.assertNotIn("database_url_env", {f["id"] for f in findings})

    def test_database_detected_and_missing_env_is_flagged(self):
        tree = {"backend/manage.py", "backend/app/models.py", "backend/app/migrations/0001_initial.py"}
        with patch("app.github_utils.get_repo_tree", return_value=list(tree)):
            findings = compliance.run_compliance_checks(
                "token", "org/repo", "main",
                _detected_resources(database=True, frontend=False),
                env_vars=[],
            )
        db_finding = next(f for f in findings if f["id"] == "database_url_env")
        self.assertFalse(db_finding["passed"])

    def test_multi_stage_dockerfile_as_build_passes(self):
        dockerfile = "FROM node:20 AS build\nRUN npm run build\nFROM public.ecr.aws/docker/library/python:3.12-slim\nCOPY --from=build /app/dist ./dist\n"
        gh = _FakeGithubUtils({"backend/Dockerfile": dockerfile})
        finding = compliance._check_dockerfile_base_image(
            "token", "org/repo", "main", "backend", {"backend/Dockerfile"}, gh,
        )
        self.assertFalse(finding["passed"])  # node:20 is still a bare Docker Hub pull
        self.assertIn("node:20", finding["detail"])
        self.assertNotIn("python:3.12-slim", finding["detail"])  # the ECR-mirrored stage isn't flagged

    def test_dockerfile_stage_reference_not_flagged_as_bare_image(self):
        dockerfile = "FROM public.ecr.aws/docker/library/node:20 AS build\nRUN npm run build\nFROM build AS runtime\nCMD [\"node\", \"server.js\"]\n"
        gh = _FakeGithubUtils({"backend/Dockerfile": dockerfile})
        finding = compliance._check_dockerfile_base_image(
            "token", "org/repo", "main", "backend", {"backend/Dockerfile"}, gh,
        )
        self.assertTrue(finding["passed"])

    def test_models_package_form_detected(self):
        tree = {"backend/app/models/__init__.py", "backend/app/models/user.py"}
        finding = compliance._check_django_migrations("backend", tree)
        self.assertFalse(finding["passed"])
        self.assertIn("backend/app", finding["detail"])

    def test_models_package_form_with_migrations_passes(self):
        tree = {
            "backend/app/models/__init__.py", "backend/app/models/user.py",
            "backend/app/migrations/0001_initial.py",
        }
        finding = compliance._check_django_migrations("backend", tree)
        self.assertTrue(finding["passed"])

    def test_health_endpoint_ignores_bare_comment_mention(self):
        gh = _FakeGithubUtils({
            "backend/urls.py": '# health check documentation\nurlpatterns = [path("api/", include("api.urls"))]\n',
        })
        finding = compliance._check_health_endpoint(
            "token", "org/repo", "main", "backend", {"backend/urls.py"}, gh,
        )
        self.assertFalse(finding["passed"])

    def test_health_endpoint_detects_health_check_package_include(self):
        gh = _FakeGithubUtils({
            "backend/urls.py": 'urlpatterns = [path("ht/", include("health_check.urls"))]\n',
        })
        finding = compliance._check_health_endpoint(
            "token", "org/repo", "main", "backend", {"backend/urls.py"}, gh,
        )
        self.assertTrue(finding["passed"])

    def test_allowed_hosts_check_omitted_for_non_django_backend(self):
        tree = {"backend/package.json"}
        with patch("app.github_utils.get_repo_tree", return_value=list(tree)):
            findings = compliance.run_compliance_checks(
                "token", "org/repo", "main",
                _detected_resources(backend_framework="express", database=False, frontend=False),
                env_vars=[],
            )
        self.assertNotIn("allowed_hosts_env", {f["id"] for f in findings})
        self.assertNotIn("host_header_check", {f["id"] for f in findings})


class _FakeDeployment:
    """Duck-typed stand-in for Deployment — _deterministic_template_fix only
    reads/writes `cloudformation_template` and calls `.save(update_fields=...)`,
    so a real DB-backed model instance isn't needed."""

    def __init__(self, template):
        self.cloudformation_template = template
        self.saved = False

    def save(self, update_fields=None):
        self.saved = True


class DeterministicTemplateFixTests(SimpleTestCase):
    """Found live (2026-07-15 E2E run): a paid-tier spec deployed against an
    AWS account that AWS itself restricts to free-tier limits fails on BOTH
    BackupRetentionPeriod and DBInstanceClass in turn — but CloudFormation only
    reports one failure per attempt, and provision_with_feedback allows only
    one bounded auto-fix retry. Fixing only the reported error left the second
    one to exhaust that retry and fail the whole deploy. The fix normalizes
    both free-tier-sensitive RDS properties in one pass whichever error
    surfaces first."""

    _TEMPLATE = (
        "Resources:\n"
        "  DbInstance:\n"
        "    Properties:\n"
        "      BackupRetentionPeriod: 7\n"
        "      DBInstanceClass: db.t3.small\n"
    )

    def test_instance_class_error_fixes_both_properties(self):
        d = _FakeDeployment(self._TEMPLATE)
        changed = deploy._deterministic_template_fix(
            d, "This instance size isn't available with free plan accounts.",
        )
        self.assertTrue(changed)
        self.assertIn("DBInstanceClass: db.t3.micro", d.cloudformation_template)
        self.assertIn("BackupRetentionPeriod: 1", d.cloudformation_template)

    def test_backup_retention_error_fixes_both_properties(self):
        d = _FakeDeployment(self._TEMPLATE)
        changed = deploy._deterministic_template_fix(
            d, "backup retention period exceeds the maximum available to free tier customers",
        )
        self.assertTrue(changed)
        self.assertIn("DBInstanceClass: db.t3.micro", d.cloudformation_template)
        self.assertIn("BackupRetentionPeriod: 1", d.cloudformation_template)

    def test_unrelated_error_makes_no_change(self):
        d = _FakeDeployment(self._TEMPLATE)
        changed = deploy._deterministic_template_fix(d, "some unrelated CFN failure")
        self.assertFalse(changed)
        self.assertEqual(d.cloudformation_template, self._TEMPLATE)
        self.assertFalse(d.saved)


class RequiredSecretsCheckTests(TestCase):
    """Found live: a user_secret with no staged_value and no secrets_manager_arn
    is silently dropped from the generated spec — the customer's own container
    crashes mid-migration with a bare KeyError instead of Clyro catching it at
    the Validate gate."""

    def setUp(self):
        self.user = User.objects.create(
            cognito_sub="test-sub", email="test@example.com", name="Test User",
        )
        self.project = Project.objects.create(user=self.user, name="taskboard")

    def test_missing_user_secret_is_a_blocker(self):
        EnvVarKey.objects.create(
            project=self.project, key_name="SECRET_KEY", classification="user_secret",
        )
        findings = iac.check_required_secrets_present(self.project)
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0]["severity"], "blocker")
        self.assertIn("SECRET_KEY", findings[0]["message"])

    def test_staged_value_satisfies_the_check(self):
        EnvVarKey.objects.create(
            project=self.project, key_name="SECRET_KEY", classification="user_secret",
            staged_value="already-staged-in-step-1",
        )
        self.assertEqual(iac.check_required_secrets_present(self.project), [])

    def test_secrets_manager_arn_satisfies_the_check(self):
        EnvVarKey.objects.create(
            project=self.project, key_name="SECRET_KEY", classification="user_secret",
            secrets_manager_arn="arn:aws:secretsmanager:us-east-1:123:secret:foo",
        )
        self.assertEqual(iac.check_required_secrets_present(self.project), [])

    def test_generated_and_optional_vars_are_never_flagged(self):
        EnvVarKey.objects.create(
            project=self.project, key_name="DJANGO_SETTINGS_MODULE", classification="generated",
        )
        EnvVarKey.objects.create(
            project=self.project, key_name="DEBUG", classification="optional",
        )
        self.assertEqual(iac.check_required_secrets_present(self.project), [])

    def test_inactive_secret_is_not_flagged(self):
        EnvVarKey.objects.create(
            project=self.project, key_name="OLD_KEY", classification="user_secret",
            is_active=False,
        )
        self.assertEqual(iac.check_required_secrets_present(self.project), [])


class GithubInstallationOwnershipTests(TestCase):
    """Found live: github_installations' POST handler keyed its update_or_create
    only on GitHub's installation_id, so any authenticated user who learned
    another org's installation_id could silently reassign (steal) it."""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.user_a = User.objects.create(cognito_sub="sub-a", email="a@example.com", name="A")
        self.user_b = User.objects.create(cognito_sub="sub-b", email="b@example.com", name="B")

    def _post(self, user, installation_id):
        request = self.factory.post('/api/github/installations/', {'installation_id': installation_id})
        force_authenticate(request, user=user)
        return app_views.github_installations(request)

    @patch('app.views.github_utils.get_installation_info')
    def test_second_user_cannot_steal_existing_installation(self, mock_info):
        mock_info.return_value = {
            'account': {'login': 'acme', 'type': 'Organization', 'avatar_url': ''},
            'app_id': 1,
        }
        # user_a connects installation 555 first.
        resp_a = self._post(self.user_a, 555)
        self.assertEqual(resp_a.status_code, status.HTTP_201_CREATED)

        # user_b then tries to claim the same installation_id.
        resp_b = self._post(self.user_b, 555)
        self.assertEqual(resp_b.status_code, status.HTTP_403_FORBIDDEN)

        installation = GitHubInstallation.objects.get(installation_id=555)
        self.assertEqual(installation.user_id, self.user_a.id)

    @patch('app.views.github_utils.get_installation_info')
    def test_owner_can_update_their_own_installation(self, mock_info):
        mock_info.return_value = {
            'account': {'login': 'acme', 'type': 'Organization', 'avatar_url': ''},
            'app_id': 1,
        }
        resp_1 = self._post(self.user_a, 555)
        self.assertEqual(resp_1.status_code, status.HTTP_201_CREATED)
        resp_2 = self._post(self.user_a, 555)
        self.assertEqual(resp_2.status_code, status.HTTP_201_CREATED)
        self.assertEqual(GitHubInstallation.objects.filter(installation_id=555).count(), 1)


class IacGenerateDedupTests(TestCase):
    """Found live: a React StrictMode double-effect (or a double-click) firing
    iac_generate twice in quick succession let the second call's DB read race
    the first call's in-flight update, baking a stale free-tier network config
    into the generated template. Two rapid requests must share one AgentJob."""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = User.objects.create(cognito_sub="sub-c", email="c@example.com", name="C")
        self.project = Project.objects.create(user=self.user, name="taskboard")

    @patch('app.provisioning.views.tasks.run_iac_generate_task.delay')
    def test_two_rapid_calls_share_one_job(self, mock_delay):
        request_1 = self.factory.post(f'/api/projects/{self.project.id}/iac/generate/', {})
        force_authenticate(request_1, user=self.user)
        resp_1 = provisioning_views.iac_generate(request_1, str(self.project.id))
        self.assertEqual(resp_1.status_code, status.HTTP_202_ACCEPTED)

        request_2 = self.factory.post(f'/api/projects/{self.project.id}/iac/generate/', {})
        force_authenticate(request_2, user=self.user)
        resp_2 = provisioning_views.iac_generate(request_2, str(self.project.id))
        self.assertEqual(resp_2.status_code, status.HTTP_202_ACCEPTED)

        self.assertEqual(resp_1.data['job_id'], resp_2.data['job_id'])
        self.assertEqual(mock_delay.call_count, 1)
        self.assertEqual(
            AgentJob.objects.filter(project=self.project, kind=AgentJob.Kind.IAC_GENERATE).count(), 1,
        )

    @patch('app.provisioning.views.tasks.run_iac_generate_task.delay')
    def test_new_call_after_completion_starts_a_fresh_job(self, mock_delay):
        request_1 = self.factory.post(f'/api/projects/{self.project.id}/iac/generate/', {})
        force_authenticate(request_1, user=self.user)
        resp_1 = provisioning_views.iac_generate(request_1, str(self.project.id))
        AgentJob.objects.filter(id=resp_1.data['job_id']).update(status=AgentJob.Status.DONE)

        request_2 = self.factory.post(f'/api/projects/{self.project.id}/iac/generate/', {})
        force_authenticate(request_2, user=self.user)
        resp_2 = provisioning_views.iac_generate(request_2, str(self.project.id))

        self.assertNotEqual(resp_1.data['job_id'], resp_2.data['job_id'])
        self.assertEqual(mock_delay.call_count, 2)


class FreeTierCostEngineTests(SimpleTestCase):
    """AWSAccountConnection.verified_account_type is known before Step 4/5 runs,
    but estimate_cost had no concept of it at all — every line item was priced
    as if fully billed, even for a free-tier-eligible RDS single-AZ micro
    instance. ECS Fargate / ElastiCache have no AWS free tier and must never
    be zeroed just because the account happens to be free-tier."""

    def _canvas(self):
        return {
            "nodes": [
                {"id": "db", "type": "database", "aws_service": "rds_postgres"},
                {"id": "cache", "type": "cache", "aws_service": "elasticache"},
            ],
            "connections": [],
        }

    def test_free_tier_zeroes_eligible_rds_micro(self):
        intent = {"scale": "solo", "criticality": "low", "environment": "staging"}
        estimate = cost_engine.estimate_cost(self._canvas(), intent, account_type="free_tier")
        db_item = next(i for i in estimate["line_items"] if i["node_id"] == "db")
        self.assertEqual(db_item["monthly"], 0)

    def test_free_tier_does_not_zero_elasticache(self):
        intent = {"scale": "solo", "criticality": "low", "environment": "staging"}
        estimate = cost_engine.estimate_cost(self._canvas(), intent, account_type="free_tier")
        cache_item = next(i for i in estimate["line_items"] if i["node_id"] == "cache")
        self.assertGreater(cache_item["monthly"], 0)

    def test_free_tier_does_not_zero_larger_rds_instance(self):
        # "medium" sizes to db.t3.medium, not a *.micro class — not free-tier eligible.
        intent = {"scale": "medium", "criticality": "low", "environment": "staging"}
        estimate = cost_engine.estimate_cost(self._canvas(), intent, account_type="free_tier")
        db_item = next(i for i in estimate["line_items"] if i["node_id"] == "db")
        self.assertGreater(db_item["monthly"], 0)

    def test_multi_az_disqualifies_free_tier(self):
        intent = {"scale": "solo", "criticality": "high", "environment": "production"}
        estimate = cost_engine.estimate_cost(self._canvas(), intent, account_type="free_tier")
        db_item = next(i for i in estimate["line_items"] if i["node_id"] == "db")
        self.assertGreater(db_item["monthly"], 0)

    def test_paid_account_prices_everything_normally(self):
        intent = {"scale": "solo", "criticality": "low", "environment": "staging"}
        estimate = cost_engine.estimate_cost(self._canvas(), intent, account_type="paid")
        db_item = next(i for i in estimate["line_items"] if i["node_id"] == "db")
        self.assertGreater(db_item["monthly"], 0)
        self.assertIn("Free tier not applied", estimate["assumptions"])


def _detection_with(**infra_overrides):
    detected = {
        "services": {
            "backend": {"detected": True, "framework": "django", "path": "."},
            "worker": {"detected": True, "type": "celery"},
        },
        "infrastructure": {
            "database": {"detected": True, "engine": "postgres"},
        },
    }
    detected["infrastructure"].update(infra_overrides)
    return detected


class CanvasBuilderBrokerAndStorageTests(SimpleTestCase):
    def test_storage_node_created_when_detected(self):
        detected = _detection_with(storage={"detected": True, "type": "s3"})
        canvas = canvas_builder.build_canvas_from_detection(detected, {})
        node_ids = {n["id"] for n in canvas["nodes"]}
        self.assertIn("storage", node_ids)
        storage_node = next(n for n in canvas["nodes"] if n["id"] == "storage")
        self.assertEqual(storage_node["aws_service"], "s3")
        self.assertIn({"from": "backend", "to": "storage", "label": "reads/writes"}, canvas["connections"])

    def test_no_storage_node_when_not_detected(self):
        detected = _detection_with(storage={"detected": False})
        canvas = canvas_builder.build_canvas_from_detection(detected, {})
        node_ids = {n["id"] for n in canvas["nodes"]}
        self.assertNotIn("storage", node_ids)

    def test_redis_broker_does_not_create_a_queue_node(self):
        detected = _detection_with(
            cache={"detected": True, "engine": "redis"},
            queue={"detected": True, "type": "sqs"},  # stale flag from an old-schema scan
        )
        detected["services"]["worker"]["broker"] = "redis"
        canvas = canvas_builder.build_canvas_from_detection(detected, {})
        node_ids = {n["id"] for n in canvas["nodes"]}
        self.assertIn("cache", node_ids)
        self.assertNotIn("queue", node_ids)

    def test_sqs_broker_creates_a_queue_node(self):
        detected = _detection_with(queue={"detected": True, "type": "sqs"})
        detected["services"]["worker"]["broker"] = "sqs"
        canvas = canvas_builder.build_canvas_from_detection(detected, {})
        node_ids = {n["id"] for n in canvas["nodes"]}
        self.assertIn("queue", node_ids)

    def test_missing_broker_field_falls_back_to_queue_flag(self):
        # Specs from before the `broker` field existed — no worker.broker key at all.
        detected = _detection_with(queue={"detected": True, "type": "sqs"})
        canvas = canvas_builder.build_canvas_from_detection(detected, {})
        node_ids = {n["id"] for n in canvas["nodes"]}
        self.assertIn("queue", node_ids)


class WarmupDispatchTests(TestCase):
    """Step 1/3 had no warmup at all — only Step 4/5's IacArchitect runtime did
    — so both paid the full ~17s AgentCore cold start every time."""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = User.objects.create(cognito_sub="sub-w", email="w@example.com", name="W")

    @patch('app.views.tasks.run_warmup_task.delay')
    def test_wizard_state_does_not_warm_on_step_one(self, mock_delay):
        """Step 1 has no agent left to warm — it ingests CLYRO.md from the repo."""
        project = Project.objects.create(user=self.user, name="taskboard")
        request = self.factory.get(f'/api/projects/{project.id}/wizard-state/')
        force_authenticate(request, user=self.user)
        app_views.wizard_state(request, str(project.id))
        mock_delay.assert_not_called()

    @patch('app.views.tasks.run_warmup_task.delay')
    def test_save_intent_warms_reasoning_runtime(self, mock_delay):
        project = Project.objects.create(user=self.user, name="taskboard")
        request = self.factory.post(f'/api/projects/{project.id}/intent/', {
            'scale': 'small', 'criticality': 'low', 'environment': 'staging',
        })
        force_authenticate(request, user=self.user)
        app_views.save_intent(request, str(project.id))
        mock_delay.assert_called_once_with(str(project.id), "REASONING_RUNTIME_ARN")


def _spec_with_domain(hosted_zone_id=None):
    import copy
    spec = copy.deepcopy(_spec("paid"))
    spec["domain"] = {
        "has_domain": True, "domain_name": "app.example.com",
        "acm": True, "hosted_zone_id": hosted_zone_id, "hosted_zone_name": "example.com",
    }
    alb_edge = next(e for e in spec["network_edges"] if e["kind"] == "alb")
    alb_edge["listener_port"] = 443
    alb_edge["redirect_http"] = True
    return spec


class DomainAcmHttpsTests(SimpleTestCase):
    def test_no_domain_keeps_single_http_listener(self):
        template = cfn_generator.generate_template(_spec("paid"))
        self.assertIn("AlbListener", template)
        self.assertNotIn("AlbHttpRedirectListener", template)
        self.assertNotIn("DomainCertificate", template)
        matches = cfnlint_api.lint(template, config=ManualArgs(regions=["us-east-1"]))
        self.assertEqual([], [m for m in matches if m.rule.severity == "error"])

    def test_domain_adds_https_listener_cert_and_redirect(self):
        template = cfn_generator.generate_template(_spec_with_domain())
        self.assertIn("DomainCertificate", template)
        self.assertIn("DomainRecordSet", template)
        self.assertIn("AlbHttpRedirectListener", template)
        self.assertIn("Protocol: HTTPS", template)
        self.assertIn("DomainHostedZoneId:", template)  # Parameters section
        matches = cfnlint_api.lint(template, config=ManualArgs(regions=["us-east-1"]))
        errors = [m for m in matches if m.rule.severity == "error"]
        self.assertEqual([], errors)

    def test_add_domain_resources_returns_none_without_domain(self):
        resources = {}
        cert_id = cfn_generator._add_domain_resources(resources, _spec("paid"))
        self.assertIsNone(cert_id)
        self.assertEqual(resources, {})

    def test_add_domain_resources_shape(self):
        resources = {}
        cert_id = cfn_generator._add_domain_resources(resources, _spec_with_domain())
        self.assertEqual(cert_id, "DomainCertificate")
        self.assertEqual(resources["DomainCertificate"]["Type"], "AWS::CertificateManager::Certificate")
        self.assertEqual(resources["DomainRecordSet"]["Type"], "AWS::Route53::RecordSet")
        self.assertEqual(resources["DomainRecordSet"]["Properties"]["HostedZoneName"], "example.com.")


class FindHostedZoneIdTests(SimpleTestCase):
    def _paginator_stub(self, zones):
        class _Paginator:
            def paginate(self):
                yield {"HostedZones": zones}

        class _Route53:
            def get_paginator(self, name):
                assert name == "list_hosted_zones"
                return _Paginator()

        return _Route53()

    @patch('app.provisioning.aws_client.boto3.client')
    def test_finds_matching_zone(self, mock_boto_client):
        mock_boto_client.return_value = self._paginator_stub([
            {"Id": "/hostedzone/Z1OTHER", "Name": "other.com."},
            {"Id": "/hostedzone/Z2MATCH", "Name": "example.com."},
        ])
        creds = {"AccessKeyId": "a", "SecretAccessKey": "b", "SessionToken": "c"}
        result = aws_client_module.find_hosted_zone_id(creds, "us-east-1", "example.com")
        self.assertEqual(result, "Z2MATCH")

    @patch('app.provisioning.aws_client.boto3.client')
    def test_returns_none_when_no_match(self, mock_boto_client):
        mock_boto_client.return_value = self._paginator_stub([{"Id": "/hostedzone/Z1OTHER", "Name": "other.com."}])
        creds = {"AccessKeyId": "a", "SecretAccessKey": "b", "SessionToken": "c"}
        result = aws_client_module.find_hosted_zone_id(creds, "us-east-1", "example.com")
        self.assertIsNone(result)


def _access_denied():
    return ClientError({"Error": {"Code": "AccessDenied", "Message": "denied"}}, "AssumeRole")


class ReconcileConnectionSweepTests(TestCase):
    """Found live: 12 AWSAccountConnection rows pointed at nonexistent IAM
    roles with nothing proactively catching it — health_status stayed
    'unknown' forever until the user's next action reactively surfaced it."""

    def setUp(self):
        self.user = User.objects.create(cognito_sub="sub-r", email="r@example.com", name="R")
        self.project = Project.objects.create(user=self.user, name="taskboard")

    def _connection(self, **kwargs):
        defaults = dict(
            project=self.project, aws_account_id="123456789012", iam_role_arn="arn:aws:iam::123:role/clyro",
            bootstrap_stack_id="clyro-bootstrap", connected_at=timezone.now(),
        )
        defaults.update(kwargs)
        return AWSAccountConnection.objects.create(**defaults)

    @patch('app.provisioning.reconcile.aws_client.assume_role')
    def test_dead_connection_flips_to_unreachable(self, mock_assume):
        mock_assume.side_effect = _access_denied()
        conn = self._connection()
        counts = reconcile.sweep()
        conn.refresh_from_db()
        self.assertEqual(conn.health_status, AWSAccountConnection.HealthStatus.UNREACHABLE)
        self.assertIsNotNone(conn.last_reconciled_at)
        self.assertEqual(counts["connections_checked"], 1)
        self.assertEqual(counts["connections_marked_dead"], 1)

    @patch('app.provisioning.reconcile.aws_client.assume_role')
    def test_healthy_connection_flips_to_healthy(self, mock_assume):
        mock_assume.return_value = {"AccessKeyId": "a", "SecretAccessKey": "b", "SessionToken": "c"}
        conn = self._connection()
        reconcile.sweep()
        conn.refresh_from_db()
        self.assertEqual(conn.health_status, AWSAccountConnection.HealthStatus.HEALTHY)

    @patch('app.provisioning.reconcile.aws_client.assume_role')
    def test_recently_reconciled_connection_is_skipped(self, mock_assume):
        conn = self._connection(last_reconciled_at=timezone.now())
        counts = reconcile.sweep()
        mock_assume.assert_not_called()
        self.assertEqual(counts["connections_checked"], 0)

    @patch('app.provisioning.reconcile.aws_client.assume_role')
    def test_transient_error_leaves_health_status_untouched(self, mock_assume):
        mock_assume.side_effect = ClientError(
            {"Error": {"Code": "Throttling", "Message": "slow down"}}, "AssumeRole",
        )
        conn = self._connection()
        reconcile.sweep()
        conn.refresh_from_db()
        self.assertEqual(conn.health_status, AWSAccountConnection.HealthStatus.UNKNOWN)
        self.assertIsNone(conn.last_reconciled_at)


class ReconcileStuckDeletionTests(TestCase):
    """Found live: 3 Deployment rows stuck in status='deleting' forever since
    teardown()'s first step (_assume()) always fails for a dead connection, so
    poll()'s DELETING -> DELETED transition never got a chance to run."""

    def setUp(self):
        self.user = User.objects.create(cognito_sub="sub-s", email="s@example.com", name="S")
        self.project = Project.objects.create(user=self.user, name="taskboard")
        self.connection = AWSAccountConnection.objects.create(
            project=self.project, aws_account_id="123456789012", iam_role_arn="arn:aws:iam::123:role/clyro",
            bootstrap_stack_id="clyro-bootstrap", connected_at=timezone.now(),
        )
        self.intent = IntentRecord.objects.create(project=self.project)
        self.canvas = CanvasVersion.objects.create(
            project=self.project, intent_record=self.intent, version_number=1,
            canvas_yaml="version: 1\nnodes: []\nconnections: []\n", canvas_snapshot={},
        )

    def _stuck_deployment(self):
        return Deployment.objects.create(
            project=self.project, canvas_version=self.canvas, intent_record=self.intent,
            aws_connection=self.connection, environment=Deployment.Environment.PRODUCTION,
            status=Deployment.Status.DELETING, cloudformation_stack_name="clyro-taskboard-production",
        )

    @patch('app.provisioning.reconcile.aws_client.find_stack')
    @patch('app.provisioning.reconcile.aws_client.assume_role')
    def test_resolves_to_deleted_when_connection_healthy_and_stack_gone(self, mock_assume, mock_find_stack):
        mock_assume.return_value = {"AccessKeyId": "a", "SecretAccessKey": "b", "SessionToken": "c"}
        mock_find_stack.return_value = None
        deployment = self._stuck_deployment()
        counts = reconcile.sweep()
        deployment.refresh_from_db()
        self.project.refresh_from_db()
        self.assertEqual(deployment.status, Deployment.Status.DELETED)
        self.assertEqual(self.project.status, Project.Status.DELETED)
        self.assertEqual(counts["deployments_resolved"], 1)

    @patch('app.provisioning.reconcile.aws_client.find_stack')
    @patch('app.provisioning.reconcile.aws_client.assume_role')
    def test_still_deleting_when_stack_still_exists(self, mock_assume, mock_find_stack):
        mock_assume.return_value = {"AccessKeyId": "a", "SecretAccessKey": "b", "SessionToken": "c"}
        mock_find_stack.return_value = "DELETE_IN_PROGRESS"
        deployment = self._stuck_deployment()
        counts = reconcile.sweep()
        deployment.refresh_from_db()
        self.assertEqual(deployment.status, Deployment.Status.DELETING)
        self.assertEqual(counts["deployments_resolved"], 0)

    @patch('app.provisioning.reconcile.aws_client.assume_role')
    def test_dead_connection_flips_to_failed_not_falsely_deleted(self, mock_assume):
        mock_assume.side_effect = _access_denied()
        deployment = self._stuck_deployment()
        counts = reconcile.sweep()
        deployment.refresh_from_db()
        self.assertEqual(deployment.status, Deployment.Status.FAILED)
        self.assertEqual(counts["deployments_resolved"], 1)
        entry = ProvisioningLogEntry.objects.get(deployment=deployment)
        self.assertIn("reconnect your AWS account", entry.plain_message)

    @patch('app.provisioning.reconcile.aws_client.delete_stack')
    @patch('app.provisioning.reconcile.aws_client.find_stack')
    @patch('app.provisioning.reconcile.aws_client.assume_role')
    def test_finishes_full_purge_when_delete_job_was_cut_off(
        self, mock_assume, mock_find_stack, mock_delete_stack,
    ):
        # A run_delete_project_task that timed out mid-teardown: the stack
        # actually finished deleting in AWS, but the task's own poll gave up
        # first and marked the AgentJob/project FAILED. Reconcile must finish
        # the purge (project row gone), not just re-flag it as 'deleted'.
        # reconcile.aws_client and deploy.aws_client are the same imported
        # module object, so one set of patches covers both call sites.
        mock_assume.return_value = {"AccessKeyId": "a", "SecretAccessKey": "b", "SessionToken": "c"}
        mock_find_stack.return_value = None
        deployment = self._stuck_deployment()
        project_id = self.project.id
        AgentJob.objects.create(project=self.project, kind=AgentJob.Kind.DELETE, status=AgentJob.Status.FAILED)

        counts = reconcile.sweep()

        self.assertEqual(counts["deployments_resolved"], 1)
        self.assertFalse(Project.objects.filter(id=project_id).exists())
        self.assertFalse(Deployment.objects.filter(id=deployment.id).exists())


class DeployLifecycleTests(TestCase):
    """deploy.py had near-zero test coverage despite being the highest-consequence
    backend file (submits/deletes real customer AWS stacks) — covers _assume's
    error branching and the teardown/poll/health lifecycle transitions."""

    def setUp(self):
        self.user = User.objects.create(cognito_sub="sub-d", email="d@example.com", name="D")
        self.project = Project.objects.create(user=self.user, name="taskboard")
        self.connection = AWSAccountConnection.objects.create(
            project=self.project, aws_account_id="123456789012", iam_role_arn="arn:aws:iam::123:role/clyro",
            bootstrap_stack_id="clyro-bootstrap", connected_at=timezone.now(),
        )
        self.intent = IntentRecord.objects.create(project=self.project)
        self.canvas = CanvasVersion.objects.create(
            project=self.project, intent_record=self.intent, version_number=1,
            canvas_yaml="version: 1\nnodes: []\nconnections: []\n", canvas_snapshot={},
        )

    def _deployment(self, **kwargs):
        defaults = dict(
            project=self.project, canvas_version=self.canvas, intent_record=self.intent,
            aws_connection=self.connection, environment=Deployment.Environment.PRODUCTION,
            status=Deployment.Status.COMPLETE, cloudformation_stack_name="clyro-taskboard-production",
            cloudformation_stack_id="arn:aws:cloudformation:us-east-1:123:stack/clyro-taskboard-production/abc",
        )
        defaults.update(kwargs)
        return Deployment.objects.create(**defaults)

    # ── _assume ──────────────────────────────────────────────────────────────

    @patch('app.provisioning.deploy.aws_client.assume_role')
    def test_assume_access_denied_raises_reconnect_error(self, mock_assume):
        mock_assume.side_effect = _access_denied()
        deployment = self._deployment()
        with self.assertRaisesMessage(deploy.DeployError, "reconnect your AWS account"):
            deploy._assume(deployment)

    @patch('app.provisioning.deploy.aws_client.assume_role')
    def test_assume_other_client_error_raises_generic_error(self, mock_assume):
        mock_assume.side_effect = ClientError(
            {"Error": {"Code": "Throttling", "Message": "slow down"}}, "AssumeRole",
        )
        deployment = self._deployment()
        with self.assertRaisesMessage(deploy.DeployError, "slow down"):
            deploy._assume(deployment)

    @patch('app.provisioning.deploy.aws_client.assume_role')
    def test_assume_success_returns_creds_and_region(self, mock_assume):
        mock_assume.return_value = {"AccessKeyId": "a", "SecretAccessKey": "b", "SessionToken": "c"}
        deployment = self._deployment()
        creds, region = deploy._assume(deployment)
        self.assertEqual(creds["AccessKeyId"], "a")
        self.assertEqual(region, self.connection.aws_region or "us-east-1")

    def test_assume_with_no_connection_raises(self):
        deployment = self._deployment(aws_connection=None)
        with self.assertRaisesMessage(deploy.DeployError, "Connect your AWS account"):
            deploy._assume(deployment)

    # ── teardown ─────────────────────────────────────────────────────────────

    @patch('app.provisioning.deploy.aws_client.delete_stack')
    @patch('app.provisioning.deploy.aws_client.list_stack_resources')
    @patch('app.provisioning.deploy.aws_client.assume_role')
    def test_teardown_deletes_stack_and_sets_deleting(self, mock_assume, mock_list_resources, mock_delete):
        mock_assume.return_value = {"AccessKeyId": "a", "SecretAccessKey": "b", "SessionToken": "c"}
        mock_list_resources.return_value = []
        deployment = self._deployment()
        result = deploy.teardown(self.project)
        deployment.refresh_from_db()
        mock_delete.assert_called_once()
        self.assertEqual(deployment.status, Deployment.Status.DELETING)
        self.assertEqual(result["status"], Deployment.Status.DELETING)

    @patch('app.provisioning.deploy.aws_client.delete_stack')
    @patch('app.provisioning.deploy.aws_client.assume_role')
    def test_teardown_with_dead_connection_never_calls_delete_stack(self, mock_assume, mock_delete):
        mock_assume.side_effect = _access_denied()
        self._deployment()
        with self.assertRaises(deploy.DeployError):
            deploy.teardown(self.project)
        mock_delete.assert_not_called()

    def test_teardown_already_deleting_is_a_no_op(self):
        deployment = self._deployment(status=Deployment.Status.DELETING)
        result = deploy.teardown(self.project)
        self.assertEqual(result["status"], Deployment.Status.DELETING)

    def test_teardown_with_no_active_deployment_raises(self):
        with self.assertRaisesMessage(deploy.DeployError, "No provisioned infrastructure"):
            deploy.teardown(self.project)

    # ── poll ─────────────────────────────────────────────────────────────────

    @patch('app.provisioning.deploy.aws_client.describe_stack_events')
    @patch('app.provisioning.deploy.aws_client.describe_stack')
    @patch('app.provisioning.deploy.aws_client.assume_role')
    def test_poll_deleting_to_deleted_when_stack_gone(self, mock_assume, mock_describe, mock_events):
        mock_assume.return_value = {"AccessKeyId": "a", "SecretAccessKey": "b", "SessionToken": "c"}
        mock_describe.side_effect = ClientError(
            {"Error": {"Code": "ValidationError", "Message": "Stack does not exist"}}, "DescribeStacks",
        )
        deployment = self._deployment(status=Deployment.Status.DELETING)
        result = deploy.poll(self.project)
        deployment.refresh_from_db()
        self.project.refresh_from_db()
        self.assertEqual(deployment.status, Deployment.Status.DELETED)
        self.assertEqual(self.project.status, Project.Status.DELETED)
        self.assertEqual(result["status"], Deployment.Status.DELETED)

    @patch('app.provisioning.deploy.aws_client.describe_stack_events')
    @patch('app.provisioning.deploy.aws_client.describe_stack')
    @patch('app.provisioning.deploy.aws_client.assume_role')
    def test_poll_non_terminal_status_leaves_deployment_unchanged(self, mock_assume, mock_describe, mock_events):
        mock_assume.return_value = {"AccessKeyId": "a", "SecretAccessKey": "b", "SessionToken": "c"}
        mock_describe.return_value = {"status": "CREATE_IN_PROGRESS", "outputs": []}
        mock_events.return_value = []
        deployment = self._deployment(status=Deployment.Status.SUBMITTING)
        deployment.cloudformation_stack_name = "clyro-taskboard-production"
        deployment.save(update_fields=["cloudformation_stack_name"])
        result = deploy.poll(self.project)
        deployment.refresh_from_db()
        self.assertEqual(deployment.status, Deployment.Status.IN_PROGRESS)
        self.assertEqual(result["status"], Deployment.Status.IN_PROGRESS)

    def test_poll_with_no_active_deployment_raises(self):
        with self.assertRaisesMessage(deploy.DeployError, "No active deployment"):
            deploy.poll(self.project)

    # ── health ───────────────────────────────────────────────────────────────

    @patch('app.provisioning.deploy.aws_client.list_stack_resources')
    @patch('app.provisioning.deploy.aws_client.assume_role')
    def test_health_stack_not_found_returns_not_found_status(self, mock_assume, mock_list_resources):
        mock_assume.return_value = {"AccessKeyId": "a", "SecretAccessKey": "b", "SessionToken": "c"}
        mock_list_resources.side_effect = ClientError(
            {"Error": {"Code": "ValidationError", "Message": "Stack does not exist"}}, "ListStackResources",
        )
        deployment = self._deployment()
        result = deploy.health(self.project)
        self.assertEqual(result["stack_status"], "not_found")
        self.assertEqual(result["health_items"], [])

    def test_health_with_no_active_deployment_raises(self):
        with self.assertRaisesMessage(deploy.DeployError, "No provisioned infrastructure"):
            deploy.health(self.project)

    # ── _has_been_live ───────────────────────────────────────────────────────

    def test_has_been_live_true_for_live_project(self):
        self.project.status = Project.Status.LIVE
        self.project.save(update_fields=["status"])
        self.assertTrue(deploy._has_been_live(self.project))

    def test_has_been_live_true_for_completed_deployment(self):
        self._deployment(status=Deployment.Status.COMPLETE)
        self.assertTrue(deploy._has_been_live(self.project))

    def test_has_been_live_false_for_never_live_project(self):
        self._deployment(status=Deployment.Status.FAILED)
        self.assertFalse(deploy._has_been_live(self.project))


class AwsConnectionInitDuplicateTests(TestCase):
    """Found live: Step 2 fires aws_connection_init twice on mount (React
    StrictMode double-invokes the effect in dev), and the endpoint's
    look-then-create ran unserialized — the project ended up with two pending
    connections holding two different external ids. The CFN link came from one
    row, aws_connection_verify read the other, and the user got a permanent
    "could not assume role" against a stack that was perfectly valid."""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = User.objects.create(cognito_sub="sub-i", email="i@example.com", name="I")
        self.project = Project.objects.create(user=self.user, name="newp1")

    def _init(self):
        request = self.factory.post(f'/api/projects/{self.project.pk}/aws-connection/', {})
        force_authenticate(request, user=self.user)
        return provisioning_views.aws_connection_init(request, self.project.pk)

    def test_repeated_init_reuses_one_pending_connection(self):
        first = self._init()
        second = self._init()

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data['external_id'], second.data['external_id'])
        self.assertEqual(
            AWSAccountConnection.objects.filter(project=self.project, connected_at__isnull=True).count(), 1,
        )

    def test_second_pending_connection_is_rejected_by_the_database(self):
        # The lock in aws_connection_init is what prevents this in practice; the
        # constraint is the backstop that stops any other caller reintroducing it.
        self._init()
        with self.assertRaises(IntegrityError):
            AWSAccountConnection.objects.create(
                project=self.project, aws_account_id='pending', iam_role_arn='pending',
                bootstrap_stack_id='some-other-external-id',
            )


class AwsConnectionVerifyArnMatchTests(TestCase):
    """The pasted ARN carries the external id its stack was built with
    (bootstrap.yaml names the role clyro-provisioning-{ExternalId}), so verify
    resolves the connection from the ARN rather than assuming the newest pending
    row is the right one."""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = User.objects.create(cognito_sub="sub-v", email="v@example.com", name="V")
        self.project = Project.objects.create(user=self.user, name="newp1")

    def _pending(self, external_id):
        return AWSAccountConnection.objects.create(
            project=self.project, aws_account_id='pending', iam_role_arn='pending',
            bootstrap_stack_id=external_id,
        )

    def _verify(self, role_arn):
        request = self.factory.post(
            f'/api/projects/{self.project.pk}/aws-connection/verify/', {'role_arn': role_arn},
        )
        force_authenticate(request, user=self.user)
        return provisioning_views.aws_connection_verify(request, self.project.pk)

    @patch('app.provisioning.views.get_account_plan_type', return_value=None)
    @patch('app.provisioning.views.get_account_id', return_value='123456789012')
    @patch('app.provisioning.views.assume_role')
    def test_verify_uses_the_external_id_the_arn_was_built_with(self, mock_assume, _id, _plan):
        mock_assume.return_value = {'AccessKeyId': 'k', 'SecretAccessKey': 's', 'SessionToken': 't'}
        self._pending('aaaaaaaa-0000-0000-0000-000000000000')

        resp = self._verify('arn:aws:iam::123456789012:role/clyro-provisioning-aaaaaaaa-0000-0000-0000-000000000000')

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(mock_assume.call_args.args[1], 'aaaaaaaa-0000-0000-0000-000000000000')

    @patch('app.provisioning.views.assume_role')
    def test_arn_from_another_connection_is_named_rather_than_sent_to_sts(self, mock_assume):
        self._pending('aaaaaaaa-0000-0000-0000-000000000000')

        resp = self._verify('arn:aws:iam::123456789012:role/clyro-provisioning-bbbbbbbb-1111-1111-1111-111111111111')

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('different Clyro connection', resp.data['error'])
        mock_assume.assert_not_called()

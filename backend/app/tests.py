from unittest.mock import patch

from cfnlint import api as cfnlint_api
from cfnlint.config import ManualArgs
from django.test import SimpleTestCase

from app.provisioning import cfn_events, cfn_generator, deploy
from app.scanner import compliance


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

from cfnlint import api as cfnlint_api
from cfnlint.config import ManualArgs
from django.test import SimpleTestCase

from app.provisioning import cfn_events, cfn_generator


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

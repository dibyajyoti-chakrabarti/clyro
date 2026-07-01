import uuid
from django.db import models


class User(models.Model):
    class SubscriptionTier(models.TextChoices):
        FREE = 'free'
        PRO = 'pro'
        ENTERPRISE = 'enterprise'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cognito_sub = models.TextField(unique=True)
    email = models.EmailField(unique=True)
    name = models.TextField()
    avatar_url = models.TextField(null=True, blank=True)
    subscription_tier = models.TextField(
        choices=SubscriptionTier.choices,
        default=SubscriptionTier.FREE
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # DRF / Django auth compatibility — no DB columns, just Python properties
    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False

    @property
    def is_active(self):
        return True

    class Meta:
        db_table = 'users'
        indexes = [models.Index(fields=['cognito_sub'])]

    def __str__(self):
        return f"{self.name} <{self.email}>"


class GitHubInstallation(models.Model):
    class AccountType(models.TextChoices):
        USER = 'User'
        ORGANIZATION = 'Organization'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='github_installations')
    installation_id = models.BigIntegerField(unique=True)
    account_login = models.TextField()
    account_type = models.TextField(choices=AccountType.choices)
    account_avatar_url = models.TextField(null=True, blank=True)
    app_id = models.IntegerField()
    suspended_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'github_installations'
        indexes = [models.Index(fields=['user'])]

    def __str__(self):
        return f"{self.account_login} (installation {self.installation_id})"


class Project(models.Model):
    class Status(models.TextChoices):
        CREATED = 'created'
        REPO_CONNECTED = 'repo_connected'
        SCANNING = 'scanning'
        SCAN_COMPLETE = 'scan_complete'
        INTENT_COLLECTED = 'intent_collected'
        CANVAS_DRAFT = 'canvas_draft'
        CANVAS_FINALIZED = 'canvas_finalized'
        PROVISIONING = 'provisioning'
        LIVE = 'live'
        FAILED = 'failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='projects')
    name = models.TextField()
    description = models.TextField(null=True, blank=True)
    status = models.TextField(choices=Status.choices, default=Status.CREATED)
    github_installation = models.ForeignKey(
        GitHubInstallation, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='projects'
    )
    repo_full_name = models.TextField(null=True, blank=True)
    repo_branch = models.TextField(default='main')
    is_monorepo = models.BooleanField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'projects'
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.name} ({self.status})"


class ScanResult(models.Model):
    class Status(models.TextChoices):
        RUNNING = 'running'
        COMPLETE = 'complete'
        FAILED = 'failed'
        BLOCKED = 'blocked'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='scan_results')
    scan_timestamp = models.DateTimeField(auto_now_add=True)
    status = models.TextField(choices=Status.choices, default=Status.RUNNING)
    block_reason = models.TextField(null=True, blank=True)
    detected_resources = models.JSONField(null=True, blank=True)
    env_vars = models.JSONField(null=True, blank=True)
    draft_canvas_yaml = models.TextField(null=True, blank=True)
    raw_file_tree = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'scan_results'
        indexes = [models.Index(fields=['project'])]

    def __str__(self):
        return f"Scan for {self.project.name} at {self.scan_timestamp} ({self.status})"


class IntentRecord(models.Model):
    class Scale(models.TextChoices):
        SOLO = 'solo'
        SMALL = 'small'
        MEDIUM = 'medium'
        LARGE = 'large'

    class Criticality(models.TextChoices):
        LOW = 'low'
        MEDIUM = 'medium'
        HIGH = 'high'

    class Environment(models.TextChoices):
        PRODUCTION = 'production'
        STAGING = 'staging'
        DEVELOPMENT = 'development'

    class ComputeChoice(models.TextChoices):
        ECS_FARGATE = 'ecs_fargate'
        ECS_EC2 = 'ecs_ec2'
        EC2 = 'ec2'

    class DatabaseChoice(models.TextChoices):
        RDS_POSTGRES = 'rds_postgres'
        AURORA_POSTGRES = 'aurora_postgres'

    class DomainHas(models.TextChoices):
        YES = 'yes'
        NO = 'no'
        INTERNAL = 'internal'

    class AwsAccountType(models.TextChoices):
        PAID = 'paid'
        FREE_TIER = 'free_tier'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='intent_records')
    description = models.TextField(null=True, blank=True)
    scale = models.TextField(choices=Scale.choices, null=True, blank=True)
    criticality = models.TextField(choices=Criticality.choices, null=True, blank=True)
    environment = models.TextField(choices=Environment.choices, null=True, blank=True)
    compute_choice = models.TextField(choices=ComputeChoice.choices, null=True, blank=True)
    database_choice = models.TextField(choices=DatabaseChoice.choices, null=True, blank=True)
    worker_compute_choice = models.TextField(choices=ComputeChoice.choices, null=True, blank=True)
    domain_has = models.TextField(choices=DomainHas.choices, null=True, blank=True)
    domain_name = models.TextField(null=True, blank=True)
    aws_account_type = models.TextField(choices=AwsAccountType.choices, null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'intent_records'
        indexes = [models.Index(fields=['project'])]

    def __str__(self):
        return f"Intent for {self.project.name} ({self.environment})"


class CanvasVersion(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'draft'
        FINALIZED = 'finalized'

    class Operation(models.TextChoices):
        INITIAL = 'INITIAL'
        ADD_NODE = 'ADD_NODE'
        REMOVE_NODE = 'REMOVE_NODE'
        UPDATE_NODE = 'UPDATE_NODE'
        ADD_CONNECTION = 'ADD_CONNECTION'
        REMOVE_CONNECTION = 'REMOVE_CONNECTION'
        REVERT = 'REVERT'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='canvas_versions')
    intent_record = models.ForeignKey(
        IntentRecord, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='canvas_versions'
    )
    version_number = models.IntegerField()
    status = models.TextField(choices=Status.choices, default=Status.DRAFT)
    canvas_yaml = models.TextField()
    canvas_snapshot = models.JSONField()
    operation = models.TextField(choices=Operation.choices, null=True, blank=True)
    changed_node_id = models.TextField(null=True, blank=True)
    previous_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    estimated_cost = models.JSONField(null=True, blank=True)
    finalized_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'canvas_versions'
        unique_together = [('project', 'version_number')]
        indexes = [
            models.Index(fields=['project']),
            models.Index(fields=['project', 'status']),
        ]

    def __str__(self):
        return f"Canvas v{self.version_number} for {self.project.name} ({self.status})"


class AWSAccountConnection(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='aws_connections')
    aws_account_id = models.TextField()
    aws_region = models.TextField(default='us-east-1')
    iam_role_arn = models.TextField()
    bootstrap_stack_id = models.TextField(null=True, blank=True)
    bootstrap_stack_status = models.TextField(null=True, blank=True)
    connected_at = models.DateTimeField(null=True, blank=True)
    last_verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'aws_account_connections'
        indexes = [models.Index(fields=['project'])]

    def __str__(self):
        return f"AWS {self.aws_account_id} for {self.project.name}"


class EnvVarKey(models.Model):
    class Classification(models.TextChoices):
        GENERATED = 'generated'
        USER_SECRET = 'user_secret'
        OPTIONAL = 'optional'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='env_var_keys')
    scan_result = models.ForeignKey(
        ScanResult, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='env_var_keys'
    )
    key_name = models.TextField()
    classification = models.TextField(choices=Classification.choices)
    source_file = models.TextField(null=True, blank=True)
    context_block = models.TextField(null=True, blank=True)
    production_default = models.TextField(null=True, blank=True)
    secrets_manager_arn = models.TextField(null=True, blank=True)
    secrets_manager_key = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'env_var_keys'
        unique_together = [('project', 'key_name')]
        indexes = [
            models.Index(fields=['project']),
            models.Index(fields=['project', 'classification']),
        ]

    def __str__(self):
        return f"{self.key_name} ({self.classification}) — {self.project.name}"


class Deployment(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending'
        GENERATING_IAC = 'generating_iac'
        IAC_READY = 'iac_ready'
        SUBMITTING = 'submitting'
        IN_PROGRESS = 'in_progress'
        COMPLETE = 'complete'
        FAILED = 'failed'
        ROLLED_BACK = 'rolled_back'

    class Environment(models.TextChoices):
        PRODUCTION = 'production'
        STAGING = 'staging'
        DEVELOPMENT = 'development'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='deployments')
    canvas_version = models.ForeignKey(CanvasVersion, on_delete=models.PROTECT, related_name='deployments')
    intent_record = models.ForeignKey(IntentRecord, on_delete=models.PROTECT, related_name='deployments')
    aws_connection = models.ForeignKey(AWSAccountConnection, on_delete=models.PROTECT, related_name='deployments')
    environment = models.TextField(choices=Environment.choices)
    status = models.TextField(choices=Status.choices, default=Status.PENDING)
    cloudformation_stack_id = models.TextField(null=True, blank=True)
    cloudformation_stack_name = models.TextField(null=True, blank=True)
    cloudformation_template = models.TextField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'deployments'
        indexes = [
            models.Index(fields=['project']),
            models.Index(fields=['project', 'status']),
        ]

    def __str__(self):
        return f"Deployment {self.id} for {self.project.name} ({self.environment}, {self.status})"


class DeploymentStackOutput(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    deployment = models.ForeignKey(Deployment, on_delete=models.CASCADE, related_name='stack_outputs')
    output_key = models.TextField()
    output_value = models.TextField()
    description = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'deployment_stack_outputs'
        unique_together = [('deployment', 'output_key')]
        indexes = [models.Index(fields=['deployment'])]

    def __str__(self):
        return f"{self.output_key} = {self.output_value}"


class ProvisioningLogEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    deployment = models.ForeignKey(Deployment, on_delete=models.CASCADE, related_name='log_entries')
    sequence = models.IntegerField()
    resource_type = models.TextField(null=True, blank=True)
    resource_id = models.TextField(null=True, blank=True)
    status = models.TextField()
    plain_message = models.TextField()
    raw_event = models.JSONField(null=True, blank=True)
    event_timestamp = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'provisioning_log_entries'
        unique_together = [('deployment', 'sequence')]
        indexes = [models.Index(fields=['deployment'])]

    def __str__(self):
        return f"[{self.sequence}] {self.plain_message}"


class MonitoringAlert(models.Model):
    class Severity(models.TextChoices):
        CRITICAL = 'critical'
        WARNING = 'warning'
        INFO = 'info'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    deployment = models.ForeignKey(Deployment, on_delete=models.CASCADE, related_name='alerts')
    severity = models.TextField(choices=Severity.choices)
    source_alarm = models.TextField()
    plain_message = models.TextField()
    resource_type = models.TextField(null=True, blank=True)
    resource_id = models.TextField(null=True, blank=True)
    fired_at = models.DateTimeField()
    resolved_at = models.DateTimeField(null=True, blank=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'monitoring_alerts'
        indexes = [
            models.Index(fields=['deployment']),
            models.Index(fields=['deployment', '-fired_at']),
        ]

    def __str__(self):
        return f"[{self.severity}] {self.plain_message[:60]}"


class MonitoringMetricsCache(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    deployment = models.ForeignKey(Deployment, on_delete=models.CASCADE, related_name='metrics_cache')
    metric_key = models.TextField()
    metric_value = models.JSONField()
    fetched_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'monitoring_metrics_cache'
        unique_together = [('deployment', 'metric_key')]
        indexes = [models.Index(fields=['deployment'])]

    def __str__(self):
        return f"{self.metric_key} for deployment {self.deployment_id}"


class Subscription(models.Model):
    class Tier(models.TextChoices):
        FREE = 'free'
        PRO = 'pro'
        ENTERPRISE = 'enterprise'

    class Status(models.TextChoices):
        ACTIVE = 'active'
        CANCELLED = 'cancelled'
        PAST_DUE = 'past_due'
        TRIALING = 'trialing'

    class PaymentGateway(models.TextChoices):
        STRIPE = 'stripe'
        RAZORPAY = 'razorpay'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='subscriptions')
    tier = models.TextField(choices=Tier.choices, default=Tier.FREE)
    status = models.TextField(choices=Status.choices, default=Status.ACTIVE)
    payment_gateway = models.TextField(choices=PaymentGateway.choices, null=True, blank=True)
    gateway_customer_id = models.TextField(null=True, blank=True)
    gateway_sub_id = models.TextField(null=True, blank=True)
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'subscriptions'
        indexes = [models.Index(fields=['user'])]

    def __str__(self):
        return f"{self.user.email} — {self.tier} ({self.status})"

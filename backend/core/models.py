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
        # Set once env_vars_stage succeeds (Step 2 "set up your app" secrets
        # entry) — staged only, nothing written to Secrets Manager yet.
        SECRETS_STAGED = 'secrets_staged'
        SCANNING = 'scanning'
        SCAN_COMPLETE = 'scan_complete'
        INTENT_COLLECTED = 'intent_collected'
        CANVAS_DRAFT = 'canvas_draft'
        CANVAS_FINALIZED = 'canvas_finalized'
        # AWS-connect substates (Step 4's "connect AWS" phase): pending is set by
        # aws_connection_init (CFN console URL handed out, role not yet assumed);
        # connected once assume_role/get_account_id succeed in aws_connection_verify;
        # verified/mismatch once the account's verified_account_type is compared
        # against the project's IntentRecord.aws_account_type claim.
        AWS_CONNECT_PENDING = 'aws_connect_pending'
        AWS_CONNECTED = 'aws_connected'
        AWS_VERIFIED = 'aws_verified'
        AWS_MISMATCH = 'aws_mismatch'
        # Set at the end of iac.generate()/iac.validate() once each succeeds.
        IAC_GENERATED = 'iac_generated'
        IAC_VALIDATED = 'iac_validated'
        PROVISIONING = 'provisioning'
        LIVE = 'live'
        FAILED = 'failed'
        PAUSED = 'paused'
        DELETED = 'deleted'

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
    compliance_findings = models.JSONField(null=True, blank=True)
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
    # Optional manual override — when blank, deploy.start() resolves the zone
    # live via route53:ListHostedZones at provisioning time instead (the AWS
    # account isn't necessarily connected yet when domain_name is answered).
    route53_hosted_zone_id = models.TextField(null=True, blank=True)
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
    # Proactively queried from AWS itself (freetier:GetAccountPlanState) right after
    # the role is assumed, rather than trusting only the user's Step-2 self-report
    # (IntentRecord.aws_account_type) — an AWS account can be free-tier-restricted
    # regardless of what the user picked. Null when the call failed/was unavailable.
    verified_account_type = models.CharField(
        max_length=16, choices=IntentRecord.AwsAccountType.choices, null=True, blank=True,
    )
    # The user's self-report, submitted alongside the connect flow (Step 2) — the
    # question that used to live on IntentRecord moved here since AWS now connects
    # before intent is collected. Compared against verified_account_type to flag
    # account_type_mismatch; also the fallback source when verification fails.
    claimed_account_type = models.CharField(
        max_length=16, choices=IntentRecord.AwsAccountType.choices, null=True, blank=True,
    )

    class HealthStatus(models.TextChoices):
        HEALTHY = 'healthy'
        UNREACHABLE = 'unreachable'  # AssumeRole AccessDenied — likely bootstrap stack torn down
        UNKNOWN = 'unknown'  # never reconciled yet

    # Proactively swept on a schedule (app.provisioning.reconcile.sweep) rather
    # than only discovered reactively the next time the user hits _assume() —
    # see reconcile.py for the incident that motivated this.
    health_status = models.TextField(choices=HealthStatus.choices, default=HealthStatus.UNKNOWN)
    last_reconciled_at = models.DateTimeField(null=True, blank=True)

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
    # Holds a value collected by env_vars_stage (Step 2, before an AWS connection
    # exists) until env_vars_save actually writes it to Secrets Manager (Step 4).
    # Cleared back to null once write_secret succeeds — plaintext secrets should
    # not linger in the DB once they're safely in Secrets Manager.
    staged_value = models.TextField(null=True, blank=True)
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
        BUILDING = 'building'
        BUILD_FAILED = 'build_failed'
        COMPLETE = 'complete'
        FAILED = 'failed'
        ROLLING_BACK = 'rolling_back'
        ROLLED_BACK = 'rolled_back'
        PAUSING = 'pausing'
        PAUSED = 'paused'
        RESUMING = 'resuming'
        DELETING = 'deleting'
        DELETED = 'deleted'

    class Environment(models.TextChoices):
        PRODUCTION = 'production'
        STAGING = 'staging'
        DEVELOPMENT = 'development'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='deployments')
    canvas_version = models.ForeignKey(CanvasVersion, on_delete=models.PROTECT, related_name='deployments')
    intent_record = models.ForeignKey(IntentRecord, on_delete=models.PROTECT, related_name='deployments')
    aws_connection = models.ForeignKey(
        AWSAccountConnection, on_delete=models.PROTECT, related_name='deployments',
        null=True, blank=True,
    )
    environment = models.TextField(choices=Environment.choices)
    status = models.TextField(choices=Status.choices, default=Status.PENDING)
    cloudformation_stack_id = models.TextField(null=True, blank=True)
    cloudformation_stack_name = models.TextField(null=True, blank=True)
    cloudformation_template = models.TextField(null=True, blank=True)
    paused_state = models.JSONField(null=True, blank=True)
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


class AgentJob(models.Model):
    """A single async invocation of one of the Bedrock AgentCore agents (scan,
    Step-3 chat, IaC generate/refine, provisioning-with-feedback), run via Celery
    instead of blocking the Django request/response cycle. One shared model for
    every job kind rather than four bespoke tables — the frontend polls
    `.../status/<id>/` the same way for all of them, mirroring the pattern already
    proven for CloudFormation deploy status."""

    class Kind(models.TextChoices):
        SCAN = 'scan'
        CANVAS_CHAT = 'canvas_chat'
        IAC_GENERATE = 'iac_generate'
        IAC_REFINE = 'iac_refine'
        PROVISION = 'provision'
        BUILD = 'build'

    class Status(models.TextChoices):
        PENDING = 'pending'
        RUNNING = 'running'
        DONE = 'done'
        FAILED = 'failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='agent_jobs')
    kind = models.TextField(choices=Kind.choices)
    status = models.TextField(choices=Status.choices, default=Status.PENDING)
    result = models.JSONField(null=True, blank=True)
    # Live progress while the job runs (B2): {"phase": str, "partial_template": str}.
    # Written throttled by the generate task as the agent streams; read by the
    # frontend's poll loop to show the template forming instead of a spinner.
    progress = models.JSONField(null=True, blank=True)
    error = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agent_jobs'
        indexes = [
            models.Index(fields=['project', 'kind']),
        ]

    def __str__(self):
        return f"AgentJob {self.id} ({self.kind}, {self.status})"


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

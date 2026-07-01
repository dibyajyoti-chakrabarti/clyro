from django.contrib import admin
from .models import (
    User, GitHubInstallation, Project, ScanResult, IntentRecord,
    CanvasVersion, AWSAccountConnection, EnvVarKey, Deployment,
    DeploymentStackOutput, ProvisioningLogEntry, MonitoringAlert,
    MonitoringMetricsCache, Subscription
)


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'subscription_tier', 'created_at')
    search_fields = ('email', 'name', 'cognito_sub')


@admin.register(GitHubInstallation)
class GitHubInstallationAdmin(admin.ModelAdmin):
    list_display = ('account_login', 'account_type', 'installation_id', 'user')
    search_fields = ('account_login',)


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'status', 'repo_full_name', 'created_at')
    list_filter = ('status',)
    search_fields = ('name', 'repo_full_name')


@admin.register(ScanResult)
class ScanResultAdmin(admin.ModelAdmin):
    list_display = ('project', 'status', 'scan_timestamp')
    list_filter = ('status',)


@admin.register(IntentRecord)
class IntentRecordAdmin(admin.ModelAdmin):
    list_display = ('project', 'environment', 'scale', 'aws_account_type', 'completed_at')
    list_filter = ('environment', 'scale', 'aws_account_type')


@admin.register(CanvasVersion)
class CanvasVersionAdmin(admin.ModelAdmin):
    list_display = ('project', 'version_number', 'status', 'operation', 'created_at')
    list_filter = ('status', 'operation')


@admin.register(AWSAccountConnection)
class AWSAccountConnectionAdmin(admin.ModelAdmin):
    list_display = ('project', 'aws_account_id', 'aws_region', 'connected_at', 'last_verified_at')


@admin.register(EnvVarKey)
class EnvVarKeyAdmin(admin.ModelAdmin):
    list_display = ('key_name', 'classification', 'project', 'is_active')
    list_filter = ('classification', 'is_active')
    search_fields = ('key_name',)


@admin.register(Deployment)
class DeploymentAdmin(admin.ModelAdmin):
    list_display = ('project', 'environment', 'status', 'started_at', 'completed_at')
    list_filter = ('status', 'environment')


@admin.register(DeploymentStackOutput)
class DeploymentStackOutputAdmin(admin.ModelAdmin):
    list_display = ('deployment', 'output_key', 'output_value')


@admin.register(ProvisioningLogEntry)
class ProvisioningLogEntryAdmin(admin.ModelAdmin):
    list_display = ('deployment', 'sequence', 'status', 'plain_message', 'event_timestamp')


@admin.register(MonitoringAlert)
class MonitoringAlertAdmin(admin.ModelAdmin):
    list_display = ('deployment', 'severity', 'plain_message', 'fired_at', 'resolved_at')
    list_filter = ('severity',)


@admin.register(MonitoringMetricsCache)
class MonitoringMetricsCacheAdmin(admin.ModelAdmin):
    list_display = ('deployment', 'metric_key', 'fetched_at')


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ('user', 'tier', 'status', 'payment_gateway', 'current_period_end')
    list_filter = ('tier', 'status')

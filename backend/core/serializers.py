from rest_framework import serializers
from .models import GitHubInstallation, IntentRecord, Project, ScanResult, User


class GitHubInstallationSerializer(serializers.ModelSerializer):
    class Meta:
        model = GitHubInstallation
        fields = ['id', 'installation_id', 'account_login', 'account_type', 'account_avatar_url', 'created_at']


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ['id', 'name', 'description', 'status', 'repo_full_name', 'repo_branch', 'is_monorepo', 'created_at', 'updated_at']
        read_only_fields = ['id', 'status', 'is_monorepo', 'created_at', 'updated_at']


class ScanResultSerializer(serializers.ModelSerializer):
    compliance_prompt = serializers.SerializerMethodField()

    def get_compliance_prompt(self, obj):
        from app.scanner.compliance import build_agent_prompt
        if not obj.compliance_findings:
            return None
        return build_agent_prompt(obj.project.repo_full_name, obj.project.repo_branch, obj.compliance_findings)

    class Meta:
        model = ScanResult
        fields = [
            'id', 'status', 'block_reason', 'detected_resources', 'env_vars', 'draft_canvas_yaml',
            'scan_timestamp', 'compliance_findings', 'compliance_prompt',
        ]


class UserProfileSerializer(serializers.ModelSerializer):
    project_count = serializers.SerializerMethodField()
    subscription_status = serializers.SerializerMethodField()

    def get_project_count(self, obj):
        return obj.projects.count()

    def get_subscription_status(self, obj):
        sub = obj.subscriptions.order_by('-created_at').first()
        return sub.status if sub else 'active'

    class Meta:
        model = User
        fields = ['id', 'name', 'email', 'avatar_url', 'subscription_tier',
                  'subscription_status', 'project_count', 'created_at']
        read_only_fields = ['id', 'email', 'avatar_url', 'subscription_status',
                            'project_count', 'created_at']


class IntentRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = IntentRecord
        fields = [
            'id', 'description', 'scale', 'criticality', 'environment',
            'compute_choice', 'database_choice', 'worker_compute_choice',
            'domain_has', 'domain_name', 'aws_account_type',
            'completed_at', 'created_at',
        ]
        read_only_fields = ['id', 'completed_at', 'created_at']

from rest_framework import serializers
from .models import GitHubInstallation, IntentRecord, Project, ScanResult


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
    class Meta:
        model = ScanResult
        fields = ['id', 'status', 'block_reason', 'detected_resources', 'env_vars', 'draft_canvas_yaml', 'scan_timestamp']


class IntentRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = IntentRecord
        fields = [
            'id', 'description', 'scale', 'criticality', 'environment',
            'compute_choice', 'database_choice', 'worker_compute_choice',
            'domain_has', 'domain_name', 'completed_at', 'created_at',
        ]
        read_only_fields = ['id', 'completed_at', 'created_at']

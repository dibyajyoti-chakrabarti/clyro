from rest_framework import serializers
from .models import GitHubInstallation, Project


class GitHubInstallationSerializer(serializers.ModelSerializer):
    class Meta:
        model = GitHubInstallation
        fields = ['id', 'installation_id', 'account_login', 'account_type', 'account_avatar_url', 'created_at']


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ['id', 'name', 'description', 'status', 'repo_full_name', 'repo_branch', 'created_at', 'updated_at']
        read_only_fields = ['id', 'status', 'created_at', 'updated_at']

"""Translate raw CloudFormation stack events into the plain-English live-feed
entries shown during provisioning. Pure / deterministic (no AWS, no Django) so it's
unit-testable in isolation; the deploy service maps the output onto
``ProvisioningLogEntry`` rows.
"""

from __future__ import annotations

from typing import Any

# Friendly names for the resource types the Step 4 template creates.
RESOURCE_LABELS: dict[str, str] = {
    "AWS::CloudFormation::Stack": "Stack",
    "AWS::EC2::VPC": "VPC",
    "AWS::EC2::Subnet": "Subnet",
    "AWS::EC2::SecurityGroup": "Security group",
    "AWS::EC2::InternetGateway": "Internet gateway",
    "AWS::EC2::NatGateway": "NAT gateway",
    "AWS::EC2::RouteTable": "Route table",
    "AWS::ElasticLoadBalancingV2::LoadBalancer": "Load balancer",
    "AWS::ElasticLoadBalancingV2::TargetGroup": "Target group",
    "AWS::ElasticLoadBalancingV2::Listener": "Load balancer listener",
    "AWS::ECS::Cluster": "ECS cluster",
    "AWS::ECS::TaskDefinition": "ECS task definition",
    "AWS::ECS::Service": "ECS service",
    "AWS::RDS::DBInstance": "PostgreSQL database",
    "AWS::RDS::DBCluster": "Aurora cluster",
    "AWS::RDS::DBSubnetGroup": "DB subnet group",
    "AWS::ElastiCache::ReplicationGroup": "Redis cache",
    "AWS::ElastiCache::SubnetGroup": "Cache subnet group",
    "AWS::SQS::Queue": "SQS queue",
    "AWS::S3::Bucket": "S3 bucket",
    "AWS::CloudFront::Distribution": "CloudFront distribution",
    "AWS::CertificateManager::Certificate": "ACM certificate",
    "AWS::SecretsManager::Secret": "Secret",
    "AWS::Logs::LogGroup": "Log group",
    "AWS::IAM::Role": "IAM role",
    "AWS::CloudWatch::Alarm": "CloudWatch alarm",
}

# Resources that legitimately take several minutes — worth flagging in the feed.
_SLOW_RESOURCES = {
    "AWS::RDS::DBInstance": "this typically takes 3 to 5 minutes",
    "AWS::RDS::DBCluster": "this typically takes 3 to 5 minutes",
    "AWS::CloudFront::Distribution": "this can take several minutes",
    "AWS::ElastiCache::ReplicationGroup": "this typically takes a few minutes",
    "AWS::CertificateManager::Certificate": "waiting on DNS validation",
}


def _label(resource_type: str | None, logical_id: str | None) -> str:
    label = RESOURCE_LABELS.get(resource_type or "", resource_type or "Resource")
    return label


def status_kind(resource_status: str | None) -> str:
    """Map a CFN ResourceStatus to the live-feed kind the frontend renders."""
    s = resource_status or ""
    if s.endswith("_FAILED") and "ROLLBACK" not in s:
        return "failed"
    if "ROLLBACK" in s or s.startswith("DELETE_"):
        return "rolled_back"
    if s.endswith("_COMPLETE"):
        return "done"
    if s.endswith("_IN_PROGRESS"):
        return "in_progress"
    return "pending"


def translate_failure_reason(reason: str | None) -> str:
    """Map a raw CFN ResourceStatusReason to a plain-English explanation + fix.
    Falls back to the raw reason so nothing is ever hidden."""
    if not reason:
        return "Creation failed (no reason reported by AWS)."
    r = reason.lower()
    if "cannotpullcontainer" in r or ("image" in r and ("not found" in r or "does not exist" in r)) \
            or ("repository" in r and "does not exist" in r):
        return ("The container image isn't in ECR yet. Push your image to the repository "
                "(or point the template at a public image), then retry.")
    if "insufficient" in r and "capacity" in r:
        return ("AWS doesn't have capacity for that instance type in this Availability Zone "
                "right now. Retry, or choose a different instance size.")
    if "already exists" in r or "alreadyexists" in r:
        return ("A resource with this name already exists in your account. Remove it or rename, "
                "then retry.")
    if "limitexceeded" in r or "quota" in r or "limit exceeded" in r:
        return ("You've hit an AWS service limit. Request a quota increase in the AWS console, "
                "then retry.")
    if "not authorized" in r or "accessdenied" in r or "access denied" in r:
        return ("The Clyro role doesn't have permission for this action. The bootstrap role may "
                "need additional permissions.")
    return reason.strip()


def translate_event(event: dict[str, Any], sequence: int) -> dict[str, Any]:
    """Translate one boto3 stack event into a ``ProvisioningLogEntry``-shaped dict.

    Returns keys: ``sequence, resource_type, resource_id, status, plain_message,
    event_timestamp, raw_event, event_id``.
    """
    resource_type = event.get("ResourceType")
    logical_id = event.get("LogicalResourceId")
    resource_status = event.get("ResourceStatus")
    reason = event.get("ResourceStatusReason")
    kind = status_kind(resource_status)
    label = _label(resource_type, logical_id)
    is_stack = resource_type == "AWS::CloudFormation::Stack"

    if kind == "failed":
        message = f"❌ {label} failed: {translate_failure_reason(reason)}"
    elif kind == "rolled_back":
        if (resource_status or "").endswith("_IN_PROGRESS"):
            message = f"↩️ Rolling back {label}…"
        elif (resource_status or "").startswith("DELETE"):
            message = f"🗑️ {label} removed"
        else:
            message = f"↩️ {label} rolled back"
    elif kind == "done":
        message = (
            "✅ Stack ready" if is_stack and (resource_status or "").startswith("CREATE")
            else f"✅ {label} ready"
        )
    elif kind == "in_progress":
        if is_stack:
            message = "⏳ Provisioning started…"
        else:
            hint = _SLOW_RESOURCES.get(resource_type or "")
            message = f"⏳ Creating {label}…" + (f" {hint}." if hint else "")
    else:
        message = f"{label}: {resource_status}"

    timestamp = event.get("Timestamp")
    raw = {
        "EventId": event.get("EventId"),
        "ResourceStatus": resource_status,
        "ResourceStatusReason": reason,
        "LogicalResourceId": logical_id,
        "ResourceType": resource_type,
        "Timestamp": timestamp.isoformat() if hasattr(timestamp, "isoformat") else timestamp,
    }
    return {
        "sequence": sequence,
        "resource_type": resource_type,
        "resource_id": logical_id,
        "status": kind,
        "plain_message": message,
        "event_timestamp": timestamp,
        "raw_event": raw,
        "event_id": event.get("EventId"),
    }


# ── Stack-status classification ────────────────────────────────────────────────

def is_terminal(stack_status: str | None) -> bool:
    s = stack_status or ""
    return s.endswith("_COMPLETE") or s.endswith("_FAILED")


def is_failure(stack_status: str | None) -> bool:
    """A create that failed or rolled back — not a healthy end state."""
    s = stack_status or ""
    return "FAILED" in s or "ROLLBACK" in s


def is_live(stack_status: str | None) -> bool:
    """A healthy, deployed stack (used to block re-provisioning a live stack)."""
    return stack_status in ("CREATE_COMPLETE", "UPDATE_COMPLETE", "UPDATE_ROLLBACK_COMPLETE")


def is_rolling_back(stack_status: str | None) -> bool:
    """A failed create/update is still cleaning up; not terminal and not healthy."""
    s = stack_status or ""
    return (
        "ROLLBACK_IN_PROGRESS" in s
        or "ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS" in s
        or s == "DELETE_IN_PROGRESS"
    )


def is_rolled_back(stack_status: str | None) -> bool:
    """A failed stack that must be deleted before a fresh CreateStack can run."""
    return stack_status in (
        "ROLLBACK_COMPLETE", "ROLLBACK_FAILED",
        "CREATE_FAILED", "DELETE_FAILED",
    )

"""Deterministic CloudFormation authoring for Step 4.

The build spec already resolves the architecture into concrete AWS choices. This
module turns that spec into a complete CloudFormation template without asking an
LLM to transcribe it. It intentionally emits plain long-form intrinsics
(`{"Ref": ...}`, `{"Fn::Sub": ...}`) so PyYAML can serialize the template
without custom tags; cfn-lint and CloudFormation accept both long and short forms.
"""

from __future__ import annotations

import re
from typing import Any

import yaml


class _Dumper(yaml.SafeDumper):
    def ignore_aliases(self, data):
        return True


def _ref(logical_id: str) -> dict[str, str]:
    return {"Ref": logical_id}


def _sub(value: str) -> dict[str, str]:
    return {"Fn::Sub": value}


def _getatt(logical_id: str, attr: str) -> dict[str, list[str]]:
    return {"Fn::GetAtt": [logical_id, attr]}


def _az(index: int) -> dict[str, list[Any]]:
    return {"Fn::Select": [index, {"Fn::GetAZs": ""}]}


def _pascal(value: str | None) -> str:
    text = re.sub(r"[^a-zA-Z0-9]+", " ", value or "").strip()
    out = "".join(part[:1].upper() + part[1:] for part in text.split())
    return out or "App"


def _name(value: str, limit: int) -> str:
    return value[:limit].rstrip("-")


def _cpu_units(vcpu: Any) -> str:
    try:
        return str(int(float(vcpu) * 1024))
    except (TypeError, ValueError):
        return "256"


def _memory_mb(gb: Any) -> str:
    try:
        return str(int(float(gb) * 1024))
    except (TypeError, ValueError):
        return "512"


def _db_name(project: str) -> str:
    raw = re.sub(r"[^a-zA-Z0-9_]+", "_", project or "app").strip("_").lower()
    if not raw or raw[0].isdigit():
        raw = f"app_{raw or 'db'}"
    return raw[:60]


def _resources_by_type(spec: dict[str, Any], node_type: str) -> list[dict[str, Any]]:
    return [r for r in spec.get("resources") or [] if r.get("type") == node_type]


def _first_resource(spec: dict[str, Any], node_type: str) -> dict[str, Any] | None:
    return next(iter(_resources_by_type(spec, node_type)), None)


def _has_generated_env(spec: dict[str, Any], key: str) -> bool:
    return any((e.get("key_name") or "").upper() == key for e in spec.get("generated_env") or [])


def _docker_repo_owners(spec: dict[str, Any]) -> dict[str, str]:
    owners: dict[str, str] = {}
    by_path: dict[str, str] = {}
    for entry in spec.get("resources") or []:
        if entry.get("type") not in ("service", "worker") or entry.get("image") != "ecr":
            continue
        path = entry.get("build_path") or "."
        by_path.setdefault(path, entry["node_id"])
        owners[entry["node_id"]] = by_path[path]
    return owners


def _policy_statement(effect: str, actions: list[str], resource: Any) -> dict[str, Any]:
    return {"Effect": effect, "Action": actions, "Resource": resource}


def _security_group(logical_id: str, name: str, description: str) -> tuple[str, dict[str, Any]]:
    return logical_id, {
        "Type": "AWS::EC2::SecurityGroup",
        "Properties": {
            "GroupName": name,
            "GroupDescription": description,
            "VpcId": _ref("Vpc"),
        },
    }


def _ingress(group: str, source: Any, port: int, description: str) -> dict[str, Any]:
    props = {
        "GroupId": _ref(group),
        "IpProtocol": "tcp",
        "FromPort": port,
        "ToPort": port,
        "Description": description,
    }
    if isinstance(source, str) and source.startswith("sg:"):
        props["SourceSecurityGroupId"] = _ref(source[3:])
    else:
        props["CidrIp"] = source
    return {"Type": "AWS::EC2::SecurityGroupIngress", "Properties": props}


def _role(logical_id: str, name: str, service: str, policies: list[dict[str, Any]] | None = None,
          managed: list[str] | None = None) -> tuple[str, dict[str, Any]]:
    props: dict[str, Any] = {
        "RoleName": name,
        "AssumeRolePolicyDocument": {
            "Version": "2012-10-17",
            "Statement": [{
                "Effect": "Allow",
                "Principal": {"Service": service},
                "Action": "sts:AssumeRole",
            }],
        },
    }
    if managed:
        props["ManagedPolicyArns"] = managed
    if policies:
        props["Policies"] = policies
    return logical_id, {"Type": "AWS::IAM::Role", "Properties": props}


def _env_value(key: str, spec: dict[str, Any], *, db_name: str, app_bucket: str | None) -> Any:
    upper = key.upper()
    broker = spec.get("broker") or {}
    if upper == "DATABASE_URL":
        return _sub(
            f"postgres://clyro:{{{{resolve:secretsmanager:${{DbSecret}}:SecretString:password}}}}"
            f"@${{DbInstance.Endpoint.Address}}:5432/{db_name}"
        )
    if upper in ("REDIS_URL", "CACHE_URL"):
        return _sub("redis://${Cache.PrimaryEndPoint.Address}:6379/0")
    if "BROKER" in upper:
        if broker.get("transport") == "redis" or _first_resource(spec, "cache"):
            return _sub("redis://${Cache.PrimaryEndPoint.Address}:6379/0")
        return "sqs://"
    if upper == "AWS_S3_BUCKET_NAME" and app_bucket:
        return _ref(app_bucket)
    if upper == "AWS_STORAGE_BUCKET_NAME" and app_bucket:
        return _ref(app_bucket)
    literal = next((e.get("value") for e in spec.get("generated_env") or []
                    if e.get("key_name") == key and e.get("value") is not None), None)
    return literal if literal is not None else ""


def _container_environment(spec: dict[str, Any], *, db_name: str, app_bucket: str | None) -> list[dict[str, Any]]:
    env = []
    seen = set()
    for entry in spec.get("generated_env") or []:
        key = entry.get("key_name")
        if not key or key in seen:
            continue
        seen.add(key)
        env.append({"Name": key, "Value": _env_value(key, spec, db_name=db_name, app_bucket=app_bucket)})
    return env


def _container_secrets(spec: dict[str, Any]) -> list[dict[str, Any]]:
    secrets = []
    for entry in spec.get("secrets") or []:
        key = entry.get("key_name")
        arn = entry.get("secretsmanager_arn")
        if key and arn:
            secrets.append({"Name": key, "ValueFrom": arn})
    return secrets


def _add_networking(resources: dict[str, Any], spec: dict[str, Any]) -> None:
    networking = spec.get("networking") or {}
    cidrs = {
        "PublicSubnet1": "10.0.0.0/24",
        "PublicSubnet2": "10.0.1.0/24",
        "PrivateSubnet1": "10.0.10.0/24",
        "PrivateSubnet2": "10.0.11.0/24",
    }
    resources["Vpc"] = {
        "Type": "AWS::EC2::VPC",
        "Properties": {
            "CidrBlock": networking.get("vpc_cidr") or "10.0.0.0/16",
            "EnableDnsHostnames": True,
            "EnableDnsSupport": True,
            "Tags": [{"Key": "Name", "Value": _sub("${AWS::StackName}-vpc")}],
        },
    }
    resources["InternetGateway"] = {"Type": "AWS::EC2::InternetGateway"}
    resources["VpcGatewayAttachment"] = {
        "Type": "AWS::EC2::VPCGatewayAttachment",
        "Properties": {"VpcId": _ref("Vpc"), "InternetGatewayId": _ref("InternetGateway")},
    }
    for idx, lid in enumerate(("PublicSubnet1", "PublicSubnet2", "PrivateSubnet1", "PrivateSubnet2")):
        public = lid.startswith("Public")
        resources[lid] = {
            "Type": "AWS::EC2::Subnet",
            "Properties": {
                "VpcId": _ref("Vpc"),
                "CidrBlock": cidrs[lid],
                "AvailabilityZone": _az(idx % 2),
                "MapPublicIpOnLaunch": public,
                "Tags": [{"Key": "Name", "Value": _sub(f"${{AWS::StackName}}-{lid.lower()}")}],
            },
        }
    resources["PublicRouteTable"] = {
        "Type": "AWS::EC2::RouteTable",
        "Properties": {"VpcId": _ref("Vpc")},
    }
    resources["PublicDefaultRoute"] = {
        "Type": "AWS::EC2::Route",
        "DependsOn": "VpcGatewayAttachment",
        "Properties": {
            "RouteTableId": _ref("PublicRouteTable"),
            "DestinationCidrBlock": "0.0.0.0/0",
            "GatewayId": _ref("InternetGateway"),
        },
    }
    for lid in ("PublicSubnet1", "PublicSubnet2"):
        resources[f"{lid}RouteTableAssociation"] = {
            "Type": "AWS::EC2::SubnetRouteTableAssociation",
            "Properties": {"SubnetId": _ref(lid), "RouteTableId": _ref("PublicRouteTable")},
        }
    resources["PrivateRouteTable"] = {
        "Type": "AWS::EC2::RouteTable",
        "Properties": {"VpcId": _ref("Vpc")},
    }
    for lid in ("PrivateSubnet1", "PrivateSubnet2"):
        resources[f"{lid}RouteTableAssociation"] = {
            "Type": "AWS::EC2::SubnetRouteTableAssociation",
            "Properties": {"SubnetId": _ref(lid), "RouteTableId": _ref("PrivateRouteTable")},
        }
    if networking.get("nat_gateway"):
        resources["NatEip"] = {
            "Type": "AWS::EC2::EIP",
            "DependsOn": "VpcGatewayAttachment",
            "Properties": {"Domain": "vpc"},
        }
        resources["NatGateway"] = {
            "Type": "AWS::EC2::NatGateway",
            "Properties": {"AllocationId": _getatt("NatEip", "AllocationId"), "SubnetId": _ref("PublicSubnet1")},
        }
        resources["PrivateDefaultRoute"] = {
            "Type": "AWS::EC2::Route",
            "Properties": {
                "RouteTableId": _ref("PrivateRouteTable"),
                "DestinationCidrBlock": "0.0.0.0/0",
                "NatGatewayId": _ref("NatGateway"),
            },
        }


def _add_security_groups(resources: dict[str, Any], spec: dict[str, Any]) -> dict[str, str]:
    prefix = spec.get("naming_prefix") or "app"
    sg_by_node: dict[str, str] = {}
    needs_alb = any((e.get("kind") == "alb") for e in spec.get("network_edges") or [])
    if needs_alb:
        lid, res = _security_group("AlbSecurityGroup", f"{prefix}-alb-sg", "Clyro ALB security group")
        resources[lid] = res
    for entry in spec.get("resources") or []:
        if not entry.get("security_group"):
            continue
        lid = f"{_pascal(entry.get('node_id'))}SecurityGroup"
        sg_by_node[entry["node_id"]] = lid
        _, res = _security_group(lid, f"{prefix}-{entry['security_group']}", f"Clyro {entry['node_id']} security group")
        resources[lid] = res

    for edge in spec.get("network_edges") or []:
        if edge.get("kind") == "alb" and "AlbSecurityGroup" in resources:
            target = sg_by_node.get(edge.get("to"))
            listener = int(edge.get("listener_port") or 80)
            target_port = int(edge.get("target_port") or 8000)
            resources["AlbIngress"] = _ingress("AlbSecurityGroup", "0.0.0.0/0", listener, "Clyro internet to ALB")
            if edge.get("redirect_http") and listener != 80:
                resources["AlbHttpRedirectIngress"] = _ingress("AlbSecurityGroup", "0.0.0.0/0", 80, "Clyro internet to ALB HTTP")
            if target:
                resources[f"{_pascal(edge.get('to'))}AlbIngress"] = _ingress(
                    target, "sg:AlbSecurityGroup", target_port, "Clyro ALB to service"
                )
        elif edge.get("kind") == "sg_ingress":
            source = sg_by_node.get(edge.get("from"))
            target = sg_by_node.get(edge.get("to"))
            if source and target:
                resources[f"{_pascal(edge.get('from'))}To{_pascal(edge.get('to'))}Ingress"] = _ingress(
                    target, f"sg:{source}", int(edge.get("port") or 0), f"Clyro {edge.get('from')} to {edge.get('to')}"
                )
    return sg_by_node


def _add_s3_and_cloudfront(resources: dict[str, Any], spec: dict[str, Any]) -> str | None:
    iam_prefix = spec.get("iam_scoped_prefix") or "clyro-app"
    has_static = bool(_first_resource(spec, "static"))
    app_bucket_needed = bool(_resources_by_type(spec, "storage") or _has_generated_env(spec, "AWS_S3_BUCKET_NAME")
                             or _has_generated_env(spec, "AWS_STORAGE_BUCKET_NAME"))
    app_bucket = None
    if app_bucket_needed:
        app_bucket = "AppStorageBucket"
        resources[app_bucket] = {
            "Type": "AWS::S3::Bucket",
            "Properties": {
                "BucketName": _sub(f"{iam_prefix}-app-storage-${{AWS::AccountId}}"),
                "PublicAccessBlockConfiguration": {
                    "BlockPublicAcls": True,
                    "BlockPublicPolicy": True,
                    "IgnorePublicAcls": True,
                    "RestrictPublicBuckets": True,
                },
                "BucketEncryption": {
                    "ServerSideEncryptionConfiguration": [{
                        "ServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}
                    }]
                },
            },
        }
    if not has_static:
        return app_bucket
    resources["FrontendBucket"] = {
        "Type": "AWS::S3::Bucket",
        "Properties": {
            "BucketName": _sub(f"{iam_prefix}-frontend-${{AWS::AccountId}}"),
            "PublicAccessBlockConfiguration": {
                "BlockPublicAcls": True,
                "BlockPublicPolicy": True,
                "IgnorePublicAcls": True,
                "RestrictPublicBuckets": True,
            },
            "BucketEncryption": {
                "ServerSideEncryptionConfiguration": [{
                    "ServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}
                }]
            },
        },
    }
    resources["FrontendOAC"] = {
        "Type": "AWS::CloudFront::OriginAccessControl",
        "Properties": {
            "OriginAccessControlConfig": {
                "Name": _sub("${AWS::StackName}-frontend-oac"),
                "OriginAccessControlOriginType": "s3",
                "SigningBehavior": "always",
                "SigningProtocol": "sigv4",
            }
        },
    }
    origins = [{
        "Id": "FrontendS3Origin",
        "DomainName": _getatt("FrontendBucket", "RegionalDomainName"),
        "OriginAccessControlId": _ref("FrontendOAC"),
        "S3OriginConfig": {"OriginAccessIdentity": ""},
    }]
    api_behaviors = []
    if any(e.get("kind") == "alb" for e in spec.get("network_edges") or []):
        origins.append({
            "Id": "BackendAlbOrigin",
            "DomainName": _getatt("ApplicationLoadBalancer", "DNSName"),
            "CustomOriginConfig": {
                "HTTPPort": 80,
                "HTTPSPort": 443,
                "OriginProtocolPolicy": "http-only",
                "OriginSSLProtocols": ["TLSv1.2"],
            },
        })
        api_behaviors.append({
            "PathPattern": "/api/*",
            "TargetOriginId": "BackendAlbOrigin",
            "ViewerProtocolPolicy": "redirect-to-https",
            "AllowedMethods": ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"],
            "CachedMethods": ["GET", "HEAD", "OPTIONS"],
            "Compress": True,
            "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
            "OriginRequestPolicyId": "b689b0a8-53d0-40ab-baf2-68738e2966ac",
        })
    distribution_config = {
        "Enabled": True,
        "DefaultRootObject": "index.html",
        "Origins": origins,
        "DefaultCacheBehavior": {
            "TargetOriginId": "FrontendS3Origin",
            "ViewerProtocolPolicy": "redirect-to-https",
            "AllowedMethods": ["GET", "HEAD", "OPTIONS"],
            "CachedMethods": ["GET", "HEAD"],
            "Compress": True,
            "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
        },
        "CustomErrorResponses": [
            {
                "ErrorCode": 403,
                "ResponseCode": 200,
                "ResponsePagePath": "/index.html",
            },
            {
                "ErrorCode": 404,
                "ResponseCode": 200,
                "ResponsePagePath": "/index.html",
            },
        ],
    }
    if api_behaviors:
        distribution_config["CacheBehaviors"] = api_behaviors
    resources["FrontendDistribution"] = {
        "Type": "AWS::CloudFront::Distribution",
        "Properties": {
            "DistributionConfig": distribution_config
        },
    }
    resources["FrontendBucketPolicy"] = {
        "Type": "AWS::S3::BucketPolicy",
        "Properties": {
            "Bucket": _ref("FrontendBucket"),
            "PolicyDocument": {
                "Version": "2012-10-17",
                "Statement": [{
                    "Effect": "Allow",
                    "Principal": {"Service": "cloudfront.amazonaws.com"},
                    "Action": "s3:GetObject",
                    "Resource": _sub("${FrontendBucket.Arn}/*"),
                    "Condition": {
                        "StringEquals": {
                            "AWS:SourceArn": _sub(
                                "arn:aws:cloudfront::${AWS::AccountId}:distribution/${FrontendDistribution}"
                            )
                        }
                    },
                }],
            },
        },
    }
    return app_bucket


def _add_data_resources(resources: dict[str, Any], spec: dict[str, Any], sg_by_node: dict[str, str]) -> tuple[str | None, str | None]:
    prefix = spec.get("naming_prefix") or "app"
    iam_prefix = spec.get("iam_scoped_prefix") or f"clyro-{prefix}"
    db = _first_resource(spec, "database")
    cache = _first_resource(spec, "cache")
    db_name = _db_name(spec.get("project") or "app")
    db_lid = None
    cache_lid = None
    if db:
        db_lid = "DbInstance"
        resources["DbSecret"] = {
            "Type": "AWS::SecretsManager::Secret",
            "Properties": {
                "Name": f"{iam_prefix}/db",
                "GenerateSecretString": {
                    "SecretStringTemplate": '{"username":"clyro"}',
                    "GenerateStringKey": "password",
                    "PasswordLength": 16,
                    "ExcludeCharacters": '"@/\\',
                },
            },
        }
        resources["DbSubnetGroup"] = {
            "Type": "AWS::RDS::DBSubnetGroup",
            "Properties": {
                "DBSubnetGroupDescription": "Clyro private database subnets",
                "SubnetIds": [_ref("PrivateSubnet1"), _ref("PrivateSubnet2")],
            },
        }
        is_free_tier = spec.get("account_type") == "free_tier"
        backup = 1 if is_free_tier else 7
        # Free-tier accounts reject non-eligible instance classes at deploy time
        # ("This instance size isn't available with free plan accounts") --
        # found live provisioning a real free-tier account. Force the
        # free-tier-eligible class regardless of what the spec suggested,
        # same as the BackupRetentionPeriod cap below.
        db_class = "db.t3.micro" if is_free_tier else (db.get("instance_class") or "db.t3.micro")
        resources[db_lid] = {
            "Type": "AWS::RDS::DBInstance",
            "DeletionPolicy": "Delete",
            "UpdateReplacePolicy": "Delete",
            "Properties": {
                "DBInstanceIdentifier": _name(f"{prefix}-db", 63),
                "Engine": "postgres",
                "DBInstanceClass": db_class,
                "AllocatedStorage": "20",
                "StorageType": "gp2",
                "DBName": db_name,
                "MasterUsername": "clyro",
                "MasterUserPassword": _sub("{{resolve:secretsmanager:${DbSecret}:SecretString:password}}"),
                "DBSubnetGroupName": _ref("DbSubnetGroup"),
                "VPCSecurityGroups": [_ref(sg_by_node.get(db.get("node_id"), "DbSecurityGroup"))],
                "PubliclyAccessible": False,
                "MultiAZ": bool(db.get("multi_az")),
                "BackupRetentionPeriod": backup,
                "DeletionProtection": False,
            },
        }
    if cache:
        cache_lid = "Cache"
        resources["CacheSubnetGroup"] = {
            "Type": "AWS::ElastiCache::SubnetGroup",
            "Properties": {
                "Description": "Clyro private cache subnets",
                "SubnetIds": [_ref("PrivateSubnet1"), _ref("PrivateSubnet2")],
            },
        }
        # Same free-tier instance-class cap as the RDS DBInstance above.
        cache_class = ("cache.t3.micro" if spec.get("account_type") == "free_tier"
                       else (cache.get("node_class") or "cache.t3.micro"))
        resources[cache_lid] = {
            "Type": "AWS::ElastiCache::ReplicationGroup",
            "DeletionPolicy": "Snapshot",
            "UpdateReplacePolicy": "Snapshot",
            "Properties": {
                "ReplicationGroupId": _name(f"{prefix}-cache", 40),
                "ReplicationGroupDescription": "Clyro Redis cache",
                "Engine": "redis",
                "CacheNodeType": cache_class,
                "NumCacheClusters": int(cache.get("replicas") or 0) + 1,
                "AutomaticFailoverEnabled": bool(cache.get("replicas")),
                "CacheSubnetGroupName": _ref("CacheSubnetGroup"),
                "SecurityGroupIds": [_ref(sg_by_node.get(cache.get("node_id"), "CacheSecurityGroup"))],
            },
        }
    return db_lid, cache_lid


def _add_queue(resources: dict[str, Any], spec: dict[str, Any]) -> str | None:
    queue = _first_resource(spec, "queue")
    if not queue:
        return None
    iam_prefix = spec.get("iam_scoped_prefix") or "clyro-app"
    resources["TaskQueue"] = {
        "Type": "AWS::SQS::Queue",
        "Properties": {
            "QueueName": _name(f"{iam_prefix}-{queue.get('node_id')}", 80),
            "VisibilityTimeout": 60,
        },
    }
    return "TaskQueue"


def _add_domain_resources(resources: dict[str, Any], spec: dict[str, Any]) -> str | None:
    """ACM cert (DNS validation) + a Route53 alias record for the ALB. Returns
    the cert's logical id, or None when the spec has no domain.

    The cert's DomainValidationOptions references a DomainHostedZoneId
    Parameter resolved at deploy time (deploy.start(), the first point AWS
    credentials are guaranteed to exist — generate()/refine()/validate() make
    no live AWS calls by design). When no zone can be resolved, the parameter
    defaults to "" and the cert sits PENDING_VALIDATION until the user adds
    the CNAME AWS's console shows — a disclosed operational trade-off, not a
    provisioning blocker. The Route53 RecordSet uses HostedZoneName instead,
    which CloudFormation resolves against the account at deploy time without
    needing the zone id upfront."""
    domain = spec.get("domain") or {}
    if not domain.get("has_domain"):
        return None
    domain_name = domain.get("domain_name")
    hosted_zone_name = domain.get("hosted_zone_name")
    if not domain_name or not hosted_zone_name:
        return None

    resources["DomainCertificate"] = {
        "Type": "AWS::CertificateManager::Certificate",
        "Properties": {
            "DomainName": domain_name,
            "ValidationMethod": "DNS",
            "DomainValidationOptions": [{
                "DomainName": domain_name,
                "HostedZoneId": _ref("DomainHostedZoneId"),
            }],
        },
    }
    resources["DomainRecordSet"] = {
        "Type": "AWS::Route53::RecordSet",
        "Properties": {
            "HostedZoneName": f"{hosted_zone_name}.",
            "Name": f"{domain_name}.",
            "Type": "A",
            "AliasTarget": {
                "DNSName": _getatt("ApplicationLoadBalancer", "DNSName"),
                "HostedZoneId": _getatt("ApplicationLoadBalancer", "CanonicalHostedZoneID"),
            },
        },
    }
    return "DomainCertificate"


def _add_alb(resources: dict[str, Any], spec: dict[str, Any], sg_by_node: dict[str, str]) -> dict[str, str]:
    public_services = {e.get("to"): e for e in spec.get("network_edges") or [] if e.get("kind") == "alb"}
    target_groups: dict[str, str] = {}
    if not public_services:
        return target_groups
    short = spec.get("short_prefix") or spec.get("naming_prefix") or "app"
    resources["ApplicationLoadBalancer"] = {
        "Type": "AWS::ElasticLoadBalancingV2::LoadBalancer",
        "Properties": {
            "Name": _name(f"{short}-alb", 32),
            "Type": "application",
            "Scheme": "internet-facing",
            "SecurityGroups": [_ref("AlbSecurityGroup")],
            "Subnets": [_ref("PublicSubnet1"), _ref("PublicSubnet2")],
        },
    }
    default_tg = None
    for node_id, edge in public_services.items():
        tg = f"{_pascal(node_id)}TargetGroup"
        target_groups[node_id] = tg
        default_tg = default_tg or tg
        resources[tg] = {
            "Type": "AWS::ElasticLoadBalancingV2::TargetGroup",
            "Properties": {
                "Name": _name(f"{short}-{node_id}-tg", 32),
                "VpcId": _ref("Vpc"),
                "Protocol": "HTTP",
                "Port": int(edge.get("target_port") or 8000),
                "TargetType": "ip",
                "HealthCheckPath": spec.get("health_check_path") or "/health",
                "Matcher": {"HttpCode": "200-399"},
            },
        }

    sample_edge = next(iter(public_services.values()))
    listener_port = int(sample_edge.get("listener_port") or 80)
    redirect_http = bool(sample_edge.get("redirect_http")) and listener_port != 80
    cert_id = _add_domain_resources(resources, spec) if redirect_http else None

    if cert_id:
        resources["AlbListener"] = {
            "Type": "AWS::ElasticLoadBalancingV2::Listener",
            "Properties": {
                "LoadBalancerArn": _ref("ApplicationLoadBalancer"),
                "Port": listener_port,
                "Protocol": "HTTPS",
                "Certificates": [{"CertificateArn": _ref(cert_id)}],
                "DefaultActions": [{"Type": "forward", "TargetGroupArn": _ref(default_tg)}],
            },
        }
        resources["AlbHttpRedirectListener"] = {
            "Type": "AWS::ElasticLoadBalancingV2::Listener",
            "Properties": {
                "LoadBalancerArn": _ref("ApplicationLoadBalancer"),
                "Port": 80,
                "Protocol": "HTTP",
                "DefaultActions": [{
                    "Type": "redirect",
                    "RedirectConfig": {
                        "Protocol": "HTTPS", "Port": str(listener_port),
                        "StatusCode": "HTTP_301",
                    },
                }],
            },
        }
    else:
        resources["AlbListener"] = {
            "Type": "AWS::ElasticLoadBalancingV2::Listener",
            "Properties": {
                "LoadBalancerArn": _ref("ApplicationLoadBalancer"),
                "Port": listener_port,
                "Protocol": "HTTP",
                "DefaultActions": [{"Type": "forward", "TargetGroupArn": _ref(default_tg)}],
            },
        }
    return target_groups


def _add_ecs(resources: dict[str, Any], spec: dict[str, Any], sg_by_node: dict[str, str],
             target_groups: dict[str, str], app_bucket: str | None, db_name: str) -> None:
    prefix = spec.get("naming_prefix") or "app"
    iam_prefix = spec.get("iam_scoped_prefix") or f"clyro-{prefix}"
    resources["EcsCluster"] = {
        "Type": "AWS::ECS::Cluster",
        "Properties": {
            "ClusterName": f"{prefix}-cluster",
            "ClusterSettings": [{"Name": "containerInsights", "Value": "enabled"}],
        },
    }
    log_groups = []
    secret_resources: list[Any] = []
    if "DbSecret" in resources:
        secret_resources.append(_getatt("DbSecret", "Id"))
    secret_resources.extend(s["secretsmanager_arn"] for s in spec.get("secrets") or [] if s.get("secretsmanager_arn"))
    execution_policies = []
    if secret_resources:
        execution_policies.append({
            "PolicyName": "read-task-secrets",
            "PolicyDocument": {
                "Version": "2012-10-17",
                "Statement": [_policy_statement("Allow", ["secretsmanager:GetSecretValue"], secret_resources)],
            },
        })
    resources.update([_role(
        "TaskExecutionRole",
        f"{iam_prefix}-ecs-exec",
        "ecs-tasks.amazonaws.com",
        policies=execution_policies,
        managed=["arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"],
    )])
    task_statements = []
    if "TaskQueue" in resources:
        task_statements.append(_policy_statement(
            "Allow",
            ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes", "sqs:GetQueueUrl"],
            _getatt("TaskQueue", "Arn"),
        ))
    if app_bucket:
        task_statements.append(_policy_statement(
            "Allow",
            ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
            [_getatt(app_bucket, "Arn"), _sub(f"${{{app_bucket}.Arn}}/*")],
        ))
    resources.update([_role(
        "TaskRole",
        f"{iam_prefix}-ecs-task",
        "ecs-tasks.amazonaws.com",
        policies=[{
            "PolicyName": "app-access",
            "PolicyDocument": {"Version": "2012-10-17", "Statement": task_statements or [
                _policy_statement("Allow", ["cloudwatch:PutMetricData"], "*")
            ]},
        }],
    )])

    owners = _docker_repo_owners(spec)
    for owner in sorted(set(owners.values())):
        resources[f"{_pascal(owner)}Repository"] = {
            "Type": "AWS::ECR::Repository",
            "Properties": {
                "RepositoryName": f"{prefix}-{owner}",
                "ImageScanningConfiguration": {"ScanOnPush": True},
            },
        }

    subnet_ids = [_ref("PublicSubnet1"), _ref("PublicSubnet2")] if (spec.get("networking") or {}).get("task_placement") == "public" else [_ref("PrivateSubnet1"), _ref("PrivateSubnet2")]
    assign_public = "ENABLED" if (spec.get("networking") or {}).get("task_placement") == "public" else "DISABLED"
    env = _container_environment(spec, db_name=db_name, app_bucket=app_bucket)
    secrets = _container_secrets(spec)
    for entry in spec.get("resources") or []:
        if entry.get("type") not in ("service", "worker"):
            continue
        node = entry["node_id"]
        pascal = _pascal(node)
        owner = owners.get(node, node)
        log_group = f"{pascal}LogGroup"
        task_def = f"{pascal}TaskDefinition"
        service = f"{pascal}Service"
        port = int(entry.get("container_port") or 8000)
        log_groups.append(log_group)
        resources[log_group] = {
            "Type": "AWS::Logs::LogGroup",
            "Properties": {"LogGroupName": f"/ecs/{iam_prefix}-{node}", "RetentionInDays": 14},
        }
        container: dict[str, Any] = {
            "Name": node,
            "Image": _sub(f"${{AWS::AccountId}}.dkr.ecr.${{AWS::Region}}.amazonaws.com/{prefix}-{owner}:latest"),
            "Essential": True,
            "Environment": env,
            "Secrets": secrets,
            "LogConfiguration": {
                "LogDriver": "awslogs",
                "Options": {
                    "awslogs-group": _ref(log_group),
                    "awslogs-region": _ref("AWS::Region"),
                    "awslogs-stream-prefix": node,
                },
            },
        }
        if entry.get("type") == "service":
            container["PortMappings"] = [{"ContainerPort": port, "Protocol": "tcp"}]
        resources[task_def] = {
            "Type": "AWS::ECS::TaskDefinition",
            "Properties": {
                "Family": f"{prefix}-{node}",
                "RequiresCompatibilities": ["FARGATE"],
                "NetworkMode": "awsvpc",
                "Cpu": _cpu_units((entry.get("sizing") or {}).get("fargate_vcpu")),
                "Memory": _memory_mb((entry.get("sizing") or {}).get("fargate_gb")),
                "ExecutionRoleArn": _getatt("TaskExecutionRole", "Arn"),
                "TaskRoleArn": _getatt("TaskRole", "Arn"),
                "ContainerDefinitions": [container],
            },
        }
        svc_props: dict[str, Any] = {
            "ServiceName": f"{prefix}-{node}",
            "Cluster": _ref("EcsCluster"),
            "TaskDefinition": _ref(task_def),
            "LaunchType": "FARGATE",
            "DesiredCount": 0,
            "NetworkConfiguration": {
                "AwsvpcConfiguration": {
                    "AssignPublicIp": assign_public,
                    "SecurityGroups": [_ref(sg_by_node[node])],
                    "Subnets": subnet_ids,
                }
            },
        }
        if node in target_groups:
            svc_props["LoadBalancers"] = [{
                "ContainerName": node,
                "ContainerPort": port,
                "TargetGroupArn": _ref(target_groups[node]),
            }]
            resources[service] = {"Type": "AWS::ECS::Service", "DependsOn": ["AlbListener"], "Properties": svc_props}
        else:
            resources[service] = {"Type": "AWS::ECS::Service", "Properties": svc_props}


def generate_template(spec: dict[str, Any]) -> str:
    """Return a deterministic CloudFormation YAML template for a build spec."""
    resources: dict[str, Any] = {}
    outputs: dict[str, Any] = {}
    project = spec.get("project") or "app"
    db_name = _db_name(project)

    _add_networking(resources, spec)
    sg_by_node = _add_security_groups(resources, spec)
    app_bucket = _add_s3_and_cloudfront(resources, spec)
    _add_data_resources(resources, spec, sg_by_node)
    _add_queue(resources, spec)
    target_groups = _add_alb(resources, spec, sg_by_node)
    _add_ecs(resources, spec, sg_by_node, target_groups, app_bucket, db_name)

    if "ApplicationLoadBalancer" in resources:
        outputs["BackendURL"] = {
            "Description": "Application load balancer URL",
            "Value": _sub("http://${ApplicationLoadBalancer.DNSName}"),
        }
    if "FrontendDistribution" in resources:
        outputs["FrontendURL"] = {
            "Description": "CloudFront URL",
            "Value": _sub("https://${FrontendDistribution.DomainName}"),
        }
        outputs["FrontendBucketName"] = {"Description": "Frontend bucket", "Value": _ref("FrontendBucket")}
    if "TaskQueue" in resources:
        outputs["TaskQueueURL"] = {"Description": "Task queue URL", "Value": _ref("TaskQueue")}
    if "DbInstance" in resources:
        outputs["DatabaseEndpoint"] = {"Description": "Database endpoint", "Value": _getatt("DbInstance", "Endpoint.Address")}
    if "DomainCertificate" in resources:
        outputs["ApplicationURL"] = {
            "Description": "Application URL",
            "Value": _sub(f"https://{(spec.get('domain') or {}).get('domain_name')}"),
        }

    parameters: dict[str, Any] = {}
    if "DomainCertificate" in resources:
        parameters["DomainHostedZoneId"] = {
            "Type": "String",
            "Default": "",
            "Description": (
                "Route53 hosted zone id for the ACM DNS validation record — "
                "resolved live by Clyro at provisioning time. Left blank if no "
                "matching hosted zone was found; the certificate then needs "
                "manual DNS validation."
            ),
        }

    doc = {
        "AWSTemplateFormatVersion": "2010-09-09",
        "Description": f"Clyro deterministic infrastructure for {project}",
    }
    if parameters:
        doc["Parameters"] = parameters
    doc["Resources"] = resources
    doc["Outputs"] = outputs
    yaml_str = yaml.dump(doc, Dumper=_Dumper, sort_keys=False, width=120)

    from . import codebuild_spec
    cloudfront = "FrontendDistribution" if "FrontendDistribution" in resources else None
    bucket = "FrontendBucket" if "FrontendBucket" in resources else None
    cb_yaml = codebuild_spec.generate_codebuild_resources(spec, cloudfront, bucket)
    yaml_str = codebuild_spec.splice_into_template(yaml_str, cb_yaml)

    return yaml_str

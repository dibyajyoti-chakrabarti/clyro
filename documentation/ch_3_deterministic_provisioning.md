# Chapter 3: Deterministic Provisioning

Everything in this chapter is about the **customer** infrastructure Clyro generates, not
about Clyro's own platform. See Chapter 6 for the platform.

In earlier iterations Clyro asked an LLM to write the final CloudFormation template
directly. That proved unreliable: syntax errors, invented resource properties, and
security misconfigurations that validated but were wrong.

## The spec approach

The agent now produces a simplified **JSON architecture spec**: nodes, their AWS service
choices, sizing, connections, and the networking and domain decisions taken from the
user's answers. That spec, not YAML, is the LLM's output. Examples live in
`backend/app/tests.py`.

`backend/app/provisioning/build_spec.py` assembles the spec from the canvas, the intent
record and the ingested contract, and picks the CloudFormation resource set for each
node.

## The generator

`backend/app/provisioning/cfn_generator.py` turns the spec into strictly valid
CloudFormation YAML. Nothing in it asks a model anything. The main entry point is
`generate_template(spec)`, and it composes a fixed set of builders:

| Builder | Produces |
| --- | --- |
| `_add_networking` | VPC, two public and two private subnets across two AZs, an IGW, a public and a private route table. A NAT **Gateway** and the private default route are added **only** when `networking.nat_gateway` is set, which is how the free-tier path avoids the charge. |
| `_add_security_groups` | One group per node, with ingress derived from the canvas connections rather than configured by hand |
| `_add_data_resources` | RDS PostgreSQL, its subnet group, and the Secrets Manager secret holding its credentials |
| `_add_ecs` | Cluster, task definitions, services, task and execution roles, log groups |
| `_add_alb` | Load balancer, target groups and listeners, when the topology has one |
| `_add_s3_and_cloudfront` | Static frontend bucket, distribution, origin access control |
| `_add_queue` | SQS queue and policy |
| `_add_domain_resources` | ACM certificate and the DNS records that validate it |
| `_add_alerting` | SNS topic, subscription, and CloudWatch alarms |
| `_add_log_archive_bucket` | The log archive bucket |

`backend/app/provisioning/codebuild_spec.py` generates the CodeBuild project and its IAM
role: it fetches the application source from the build-archive S3 bucket and pushes the
built image to ECR.

`backend/app/provisioning/iac.py` is the layer above. It owns generation, validation,
conformance checking against the spec (`check_spec_conformance`), and the deterministic
repairs applied when a stack fails for a known reason.

## What a generated stack looks like

For the **development-shaped** topology, roughly 34 CloudFormation resources: a VPC, four
subnets, two route tables, an IGW, two security groups, an RDS PostgreSQL instance, a DB
subnet group, a Secrets Manager secret, an ECS cluster with a task definition and a
service, an ECR repository, a CodeBuild project, two S3 buckets, a log group, three IAM
roles, an SNS topic with a subscription, and a CloudWatch alarm.

Note what is **not** in that list: there is no load balancer in the development topology.

## Deployment execution

`backend/app/provisioning/deploy.py` submits the template to the user's account with
boto3, on temporary credentials from assuming the connector role, and polls the stack
events back into `ProvisioningLogEntry`.

The ordering is the part that is easy to get wrong, and it is covered in Chapter 11:
services are authored with `DesiredCount: 0` so the stack can reach completion before any
container image exists, then CodeBuild builds and pushes the image, then a one-off ECS
task runs the application's database migrations, and only then are the services scaled to
the count in the spec.

# Ch. 18 — IAM Least-Privilege Review

Audit items `audit/codebase/security.md` #3 and `audit/infra/security.md` #1 asked for a
dedicated least-privilege pass over (a) the customer-facing IAM roles the deterministic
generator emits, and (b) `ClyroProvisioningRole`'s own permissions. This chapter is that
review's output — a read-only audit, not a code change. Re-run it whenever
`cfn_generator.py`'s role-emitting code or `bootstrap.yaml`'s `ClyroProvisioningPolicy`
changes meaningfully, and at least once a quarter regardless.

## 1. Generated customer-facing roles (`backend/app/provisioning/cfn_generator.py`)

Two IAM roles are emitted per deployment:

- **`TaskExecutionRole`** (`cfn_generator.py:622-628`) — the ECS agent's own role (image
  pull, log push). Uses AWS's managed
  `AmazonECSTaskExecutionRolePolicy` plus, when the spec has secrets, an inline
  `secretsmanager:GetSecretValue` statement scoped to the specific ARNs resolved for
  this deployment (`secret_resources`, not `*`). **Verdict: correctly scoped.**
- **`TaskRole`** (`cfn_generator.py:642-652`) — the application container's own
  permissions at runtime:
  - SQS actions (`SendMessage`/`ReceiveMessage`/`DeleteMessage`/`GetQueueAttributes`/`GetQueueUrl`)
    scoped to `!GetAtt TaskQueue.Arn` — this deployment's own queue only. **Correctly scoped.**
  - S3 actions (`GetObject`/`PutObject`/`DeleteObject`/`ListBucket`) scoped to the app's
    own bucket ARN + `/*`. **Correctly scoped.**
  - Fallback `cloudwatch:PutMetricData` on `Resource: '*'` when neither a queue nor a
    bucket exists. `PutMetricData` has no resource-level ARN scoping in AWS's IAM model
    (confirmed against the CloudWatch actions table) — `*` here is the actual AWS
    constraint, not an over-broad grant. **Acceptable, not a finding.**

No changes recommended. Both roles already follow the principle of scoping to the
specific resource this deployment created, falling back to `*` only where AWS's own API
doesn't support resource-level scoping.

## 2. `ClyroProvisioningRole` / `ClyroProvisioningPolicy` (`backend/cfn-templates/bootstrap.yaml`)

This is the cross-account role Clyro assumes in a connected customer account to run
`CreateStack`/`UpdateStack`/`DeleteStack` against the generated template. Every
statement is scoped to `arn:...:clyro-*`-prefixed resources **except** the following
service groups, which use `Resource: '*'`:

| Service | Why `*` (per the template's own inline comments, verified against the AWS IAM actions reference) |
|---|---|
| `ec2:*` (VPC/subnet/SG/route table/NAT/IGW create-describe-modify) | None of these EC2 networking actions support resource-level ARN scoping in AWS's IAM model — this is a hard AWS constraint, not a Clyro choice. |
| `ecs:*` (cluster/service/task-def create-describe-update) | Same — ECS's control-plane actions don't support resource-level scoping for `Create*`/`Describe*`. |
| `application-autoscaling:*` | Same constraint class. |
| `ecr:GetAuthorizationToken` | Explicitly called out in the template: this action has no resource-level scoping in AWS's IAM model at all (same class as `secretsmanager:GetRandomPassword`). Other ECR actions in the same statement (repo management, image push) are candidates for scoping to `arn:...:repository/clyro-*` — **see recommendation below**. |
| `elasticloadbalancing:*` | ALB/target-group/listener create-describe actions — same non-scopable-action constraint. |
| `rds:*`, `elasticache:*` | Same constraint class for the create/describe surface used. |
| `cloudwatch:*` (read-only) | Powers the Step 5 metrics panel (ALB response time/request rate/error rate, ECS CPU) — `cloudwatch:GetMetricData`/`ListMetrics`-style read actions don't support resource-level scoping. |
| `logs:*` (one statement) | Comment notes "not IamScopedPrefix — unlike log groups, there's no clyro- substring to scope on" — worth a second look (see below). |

### Recommendation (non-blocking, low priority)

1. **`ecr:CreateRepository`/`DescribeRepositories`/`SetRepositoryPolicy`/`PutLifecyclePolicy`/`TagResource`/`BatchCheckLayerAvailability`/`InitiateLayerUpload`/`UploadLayerPart`/`CompleteLayerUpload`/`PutImage`/`BatchGetImage`** *do* support resource-level ARN scoping (`arn:aws:ecr:*:{account}:repository/clyro-*`) — only `GetAuthorizationToken` genuinely requires `*`. Consider splitting this into two statements: a scoped one for everything but `GetAuthorizationToken`, and a separate `Resource: '*'` statement for just that one action. Low priority — these repos are already namespaced `clyro-*` and only reachable by an account that's explicitly connected Clyro, so the practical exposure is limited, but it's a straightforward tightening.
2. **The `logs:*` statement** flagged in its own comment as lacking a `clyro-` substring to scope on — worth re-checking whether the actual log group names created by `cfn_generator.py` (`/ecs/{iam_prefix}-{node}`, per `cfn_generator.py:681`) could support a `logs:*` scoped to `arn:aws:logs:*:{account}:log-group:/ecs/clyro-*` instead of `*`. Likely tightenable; not done as part of this review since it's read-only.

### Recommendation (standing, not a one-time fix)

Run AWS IAM Access Analyzer's policy-generator against `ClyroProvisioningRole` in
Clyro's own connected test account periodically (recommended cadence: **quarterly**, or
whenever `bootstrap.yaml`'s policy changes) to catch any newly-unused actions as the
generated template's resource surface evolves. This is inherently a recurring review,
not a one-time code change — track it as a recurring calendar item, not a backlog ticket.

## Conclusion

No urgent findings. The two `ecr`/`logs` tightening opportunities above are optional,
low-priority follow-ups — everything else already uses the narrowest scoping AWS's IAM
model permits for the actions in question.

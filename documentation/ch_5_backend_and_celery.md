# Chapter 5: Backend, Celery & Agents

The Django backend owns the API, the database, the cross-account AWS calls, and the
deterministic layers that turn a canvas into a CloudFormation template.

In production it runs as containers on one EC2 instance: **uvicorn** serving
`config.asgi:application` with three workers, behind nginx, with PostgreSQL and Redis as
sibling containers on the same box. Chapter 6 has the detail. There is no Lambda and no
managed database in Clyro's own account.

## Celery

Long-running AI generation cannot block an HTTP request, so every slow path is a Celery
task dispatched with `.delay()` and tracked by an `AgentJob` row.

The broker and the result backend are both the **Redis container on the same instance**
(`redis://redis:6379/1`). Not SQS, and not ElastiCache. Redis runs with persistence
disabled, which is deliberate: losing queued jobs on a reboot is acceptable because every
task is retriable.

Tasks in `backend/app/tasks.py`:

| Task | Work |
| --- | --- |
| `run_scan_task` | Ingest and verify the repo's `CLYRO.md` contract |
| `run_canvas_agent_task` | One turn of the canvas conversation |
| `run_iac_generate_task` | Generate the CloudFormation template |
| `run_iac_refine_task` | Apply a refinement instruction to it |
| `run_provision_task` | Create the stack, build, migrate, scale up |
| `run_recreate_task` | Tear down and provision again |
| `run_build_task` | Rebuild and redeploy the application image |
| `run_delete_project_task` | Teardown plus project removal |
| `run_warmup_task` | Warm an AgentCore runtime ahead of a user hitting it |

`CELERY_TASK_TIME_LIMIT` is 900 seconds, and the provisioning tasks raise their own limits
above that, because a real stack create plus a CodeBuild run plus migrations genuinely
takes tens of minutes.

### Scheduled work

Celery beat runs as its own container from the same image, driving `CELERY_BEAT_SCHEDULE`
in `backend/config/settings.py`:

- `reconcile-aws-state`, every 15 minutes: catches dead account connections and
  `Deployment` rows stuck in `deleting`, rather than only discovering them the next time
  a user triggers an assume-role.
- `collect-health-snapshots`, every 60 seconds: one `HealthSnapshot` per live project,
  which is what the step 7 uptime percentage and 24 hour status strip are computed from.
- `archive-service-logs`, every 5 minutes: copies each live service's CloudWatch events
  into the generated stack's log archive bucket as JSONL, with idempotent keys.

### Progress reporting

Tasks write to `ProvisioningLogEntry` as they go and the frontend polls. There is no
websocket. Reasoning deltas from the models that emit them are forwarded into the same
stream, which is what produces the "Thinking..." output during canvas and IaC turns.

> **Stale comments in the code (2026-09-06).** `config/settings.py` still carries comments
> saying production uses SQS, that "production has no Redis", and that beat runs as a
> sidecar in `infrastructure/modules/celery_worker/`. None of that is true any more: the
> broker is the Redis container, and there is no `celery_worker` Terraform module. The
> Django cache genuinely is per-process LocMem, which is the one part of that comment
> block still correct, and it is fine because the cache holds only short-TTL health poll
> snapshots that do not need cross-process coherence.

## AI agents

Two Amazon Bedrock AgentCore runtimes, in `backend/agents/`, deployed by
`.github/workflows/deploy-agents.yml` as CodeZip bundles:

- **`CryloCanvas_Reasoning`** (`backend/agents/CryloCanvas/`) is the conversational layer
  over the architecture canvas, used in wizard steps 3 and 4. It is the only LLM in that
  part of the flow: placement, validation and cost are deterministic, in
  `backend/canvas_core/`.
- **`CryloIac_IacArchitect`** (`backend/agents/CryloIac/`) generates and refines the
  CloudFormation template in step 5, with lint and security fix rounds.

Neither writes the final template unsupervised. `backend/app/provisioning/iac.py` checks
whatever comes back against the spec (`check_spec_conformance`) and applies deterministic
repairs for known failure modes. Chapter 13 covers that mechanism, and Chapter 14 the
agent network as designed.

### Models

Selected in each runtime's `model/load.py`:

| Role | Default | Alternatives |
| --- | --- | --- |
| Canvas | MiniMax M2.5 | Kimi K2.5, GLM-5, DeepSeek V3.2 |
| IaC generate | MiniMax M2.5 | Kimi K2.5, GLM-5, DeepSeek V3.2 |
| IaC refine | GLM-5 | as above |

MiniMax is the default because it reasons natively, so the wizard gets useful progress
output without a separate extended-thinking configuration. Clyro has deliberately moved
off Anthropic models on Bedrock; any document describing this as an Anthropic-model
system is out of date.

### MCP tools

The runtimes reach three MCP tool Lambdas through the AgentCore gateway:
`clyro-mcp-pricing` (`get_pricing`), `clyro-mcp-cfn`
(`validate_cloudformation_template`) and `clyro-mcp-docs` (`search_documentation`,
`read_documentation`, `recommend`). Their sources are in `backend/mcp/`, they are
deployed by `backend/mcp/deploy_mcp.sh`, and their ARNs are published to SSM under
`/clyro/prod/mcp/` for the gateway to read.

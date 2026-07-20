from __future__ import annotations

import asyncio
import json
import re
from typing import Any

from bedrock_agentcore.runtime import BedrockAgentCoreApp
from strands import Agent

from mcp_client.client import get_mcp_client
from model.load import DEFAULT_GENERATE, DEFAULT_REFINE, load_model, resolve_model_id

app = BedrockAgentCoreApp()
log = app.logger

_AUTHORING_RULES = """
AUTHORING RULES (from the build spec):
- networking: create a VPC (use networking.vpc_cidr), public + private subnets across
  networking.az_count AZs. ALB and CloudFront origins live in public subnets; RDS and
  ElastiCache live in PRIVATE subnets with no public access. An ALB always needs subnets
  in >= 2 AZs.
    * ECS task placement follows networking.task_placement. "private" (default) → run
      tasks in the private subnets with AssignPublicIp DISABLED. "public" → run tasks in
      the PUBLIC subnets with AssignPublicIp ENABLED, so they can pull images from ECR
      without a NAT gateway. This applies to EVERY `AWS::ECS::Service` you create in
      this template — the primary service AND any worker/background services — not
      just the first one. When `nat_gateway` is false, a task left in a private subnet
      has NO route to ECR/Secrets Manager/CloudWatch Logs at all and will never start
      (ResourceInitializationError pulling registry auth) — this is a blocker, not a
      warning, and it's easy to apply the placement to one service and forget the
      other(s) when a template has multiple services. Double-check every
      NetworkConfiguration.AwsvpcConfiguration block uses the SAME Subnets/AssignPublicIp
      pairing before you finish.
    * NAT gateways: create them (one per AZ, each with an EIP, and a default route from
      the private route table) ONLY if networking.nat_gateway is true. If it is false,
      create NO NatGateway/EIP and give the private subnets no internet route — nothing
      there (RDS/ElastiCache) needs outbound internet.
- security groups: create exactly one SG per resource that lists a `security_group`.
  For every network_edge:
    * kind "sg_ingress": add an ingress rule on `to_sg` allowing `port`/`protocol`
      FROM `from_sg` (source security group, not a CIDR).
    * kind "alb": create the ALB security group (`alb_sg`), a listener on
      `listener_port`, a target group to the service on `target_port`, and an ingress
      rule on the service SG from the ALB SG. If `redirect_http` is true, add an
      HTTP:80 listener that redirects to HTTPS:443. Name the ALB and its Target
      Group(s) using `short_prefix` (NOT `naming_prefix`) — these two resource types
      have a hard 32-character AWS limit and `short_prefix` is already pre-truncated
      to leave room for your suffix (e.g. `${short_prefix}-alb`, `${short_prefix}-tg`).
    * kind "none": add NO ingress rule (asynchronous / IAM-scoped access).
- resources: for each entry in resources[], create exactly the AWS resource types in
  its `cfn_resources`. Apply sizing (Fargate vCPU/memory + desired task count; RDS/
  Aurora instance_class + Multi-AZ; ElastiCache node_class + replicas).
- container images: the `image` field is a placeholder ("ecr") standing in for the
  project's own ECR repository — ALWAYS reference it as a parameter/`!Sub` built from
  naming_prefix (e.g. an `AWS::ECR::Repository` you create, or
  `${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/${naming_prefix}-<node_id>:latest`).
  NEVER emit a generic public image (nginx:latest, httpd:latest, alpine, hello-world,
  etc.) in its place — a stack that "succeeds" while running the wrong image is a
  silent failure, worse than one that fails to deploy. NEVER emit a literal
  placeholder token either (e.g. `<IMAGE_URL_PLACEHOLDER>`, `YOUR_IMAGE_HERE`,
  `REPLACE_ME`) — ECS will reject it outright, and it's no more real than a generic
  public image. The real `${AWS::AccountId}.dkr.ecr...}` reference above is always
  constructible from the build spec; there is never a reason to leave a stand-in.
- IAM roles for ECS: every `AWS::ECS::TaskDefinition` needs TWO separate IAM roles,
  never one shared role:
    * ExecutionRoleArn — only what CFN/ECS needs to start the task: ECR image pull,
      CloudWatch Logs write, and (if generate_env/secrets reference it) reading the
      specific Secrets Manager ARNs injected as container secrets.
    * TaskRoleArn — only what the APPLICATION calls at runtime. Cross-reference this
      node's `generated_env` / sibling `resources[]` entries: if an SQS queue exists in
      the spec, grant `sqs:SendMessage`/`ReceiveMessage`/`DeleteMessage`/
      `GetQueueAttributes` scoped to that queue's ARN; if an S3 bucket exists, grant the
      specific `s3:GetObject`/`PutObject` etc. scoped to that bucket's ARN. Grant NOTHING
      the spec doesn't imply the app calls. Never put `Resource: "*"` on
      secretsmanager/s3/sqs/sns actions — always scope to the ARN of the resource you
      created in this same template.
    * Reference a role's ARN with `!GetAtt <Role>.Arn`, NEVER `!Ref <Role>`. `!Ref` on an
      `AWS::IAM::Role` returns the role NAME, not its ARN, so `ExecutionRoleArn` /
      `TaskRoleArn` (and any `*Arn` / `Role:` field expecting an ARN) silently receive a
      bare name where an ARN is required. This is a recurring first-draft mistake — get it
      right up front so it never reaches a validation round.
    * Every `Resource:`/`Principal:` ARN you write in an IAM policy statement must use
      `${AWS::AccountId}`/`${AWS::Region}` pseudo-parameters, NEVER a literal 12-digit
      account number or literal region string — an IAM grant is always describing "this
      same deploying account", and a hardcoded account number breaks the template if
      deployed anywhere else (and can coincidentally reference the wrong account
      entirely). This does NOT apply to a pre-existing secret's real ARN used to
      *resolve its value* (see `secrets:`/`generated_env` below) — that ARN is supplied
      data, not something you construct, and must stay exactly as given.
- security groups (continued): restrict egress explicitly per tier instead of the
  CloudFormation default allow-all — a service/worker SG should egress only to the
  ports it actually needs (DB port to the db SG, cache port to the cache SG, 443 for
  ECR/Secrets Manager/general HTTPS), not 0.0.0.0/0 on all ports.
- CloudFront managed policy IDs: if you reference an AWS-managed CachePolicy /
  OriginRequestPolicy by Id (rather than creating your own), use ONLY these verified
  IDs — do not invent or recall others from memory:
    * CachingOptimized: 658327ea-f89d-4fab-a63d-7e88639e58f6
    * CachingDisabled: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad
    * AllViewerExceptHostHeader (origin request): b689b0a8-53d0-40ab-baf2-68738e2966ac
  If the spec's needs don't clearly match one of these, create your own
  `AWS::CloudFront::CachePolicy` / `OriginRequestPolicy` resource instead of guessing an
  Id.
- stateful-resource hygiene (avoids cfn-lint warnings that would otherwise need a fix
  round):
    * Do NOT set EngineVersion on RDS DBInstance / Aurora DBCluster — omit it so AWS
      selects a current supported default. Pinning a specific minor version (e.g.
      '16.3') triggers W3691 ("deprecated and cannot be used to create new RDS DB
      instances") and fails at deploy as versions age out.
    * If account_type is "free_tier", set RDS `BackupRetentionPeriod: 1` (not the
      commonly-used default of 7) — some AWS accounts enrolled in the free tier
      hard-cap this below 7 and CreateDBInstance fails at deploy time with
      "FreeTierRestrictionError: The specified backup retention period exceeds the
      maximum available to free tier customers." 1 is safe; 7 is not, on those
      accounts. Paid-tier accounts can use 7.
    * On every stateful data resource (RDS DBInstance/DBCluster, ElastiCache
      ReplicationGroup) set BOTH DeletionPolicy AND UpdateReplacePolicy to Snapshot.
      cfn-lint W3011 fires if only one is present. Do NOT use Retain on ElastiCache —
      it was tried and breaks CloudFormation's own automatic rollback: if ANY other
      resource in the stack fails after the cache finishes creating, CFN's rollback
      can't delete the CacheSecurityGroup because the retained (never-deleted)
      replication group's ENI still references it, permanently wedging the stack in
      ROLLBACK_FAILED with the cache and its security group still running and billing.
      Snapshot deletes the replication group (after taking a final snapshot) exactly
      like RDS, so rollback/teardown can actually complete.
    * RDS DBInstance MUST set `DBName` to the exact database your DATABASE_URL
      connects to — the path segment of the URL. e.g. for
      `…@${DbInstance.Endpoint.Address}:5432/appdb` set `DBName: appdb`. PostgreSQL
      RDS creates NO user database when DBName is omitted (only the internal
      `postgres` db), so the app and `manage.py migrate` both die with
      `FATAL: database "appdb" does not exist` the instant they connect.
- naming: three prefixes are provided — use the right one per resource type, they are
  NOT interchangeable:
    * `naming_prefix` — the default. Use it for everything not listed below.
    * `iam_scoped_prefix` (`naming_prefix` with a "clyro-" marker) — IAM role names, S3
      bucket names, SQS queue names, and CloudWatch Log Group names ONLY. Required so
      bootstrap.yaml's cross-account IAM policy can scope those four resource types
      instead of granting them `Resource: "*"`.
    * `short_prefix` (pre-truncated to stay safe) — the ALB name and Target Group
      name(s) ONLY. These two resource types cap at 32 characters TOTAL including your
      suffix, and a real project name is often already close to or over that limit on
      its own — do not use `naming_prefix` or `iam_scoped_prefix` for these, use
      `short_prefix`.
  Other AWS length limits to keep in mind (roomier, but still finite): ElastiCache
  ReplicationGroupId 40 chars, RDS DBInstanceIdentifier/DBClusterIdentifier 63 chars,
  S3 bucket name 63 chars total (you're also appending `-${AWS::AccountId}`, 12+ more
  characters — account for it), IAM role name 64 chars, SQS queue name 80 chars.
- secrets: reference each entry in secrets[] via a CloudFormation dynamic reference
  ({{resolve:secretsmanager:<arn>}}) injected as a container environment variable —
  NEVER inline a secret value. These secrets are stored as PLAIN STRINGS (created via
  a raw `SecretString` write, not a JSON document) — the reference must be exactly
  `{{resolve:secretsmanager:<arn>}}` or `{{resolve:secretsmanager:<arn>:SecretString}}`,
  with NO trailing `:<json-key>` segment. Do NOT append a third segment like
  `:SecretString:SECRET_KEY` (as if extracting a field from a JSON object) — that tells
  AWS to JSON-parse the secret and fails at deploy time with "Could not parse
  SecretString JSON" on a plain-string secret. This is different from the
  `generated_env` RDS master-credentials secret below, which genuinely IS created as
  JSON (`{"username": ..., "password": ...}`) and DOES need the `:SecretString:password`
  field-extraction form — don't confuse the two patterns.
- generated_env: synthesize each entry from the resources you create (e.g. DATABASE_URL
  from the RDS endpoint + its generated master-credentials secret, REDIS_URL from the
  ElastiCache primary endpoint, CELERY_BROKER_URL from the SQS queue URL) and inject it
  as a container environment variable. When a value embeds a generated secret's
  password (e.g. RDS master password in DATABASE_URL), you MUST use the dynamic
  reference `{{resolve:secretsmanager:${SecretLogicalId}:SecretString:password}}` —
  e.g. `!Sub 'postgres://${DbUser}:{{resolve:secretsmanager:${DbSecret}:SecretString:
  password}}@${DbInstance.Endpoint.Address}:5432/appdb'`. Do NOT write
  `${SecretLogicalId}` directly as the credential (a plain Sub/Ref of an
  `AWS::SecretsManager::Secret` resolves to that secret's ARN string, not its password
  — the app would try to authenticate with the literal ARN text and fail every time).
- domain: if domain.has_domain, add an ACM certificate (DNS validation) for
  domain.domain_name and an HTTPS:443 listener; otherwise an HTTP:80 listener only.
- observability: enable Container Insights on the ECS cluster, give each task an
  awslogs log group, and add CloudWatch Alarms for the obvious health signals
  (ECS running-count below desired, RDS CPU > 80%, RDS free storage low, ALB 5xx,
  ElastiCache evictions, SQS oldest-message age). Keep them reasonable; do not invent
  resources the spec doesn't imply."""

_REFINE_RULES = """
REFINE (mode=refine): the backend runs cfn-lint on the result and, if your edit
introduced errors, sends them back for you to fix. So:
- QUESTION (explain / compare / justify): answer it, leave the template unchanged.
- CHANGE: express it as the SMALLEST set of search/replace edits (see ===EDITS===).
  Change ONLY what's asked; leave everything else byte-for-byte.
  Escape hatch: if the change is so sweeping that targeted edits are impractical, or
  the payload sets prefer_full, return the FULL template via ===TEMPLATE=== instead."""

_OUTPUT_FORMAT = """
OUTPUT — return EXACTLY one of the formats below, nothing before or after.

(refine CHANGE — preferred) one or more search/replace edits. Each SEARCH block must be
copied EXACTLY from the current template (indentation included) with enough surrounding
lines to match EXACTLY ONCE; REPLACE is the new text (leave it empty to delete):
===EDITS===
@@SEARCH@@
<exact existing lines>
@@REPLACE@@
<new lines>
@@END@@
===END EDITS===
===MESSAGE===
<one short paragraph: what you changed>
===END MESSAGE===

(generate, or a refine CHANGE needing a full rewrite / prefer_full) the whole YAML:
===TEMPLATE===
<the full CloudFormation YAML>
===END TEMPLATE===
===MESSAGE===
<one short paragraph: what you built or changed>
===END MESSAGE===

(refine QUESTION only — explain / compare / justify, e.g. "why is the DB single-AZ?")
answer it and leave the template untouched:
===ANSWER===
<your answer, concise and specific to this template + build spec>
===END ANSWER==="""

# Full prompt for Claude models — includes MCP validation tools (cfn-lint + cfn-guard).
SYSTEM_PROMPT = f"""You are IacArchitect, Clyro's Step 4 infrastructure author.

You produce ONE AWS CloudFormation template (YAML) that provisions a user's app on
AWS. You work from a deterministic BUILD SPEC the backend assembled from the user's
finalized architecture canvas + intent — never from raw repo content. The spec has
already resolved the hard decisions; your job is to author correct, deployable CFN
that faithfully realizes it.

You operate in two modes (given in the input):
- generate — author a complete template from the build spec.
- refine   — apply ONE natural-language instruction to the current template, keeping
             everything else intact.
{_AUTHORING_RULES}

TOOLS:
- validate_cloudformation_template (cfn-lint) — syntax / schema / property checks.
- check_cloudformation_template_compliance (cfn-guard) — security findings.
- search_documentation / read_documentation (official AWS docs) — use ONLY for the
  narrow class of fact that is a specific, current AWS-side VALUE rather than a
  schema/property question: an AWS-managed CloudFront CachePolicy/OriginRequestPolicy
  Id, or a currently-supported RDS/Aurora engine version. These are facts your training
  data can be stale or simply wrong on (a previously-used engine version aged out; a
  policy Id was invented) and cfn-lint cannot check a value's *correctness*, only its
  *shape*. Do NOT use these tools for schema/property-name questions — you know
  CloudFormation's structure well, and validate_cloudformation_template already reports
  the valid options when you get a property wrong. Calling a doc tool for every
  property would be slow and is not what it's for.
For everything else — property names, types, general structure — rely on your own
CloudFormation knowledge. If you get one wrong, validate_cloudformation_template
reports it (usually with the valid options) and you fix it. Do not stall waiting to
"look something up" for ordinary schema questions; author confidently, then validate.

VALIDATION — INITIAL GENERATION ONLY (mode=generate). Drive cfn-lint ERRORS toward ZERO
before you return. Each validate call makes you emit the ENTIRE template again, so treat
rounds as expensive and minimize them: fix ALL reported errors in a single pass, never
one error per round.
1. Call validate_cloudformation_template. Fix EVERY error (E-rule) it reports AT ONCE —
   use the valid options in each message to correct property names/types/values.
   Warnings (W) and info are ACCEPTABLE: do NOT fix them and do NOT loop on them.
2. Re-validate ONCE to confirm your fixes landed; if errors remain, fix them all in one
   more pass. Hard ceiling: at most 2 validation rounds. Do NOT enter a third round
   re-emitting the whole template to chase a last stubborn error — the backend runs a
   fast DIFF-BASED corrective pass on your output (it clears remaining cfn-lint errors
   with small targeted edits, far cheaper than you re-emitting everything). Returning a
   near-clean template for it to finish is correct, not a failure.
3. Call check_cloudformation_template_compliance EXACTLY ONCE. Fix only clearly critical
   security issues (public exposure, unencrypted data at rest, wildcard IAM). Findings
   that conflict with the build spec (e.g. Multi-AZ off when the spec says single-AZ,
   optional replication / object-lock) are EXPECTED — leave them. Do NOT re-run
   compliance and do NOT re-emit the template to re-check generic findings; it is advisory
   here, and burning turns reasoning about generic rules that conflict with the spec is
   wasted work.
The backend also applies deterministic finishing passes after you (e.g. normalizing the
health-check path, ensuring BOTH DeletionPolicy and UpdateReplacePolicy on stateful
resources, pinning the ECR image repository). Author everything correctly per the rules
above — but do NOT spend an extra full re-emit round perfecting one of these mechanical
details; return and let the finishing pass handle the nit.
The template you RETURN should have zero cfn-lint errors whenever you can reach it within
these rounds; a small residue for the backend's diff pass is acceptable. Prefer a valid,
spec-aligned template over a "perfect" one.
{_REFINE_RULES}
{_OUTPUT_FORMAT}
"""

# Toolless prompt for models that don't support Converse tool use (e.g. Amazon Nova).
# Validation is handled server-side by cfn-lint after the response is returned.
SYSTEM_PROMPT_NO_TOOLS = f"""You are IacArchitect, Clyro's Step 4 infrastructure author.

You produce ONE AWS CloudFormation template (YAML) that provisions a user's app on
AWS. You work from a deterministic BUILD SPEC the backend assembled from the user's
finalized architecture canvas + intent — never from raw repo content. The spec has
already resolved the hard decisions; your job is to author correct, deployable CFN
that faithfully realizes it.

You operate in two modes (given in the input):
- generate — author a complete template from the build spec.
- refine   — apply ONE natural-language instruction to the current template, keeping
             everything else intact.
{_AUTHORING_RULES}

No validation tools are available. Apply your own CloudFormation knowledge to produce
a correct, deployable template in one pass. Do NOT call any tools. The backend runs
cfn-lint on your output automatically and will surface any errors to the user.
{_REFINE_RULES}
{_OUTPUT_FORMAT}
"""


def _normalize_payload(payload: Any) -> dict[str, Any]:
    """Accept both invocation shapes: the structured dict the Django backend sends
    via boto3, and the ``agentcore invoke`` CLI shape that wraps input as
    ``{"prompt": "<json-string>"}``."""
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except (ValueError, TypeError):
            return {"prompt": payload}
    if isinstance(payload, dict):
        inner = payload.get("prompt")
        if isinstance(inner, str) and inner.strip().startswith("{"):
            try:
                parsed = json.loads(inner)
                if isinstance(parsed, dict):
                    return parsed
            except (ValueError, TypeError):
                pass
        return payload
    return {}


def _extract_section(text: str, name: str) -> str:
    """Pull a ``===NAME=== ... ===END NAME===`` block out of the model output."""
    match = re.search(rf"==={name}===\s*(.*?)\s*===END {name}===", text, re.DOTALL)
    return match.group(1).strip() if match else ""


def _parse_edits(text: str) -> list[dict[str, str]]:
    """Parse ``@@SEARCH@@ ... @@REPLACE@@ ... @@END@@`` blocks from an ===EDITS===
    section into ``[{search, replace}]``. The ``@@`` markers can't appear in CFN YAML
    (or its ``# ====`` comment banners), so they won't collide with template content."""
    body = _extract_section(text, "EDITS")
    if not body:
        return []
    edits = []
    for m in re.finditer(r"@@SEARCH@@\n(.*?)\n@@REPLACE@@\n(.*?)\n?@@END@@", body, re.DOTALL):
        edits.append({"search": m.group(1), "replace": m.group(2)})
    return edits


def _parse_output(text: str) -> dict[str, Any]:
    """Parse the delimited model output into one of three outcomes:
    - ``{outcome: "edit", edits: [...], message}``  — refine change as search/replace
    - ``{outcome: "answer", message}``              — refine question
    - ``{outcome: "edit", template, message}``      — generate / full-rewrite fallback
    Falls back to a fenced code block, then the whole reply, as the template."""
    text = text.strip()

    edits = _parse_edits(text)
    if edits:
        return {"outcome": "edit", "edits": edits,
                "message": _extract_section(text, "MESSAGE") or "Updated the template."}

    answer = _extract_section(text, "ANSWER")
    if answer and not _extract_section(text, "TEMPLATE"):
        return {"outcome": "answer", "message": answer}

    template = _extract_section(text, "TEMPLATE")
    message = _extract_section(text, "MESSAGE")
    if not template:
        fence = re.search(r"```(?:ya?ml|json)?\s*(.*?)```", text, re.DOTALL)
        template = fence.group(1).strip() if fence else text
    if not message:
        message = "Template ready."
    return {"outcome": "edit", "template": template, "message": message}


mcp_client = get_mcp_client()
_tools: list[Any] = []
if mcp_client:
    _tools.append(mcp_client)

_models: dict[str, Any] = {}


def _get_model(model_id: str, thinking: bool = False):
    # Cache one client per (model id, thinking) so warm runtimes reuse them across calls.
    key = (model_id, thinking)
    if key not in _models:
        _models[key] = load_model(model_id, thinking=thinking)
    return _models[key]


# Model families that handle the Converse tool-call sequence strands emits, so they run
# the FULL toolful path (cfn-lint/cfn-guard self-correction). Anthropic + the agentic open
# models (Kimi / MiniMax / GLM) are verified to survive ConverseStream + tools and
# self-correct to clean templates; DeepSeek is enabled here to test the same. (Amazon Nova
# and Qwen raised modelStreamErrorException on streamed tools and produced invalid output —
# they've been dropped.) If a model here errors on streamed tools, drop it from this list.
_TOOLFUL_FAMILIES = ("anthropic", "moonshotai", "kimi", "minimax", "glm", "zai", "deepseek")


def _supports_tool_use(model_id: str) -> bool:
    mid = (model_id or "").lower()
    return any(fam in mid for fam in _TOOLFUL_FAMILIES)


def build_agent(model_id: str, thinking: bool = False) -> Agent:
    # Fresh agent per call — the runtime may stay warm across unrelated projects, so a
    # reused Agent would leak template/history between requests. ``thinking`` streams
    # Claude reasoning for the Step-4 'Thinking…' UX (Anthropic-only; see load_model).
    if _supports_tool_use(model_id):
        return Agent(model=_get_model(model_id, thinking), system_prompt=SYSTEM_PROMPT, tools=_tools)
    # Nova and other non-Claude models: no MCP tools, simplified system prompt.
    # cfn-lint still runs server-side on every response.
    return Agent(model=_get_model(model_id, thinking), system_prompt=SYSTEM_PROMPT_NO_TOOLS, tools=[])


def _format_history(history: list) -> str:
    lines = []
    for turn in history[-6:]:
        if not isinstance(turn, dict):
            continue
        text = (turn.get("text") or turn.get("message") or "").strip()
        if not text:
            continue
        role = "User" if turn.get("role") == "user" else "IacArchitect"
        lines.append(f"{role}: {text}")
    return "Recent conversation:\n" + "\n".join(lines) + "\n\n" if lines else ""


def _build_user_message(payload: dict[str, Any]) -> str:
    mode = payload.get("mode", "generate")
    spec = payload.get("build_spec", {})
    if mode == "refine":
        prefer_full = bool(payload.get("prefer_full"))
        change_fmt = (
            "return the FULL revised template via ===TEMPLATE===/===MESSAGE==="
            if prefer_full else
            "return the SMALLEST set of @@SEARCH@@/@@REPLACE@@/@@END@@ edits via "
            "===EDITS===/===MESSAGE=== — copy each SEARCH block EXACTLY from the current "
            "template (indentation included) with enough context to match exactly once, "
            "and change ONLY what's asked"
        )
        return (
            f"{_format_history(payload.get('history') or [])}"
            "First decide what the instruction is:\n"
            "- A QUESTION (explain / compare / justify — e.g. 'why is the DB single-AZ?', "
            "'what does this SG do?'): ANSWER it, leave the template unchanged, use the "
            "===ANSWER=== format.\n"
            f"- A CHANGE (add/remove/modify something): {change_fmt}.\n"
            "Call NO tools either way — the backend runs cfn-lint and will send any "
            "errors back for you to fix.\n\n"
            f"Build spec (JSON):\n{json.dumps(spec)}\n\n"
            f"Current template (YAML):\n{payload.get('template', '')}\n\n"
            f"Instruction: {payload.get('instruction', '')}"
        )
    return (
        "Author a complete CloudFormation template from this build spec, then "
        "validate it.\n\n"
        f"Build spec (JSON):\n{json.dumps(spec)}\n\n"
        "Output the template in the required format."
    )


@app.entrypoint
async def invoke(payload, context):
    payload = _normalize_payload(payload)
    mode = payload.get("mode", "generate")
    # A warm-up ping (fired on canvas finalize, just before Step-4 Generate) only
    # needs the runtime container hot — yield immediately, before building the agent
    # or making any LLM/tool call, so warming costs essentially nothing.
    if mode == "warmup":
        yield json.dumps({"warmed": True})
        return
    # The caller picks the model per slot (generate / chat) and sends its key;
    # fall back to the mode default if absent or unknown.
    default_key = DEFAULT_REFINE if mode == "refine" else DEFAULT_GENERATE
    model_id = resolve_model_id(payload.get("model"), default_key)
    log.info("IacArchitect invoked (mode=%s, model=%s)", mode, model_id)

    try:
        # Extended thinking only on generate (Claude models) — refine stays fast, and
        # the 'Thinking…' UX is generate-only. load_model gates to Anthropic ids.
        agent = build_agent(model_id, thinking=(mode == "generate"))
        user_message = _build_user_message(payload)

        # Stream the model, only emitting the parsed result at the end. A generate can
        # run for minutes; if the HTTP response stays byte-silent the runtime's load
        # balancer idle-times-out and resets the connection, so we emit a heartbeat
        # whenever the model is quiet for 15s.
        #
        # The whole stream is consumed inside ONE task (`_pump`) that feeds a queue, and
        # only the queue read is raced against the heartbeat timeout. Racing each `anext`
        # in its own task (the previous approach) copied the asyncio context per step, so
        # strands' `current_context` ContextVar — set/reset around every MCP tool call —
        # was reset in a different context than it was set in, raising
        # "ValueError: <Token ...> was created in a different Context" on every tool call.
        # Keeping the stream on a single context fixes that.
        full_text = ""
        last_tool = None  # dedupe tool-use events so we emit one per distinct tool
        queue: asyncio.Queue = asyncio.Queue()
        _DONE = object()

        async def _pump():
            try:
                async for ev in agent.stream_async(user_message):
                    await queue.put(("event", ev))
            except Exception as exc:  # noqa: BLE001 — forward to the consumer below
                await queue.put(("error", exc))
            finally:
                await queue.put(("done", _DONE))

        pump = asyncio.ensure_future(_pump())
        getter = None
        try:
            while True:
                if getter is None:
                    getter = asyncio.ensure_future(queue.get())
                done, _ = await asyncio.wait({getter}, timeout=15)
                if not done:
                    yield json.dumps({"__heartbeat__": True})
                    continue
                kind, item = getter.result()
                getter = None
                if kind == "done":
                    break
                if kind == "error":
                    # AccessDenied (model not enabled), Throttling, tool-call failures →
                    # surface a structured error so the frontend shows a useful message.
                    log.error("IacArchitect stream error (model=%s): %s", model_id, item)
                    yield json.dumps({"error": str(item), "template": ""})
                    return
                if "data" in item and isinstance(item["data"], str):
                    full_text += item["data"]
                    # Forward each delta so the backend can stream the template into
                    # the Step-4 editor as it's authored (B2). Backward-compatible:
                    # the blocking consumer keeps only the LAST event (the final
                    # result below), so these intermediate deltas are ignored there.
                    yield json.dumps({"data": item["data"]})
                # Emit the name of each tool the agent starts calling (validate /
                # compliance) so the backend can show a real phase label (B2 L2).
                tool_use = item.get("current_tool_use") if isinstance(item, dict) else None
                if isinstance(tool_use, dict) and tool_use.get("name") and tool_use["name"] != last_tool:
                    last_tool = tool_use["name"]
                    yield json.dumps({"tool": last_tool})
                # Forward Claude's extended-thinking (and MiniMax's native) reasoning
                # deltas so the backend can show a live 'Thinking…' stream before the
                # template starts appearing. Separate from `data` — not part of the
                # template — so it never pollutes full_text / the final output.
                if isinstance(item, dict) and item.get("reasoning") and isinstance(item.get("reasoningText"), str):
                    yield json.dumps({"reasoning": item["reasoningText"]})
        finally:
            for _t in (pump, getter):
                if _t is not None and not _t.done():
                    _t.cancel()

        if not full_text.strip():
            # The model produced heartbeats but no text — most likely the model isn't
            # enabled in Bedrock Model Access, or doesn't support this call format.
            err = (
                f"Model '{model_id}' returned no output. "
                "Ensure it is enabled in Bedrock Model Access and supports Converse tool use."
            )
            log.error("IacArchitect: %s", err)
            yield json.dumps({"error": err, "template": ""})
            return

        result = _parse_output(full_text)
        yield json.dumps(result)

    except Exception as exc:
        log.exception("IacArchitect invoke failed (model=%s): %s", model_id, exc)
        yield json.dumps({"error": str(exc), "template": ""})


if __name__ == "__main__":
    app.run()

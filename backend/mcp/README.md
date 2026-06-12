# Crylo Step-3 MCP Lambdas

Three [awslabs MCP servers](https://github.com/awslabs/mcp) packaged as
container-image **AWS Lambda** functions and fronted by a single **AgentCore
Gateway** as Lambda targets. The Step-3 canvas **Reasoning** agent calls them
through the gateway for live pricing, resource-schema, and docs lookups.

Each target exposes only a curated, Step-3-relevant subset of its server's
tools (see each `tools.json`):

| Dir | Package (pinned) | Exposed tools | IAM granted |
|-----|------------------|---------------|-------------|
| `pricing/` | `awslabs.aws-pricing-mcp-server==1.0.30` | `get_pricing` | `pricing:GetProducts` |
| `cfn/` | `awslabs.aws-iac-mcp-server==1.0.19` | `validate_cloudformation_template` (read-only) | none (offline cfn-lint) |
| `docs/` | `awslabs.aws-documentation-mcp-server==1.1.24` | `search_documentation`, `read_documentation`, `recommend` | none (public HTTPS) |

> **cfn target — `aws-iac-mcp-server`:** this is the maintained successor to the
> now-yanked `awslabs.cfn-mcp-server`. It is an IaC *validation* server, not a
> resource-schema server, so we expose its read-only
> `validate_cloudformation_template` tool (cfn-lint). It validates resource
> types and property schemas fully offline (cfn-lint ships the AWS specs), which
> serves the same Step-3 purpose as the old `get_resource_schema_information`
> (confirm a node maps to a real AWS resource with valid properties) **and** sets
> up Step 4: it validates AI-generated CloudFormation templates before deploy.
> The handler exposes **only** the validation tool — the package's compliance
> (cfn-guard), deployment-troubleshooting, and CDK/doc-search tools are gated
> off, so this target can never mutate AWS infrastructure. (We deliberately do
> **not** expose `check_cloudformation_template_compliance`: its native
> `guardpycfn` backend segfaulted under local Python 3.14 testing; re-verify on
> the py3.12 Lambda runtime before exposing it.)

## How a call flows

```
Reasoning agent ──MCP──► AgentCore Gateway ──Lambda invoke──► crylo-mcp-<name>
                                                                  │
   event = tool arguments JSON                                    │ handler.py:
   context.client_context.custom["bedrockAgentCoreToolName"]      │  - strip "<target>___" prefix
        = "<targetName>___<toolName>"                             │  - gate against ALLOWED_TOOLS
                                                                  │  - asyncio.run(mcp.call_tool(name,args))
   return  ◄── JSON-serializable result ◄─────────────────────── ┘  - normalize to structured dict
```

`handler.py` returns the structured tool output directly; the gateway re-wraps
it as MCP tool content for the agent. Errors (unknown/unexposed tool, tool
failure) come back as `{"error": "..."}` so the model gets a readable message.

## Layout

```
backend/mcp/
├── deploy_mcp.sh          # build + push 3 images, create/update 3 Lambdas, print ARNs
├── README.md
├── pricing/  cfn/  docs/  # each: requirements.txt, handler.py, tools.json, Dockerfile
```

## Local smoke test (no AWS account needed for docs)

Each dir has its own venv for isolated testing:

```bash
cd backend/mcp/docs
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# docs tools hit public AWS-docs endpoints — no credentials required:
python - <<'PY'
import importlib.util, types
s = importlib.util.spec_from_file_location("h", "handler.py")
h = importlib.util.module_from_spec(s); s.loader.exec_module(h)
ctx = types.SimpleNamespace(client_context=types.SimpleNamespace(
    custom={"bedrockAgentCoreToolName": "docs___search_documentation"}))
print(h.handler({"search_phrase": "Aurora Serverless v2", "limit": 1}, ctx))
PY
```

`pricing` and `cfn` dispatch identically but their underlying tools call the
AWS Pricing / CloudFormation APIs, so a real call needs AWS credentials (the
Lambda execution role provides them in production).

Optional: run a built image under the Lambda Runtime Interface Emulator and
invoke it with a client-context header:

```bash
docker build --platform linux/amd64 -t crylo-mcp-docs:test backend/mcp/docs
docker run -d --name rie -p 9009:8080 crylo-mcp-docs:test
CC=$(printf '{"custom":{"bedrockAgentCoreToolName":"docs___search_documentation"}}' | base64 -w0)
curl -s -XPOST localhost:9009/2015-03-31/functions/function/invocations \
  -H "X-Amz-Client-Context: $CC" -d '{"search_phrase":"S3","limit":1}'
docker rm -f rie
```

## Deploy (you run these — nothing billable is auto-created by the build)

Prereqs: AWS CLI v2, Docker, and credentials allowed to create ECR repos, IAM
roles, and Lambda functions.

### 1. Build & deploy the 3 Lambdas

```bash
cd backend/mcp
./deploy_mcp.sh                       # defaults to ap-south-1
# or override: AWS_REGION=us-east-1 ./deploy_mcp.sh
```

The script is idempotent (create on first run, update after). It builds each
image for `linux/amd64`, pushes to ECR (`crylo-mcp-<name>`), creates a
least-priv role (`crylo-mcp-<name>-role`), creates/updates the Lambda
(`crylo-mcp-<name>`), allows the AgentCore Gateway service principal to invoke
it, and writes the 3 ARNs to `backend/mcp/arns.env`:

```
CRYLO_MCP_PRICING_ARN=arn:aws:lambda:ap-south-1:...:function:crylo-mcp-pricing
CRYLO_MCP_CFN_ARN=arn:aws:lambda:ap-south-1:...:function:crylo-mcp-cfn
CRYLO_MCP_DOCS_ARN=arn:aws:lambda:ap-south-1:...:function:crylo-mcp-docs
```

> Region: defaults to **ap-south-1** (Mumbai) — verified to support Lambda, ECR,
> Bedrock, AgentCore, and the Pricing `GetProducts` API, so the Lambdas and the
> gateway/agents all run there. The pricing server maps the queried region to the
> nearest Price List API endpoint automatically. **Model-access caveat:** the
> agents need Bedrock **Claude model access enabled in ap-south-1** (granted
> per-account in the Bedrock console) — confirm before deploying agents.

> **Credentials/account id in logs:** the script prints no AWS credentials — the
> ECR token is piped into `docker login --password-stdin`, never echoed (and it
> uses `set -euo pipefail`, not `set -x`, so nothing is traced). Its own output
> masks your account id (`********1234`); real ARNs go only to `arns.env`
> (gitignored, along with `*.log`). The one thing it can't mask is **docker's
> own** build/push output, which prints the ECR registry host
> (`<acct>.dkr.ecr...`). To share a fully redacted log, filter the whole run:
> `./deploy_mcp.sh 2>&1 | sed "s/$(aws sts get-caller-identity --query Account --output text)/********XXXX/g"`

### 2. Register each Lambda as an AgentCore Gateway target

After creating the gateway (`agentcore add gateway --name CryloCanvasGw`):

```bash
agentcore add gateway-target --gateway CryloCanvasGw \
  --type lambda-function-arn --arn "$CRYLO_MCP_PRICING_ARN" \
  --schema backend/mcp/pricing/tools.json
agentcore add gateway-target --gateway CryloCanvasGw \
  --type lambda-function-arn --arn "$CRYLO_MCP_CFN_ARN" \
  --schema backend/mcp/cfn/tools.json
agentcore add gateway-target --gateway CryloCanvasGw \
  --type lambda-function-arn --arn "$CRYLO_MCP_DOCS_ARN" \
  --schema backend/mcp/docs/tools.json
```

Each `tools.json` is the gateway target's `toolSchema.inlinePayload` (an array
of `{name, description, inputSchema}`). The gateway prefixes each tool with the
target name + `___`, which the handler strips. Ensure the gateway's execution
role allows `lambda:InvokeFunction` on the three ARNs (the step-1 script also
adds a resource-based permission for the `bedrock-agentcore` service principal
as a belt-and-suspenders).

The exact `agentcore` target/schema flags can vary by CLI version — confirm
with `agentcore add gateway-target --help`; the inputs above (ARN + tools.json)
are what each target needs.

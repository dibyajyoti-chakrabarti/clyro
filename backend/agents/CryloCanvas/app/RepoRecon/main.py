"""Repo Recon (Step 1) — AgentCore Runtime.

Scans a connected GitHub repository and returns the structured detection records
(``status`` / ``block_*`` / ``detected_resources`` / ``env_vars``). Trust boundary:
this agent has **GitHub tools only and no AWS write access** — it reads untrusted
repo content, so it must never hold AWS mutation authority (design §3).

It does NOT author canvas YAML — the Step 3 ``canvas.yml`` is built deterministically
in Django from ``detected_resources`` + the intent record (canvas_core.canvas_builder).

Invocation payload (from Django, via boto3 invoke_agent_runtime):
    {"installation_token": "<short-lived GitHub App token>",
     "repo_full_name": "owner/repo", "branch": "main"}
"""

from __future__ import annotations

import base64
import json
import re
from typing import Any

import requests
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from strands import Agent, tool

from model.load import load_model

app = BedrockAgentCoreApp()
log = app.logger

# ── GitHub access (per-invoke) ───────────────────────────────────────────────
# Set at the start of every invoke from the payload. The token is a short-lived
# GitHub App installation token minted by Django; it never persists here.
_token: str = ""
_repo: str = ""
_branch: str = ""


def _init_github(token: str, repo: str, branch: str) -> None:
    global _token, _repo, _branch
    _token, _repo, _branch = token, repo, branch


def _github_headers() -> dict:
    return {"Authorization": f"Bearer {_token}", "Accept": "application/vnd.github.v3+json"}


@tool
def get_file_tree(path: str = "") -> dict:
    """Return the file and folder tree for the repo at the given path. Pass path=""
    for the root. Returns entries with 'name', 'path', 'type' (file or dir), 'size'."""
    url = f"https://api.github.com/repos/{_repo}/contents/{path}"
    resp = requests.get(url, params={"ref": _branch}, headers=_github_headers(), timeout=15)
    if resp.status_code == 404:
        return {"error": f"Path '{path}' not found in repo"}
    resp.raise_for_status()
    entries = resp.json()
    if not isinstance(entries, list):
        return {"error": "Expected a directory but got a file"}
    return {
        "entries": [
            {"name": e["name"], "path": e["path"], "type": e["type"], "size": e.get("size", 0)}
            for e in entries
        ]
    }


@tool
def read_file(path: str) -> dict:
    """Read the contents of a single file from the repo. Use only for specific
    high-signal files (requirements.txt, settings.py, etc.). Not for large/binary files."""
    url = f"https://api.github.com/repos/{_repo}/contents/{path}"
    resp = requests.get(url, params={"ref": _branch}, headers=_github_headers(), timeout=15)
    if resp.status_code == 404:
        return {"error": f"File '{path}' not found"}
    resp.raise_for_status()
    data = resp.json()
    if data.get("type") != "file":
        return {"error": f"'{path}' is not a file"}
    content = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
    return {"path": path, "content": content}


@tool
def search_in_files(extension: str, pattern: str, max_results: int = 30) -> dict:
    """Search all files with the given extension for a text pattern (GitHub search
    API). Returns matching file paths. Only use in Pass 3 when targeted reads were
    insufficient. extension e.g. "py"; pattern e.g. "os.environ.get"."""
    query = f"{pattern} repo:{_repo} extension:{extension}"
    resp = requests.get(
        "https://api.github.com/search/code",
        params={"q": query, "per_page": max_results, "ref": _branch},
        headers=_github_headers(),
        timeout=15,
    )
    if resp.status_code == 403:
        return {"error": "GitHub search rate limit hit. Skip Pass 3 and use what Pass 2 found."}
    resp.raise_for_status()
    items = resp.json().get("items", [])
    return {"matches": [{"path": item["path"], "repo": item["repository"]["full_name"]} for item in items]}


# ── System prompt (detection only — no canvas YAML) ──────────────────────────

SYSTEM_PROMPT = """
You are Clyro's repository scanner. Your job is to analyse a GitHub repository
and produce a structured JSON result describing the project's services,
infrastructure, and environment variables.

## Rules you MUST follow

1. Run exactly three passes in order. Only start the next pass if the previous
   one left something ambiguous.

### Pass 1 — File Tree (no file reads)
Call get_file_tree("") to get the root. Recurse into subdirectories only when
needed to locate high-signal files. Answer:
- Is this a monorepo or single-service repo?
- Do directories backend/, frontend/, workers/ exist?
- Do these files exist? requirements.txt, manage.py, package.json,
  docker-compose.yml, Dockerfile (in backend dir), .github/workflows/,
  any IaC directory (terraform/, cloudformation/, cdk/, infrastructure/)
Build a checklist of files to read in Pass 2.

### Pass 2 — Read High-Signal Files (in this priority order)
Call read_file() for each file that exists, in this order:
1. requirements.txt (REQUIRED — hard block if missing)
2. manage.py
3. settings.py, settings/base.py, settings/production.py,
   config/settings.py, core/settings.py (read whichever exist — union results)
4. package.json
5. docker-compose.yml
6. .github/workflows/*.yml (read the first one found)

### Pass 3 — Targeted Search (ONLY if Pass 2 left genuine ambiguity)
Call search_in_files() with specific patterns. Never read full files.
Triggers: no settings file found anywhere, DB engine unclear, suspected boto3.

## Detection Rules (apply deterministically in this order)

### Backend
- manage.py exists AND "django" in requirements.txt → Django confirmed
- django NOT in requirements.txt → HARD BLOCK: "unsupported_framework"

### Database
- psycopg2 or psycopg2-binary in requirements.txt → PostgreSQL confirmed
- mysqlclient or PyMySQL in requirements.txt → HARD BLOCK: "unsupported_database"
- sqlite in settings DATABASES and no psycopg2 → SOFT BLOCK: "ambiguous_database"
- No database config found → SOFT BLOCK: "no_database_found"

### Frontend
- package.json exists AND "react" in dependencies AND "next" NOT in deps → React confirmed
- package.json missing → no frontend (valid)

### Workers
- "celery" in requirements.txt → Celery confirmed
- "django-celery-beat" in requirements.txt → scheduled tasks confirmed

### Cache
- "redis" or "django-redis" in requirements.txt → Redis confirmed

### Storage
- "boto3" AND "django-storages" in requirements.txt AND "S3Boto3Storage" in
  any settings file → S3 storage confirmed

### Dockerfile
- Dockerfile found in backend dir → use as-is
- Dockerfile NOT found → set dockerfile_generated: true

## Environment Variable Detection
Scan ALL settings files for these patterns:
  os.environ.get('KEY'), os.environ['KEY'], os.getenv('KEY'), env('KEY'), config('KEY')
Extract the KEY name and the surrounding block context.

Classify each key:
- GENERATED: found inside DATABASES block, CACHES block, CELERY_BROKER_URL,
  CELERY_RESULT_BACKEND, AWS_STORAGE_BUCKET_NAME, DEFAULT_FILE_STORAGE
- OPTIONAL: DEBUG, ALLOWED_HOSTS
- USER_SECRET: SECRET_KEY, or any key with unrecognised context

## Output Format
You MUST respond with ONLY a valid JSON object — no markdown, no explanation.
The JSON must match this exact structure:

{
  "status": "complete" | "hard_block" | "soft_block",
  "block_reason": null | "unsupported_framework" | "unsupported_database" | "ambiguous_database" | "no_database_found" | "missing_requirements",
  "block_message": null | "human-readable explanation for the user",
  "detected_resources": {
    "repository": {
      "is_monorepo": true | false
    },
    "services": {
      "backend": {
        "detected": true | false,
        "framework": "django" | null,
        "path": "./backend" | "." | null,
        "project_name": "myproject" | null,
        "wsgi_path": "myproject.wsgi:application" | null,
        "dockerfile_found": true | false,
        "dockerfile_generated": true | false
      },
      "frontend": {
        "detected": true | false,
        "framework": "react" | null,
        "path": "./frontend" | "." | null
      },
      "worker": {
        "detected": true | false,
        "type": "celery" | null,
        "scheduled": true | false
      }
    },
    "infrastructure": {
      "database": { "detected": true | false, "engine": "postgres" | null, "source": "requirements.txt" | "settings.py" | null },
      "cache": { "detected": true | false, "engine": "redis" | null, "source": "requirements.txt" | null },
      "storage": { "detected": true | false, "type": "s3" | null, "source": "settings.py" | null },
      "queue": { "detected": true | false, "type": "sqs" | null, "source": "celery_detected" | null }
    },
    "existing_iac": {
      "found": true | false,
      "type": "terraform" | "cloudformation" | "cdk" | null,
      "path": null | "./terraform"
    }
  },
  "env_vars": [
    {
      "key": "SECRET_KEY",
      "source": "settings/base.py",
      "context": "SECRET_KEY",
      "classification": "user_secret" | "generated" | "optional",
      "production_default": null | "False"
    }
  ]
}
"""


def _normalize_payload(payload: Any) -> dict[str, Any]:
    """Accept both invocation shapes: the structured dict Django sends via boto3,
    and the ``agentcore invoke`` CLI shape that nests everything under ``prompt``
    as a JSON string."""
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


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
    return {"status": "failed", "block_reason": "agent_no_json",
            "block_message": "The scanner did not return valid JSON.",
            "detected_resources": None, "env_vars": None}


def _build_agent() -> Agent:
    # Fresh agent per call — the runtime may stay warm across unrelated repos, so
    # reusing one Agent would leak message history between scans.
    return Agent(
        model=load_model(),
        system_prompt=SYSTEM_PROMPT,
        tools=[get_file_tree, read_file, search_in_files],
    )


@app.entrypoint
async def invoke(payload, context):
    log.info("RepoRecon agent invoked")
    payload = _normalize_payload(payload)

    token = payload.get("installation_token", "")
    repo = payload.get("repo_full_name", "")
    branch = payload.get("branch", "main")
    if not token or not repo:
        yield json.dumps({"status": "failed", "block_reason": "bad_request",
                          "block_message": "installation_token and repo_full_name are required.",
                          "detected_resources": None, "env_vars": None})
        return

    _init_github(token, repo, branch)
    agent = _build_agent()

    prompt = (
        f"Scan the repository '{repo}' on branch '{branch}'. "
        "Follow all three passes as instructed and return the JSON result."
    )

    full_text = ""
    async for event in agent.stream_async(prompt):
        if "data" in event and isinstance(event["data"], str):
            full_text += event["data"]

    yield json.dumps(_extract_json(full_text))


if __name__ == "__main__":
    app.run()

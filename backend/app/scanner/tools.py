import base64
import requests
from strands import tool

# Injected per-scan before the agent runs
_token: str = ""
_repo: str = ""
_branch: str = ""


def init(token: str, repo: str, branch: str) -> None:
    global _token, _repo, _branch
    _token = token
    _repo = repo
    _branch = branch


def _github_headers() -> dict:
    return {
        "Authorization": f"Bearer {_token}",
        "Accept": "application/vnd.github.v3+json",
    }


@tool
def get_file_tree(path: str = "") -> dict:
    """
    Return the file and folder tree for the repo at the given path.
    Pass path="" to get the root. Returns a list of entries with
    'name', 'path', 'type' (file or dir), and 'size'.
    """
    url = f"https://api.github.com/repos/{_repo}/contents/{path}"
    resp = requests.get(
        url,
        params={"ref": _branch},
        headers=_github_headers(),
        timeout=15,
    )
    if resp.status_code == 404:
        return {"error": f"Path '{path}' not found in repo"}
    resp.raise_for_status()
    entries = resp.json()
    if not isinstance(entries, list):
        return {"error": "Expected a directory but got a file"}
    return {
        "entries": [
            {
                "name": e["name"],
                "path": e["path"],
                "type": e["type"],
                "size": e.get("size", 0),
            }
            for e in entries
        ]
    }


@tool
def read_file(path: str) -> dict:
    """
    Read the contents of a single file from the repo.
    Returns the decoded text content. Use this only for
    specific high-signal files (requirements.txt, settings.py, etc.).
    Do NOT use this to read large or binary files.
    """
    url = f"https://api.github.com/repos/{_repo}/contents/{path}"
    resp = requests.get(
        url,
        params={"ref": _branch},
        headers=_github_headers(),
        timeout=15,
    )
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
    """
    Search all files with the given extension in the repo for a text pattern.
    Uses the GitHub search API. Returns matching file paths and the matching lines.
    Only use this in Pass 3 when targeted file reads were insufficient.
    extension: e.g. "py", "yml"
    pattern: e.g. "os.environ.get", "DATABASES"
    """
    query = f"{pattern} repo:{_repo} extension:{extension}"
    resp = requests.get(
        "https://api.github.com/search/code",
        params={"q": query, "per_page": max_results, "ref": _branch},
        headers=_github_headers(),
        timeout=15,
    )
    if resp.status_code == 403:
        return {"error": "GitHub search rate limit hit. Skip Pass 3 and use what was found in Pass 2."}
    resp.raise_for_status()
    items = resp.json().get("items", [])
    return {
        "matches": [
            {"path": item["path"], "repo": item["repository"]["full_name"]}
            for item in items
        ]
    }

import base64
import time

import jwt
import requests
from django.conf import settings


def _make_app_jwt() -> str:
    now = int(time.time())
    payload = {
        'iat': now - 60,
        'exp': now + 540,  # 9 min — GitHub max is 10, WSL2 clock drifts ~10s
        'iss': str(settings.GITHUB_APP_ID),
    }
    with open(settings.GITHUB_APP_PRIVATE_KEY_PATH, 'r') as f:
        private_key = f.read()
    return jwt.encode(payload, private_key, algorithm='RS256')


def get_installation_info(installation_id: int) -> dict:
    app_jwt = _make_app_jwt()
    resp = requests.get(
        f'https://api.github.com/app/installations/{installation_id}',
        headers={
            'Authorization': f'Bearer {app_jwt}',
            'Accept': 'application/vnd.github.v3+json',
        },
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def get_installation_access_token(installation_id: int) -> str:
    app_jwt = _make_app_jwt()
    resp = requests.post(
        f'https://api.github.com/app/installations/{installation_id}/access_tokens',
        headers={
            'Authorization': f'Bearer {app_jwt}',
            'Accept': 'application/vnd.github.v3+json',
        },
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()['token']


def list_installation_repos(installation_id: int) -> list:
    token = get_installation_access_token(installation_id)
    repos = []
    page = 1
    while True:
        resp = requests.get(
            'https://api.github.com/installation/repositories',
            params={'per_page': 100, 'page': page},
            headers={
                'Authorization': f'Bearer {token}',
                'Accept': 'application/vnd.github.v3+json',
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        repos.extend(data['repositories'])
        if len(repos) >= data['total_count']:
            break
        page += 1
    return repos


def get_repo_tree(token: str, repo_full_name: str, branch: str) -> list[str]:
    """Full recursive file-path listing for the branch (one API call), used by
    the cloud-compliance checks — cheap enough to just check existence of
    e.g. a lockfile or a migrations directory without downloading the repo."""
    resp = requests.get(
        f'https://api.github.com/repos/{repo_full_name}/git/trees/{branch}',
        params={'recursive': '1'},
        headers={
            'Authorization': f'Bearer {token}',
            'Accept': 'application/vnd.github.v3+json',
        },
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    return [item['path'] for item in data.get('tree', []) if item.get('type') == 'blob']


def get_branch_head_sha(token: str, repo_full_name: str, branch: str) -> str | None:
    """Current head commit sha of the branch, or None if it can't be read.

    Used against the ``commit_sha`` recorded inside CLYRO.md to tell whether the
    contract still describes the branch Clyro is about to deploy."""
    resp = requests.get(
        f'https://api.github.com/repos/{repo_full_name}/commits/{branch}',
        headers={
            'Authorization': f'Bearer {token}',
            'Accept': 'application/vnd.github.v3+json',
        },
        timeout=10,
    )
    if resp.status_code >= 400:
        return None
    return resp.json().get('sha')


def compare_changed_paths(token: str, repo_full_name: str, base: str, head: str) -> list[str] | None:
    """File paths changed between two refs, or None if the comparison failed.

    None and [] mean different things to the caller: [] is "nothing changed",
    None is "we couldn't tell" — a force-push or a squashed history can leave the
    contract's base sha unreachable, and that must not be reported as a clean
    comparison."""
    resp = requests.get(
        f'https://api.github.com/repos/{repo_full_name}/compare/{base}...{head}',
        headers={
            'Authorization': f'Bearer {token}',
            'Accept': 'application/vnd.github.v3+json',
        },
        timeout=15,
    )
    if resp.status_code >= 400:
        return None
    return [f['filename'] for f in resp.json().get('files', [])]


def get_file_content(token: str, repo_full_name: str, path: str, branch: str) -> str | None:
    """A single file's text content, or None if it doesn't exist. Used by the
    cloud-compliance checks to inspect e.g. package.json/Dockerfile contents
    without a full tarball download (see build.py for that heavier path)."""
    resp = requests.get(
        f'https://api.github.com/repos/{repo_full_name}/contents/{path}',
        params={'ref': branch},
        headers={
            'Authorization': f'Bearer {token}',
            'Accept': 'application/vnd.github.v3+json',
        },
        timeout=10,
    )
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    data = resp.json()
    if data.get('encoding') != 'base64' or 'content' not in data:
        return None
    return base64.b64decode(data['content']).decode('utf-8', errors='replace')


def list_repo_branches(installation_id: int, repo_full_name: str) -> list:
    token = get_installation_access_token(installation_id)
    resp = requests.get(
        f'https://api.github.com/repos/{repo_full_name}/branches',
        params={'per_page': 100},
        headers={
            'Authorization': f'Bearer {token}',
            'Accept': 'application/vnd.github.v3+json',
        },
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()

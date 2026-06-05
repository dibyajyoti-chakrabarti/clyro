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

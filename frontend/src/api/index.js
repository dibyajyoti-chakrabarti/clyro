import { fetchAuthSession } from 'aws-amplify/auth'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

async function getToken() {
  const session = await fetchAuthSession()
  return session.tokens?.idToken?.toString() ?? null
}

async function request(method, path, body) {
  const token = await getToken()
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }
  if (body !== undefined) {
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(`${BASE_URL}${path}`, opts)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, data })
  }
  return data
}

export const api = {
  // Projects
  createProject: (name) => request('POST', '/api/projects/', { name }),
  getProject: (id) => request('GET', `/api/projects/${id}/`),
  listProjects: () => request('GET', '/api/projects/'),
  connectRepo: (id, payload) => request('POST', `/api/projects/${id}/connect-repo/`, payload),
  triggerScan: (id) => request('POST', `/api/projects/${id}/scan/`),

  // GitHub
  storeInstallation: (installation_id) =>
    request('POST', '/api/github/installations/', { installation_id }),
  listInstallations: () => request('GET', '/api/github/installations/'),
  listRepos: (installation_id) =>
    request('GET', `/api/github/repos/?installation_id=${installation_id}`),
  listBranches: (installation_id, repo) =>
    request('GET', `/api/github/branches/?installation_id=${installation_id}&repo=${encodeURIComponent(repo)}`),
}

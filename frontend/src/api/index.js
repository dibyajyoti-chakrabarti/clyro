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
  // User
  getMe: () => request('GET', '/api/users/me/'),
  updateMe: (payload) => request('PATCH', '/api/users/me/', payload),
  deleteMe: () => request('DELETE', '/api/users/me/'),

  // Projects
  createProject: (name) => request('POST', '/api/projects/', { name }),
  getProject: (id) => request('GET', `/api/projects/${id}/`),
  listProjects: () => request('GET', '/api/projects/'),
  connectRepo: (id, payload) => request('POST', `/api/projects/${id}/connect-repo/`, payload),
  triggerScan: (id) => request('POST', `/api/projects/${id}/scan/`),
  saveIntent: (id, payload) => request('POST', `/api/projects/${id}/intent/`, payload),
  getWizardState: (id) => request('GET', `/api/projects/${id}/wizard-state/`),

  // Canvas (Step 3)
  getCanvas: (id) => request('GET', `/api/projects/${id}/canvas/latest/`),
  canvasAgent: (id, payload) => request('POST', `/api/projects/${id}/canvas/agent/`, payload),
  getCanvasChat: (id) => request('GET', `/api/projects/${id}/canvas/chat/`),
  flushCanvasChat: (id) => request('POST', `/api/projects/${id}/canvas/chat/flush/`),
  dismissCanvasProposal: (id) => request('POST', `/api/projects/${id}/canvas/dismiss/`),
  listCanvasVersions: (id) => request('GET', `/api/projects/${id}/canvas/versions/`),
  revertCanvas: (id, version) =>
    request('POST', `/api/projects/${id}/canvas/versions/${version}/revert/`),
  finalizeCanvas: (id) => request('POST', `/api/projects/${id}/canvas/finalize/`),

  // Step 4 — AWS connection & env vars
  initAwsConnection: (id) => request('POST', `/api/projects/${id}/aws-connection/`),
  verifyAwsConnection: (id, payload) => request('POST', `/api/projects/${id}/aws-connection/verify/`, payload),
  getEnvVars: (id) => request('GET', `/api/projects/${id}/env-vars/`),
  saveEnvVars: (id, payload) => request('POST', `/api/projects/${id}/env-vars/save/`, payload),

  // Step 4 — IaC (CloudFormation) generation / refine / validate
  getIac: (id) => request('GET', `/api/projects/${id}/iac/`),
  generateIac: (id) => request('POST', `/api/projects/${id}/iac/generate/`),
  refineIac: (id, payload) => request('POST', `/api/projects/${id}/iac/refine/`, payload),
  validateIac: (id, payload) => request('POST', `/api/projects/${id}/iac/validate/`, payload),

  // GitHub
  storeInstallation: (installation_id) =>
    request('POST', '/api/github/installations/', { installation_id }),
  listInstallations: () => request('GET', '/api/github/installations/'),
  listRepos: (installation_id) =>
    request('GET', `/api/github/repos/?installation_id=${installation_id}`),
  listBranches: (installation_id, repo) =>
    request('GET', `/api/github/branches/?installation_id=${installation_id}&repo=${encodeURIComponent(repo)}`),
}

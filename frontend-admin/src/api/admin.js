// Admin panel API client. Uses its own HS256 token (issued by /api/admin/login/)
// kept in sessionStorage — a fully separate origin/app from the main Cognito-
// backed frontend, so there is no user session to collide with here.

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const TOKEN_KEY = 'clyro_admin_token'

export function getAdminToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function clearAdminToken() {
  sessionStorage.removeItem(TOKEN_KEY)
}

async function request(method, path, body) {
  const token = getAdminToken()
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
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Expired/invalid token: drop it so the route guard bounces to /login.
    if (res.status === 401 && token) clearAdminToken()
    throw Object.assign(new Error(data.error || data.detail || 'Request failed'), {
      status: res.status,
      data,
    })
  }
  return data
}

export const adminApi = {
  login: async (username, password) => {
    const data = await request('POST', '/api/admin/login/', { username, password })
    sessionStorage.setItem(TOKEN_KEY, data.token)
    return data
  },
  logout: () => clearAdminToken(),
  me: () => request('GET', '/api/admin/me/'),
  overview: () => request('GET', '/api/admin/overview/'),
  listWhitelist: () => request('GET', '/api/admin/whitelist/'),
  addWhitelist: (email, note) => request('POST', '/api/admin/whitelist/', { email, note }),
  removeWhitelist: (id) => request('DELETE', `/api/admin/whitelist/${id}/`),
}

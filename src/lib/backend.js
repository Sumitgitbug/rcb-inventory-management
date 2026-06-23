const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000").replace(/\/$/, "")
const AUTH_TOKEN_KEY = "inventory.authToken.v1"

export function getAuthToken() {
  if (typeof window === "undefined") return ""
  return window.localStorage.getItem(AUTH_TOKEN_KEY) || ""
}

export function setAuthToken(token) {
  if (typeof window === "undefined") return
  if (token) window.localStorage.setItem(AUTH_TOKEN_KEY, token)
  else window.localStorage.removeItem(AUTH_TOKEN_KEY)
}

async function requestJson(path, options = {}) {
  const token = getAuthToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
    ...options,
  })

  if (!response.ok) {
    const error = new Error(`Request failed with status ${response.status}`)
    error.status = response.status
    try {
      error.payload = await response.json()
    } catch {
      error.payload = null
    }
    throw error
  }

  return response.status === 204 ? null : response.json()
}

export async function getAuthStatus() {
  return requestJson("/api/auth/status")
}

export async function setupAdmin(payload) {
  const result = await requestJson("/api/auth/setup", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  setAuthToken(result.token)
  return result.user
}

export async function login(payload) {
  const result = await requestJson("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  setAuthToken(result.token)
  return result.user
}

export async function loadCurrentUser() {
  if (!getAuthToken()) return null
  try {
    const result = await requestJson("/api/auth/me")
    return result.user
  } catch (error) {
    if (error.status === 401) setAuthToken("")
    return null
  }
}

export function logout() {
  setAuthToken("")
}

export async function loadUsers() {
  const result = await requestJson("/api/users")
  return result.users ?? []
}

export async function createUser(payload) {
  const result = await requestJson("/api/users", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return result.user
}

export async function updateUser(username, payload) {
  const result = await requestJson(`/api/users/${encodeURIComponent(username)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return result.user
}

export async function resetUserPassword(username, password) {
  await requestJson(`/api/users/${encodeURIComponent(username)}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ password }),
  })
  return true
}

export async function deleteUser(username) {
  await requestJson(`/api/users/${encodeURIComponent(username)}`, {
    method: "DELETE",
  })
  return true
}

export async function loadInventoryFromApi() {
  try {
    return await requestJson("/api/inventory")
  } catch (error) {
    if (error.status === 401) setAuthToken("")
    return null
  }
}

export async function saveInventoryToApi(state) {
  try {
    await requestJson("/api/inventory", {
      method: "PUT",
      body: JSON.stringify(state),
    })
    return true
  } catch (error) {
    if (error.status === 401) setAuthToken("")
    return false
  }
}

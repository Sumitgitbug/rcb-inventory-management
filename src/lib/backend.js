const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000").replace(/\/$/, "")

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  })

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }

  return response.status === 204 ? null : response.json()
}

export async function loadInventoryFromApi() {
  try {
    return await requestJson("/api/inventory")
  } catch {
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
  } catch {
    return false
  }
}

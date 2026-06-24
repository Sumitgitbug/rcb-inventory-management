const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000").replace(/\/$/, "")

function getAuthHeader() {
  if (typeof window === "undefined") return {}
  const token = window.localStorage.getItem("inventory.authToken.v1")
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function getApiError(response, fallback) {
  try {
    const payload = await response.json()
    if (payload?.error) return String(payload.error)
  } catch {
    // Use the status-based fallback when the server does not return JSON.
  }
  return `${fallback} (${response.status})`
}

export async function fetchINoteRecords(page = 1, limit = 10, term = "", group = "") {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    q: term,
  })
  if (group) params.set("group", group)
  const url = `${API_BASE_URL}/api/i-note-records?${params.toString()}`
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...getAuthHeader(),
    },
  })  

  if (!response.ok) {
    throw new Error(await getApiError(response, "Failed to load I-Note records"))
  }

  return response.json()
}

export async function fetchINoteDetail(iNote) {
  const noteValue = String(iNote || "").trim()
  if (!noteValue) {
    throw new Error("i_note is required")
  }

  const url = `${API_BASE_URL}/api/get-i-note?i_note=${encodeURIComponent(noteValue)}`
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...getAuthHeader(),
    },
  })

  if (!response.ok) {
    throw new Error(await getApiError(response, "Failed to load I-Note detail"))
  }

  return response.json()
}

export function normalizeINoteValue(note) {
  return String(note?.inote_no || note?.note_uid || note?.id || note?.uid || "").trim()
}

export function extractINotePage(payload) {
  if (!payload || typeof payload !== "object") {
    return { records: [], page: 1, limit: 10, totalPages: 1, totalRecords: 0 }
  }

  return {
    records: extractINoteRecords(payload),
    page: Number(payload.page || 1) || 1,
    limit: Number(payload.limit || 10) || 10,
    totalPages: Number(payload.total_pages || payload.totalPages || 1) || 1,
    totalRecords: Number(payload.total_records || payload.totalRecords || 0) || 0,
  }
}

export function extractINoteDetail(payload) {
  if (!payload || typeof payload !== "object") {
    return { record: null, records: [] }
  }

  if (Array.isArray(payload)) {
    return {
      record: payload[0] ?? null,
      records: payload,
    }
  }

  if (Array.isArray(payload.data)) {
    return {
      record: payload.data[0] ?? payload.data ?? null,
      records: payload.data,
    }
  }

  if (Array.isArray(payload.records)) {
    return {
      record: payload.records[0] ?? payload.records ?? null,
      records: payload.records,
    }
  }

  if (Array.isArray(payload.result)) {
    return {
      record: payload.result[0] ?? payload.result ?? null,
      records: payload.result,
    }
  }

  return {
    record: payload,
    records: [payload],
  }
}

export function extractINoteRecords(payload) {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== "object") return []
  if (Array.isArray(payload.records)) return payload.records
  if (Array.isArray(payload.data)) return payload.data
  if (Array.isArray(payload.items)) return payload.items
  if (Array.isArray(payload.result)) return payload.result
  return []
}

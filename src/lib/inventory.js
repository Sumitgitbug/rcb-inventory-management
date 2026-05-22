import { createDefaultCatalog, getTypeCode } from "@/data/inventoryCatalog"

const STORAGE_KEYS = {
  assets: "inventory.assets.v1",
  employees: "inventory.employees.v1",
  issues: "inventory.issues.v1",
  notes: "inventory.notes.v1",
  catalog: "inventory.catalog.v1",
  counters: "inventory.assetCounters.v1",
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

export function loadStoredValue(key, fallback) {
  if (!canUseStorage()) return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function saveStoredValue(key, value) {
  if (!canUseStorage()) return
  window.localStorage.setItem(key, JSON.stringify(value))
}

export function loadInventoryState() {
  return {
    assets: loadStoredValue(STORAGE_KEYS.assets, []),
    employees: loadStoredValue(STORAGE_KEYS.employees, []),
    issues: loadStoredValue(STORAGE_KEYS.issues, []),
    notes: loadStoredValue(STORAGE_KEYS.notes, []),
    catalog: loadStoredValue(STORAGE_KEYS.catalog, createDefaultCatalog()),
    counters: loadStoredValue(STORAGE_KEYS.counters, {}),
  }
}

export function saveInventoryState(state) {
  saveStoredValue(STORAGE_KEYS.assets, state.assets)
  saveStoredValue(STORAGE_KEYS.employees, state.employees)
  saveStoredValue(STORAGE_KEYS.issues, state.issues)
  saveStoredValue(STORAGE_KEYS.notes, state.notes)
  saveStoredValue(STORAGE_KEYS.catalog, state.catalog)
  saveStoredValue(STORAGE_KEYS.counters, state.counters)
}

/**
 * Generate a single asset ID and return the updated counters.
 * Call this in a loop (with the previous nextCounters each time)
 * to get sequential IDs for a batch of N assets.
 *
 * Example for quantity = 3:
 *   let counters = inventory.counters
 *   for (let i = 0; i < 3; i++) {
 *     const { assetId, nextCounters } = generateAssetId({ catalog, type, category, purchaseDate, counters })
 *     counters = nextCounters
 *     // assetId will be ...001, ...002, ...003
 *   }
 */
export function generateAssetId({ catalog, type, purchaseDate, counters }) {
  const year = new Date(purchaseDate || Date.now()).getFullYear().toString().slice(-2)
  const typeCode = getTypeCode(catalog, type)
  const counterKey = `${typeCode}:${year}`
  const nextSequence = Number(counters[counterKey] ?? 0) + 1
  const sequence = String(nextSequence).padStart(3, "0")

  return {
    assetId: `RCB/${typeCode}/${year}/${sequence}`,
    nextCounters: {
      ...counters,
      [counterKey]: nextSequence,
    },
  }
}

export function getSerialsInUse(issues, assetId) {
  return issues
    .filter((issue) => issue.assetId === assetId && issue.status !== "returned" && issue.serialNumber)
    .map((issue) => issue.serialNumber)
}

export function formatDate(value) {
  if (!value) return "-"
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

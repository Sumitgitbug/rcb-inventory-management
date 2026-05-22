export const DEFAULT_TYPE_OPTIONS = [
  { label: "IT", value: "IT", code: "IT" },
  { label: "Store", value: "Store", code: "STO" },
  { label: "Engineering", value: "Engineering", code: "ENG" },
  { label: "Scientific", value: "Scientific", code: "SCI" },
]

export const DEFAULT_CATEGORY_BY_TYPE = {
  IT: [
    { label: "Computers/Peripherals", code: "PC" },
    { label: "Office Equipment", code: "OE" },
    { label: "Audio Visual Equipment", code: "AV" },
    { label: "Software", code: "SW" },
    { label: "Intangible Assets", code: "IA" },
  ],
  Store: [
    { label: "Equipments", code: "EQ" },
    { label: "Furniture, Fixtures and Fittings", code: "FF" },
    { label: "Sports Equipment", code: "SP" },
    { label: "Library Books and Scientific Journals", code: "LB" },
    { label: "Misc", code: "MSC" },
  ],
  Engineering: [
    { label: "Maintenance Services", code: "MS" },
    { label: "Land", code: "LD" },
    { label: "Site Development", code: "SD" },
    { label: "Buildings", code: "BL" },
    { label: "Plant and Machinery", code: "PM" },
    { label: "Electrical Installation", code: "EI" },
    { label: "Tube Wells and Water Supply System", code: "TW" },
    { label: "Capital Work-in-Progress", code: "CWP" },
  ],
  Scientific: [
    { label: "Laboratory and Scientific Equipment", code: "LS" },
    { label: "Equipments", code: "EQ" },
    { label: "Audio Visual Equipment", code: "AV" },
    { label: "Vehicles", code: "VH" },
    { label: "Misc", code: "MSC" },
  ],
}

export function createDefaultCatalog() {
  return {
    types: DEFAULT_TYPE_OPTIONS,
    categoriesByType: DEFAULT_CATEGORY_BY_TYPE,
    subCategoriesByTypeAndCategory: {},
  }
}

export function normalizeCatalog(catalog) {
  const fallback = createDefaultCatalog()
  const types = Array.isArray(catalog?.types) && catalog.types.length ? catalog.types : fallback.types
  const categoriesByType = catalog?.categoriesByType && Object.keys(catalog.categoriesByType).length
    ? catalog.categoriesByType
    : fallback.categoriesByType
  const subCategoriesByTypeAndCategory =
    catalog?.subCategoriesByTypeAndCategory && Object.keys(catalog.subCategoriesByTypeAndCategory).length
      ? catalog.subCategoriesByTypeAndCategory
      : fallback.subCategoriesByTypeAndCategory

  return {
    types,
    categoriesByType,
    subCategoriesByTypeAndCategory,
  }
}

export function getTypeOptions(catalog) {
  return normalizeCatalog(catalog).types
}

export function getCategoriesForType(catalog, type) {
  return normalizeCatalog(catalog).categoriesByType[type] ?? []
}

export function getSubCategoriesForTypeAndCategory(catalog, type, category) {
  const normalized = normalizeCatalog(catalog)
  return normalized.subCategoriesByTypeAndCategory?.[type]?.[category] ?? []
}

export function getTypeLabel(catalog, type) {
  return getTypeOptions(catalog).find((item) => item.value === type)?.label ?? type
}

export function getTypeCode(catalog, type) {
  return getTypeOptions(catalog).find((item) => item.value === type)?.code ?? "GEN"
}

export function getCategoryCode(catalog, type, category) {
  return getCategoriesForType(catalog, type).find((item) => item.label === category)?.code ?? "GEN"
}

export function makeTypeValue(label) {
  const cleaned = String(label || "").trim()
  if (!cleaned) return ""
  return cleaned.replace(/\s+/g, " ").replace(/[^A-Za-z0-9]/g, "").slice(0, 10)
}

export function makeTypeCode(label, existingCodes = []) {
  const letters = String(label || "").replace(/[^A-Za-z]/g, "").toUpperCase()
  const base = (letters.slice(0, 3) || "TYP").padEnd(3, "X")
  let code = base
  let index = 1
  while (existingCodes.includes(code)) {
    const suffix = String(index).padStart(1, "0")
    code = `${base.slice(0, 3 - suffix.length)}${suffix}`.slice(0, 3)
    index += 1
  }
  return code
}

export function makeCategoryCode(label, existingCodes = []) {
  const letters = String(label || "").replace(/[^A-Za-z]/g, "").toUpperCase()
  const base = (letters.slice(0, 3) || "CAT").padEnd(3, "X")
  let code = base
  let index = 1
  while (existingCodes.includes(code)) {
    const suffix = String(index).padStart(1, "0")
    code = `${base.slice(0, 3 - suffix.length)}${suffix}`.slice(0, 3)
    index += 1
  }
  return code
}

export function addCatalogType(catalog, label) {
  const nextLabel = String(label || "").trim()
  if (!nextLabel) return normalizeCatalog(catalog)

  const normalized = normalizeCatalog(catalog)
  if (normalized.types.some((item) => item.label.toLowerCase() === nextLabel.toLowerCase())) {
    return normalized
  }

  const existingCodes = normalized.types.map((item) => item.code)
  return {
    ...normalized,
    types: [...normalized.types, { label: nextLabel, value: nextLabel, code: makeTypeCode(nextLabel, existingCodes) }],
    categoriesByType: {
      ...normalized.categoriesByType,
      [nextLabel]: normalized.categoriesByType[nextLabel] ?? [],
    },
    subCategoriesByTypeAndCategory: {
      ...normalized.subCategoriesByTypeAndCategory,
      [nextLabel]: normalized.subCategoriesByTypeAndCategory[nextLabel] ?? {},
    },
  }
}

export function addCatalogCategory(catalog, type, label) {
  const nextLabel = String(label || "").trim()
  if (!nextLabel) return normalizeCatalog(catalog)

  const normalized = normalizeCatalog(catalog)
  const typeKey = String(type || "").trim()
  const current = normalized.categoriesByType[typeKey] ?? []
  if (current.some((item) => item.label.toLowerCase() === nextLabel.toLowerCase())) {
    return normalized
  }

  const existingCodes = current.map((item) => item.code)
  return {
    ...normalized,
    categoriesByType: {
      ...normalized.categoriesByType,
      [typeKey]: [...current, { label: nextLabel, code: makeCategoryCode(nextLabel, existingCodes) }],
    },
    subCategoriesByTypeAndCategory: {
      ...normalized.subCategoriesByTypeAndCategory,
      [typeKey]: {
        ...(normalized.subCategoriesByTypeAndCategory[typeKey] ?? {}),
        [nextLabel]: normalized.subCategoriesByTypeAndCategory[typeKey]?.[nextLabel] ?? [],
      },
    },
  }
}

export function makeSubCategoryCode(label, existingCodes = []) {
  const letters = String(label || "").replace(/[^A-Za-z]/g, "").toUpperCase()
  const base = (letters.slice(0, 4) || "SUB").padEnd(4, "X")
  let code = base
  let index = 1
  while (existingCodes.includes(code)) {
    const suffix = String(index).padStart(1, "0")
    code = `${base.slice(0, 4 - suffix.length)}${suffix}`.slice(0, 4)
    index += 1
  }
  return code
}

export function addCatalogSubCategory(catalog, type, category, label) {
  const nextLabel = String(label || "").trim()
  const typeKey = String(type || "").trim()
  const categoryKey = String(category || "").trim()
  if (!nextLabel || !typeKey || !categoryKey) return normalizeCatalog(catalog)

  const normalized = normalizeCatalog(catalog)
  const current = normalized.subCategoriesByTypeAndCategory?.[typeKey]?.[categoryKey] ?? []
  if (current.some((item) => item.label.toLowerCase() === nextLabel.toLowerCase())) {
    return normalized
  }

  const existingCodes = current.map((item) => item.code)
  return {
    ...normalized,
    subCategoriesByTypeAndCategory: {
      ...normalized.subCategoriesByTypeAndCategory,
      [typeKey]: {
        ...(normalized.subCategoriesByTypeAndCategory[typeKey] ?? {}),
        [categoryKey]: [...current, { label: nextLabel, code: makeSubCategoryCode(nextLabel, existingCodes) }],
      },
    },
  }
}

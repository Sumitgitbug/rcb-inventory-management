import { useEffect, useMemo, useState } from "react"
import { Activity, ArrowLeftRight, Boxes, Eye, Package, Plus, Search, Upload } from "lucide-react"
import Sidebar from "@/components/Sidebar"
import Modal from "@/components/Modal"
import { loadInventoryFromApi, saveInventoryToApi } from "@/lib/backend"
import {
  addCatalogCategory,
  addCatalogType,
  addCatalogSubCategory,
  createDefaultCatalog,
  getCategoriesForType,
  getSubCategoriesForTypeAndCategory,
  getTypeLabel,
  getTypeOptions,
  normalizeCatalog,
} from "@/data/inventoryCatalog"
import { generateAssetId, loadInventoryState, saveInventoryState } from "@/lib/inventory"
import { ActionButton, SectionShell } from "@/components/dashboard-ui"
import AssetsSection from "@/components/AssetsSection"
import INoteSection from "@/components/INoteSection"
import EmployeesSection from "@/components/EmployeesSection"
import IssueReturnSection from "@/components/IssueReturnSection"
import UserManagementSection from "@/components/UserManagementSection"

const ACTIVE_SECTION_STORAGE_KEY = "inventory.activeSection"
const SECTION_IDS = new Set(["dashboard", "assets", "employees", "i-note", "issue-return", "users"])
const ASSET_DASHBOARD_GROUPS = [
  { key: "IT", label: "IT", color: "#2563eb", light: "#dbeafe", types: ["IT"] },
  { key: "Engineering", label: "Engineering", color: "#059669", light: "#d1fae5", types: ["Engineering"] },
  { key: "Store", label: "Store", color: "#f59e0b", light: "#fef3c7", types: ["Store"] },
  { key: "Others", label: "Others", color: "#e11d48", light: "#ffe4e6", types: [] },
]

function readInitialSection() {
  if (typeof window === "undefined") return "dashboard"
  const hashSection = String(window.location.hash || "").replace(/^#/, "").trim()
  if (hashSection === "stocks") return "assets"
  if (SECTION_IDS.has(hashSection)) return hashSection
  const storedSection = window.localStorage.getItem(ACTIVE_SECTION_STORAGE_KEY)
  if (storedSection === "stocks") return "assets"
  if (SECTION_IDS.has(storedSection)) return storedSection
  return "dashboard"
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function normalizeDateForInput(value) {
  const text = String(value || "").trim()
  if (!text) return ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text

  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }

  const match = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (match) {
    const [, day, month, year] = match
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }

  return ""
}

function emptyAssetForm(catalog) {
  const type = getTypeOptions(catalog)[0]?.value ?? "IT"
  const category = getCategoriesForType(catalog, type)[0]?.label ?? ""
  const subCategory = getSubCategoriesForTypeAndCategory(catalog, type, category)[0]?.label ?? ""
  return {
    type,
    category,
    subCategory,
    make: "",
    model: "",
    quantity: 1,
    useSerialNumbers: false,
    serialNumbers: [""],
    invoiceNo: "",
    invoiceFile: null,
    invoiceFileName: "",
    invoiceFileType: "",
    purchaseDate: todayISO(),
    warrantyDate: "",
    orderDate: "",
    supplyDate: "",
  }
}

function emptyEmployeeForm() {
  return { code: "", name: "", email: "" }
}

function emptyIssueForm(assetId = "") {
  return {
    assetId,
    subCategory: "",
    serialNumber: "",
    employeeId: "",
    employeeName: "",
    employeeCode: "",
    employeeEmail: "",
    location: "",
    issueDate: todayISO(),
    status: "issued",
    returnDate: "",
  }
}

function emptyTransferForm(issue = null) {
  return {
    issueId: issue?.id || "",
    assetId: issue?.assetId || "",
    fromEmployeeId: issue?.employeeId || "",
    fromEmployeeCode: issue?.employeeCode || "",
    fromEmployeeName: issue?.employeeName || "",
    fromEmployeeEmail: issue?.employeeEmail || "",
    toEmployeeId: "",
    toEmployeeCode: "",
    toEmployeeName: "",
    toEmployeeEmail: "",
    fromLocation: issue?.location || "",
    toLocation: "",
    transferDate: todayISO(),
  }
}

function normalizeIssueStatus(status) {
  return String(status || "").trim().toLowerCase()
}

function normalizeSerials(values, quantity) {
  const serials = [...values]
  while (serials.length < quantity) serials.push("")
  return serials.slice(0, quantity)
}

function normalizeSerialKey(value) {
  return String(value || "").trim().toLowerCase()
}

function readINoteItemValue(item, keys) {
  for (const key of keys) {
    const value = item?.[key]
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim()
  }
  return ""
}

function buildIssueCounts(issues) {
  const counts = new Map()
  issues.forEach((issue) => {
    if (normalizeIssueStatus(issue.status) === "returned") return
    const key = String(issue.assetId || "").trim()
    if (!key) return
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })
  return counts
}

function getAssetUnits(asset) {
  return Math.max(0, Number(asset?.quantity ?? 1) || 0)
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "0%"
  const rounded = Math.round(value)
  return `${rounded}%`
}

function hasMeaningfulInventoryState(state) {
  return Boolean(
    state &&
      (
        (state.assets?.length ?? 0) > 0 ||
        (state.employees?.length ?? 0) > 0 ||
        (state.issues?.length ?? 0) > 0 ||
        (state.notes?.length ?? 0) > 0 ||
        (state.catalog?.types?.length ?? 0) > 0 ||
        Object.keys(state.counters ?? {}).length > 0
      ),
  )
}

async function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

function escapeCsvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

function buildAssetsCsv(assets, catalog) {
  const headers = [
    "assetId", "type", "category", "subCategory", "make", "model",
    "quantity", "serialNumbers", "invoiceNo", "purchaseDate",
    "warrantyDate", "orderDate", "supplyDate", "availableQuantity",
  ]
  const rows = assets.map((asset) => [
    asset.assetId,
    getTypeLabel(catalog, asset.type),
    asset.category || "",
    asset.subCategory || "",
    asset.make || "",
    asset.model || "",
    asset.quantity ?? 1,
    (asset.serialNumbers ?? []).filter(Boolean).join("|"),
    asset.invoiceNo || "",
    asset.purchaseDate || "",
    asset.warrantyDate || "",
    asset.orderDate || "",
    asset.supplyDate || "",
    asset.availableQuantity ?? "",
  ])
  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n")
}

function buildStocksCsv(assets, catalog) {
  return buildAssetsCsv(assets, catalog)
}

function downloadTextFile(filename, content, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function InventoryDashboard({ currentUser, onLogout }) {
  const initial = loadInventoryState()
  const [inventory, setInventory] = useState(initial)
  const [activeSection, setActiveSection] = useState(readInitialSection)
  const [stocksSearchTerm, setStocksSearchTerm] = useState("")
  const [activeStocksTab, setActiveStocksTab] = useState("IT")
  const [issueStatusFilter, setIssueStatusFilter] = useState("all")
  const [issueSearchTerm, setIssueSearchTerm] = useState("")
  const [hydrated, setHydrated] = useState(false)
  const [assetModalOpen, setAssetModalOpen] = useState(false)
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false)
  const [issueModalOpen, setIssueModalOpen] = useState(false)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [invoicePreview, setInvoicePreview] = useState(null)
  const [catalogModal, setCatalogModal] = useState(null)
  const [editingAssetId, setEditingAssetId] = useState(null)
  const [editingEmployeeId, setEditingEmployeeId] = useState(null)
  const [editingIssueId, setEditingIssueId] = useState(null)
  const [assetPrefillSource, setAssetPrefillSource] = useState(null)
  const [toast, setToast] = useState(null)
  const [assetForm, setAssetForm] = useState(emptyAssetForm(initial.catalog ?? createDefaultCatalog()))
  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm())
  const [issueForm, setIssueForm] = useState(emptyIssueForm())
  const [transferForm, setTransferForm] = useState(emptyTransferForm())
  const [assetSearchTerm, setAssetSearchTerm] = useState("")
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("")
  const [showAssetDropdown, setShowAssetDropdown] = useState(false)
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false)
  const isAdmin = currentUser?.role === "admin"
  const canManage = currentUser?.role === "admin" || currentUser?.role === "user"
  const visibleSection = !isAdmin && activeSection === "users" ? "dashboard" : activeSection

  const catalog = useMemo(
    () => normalizeCatalog(inventory.catalog ?? createDefaultCatalog()),
    [inventory.catalog],
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(ACTIVE_SECTION_STORAGE_KEY, visibleSection)
    const nextUrl = new URL(window.location.href)
    nextUrl.hash = visibleSection === "dashboard" ? "" : visibleSection
    window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)
  }, [visibleSection])

  useEffect(() => {
    if (typeof window === "undefined") return
    const syncSectionFromLocation = () => {
      const nextHash = String(window.location.hash || "").replace(/^#/, "").trim()
      if (nextHash === "stocks") {
        setActiveSection("assets")
        return
      }
      if (SECTION_IDS.has(nextHash) && nextHash !== activeSection) {
        setActiveSection(nextHash)
      }
    }
    window.addEventListener("hashchange", syncSectionFromLocation)
    window.addEventListener("popstate", syncSectionFromLocation)
    return () => {
      window.removeEventListener("hashchange", syncSectionFromLocation)
      window.removeEventListener("popstate", syncSectionFromLocation)
    }
  }, [activeSection])

  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      const cached = loadInventoryState()
      setInventory(cached)
      const remote = await loadInventoryFromApi()
      if (cancelled) return
      if (hasMeaningfulInventoryState(remote)) setInventory(remote)
      setHydrated(true)
    }
    hydrate()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    saveInventoryState(inventory)
    saveInventoryToApi(inventory)
  }, [inventory, hydrated])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  const assets = useMemo(() => inventory.assets ?? [], [inventory.assets])
  const employees = useMemo(() => inventory.employees ?? [], [inventory.employees])
  const issues = useMemo(() => inventory.issues ?? [], [inventory.issues])
  const notes = useMemo(() => inventory.notes ?? [], [inventory.notes])
  const issueCounts = useMemo(() => buildIssueCounts(issues), [issues])

  const assetAvailability = useMemo(() => {
    const availability = new Map()
    assets.forEach((asset) => {
      const total = Number(asset.quantity || 1) || 1
      const used = issueCounts.get(asset.assetId) ?? 0
      availability.set(asset.assetId, Math.max(0, total - used))
    })
    return availability
  }, [assets, issueCounts])

  const assetsWithAvailability = useMemo(
    () => assets.map((asset) => ({ ...asset, availableQuantity: assetAvailability.get(asset.assetId) ?? 0 })),
    [assets, assetAvailability],
  )

  const stockAssets = useMemo(
    () => assetsWithAvailability.filter((asset) => (asset.availableQuantity ?? 0) > 0),
    [assetsWithAvailability],
  )

  const availableIssueAssets = useMemo(() => stockAssets, [stockAssets])

  const issueAssetById = useMemo(
    () => new Map(assets.map((asset) => [asset.assetId, asset])),
    [assets],
  )

  const assetSubCategoryOptions = getSubCategoriesForTypeAndCategory(catalog, assetForm.type, assetForm.category)
  const availableStockTypes = getTypeOptions(catalog).map((type) => type.value)
  const effectiveActiveStocksTab = availableStockTypes.includes(activeStocksTab)
    ? activeStocksTab
    : availableStockTypes[0] || activeStocksTab

  const filteredAssets = useMemo(() => {
    if (!showAssetDropdown) return []
    const term = assetSearchTerm.toLowerCase()
    if (!term) return availableIssueAssets
    return availableIssueAssets.filter((asset) =>
      asset.assetId.toLowerCase().includes(term) ||
      asset.subCategory?.toLowerCase().includes(term) ||
      asset.model?.toLowerCase().includes(term) ||
      asset.make?.toLowerCase().includes(term)
    )
  }, [assetSearchTerm, showAssetDropdown, availableIssueAssets])

  const filteredEmployees = useMemo(() => {
    if (!showEmployeeDropdown) return []
    const term = employeeSearchTerm.toLowerCase()
    if (!term) return employees
    return employees.filter((emp) =>
      emp.code.toLowerCase().includes(term) ||
      emp.name?.toLowerCase().includes(term) ||
      emp.email?.toLowerCase().includes(term)
    )
  }, [employeeSearchTerm, showEmployeeDropdown, employees])

  const filteredStocks = useMemo(() => {
    const term = stocksSearchTerm.trim().toLowerCase()
    const tabFiltered = stockAssets.filter((asset) => asset.type === effectiveActiveStocksTab)
    const sorted = [...tabFiltered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    if (!term) return sorted
    return sorted.filter((asset) => {
      const serialText = (asset.serialNumbers ?? []).join(" ").toLowerCase()
      return [
        asset.category,
        asset.subCategory,
        asset.make,
        asset.model,
        serialText,
        asset.invoiceNo,
        asset.assetId,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    })
  }, [stockAssets, stocksSearchTerm, effectiveActiveStocksTab])

  function openAssetModal() {
    setEditingAssetId(null)
    setAssetPrefillSource(null)
    setAssetForm(emptyAssetForm(catalog))
    setAssetModalOpen(true)
  }

  function openAssetModalFromINote(prefill) {
    const quantity = Math.max(1, Math.floor(Number(prefill?.quantity) || 1))
    const itemDescription =
      String(prefill?.itemDescription || "").trim() ||
      readINoteItemValue(prefill?.item, ["item_desc", "description", "item_description", "desc", "particulars"])
    const orderDate = normalizeDateForInput(prefill?.orderDate || prefill?.noteMeta?.order_dt)
    const supplyDate = normalizeDateForInput(
      prefill?.supplyDate || prefill?.deliveryDate || prefill?.detail?.supply_date || prefill?.detail?.delivery_date,
    )
    const invoiceNo = String(prefill?.invoiceNo || "").trim()
    const baseForm = emptyAssetForm(catalog)

    setEditingAssetId(null)
    setAssetPrefillSource({
      noteNo: prefill?.noteNo || "",
      itemDescription,
      quantity,
      orderNo: prefill?.orderNo || "",
      invoiceNo,
      orderDate,
      supplyDate,
    })
    setAssetForm({
      ...baseForm,
      quantity,
      serialNumbers: [],
      useSerialNumbers: false,
      model: itemDescription,
      invoiceNo,
      orderDate,
      supplyDate,
      purchaseDate: orderDate || supplyDate || baseForm.purchaseDate,
    })
    setAssetModalOpen(true)
    showSuccess("I-Note item linked to Add Asset form.")
  }

  function openEmployeeModal() {
    setEditingEmployeeId(null)
    setEmployeeForm(emptyEmployeeForm())
    setEmployeeModalOpen(true)
  }

  function openIssueModal() {
    setEditingIssueId(null)
    const nextAsset = availableIssueAssets[0]
    setIssueForm({
      ...emptyIssueForm(nextAsset?.assetId ?? ""),
      assetId: nextAsset?.assetId ?? "",
      subCategory: nextAsset?.subCategory || "",
      serialNumber: nextAsset?.serialNumbers?.[0] || "",
    })
    setIssueModalOpen(true)
  }

  function openEditAssetModal(asset) {
    setEditingAssetId(asset.assetId)
    setAssetPrefillSource(null)
    const hasSerialNumbers = (asset.serialNumbers ?? []).some((serial) => String(serial || "").trim())
    setAssetForm({
      type: asset.type || "IT",
      category: asset.category || getCategoriesForType(catalog, asset.type || "IT")[0]?.label || "",
      subCategory: asset.subCategory || "",
      make: asset.make || "",
      model: asset.model || "",
      quantity: Number(asset.quantity || 1),
      useSerialNumbers: hasSerialNumbers,
      serialNumbers: normalizeSerials(asset.serialNumbers || [], Number(asset.quantity || 1)),
      invoiceNo: asset.invoiceNo || "",
      invoiceFile: asset.invoiceFile || null,
      invoiceFileName: asset.invoiceFileName || "",
      invoiceFileType: asset.invoiceFileType || "",
      purchaseDate: asset.purchaseDate || todayISO(),
      warrantyDate: asset.warrantyDate || "",
      orderDate: asset.orderDate || "",
      supplyDate: asset.supplyDate || "",
    })
    setAssetModalOpen(true)
  }

  function openEditEmployeeModal(employee) {
    setEditingEmployeeId(employee.id)
    setEmployeeForm({ code: employee.code || "", name: employee.name || "", email: employee.email || "" })
    setEmployeeModalOpen(true)
  }

  function openEditIssueModal(issue) {
    setEditingIssueId(issue.id)
    const nextAsset = assets.find((asset) => asset.assetId === issue.assetId)
    const nextEmployee =
      employees.find((employee) => employee.id === issue.employeeId) ??
      employees.find((employee) => employee.code === issue.employeeCode)
    setIssueForm({
      assetId: issue.assetId || "",
      subCategory: nextAsset?.subCategory || "",
      serialNumber: issue.serialNumber || "",
      employeeId: issue.employeeId || nextEmployee?.id || "",
      employeeName: issue.employeeName || "",
      employeeCode: issue.employeeCode || nextEmployee?.code || "",
      employeeEmail: issue.employeeEmail || nextEmployee?.email || "",
      location: issue.location || "",
      issueDate: issue.issueDate || todayISO(),
      status: normalizeIssueStatus(issue.status) || "issued",
      returnDate: issue.returnDate || "",
    })
    setIssueModalOpen(true)
  }

  function openTransferIssueModal(issue) {
    if (normalizeIssueStatus(issue.status) === "returned") {
      showError("Returned item cannot be transferred.")
      return
    }
    setTransferForm(emptyTransferForm(issue))
    setTransferModalOpen(true)
  }

  function openCatalogModal(target) {
    setCatalogModal({ target, value: "" })
  }

  function showSuccess(message) { setToast({ id: Date.now(), type: "success", message }) }
  function showError(message) { setToast({ id: Date.now(), type: "error", message }) }

  function addCatalogOption() {
    const nextValue = String(catalogModal?.value || "").trim()
    if (!nextValue) return
    const nextCatalog = catalogModal?.target === "type"
      ? addCatalogType(catalog, nextValue)
      : catalogModal?.target === "category"
        ? addCatalogCategory(catalog, assetForm.type, nextValue)
        : addCatalogSubCategory(catalog, assetForm.type, assetForm.category, nextValue)
    setInventory((current) => ({ ...current, catalog: nextCatalog }))
    setAssetForm((current) => {
      if (catalogModal?.target === "type") {
        const nextCategory = getCategoriesForType(nextCatalog, nextValue)[0]?.label ?? ""
        return {
          ...current,
          type: nextValue,
          category: nextCategory,
          subCategory: getSubCategoriesForTypeAndCategory(nextCatalog, nextValue, nextCategory)[0]?.label ?? "",
        }
      }
      if (catalogModal?.target === "category") {
        return {
          ...current,
          category: nextValue,
          subCategory: getSubCategoriesForTypeAndCategory(nextCatalog, current.type, nextValue)[0]?.label ?? "",
        }
      }
      if (catalogModal?.target === "subcategory") {
        return { ...current, subCategory: nextValue }
      }
      return current
    })
    setCatalogModal(null)
    showSuccess("Catalog option added successfully.")
  }

  function handleIssueAssetChange(nextAssetId) {
    const nextAsset = assets.find((asset) => asset.assetId === nextAssetId)
    setIssueForm((current) => ({
      ...current,
      assetId: nextAssetId,
      subCategory: nextAsset?.subCategory || "",
      serialNumber: nextAsset?.serialNumbers?.[0] || "",
    }))
  }

  function handleIssueEmployeeCodeChange(nextEmployeeCode) {
    const nextEmployee = employees.find((employee) => employee.code === nextEmployeeCode)
    setIssueForm((current) => ({
      ...current,
      employeeId: nextEmployee?.id || "",
      employeeCode: nextEmployeeCode,
      employeeName: nextEmployee?.name || "",
      employeeEmail: nextEmployee?.email || "",
    }))
  }

  function handleTransferEmployeeChange(nextEmployeeId) {
    const nextEmployee = employees.find((employee) => employee.id === nextEmployeeId)
    setTransferForm((current) => ({
      ...current,
      toEmployeeId: nextEmployee?.id || "",
      toEmployeeCode: nextEmployee?.code || "",
      toEmployeeName: nextEmployee?.name || "",
      toEmployeeEmail: nextEmployee?.email || "",
    }))
  }

  function handleAssetTypeChange(nextType) {
    const nextCategory = getCategoriesForType(catalog, nextType)[0]?.label ?? ""
    setAssetForm((current) => ({
      ...current,
      type: nextType,
      category: nextCategory,
      subCategory: getSubCategoriesForTypeAndCategory(catalog, nextType, nextCategory)[0]?.label ?? "",
    }))
  }

  function handleAssetCategoryChange(nextCategory) {
    setAssetForm((current) => ({
      ...current,
      category: nextCategory,
      subCategory: getSubCategoriesForTypeAndCategory(catalog, current.type, nextCategory)[0]?.label ?? "",
    }))
  }

  function handleAssetSubCategoryChange(nextSubCategory) {
    setAssetForm((current) => ({ ...current, subCategory: nextSubCategory }))
  }

  function handleAssetQuantityChange(value) {
    const quantity = Math.max(1, Number(value) || 1)
    setAssetForm((current) => ({
      ...current,
      quantity,
      serialNumbers: current.useSerialNumbers
        ? normalizeSerials(current.serialNumbers ?? [], quantity)
        : [],
    }))
  }

  function handleAssetSerialTrackingChange(enabled) {
    setAssetForm((current) => ({
      ...current,
      useSerialNumbers: enabled,
      serialNumbers: enabled ? normalizeSerials(current.serialNumbers ?? [""], current.quantity) : [],
    }))
  }

  function handleAssetSerialChange(index, value) {
    setAssetForm((current) => {
      const serialNumbers = [...(current.serialNumbers ?? [])]
      serialNumbers[index] = value
      return { ...current, serialNumbers }
    })
  }

  async function handleAssetFileChange(file) {
    if (!file) {
      setAssetForm((current) => ({ ...current, invoiceFile: null, invoiceFileName: "", invoiceFileType: "" }))
      return
    }
    const dataUrl = await toDataUrl(file)
    setAssetForm((current) => ({
      ...current,
      invoiceFile: dataUrl,
      invoiceFileName: file.name,
      invoiceFileType: file.type,
    }))
  }

  function submitAssetForm(event) {
    event.preventDefault()
    const quantity = Math.max(1, Number(assetForm.quantity) || 1)
    const useSerialNumbers = Boolean(assetForm.useSerialNumbers)
    const serialNumbers = useSerialNumbers
      ? normalizeSerials(assetForm.serialNumbers ?? [], quantity).map((serial) => serial.trim())
      : []
    const enteredSerialNumbers = serialNumbers.filter((serial) => normalizeSerialKey(serial))
    const serialKeys = enteredSerialNumbers.map(normalizeSerialKey)

    if (new Set(serialKeys).size !== serialKeys.length) {
      showError("Duplicate serial number found. Please enter unique serial numbers.")
      return
    }

    const existingSerials = new Set()
    assets.forEach((asset) => {
      if (editingAssetId && asset.assetId === editingAssetId) return
      ;(asset.serialNumbers ?? []).forEach((serial) => {
        const serialKey = normalizeSerialKey(serial)
        if (serialKey) existingSerials.add(serialKey)
      })
    })

    const duplicateExistingSerial = enteredSerialNumbers.find((serial) => existingSerials.has(normalizeSerialKey(serial)))
    if (duplicateExistingSerial) {
      showError(`Serial number "${duplicateExistingSerial}" already exists.`)
      return
    }

    const now = new Date().toISOString()

    if (editingAssetId) {
      const { nextCounters } = generateAssetId({
        catalog,
        type: assetForm.type,
        category: assetForm.category,
        purchaseDate: assetForm.purchaseDate,
        counters: inventory.counters ?? {},
      })
      const updatedAsset = {
        id: `asset-${editingAssetId}`,
        assetId: editingAssetId,
        type: assetForm.type,
        category: assetForm.category,
        subCategory: assetForm.subCategory.trim(),
        make: assetForm.make.trim(),
        model: assetForm.model.trim(),
        quantity,
        serialNumbers,
        invoiceNo: assetForm.invoiceNo.trim(),
        invoiceFile: assetForm.invoiceFile,
        invoiceFileName: assetForm.invoiceFileName,
        invoiceFileType: assetForm.invoiceFileType,
        purchaseDate: assetForm.purchaseDate,
        warrantyDate: assetForm.warrantyDate,
        orderDate: assetForm.orderDate,
        supplyDate: assetForm.supplyDate,
        sourceType: assets.find((asset) => asset.assetId === editingAssetId)?.sourceINoteNo ? "i-note" : "manual",
        sourceINoteNo: assets.find((asset) => asset.assetId === editingAssetId)?.sourceINoteNo || "",
        sourceINoteItemDescription: assets.find((asset) => asset.assetId === editingAssetId)?.sourceINoteItemDescription || "",
        createdAt: now,
        updatedAt: now,
      }
      setInventory((current) => ({
        ...current,
        assets: (current.assets ?? []).map((asset) => asset.assetId === editingAssetId ? updatedAsset : asset),
        counters: nextCounters,
      }))
      setAssetModalOpen(false)
      setEditingAssetId(null)
      setAssetPrefillSource(null)
      setAssetForm(emptyAssetForm(catalog))
      showSuccess("Asset updated successfully.")
      return
    }

    const newAssets = []
    let runningCounters = { ...(inventory.counters ?? {}) }

    const createAssetRecord = (recordQuantity, recordSerialNumbers) => {
      const { assetId, nextCounters } = generateAssetId({
        catalog,
        type: assetForm.type,
        category: assetForm.category,
        purchaseDate: assetForm.purchaseDate,
        counters: runningCounters,
      })
      runningCounters = nextCounters
      newAssets.push({
        id: `asset-${assetId}`,
        assetId,
        type: assetForm.type,
        category: assetForm.category,
        subCategory: assetForm.subCategory.trim(),
        make: assetForm.make.trim(),
        model: assetForm.model.trim(),
        quantity: recordQuantity,
        serialNumbers: recordSerialNumbers,
        invoiceNo: assetForm.invoiceNo.trim(),
        invoiceFile: assetForm.invoiceFile,
        invoiceFileName: assetForm.invoiceFileName,
        invoiceFileType: assetForm.invoiceFileType,
        purchaseDate: assetForm.purchaseDate,
        warrantyDate: assetForm.warrantyDate,
        orderDate: assetForm.orderDate,
        supplyDate: assetForm.supplyDate,
        sourceType: assetPrefillSource?.noteNo ? "i-note" : "manual",
        sourceINoteNo: assetPrefillSource?.noteNo || "",
        sourceINoteItemDescription: assetPrefillSource?.itemDescription || "",
        createdAt: now,
        updatedAt: now,
      })
    }

    for (let i = 0; i < quantity; i++) {
      createAssetRecord(1, useSerialNumbers && serialNumbers[i] ? [serialNumbers[i]] : [])
    }

    setInventory((current) => ({
      ...current,
      assets: [...newAssets, ...(current.assets ?? [])],
      counters: runningCounters,
    }))
    setAssetModalOpen(false)
    setAssetPrefillSource(null)
    setAssetForm(emptyAssetForm(catalog))
    showSuccess(`${quantity} asset${quantity > 1 ? "s" : ""} added successfully.`)
  }

  function submitEmployeeForm(event) {
    event.preventDefault()
    const now = new Date().toISOString()
    const nextEmployee = {
      id: editingEmployeeId || `employee-${now}`,
      code: employeeForm.code.trim(),
      name: employeeForm.name.trim(),
      email: employeeForm.email.trim(),
      createdAt: now,
      updatedAt: now,
    }
    if (!nextEmployee.code || !nextEmployee.name) return
    setInventory((current) => ({
      ...current,
      employees: editingEmployeeId
        ? (current.employees ?? []).map((employee) => (employee.id === editingEmployeeId ? nextEmployee : employee))
        : [nextEmployee, ...(current.employees ?? [])],
    }))
    setEmployeeModalOpen(false)
    setEditingEmployeeId(null)
    setEmployeeForm(emptyEmployeeForm())
    showSuccess(editingEmployeeId ? "Employee updated successfully." : "Employee added successfully.")
  }

  function submitIssueForm(event) {
    event.preventDefault()
    const now = new Date().toISOString()
    const normalizedStatus = normalizeIssueStatus(issueForm.status) || "issued"
    const existingIssue = editingIssueId
      ? issues.find((issue) => issue.id === editingIssueId)
      : null
    const nextIssue = {
      id: editingIssueId || `issue-${now}`,
      assetId: issueForm.assetId.trim(),
      serialNumber: issueForm.serialNumber.trim(),
      employeeId: issueForm.employeeId.trim(),
      employeeName: issueForm.employeeName.trim(),
      employeeCode: issueForm.employeeCode.trim(),
      employeeEmail: issueForm.employeeEmail.trim(),
      location: issueForm.location.trim(),
      issueDate: issueForm.issueDate,
      status: normalizedStatus,
      returnDate: issueForm.returnDate || "",
      transferHistory: Array.isArray(existingIssue?.transferHistory) ? existingIssue.transferHistory : [],
      createdAt: existingIssue?.createdAt || now,
      updatedAt: now,
    }
    if (!nextIssue.assetId || !nextIssue.employeeId || !nextIssue.employeeName || !nextIssue.location) {
      showSuccess("Please select both asset and employee before issuing.")
      return
    }
    setInventory((current) => ({
      ...current,
      issues: editingIssueId
        ? (current.issues ?? []).map((issue) => (issue.id === editingIssueId ? nextIssue : issue))
        : [nextIssue, ...(current.issues ?? [])],
    }))
    setIssueModalOpen(false)
    setEditingIssueId(null)
    setIssueForm(emptyIssueForm(assets[0]?.assetId ?? ""))
    showSuccess(
      editingIssueId
        ? "Issue record updated successfully."
        : nextIssue.status === "returned"
          ? "Return saved successfully."
          : "Item issued successfully.",
    )
  }

  function submitTransferForm(event) {
    event.preventDefault()
    const issueId = transferForm.issueId
    const fromLocation = transferForm.fromLocation.trim()
    const toLocation = transferForm.toLocation.trim()
    const toEmployeeId = transferForm.toEmployeeId.trim()
    const transferDate = transferForm.transferDate || todayISO()

    if (!issueId || !toLocation || !toEmployeeId) {
      showError("Please select target employee and transfer location.")
      return
    }

    const now = new Date().toISOString()
    setInventory((current) => ({
      ...current,
      issues: (current.issues ?? []).map((issue) => {
        if (issue.id !== issueId) return issue
        const history = Array.isArray(issue.transferHistory) ? issue.transferHistory : []
        return {
          ...issue,
          employeeId: transferForm.toEmployeeId,
          employeeCode: transferForm.toEmployeeCode,
          employeeName: transferForm.toEmployeeName,
          employeeEmail: transferForm.toEmployeeEmail,
          location: toLocation,
          transferHistory: [
            ...history,
            {
              id: `transfer-${now}`,
              fromEmployeeId: transferForm.fromEmployeeId || issue.employeeId || "",
              fromEmployeeCode: transferForm.fromEmployeeCode || issue.employeeCode || "",
              fromEmployeeName: transferForm.fromEmployeeName || issue.employeeName || "",
              fromEmployeeEmail: transferForm.fromEmployeeEmail || issue.employeeEmail || "",
              toEmployeeId: transferForm.toEmployeeId,
              toEmployeeCode: transferForm.toEmployeeCode,
              toEmployeeName: transferForm.toEmployeeName,
              toEmployeeEmail: transferForm.toEmployeeEmail,
              fromLocation: fromLocation || issue.location || "",
              toLocation,
              transferDate,
              createdAt: now,
            },
          ],
          updatedAt: now,
        }
      }),
    }))
    setTransferModalOpen(false)
    setTransferForm(emptyTransferForm())
    showSuccess("Item transferred successfully.")
  }

  function removeAsset(assetId) {
    setInventory((current) => ({
      ...current,
      assets: (current.assets ?? []).filter((asset) => asset.assetId !== assetId),
    }))
    showSuccess("Asset deleted successfully.")
  }

  function exportStocksCsv() {
    const departmentAssets = stockAssets.filter((asset) => asset.type === effectiveActiveStocksTab)
    const csv = buildStocksCsv(departmentAssets, catalog)
    const dateStamp = new Date().toISOString().slice(0, 10)
    const fileName = `stocks_${String(effectiveActiveStocksTab || "").toLowerCase()}_${dateStamp}.csv`
    downloadTextFile(fileName, csv, "text/csv;charset=utf-8")
    showSuccess(`${effectiveActiveStocksTab} stocks CSV exported successfully.`)
  }

  function removeEmployee(employeeId) {
    setInventory((current) => ({
      ...current,
      employees: (current.employees ?? []).filter((employee) => employee.id !== employeeId),
    }))
    showSuccess("Employee deleted successfully.")
  }

  function returnIssue(issueId) {
    const now = new Date().toISOString()
    setInventory((current) => ({
      ...current,
      issues: (current.issues ?? []).map((issue) =>
        issue.id === issueId
          ? { ...issue, status: "returned", returnDate: todayISO(), updatedAt: now }
          : issue,
      ),
    }))
    showSuccess("Item returned successfully.")
  }

  function issueAsset(asset) {
    setIssueForm({
      assetId: asset.assetId,
      subCategory: asset.subCategory || "",
      serialNumber: asset.serialNumbers?.[0] || "",
      employeeId: "",
      employeeName: "",
      employeeCode: "",
      employeeEmail: "",
      location: "",
      issueDate: todayISO(),
      status: "issued",
      returnDate: "",
    })
    setEditingIssueId(null)
    setIssueModalOpen(true)
  }

  const activeIssues = useMemo(
    () => issues.filter((issue) => normalizeIssueStatus(issue.status) !== "returned"),
    [issues],
  )
  const returnedIssues = useMemo(
    () => issues.filter((issue) => normalizeIssueStatus(issue.status) === "returned"),
    [issues],
  )
  const dashboardTotalUnits = useMemo(
    () => assetsWithAvailability.reduce((total, asset) => total + getAssetUnits(asset), 0),
    [assetsWithAvailability],
  )
  const dashboardAvailableUnits = useMemo(
    () => assetsWithAvailability.reduce((total, asset) => total + (Number(asset.availableQuantity ?? 0) || 0), 0),
    [assetsWithAvailability],
  )
  const dashboardIssuedUnits = Math.max(0, dashboardTotalUnits - dashboardAvailableUnits)
  const dashboardGroups = useMemo(() => {
    const primaryTypes = new Set(
      ASSET_DASHBOARD_GROUPS.flatMap((group) => group.types),
    )

    return ASSET_DASHBOARD_GROUPS.map((group) => {
      const units = assetsWithAvailability.reduce((total, asset) => {
        const type = String(asset.type || "").trim()
        const matches = group.key === "Others" ? !primaryTypes.has(type) : group.types.includes(type)
        return matches ? total + getAssetUnits(asset) : total
      }, 0)
      const records = assetsWithAvailability.filter((asset) => {
        const type = String(asset.type || "").trim()
        return group.key === "Others" ? !primaryTypes.has(type) : group.types.includes(type)
      }).length
      const percentage = dashboardTotalUnits > 0 ? (units / dashboardTotalUnits) * 100 : 0

      return { ...group, units, records, percentage }
    })
  }, [assetsWithAvailability, dashboardTotalUnits])

  const assetWheelGradient = useMemo(() => {
    if (!dashboardTotalUnits) return "conic-gradient(#e5e7eb 0deg 360deg)"
    let start = 0
    const stops = dashboardGroups
      .filter((group) => group.units > 0)
      .map((group) => {
        const sweep = (group.units / dashboardTotalUnits) * 360
        const end = start + sweep
        const stop = `${group.color} ${start}deg ${end}deg`
        start = end
        return stop
      })
    return `conic-gradient(${stops.join(", ")})`
  }, [dashboardGroups, dashboardTotalUnits])

  return (
    <div className="h-screen overflow-hidden bg-[#eef2f6] text-slate-900">
      {/* Use flex so the sidebar remains visible when expanded. */}
      <div className="flex h-full overflow-hidden">
        <Sidebar activeSection={visibleSection} onSectionChange={setActiveSection} currentUser={currentUser} onLogout={onLogout} />

        <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden p-0">
          {toast ? (
            <div
              key={toast.id}
              role="status"
              aria-live="polite"
              className={[
                "fixed right-4 top-4 z-[100] rounded-2xl border px-4 py-3 text-sm font-medium shadow-lg",
                toast.type === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-900 shadow-rose-950/10"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900 shadow-emerald-950/10",
              ].join(" ")}
            >
              {toast.message}
            </div>
          ) : null}

          <div className="flex h-full w-full min-w-0 flex-col">
            {visibleSection === "dashboard" ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-slate-100 p-5 md:p-7">
                <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Inventory Overview</p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
                      Asset Distribution Dashboard
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">Live stock view</span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">Category wise divided</span>
                  </div>
                </div>

                <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
                      <div className="flex flex-1 items-center justify-center">
                        <div
                          className="relative flex aspect-square w-full max-w-[330px] items-center justify-center rounded-full"
                          style={{ background: assetWheelGradient }}
                          aria-label="Asset category percentage wheel"
                        >
                          <div className="flex size-[62%] flex-col items-center justify-center rounded-full border border-slate-100 bg-white text-center shadow-inner">
                            <Package className="mb-2 size-7 text-slate-700" />
                            <div className="text-4xl font-semibold tracking-tight text-slate-950">{dashboardTotalUnits}</div>
                            <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Total Assets</div>
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0 flex-1 space-y-3">
                        <div>
                          <h3 className="text-base font-semibold text-slate-950">Department Share</h3>
                          <p className="mt-1 text-sm text-slate-500">Assets grouped into IT, Engineering, Store, and Others.</p>
                        </div>
                        <div className="space-y-3">
                          {dashboardGroups.map((group) => (
                            <div key={group.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <div className="mb-2 flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="size-3 rounded-full" style={{ backgroundColor: group.color }} />
                                  <span className="truncate text-sm font-semibold text-slate-900">{group.label}</span>
                                </div>
                                <div className="text-sm font-semibold text-slate-950">{formatPercent(group.percentage)}</div>
                              </div>
                              <div className="h-2 rounded-full bg-white">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${Math.max(0, Math.min(100, group.percentage))}%`, backgroundColor: group.color }}
                                />
                              </div>
                              <div className="mt-2 flex justify-between text-xs text-slate-500">
                                <span>{group.units} asset{group.units === 1 ? "" : "s"}</span>
                                <span>{group.records} record{group.records === 1 ? "" : "s"}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Availability</p>
                          <h3 className="mt-1 text-2xl font-semibold text-slate-950">{dashboardAvailableUnits}</h3>
                        </div>
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                          <Boxes className="size-6" />
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-slate-500">Available units currently ready for issue or stock movement.</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Issued Stock</p>
                          <h3 className="mt-1 text-2xl font-semibold text-slate-950">{dashboardIssuedUnits}</h3>
                        </div>
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-700">
                          <ArrowLeftRight className="size-6" />
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-slate-500">{activeIssues.length} active issue record{activeIssues.length === 1 ? "" : "s"} in progress.</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2 xl:col-span-1">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Workflow Records</p>
                          <h3 className="mt-1 text-2xl font-semibold text-slate-950">{issues.length}</h3>
                        </div>
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                          <Activity className="size-6" />
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <div className="font-semibold text-slate-950">{activeIssues.length}</div>
                          <div className="text-xs text-slate-500">Active issues</div>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <div className="font-semibold text-slate-950">{returnedIssues.length}</div>
                          <div className="text-xs text-slate-500">Returned</div>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            ) : null}
            {visibleSection === "assets" ? (
              <AssetsSection
                catalog={catalog}
                filteredStocks={filteredStocks}
                assetsWithAvailability={assetsWithAvailability}
                activeStocksTab={effectiveActiveStocksTab}
                onActiveStocksTabChange={setActiveStocksTab}
                searchTerm={stocksSearchTerm}
                onSearchTermChange={setStocksSearchTerm}
                onAddAsset={canManage ? openAssetModal : null}
                onExportCsv={exportStocksCsv}
                onEditAsset={canManage ? openEditAssetModal : null}
                onIssueAsset={canManage ? issueAsset : null}
                onRemoveAsset={canManage ? removeAsset : null}
                onViewInvoice={setInvoicePreview}
              />
            ) : null}

            {visibleSection === "employees" ? (
              <EmployeesSection
                employees={employees}
                onAddEmployee={canManage ? openEmployeeModal : null}
                onEditEmployee={canManage ? openEditEmployeeModal : null}
                onRemoveEmployee={canManage ? removeEmployee : null}
              />
            ) : null}

            {visibleSection === "i-note" ? (
              <INoteSection notes={notes} assets={assets} onAddAssetFromINote={canManage ? openAssetModalFromINote : null} />
            ) : null}

            {visibleSection === "issue-return" ? (
              <IssueReturnSection
                issues={issues}
                issueAssetById={issueAssetById}
                issueStatusFilter={issueStatusFilter}
                onIssueStatusFilterChange={setIssueStatusFilter}
                issueSearchTerm={issueSearchTerm}
                onIssueSearchTermChange={setIssueSearchTerm}
                onAddIssue={canManage ? openIssueModal : null}
                onEditIssue={canManage ? openEditIssueModal : null}
                onReturnIssue={canManage ? returnIssue : null}
                onTransferIssue={canManage ? openTransferIssueModal : null}
              />
            ) : null}

            {visibleSection === "users" && isAdmin ? (
              <UserManagementSection currentUser={currentUser} catalog={catalog} onOpenCatalogModal={openCatalogModal} />
            ) : null}
          </div>
        </main>
      </div>

      {/* Asset Modal */}
      <Modal
        open={assetModalOpen}
        onClose={() => { setAssetModalOpen(false); setEditingAssetId(null); setAssetPrefillSource(null) }}
        title={editingAssetId ? "Edit Asset" : "Add Asset"}
        description="Create or update an asset with quantity, serial numbers, and invoice details."
      >
        <form className="space-y-5" onSubmit={submitAssetForm}>
          {assetPrefillSource ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <div className="font-semibold">Linked from I-Note {assetPrefillSource.noteNo || "-"}</div>
              <div className="mt-1 text-xs leading-5 text-emerald-800">
                Accepted quantity {assetPrefillSource.quantity}. {assetPrefillSource.itemDescription || "Item description not available."}
              </div>
              {assetPrefillSource.orderNo ? (
                <div className="mt-1 text-xs text-emerald-700">Order: {assetPrefillSource.orderNo}</div>
              ) : null}
              {assetPrefillSource.invoiceNo ? (
                <div className="mt-1 text-xs text-emerald-700">Invoice: {assetPrefillSource.invoiceNo}</div>
              ) : null}
              {assetPrefillSource.orderDate || assetPrefillSource.supplyDate ? (
                <div className="mt-1 text-xs text-emerald-700">
                  {assetPrefillSource.orderDate ? `Order date: ${assetPrefillSource.orderDate}` : ""}
                  {assetPrefillSource.orderDate && assetPrefillSource.supplyDate ? " | " : ""}
                  {assetPrefillSource.supplyDate ? `Delivery date: ${assetPrefillSource.supplyDate}` : ""}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-700">Type</span>
                <button type="button" className="text-xs font-medium text-green-600 hover:text-green-900" onClick={() => openCatalogModal("type")}>
                  + Add
                </button>
              </div>
              <select
                value={assetForm.type}
                onChange={(event) => handleAssetTypeChange(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              >
                {getTypeOptions(catalog).map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
               
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-700">Category</span>
                <button type="button" className="text-xs font-medium text-lime-600 hover:text-lime-900" onClick={() => openCatalogModal("category")}>
                  + Add
                </button>
              </div>
              <select
                value={assetForm.category}
                onChange={(event) => handleAssetCategoryChange(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              >
                {getCategoriesForType(catalog, assetForm.type).map((category) => (
                  <option key={category.label} value={category.label}>{category.label}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-700">Sub Category</span>
                <button type="button" className="text-xs font-medium text-lime-600 hover:text-lime-900" onClick={() => openCatalogModal("subcategory")}>
                  + Add
                </button>
              </div>
              <select
                value={assetForm.subCategory}
                onChange={(event) => handleAssetSubCategoryChange(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              >
                <option value="">Select sub category</option>
                {assetSubCategoryOptions.some((item) => item.label === assetForm.subCategory) || !assetForm.subCategory ? null : (
                  <option value={assetForm.subCategory}>{assetForm.subCategory}</option>
                )}
                {assetSubCategoryOptions.map((subCategory) => (
                  <option key={subCategory.label} value={subCategory.label}>{subCategory.label}</option>
                ))}
              </select>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Make</span>
              <input
                value={assetForm.make}
                onChange={(event) => setAssetForm((current) => ({ ...current, make: event.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Model</span>
              <input
                value={assetForm.model}
                onChange={(event) => setAssetForm((current) => ({ ...current, model: event.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Quantity</span>
              <input
                type="number"
                min="1"
                value={assetForm.quantity}
                onChange={(event) => handleAssetQuantityChange(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2 md:col-span-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Invoice No</span>
                <input
                  value={assetForm.invoiceNo}
                  onChange={(event) => setAssetForm((current) => ({ ...current, invoiceNo: event.target.value }))}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                />
                <span className="text-xs text-slate-600">Optional</span>
              </label>

              <div className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Invoice File</span>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition hover:border-slate-400 hover:bg-slate-100">
                  <Upload className="size-4 shrink-0 text-slate-500" />
                  <span className="font-medium">{assetForm.invoiceFileName || "Choose file"}</span>
                  <span className="ml-auto text-xs text-slate-500">PDF / Image</span>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={async (event) => handleAssetFileChange(event.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
                <span className="text-xs text-slate-600">Optional</span>
              </div>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Date of Warranty</span>
              <input
                type="date"
                value={assetForm.warrantyDate || ""}
                onChange={(event) => setAssetForm((current) => ({ ...current, warrantyDate: event.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Order Date</span>
              <input
                type="date"
                value={assetForm.orderDate}
                onChange={(event) => setAssetForm((current) => ({ ...current, orderDate: event.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Supply Date</span>
              <input
                type="date"
                value={assetForm.supplyDate}
                onChange={(event) => setAssetForm((current) => ({ ...current, supplyDate: event.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              />
            </label>
          </div>
         
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Serial Numbers</h3>
                <p className="text-xs text-slate-500">Tick to add serial numbers. Entered serial numbers cannot match another asset.</p>
              </div>
              <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={assetForm.useSerialNumbers}
                  onChange={(event) => handleAssetSerialTrackingChange(event.target.checked)}
                  className="mt-0.5 size-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
                />
                <span>If Serial No. available mark this box</span>
              </label>
            </div>
            {assetForm.useSerialNumbers ? (
              <div className="grid gap-3 md:grid-cols-2">
                {Array.from({ length: assetForm.quantity }).map((_, index) => (
                  <label key={index} className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700">Serial No {index + 1}</span>
                    <input
                      value={assetForm.serialNumbers[index] ?? ""}
                      onChange={(event) => handleAssetSerialChange(index, event.target.value)}
                      className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                    />
                  </label>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                Serial numbers are disabled for this asset. It will save without serial numbers.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <ActionButton
              type="button"
              className="bg-slate-200 text-blue-900 hover:bg-slate-300"
              onClick={() => { setAssetModalOpen(false); setAssetPrefillSource(null) }}
            >
              Cancel
            </ActionButton>
            <ActionButton type="submit">{editingAssetId ? "Update Asset" : "Save Asset"}</ActionButton>
          </div>
        </form>
      </Modal>

      {/* Employee Modal */}
      <Modal
        open={employeeModalOpen}
        onClose={() => { setEmployeeModalOpen(false); setEditingEmployeeId(null) }}
        title={editingEmployeeId ? "Edit Employee" : "Add Employee"}
        description="Create a new employee record."
        widthClass="max-w-2xl"
      >
        <form className="space-y-5" onSubmit={submitEmployeeForm}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Employee Code</span>
              <input
                value={employeeForm.code}
                onChange={(event) => setEmployeeForm((current) => ({ ...current, code: event.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Employee Name</span>
              <input
                value={employeeForm.name}
                onChange={(event) => setEmployeeForm((current) => ({ ...current, name: event.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              />
            </label>
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                type="email"
                value={employeeForm.email}
                onChange={(event) => setEmployeeForm((current) => ({ ...current, email: event.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              />
            </label>
          </div>
          <div className="flex justify-end gap-3">
            <ActionButton type="button" className="bg-slate-200 text-slate-900 hover:bg-slate-300" onClick={() => setEmployeeModalOpen(false)}>
              Cancel
            </ActionButton>
            <ActionButton type="submit">{editingEmployeeId ? "Update Employee" : "Save Employee"}</ActionButton>
          </div>
        </form>
      </Modal>

      {/* Issue Modal */}
      <Modal
        open={issueModalOpen}
        onClose={() => {
          setIssueModalOpen(false)
          setEditingIssueId(null)
          setAssetSearchTerm("")
          setEmployeeSearchTerm("")
          setShowAssetDropdown(false)
          setShowEmployeeDropdown(false)
        }}
        title={editingIssueId ? "Edit Issue Item" : "Issue Item"}
        description="Issue an asset to an employee and keep stock availability in sync."
      >
        <form className="space-y-5" onSubmit={submitIssueForm}>
          <div className="space-y-4">
            <div className="relative grid gap-2">
              <span className="text-sm font-medium text-slate-700">Select Asset</span>
              <div className="text-xs text-slate-500 mb-1">ID | Sub Category | Make/Model | Serial</div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Start typing Asset ID, Sub Category, Make, or Model..."
                  value={showAssetDropdown ? assetSearchTerm : (issueForm.assetId ? `${issueForm.assetId}` : "")}
                  onChange={(e) => { setAssetSearchTerm(e.target.value); setShowAssetDropdown(true) }}
                  onFocus={() => setShowAssetDropdown(true)}
                  onBlur={() => setTimeout(() => setShowAssetDropdown(false), 200)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
                {showAssetDropdown && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                    {filteredAssets.length > 0 ? (
                      filteredAssets.map((asset) => (
                        <button
                          key={asset.assetId}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            handleIssueAssetChange(asset.assetId)
                            setAssetSearchTerm("")
                            setShowAssetDropdown(false)
                          }}
                          className="block w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-slate-100 last:border-b-0 text-sm transition"
                        >
                          <div className="font-semibold text-slate-900">{asset.assetId}</div>
                          <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                            <div>
                              <span className="inline-block bg-slate-100 px-2 py-0.5 rounded mr-2 font-medium">{asset.subCategory}</span>
                              <span className="text-slate-500">{asset.make}/{asset.model}</span>
                            </div>
                            <div className="text-slate-500">Serial: {asset.serialNumbers?.[0] || "-"}</div>
                          </div>
                        </button>
                      ))
                    ) : assetSearchTerm ? (
                      <div className="px-4 py-6 text-center text-sm text-slate-500">
                        <div>No matching assets found</div>
                        <div className="text-xs mt-1">Try searching by Asset ID, Sub Category, or Model</div>
                      </div>
                    ) : (
                      <div className="px-4 py-6 text-center text-sm text-slate-500">
                        <div>Start typing to search assets</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {issueForm.assetId && (
                <div className="text-xs text-green-600 font-medium mt-1">Selected: {issueForm.assetId} | {issueForm.subCategory}</div>
              )}
            </div>

            <div className="relative grid gap-2">
              <span className="text-sm font-medium text-slate-700">Select Employee</span>
              <div className="text-xs text-slate-500 mb-1">Code | Name | Email</div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Start typing Employee Code or Name..."
                  value={showEmployeeDropdown
                    ? employeeSearchTerm
                    : (issueForm.employeeCode
                      ? `${issueForm.employeeCode}${issueForm.employeeName ? ` - ${issueForm.employeeName}` : ""}`
                      : "")}
                  onChange={(e) => { setEmployeeSearchTerm(e.target.value); setShowEmployeeDropdown(true) }}
                  onFocus={() => setShowEmployeeDropdown(true)}
                  onBlur={() => setTimeout(() => setShowEmployeeDropdown(false), 200)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
                {showEmployeeDropdown && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                    {filteredEmployees.length > 0 ? (
                      filteredEmployees.map((emp) => (
                        <button
                          key={emp.id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            handleIssueEmployeeCodeChange(emp.code)
                            setEmployeeSearchTerm("")
                            setShowEmployeeDropdown(false)
                          }}
                          className="block w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-slate-100 last:border-b-0 text-sm transition"
                        >
                          <div className="font-semibold text-slate-900">{emp.code}</div>
                          <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                            <div className="font-medium">{emp.name}</div>
                            <div className="text-slate-500">{emp.email}</div>
                          </div>
                        </button>
                      ))
                    ) : employeeSearchTerm ? (
                      <div className="px-4 py-6 text-center text-sm text-slate-500">
                        <div>No matching employees found</div>
                        <div className="text-xs mt-1">Try searching by Code or Name</div>
                      </div>
                    ) : (
                      <div className="px-4 py-6 text-center text-sm text-slate-500">
                        <div>Start typing to search employees</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {issueForm.employeeCode && (
                <div className="text-xs text-green-600 font-medium mt-1">Selected: {issueForm.employeeCode} | {issueForm.employeeName}</div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 pt-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Location</span>
                <input
                  value={issueForm.location}
                  onChange={(event) => setIssueForm((current) => ({ ...current, location: event.target.value }))}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  placeholder="e.g., Office, Lab, Warehouse"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Issue Date</span>
                <input
                  type="date"
                  value={issueForm.issueDate}
                  onChange={(event) => setIssueForm((current) => ({ ...current, issueDate: event.target.value }))}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <ActionButton type="button" className="bg-slate-200 text-slate-900 hover:bg-slate-300" onClick={() => setIssueModalOpen(false)}>
              Cancel
            </ActionButton>
            <ActionButton type="submit">{editingIssueId ? "Update Issue Item" : "Issue Item"}</ActionButton>
          </div>
        </form>
      </Modal>

      {/* Transfer Modal */}
      <Modal
        open={transferModalOpen}
        onClose={() => {
          setTransferModalOpen(false)
          setTransferForm(emptyTransferForm())
        }}
        title="Transfer Item"
        description="Move an issued asset from one location to another and record the transfer date."
        widthClass="max-w-2xl"
      >
        <form className="space-y-5" onSubmit={submitTransferForm}>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Asset ID</div>
            <div className="mt-1 text-base font-semibold text-slate-950">{transferForm.assetId || "-"}</div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">From Employee</div>
              <div className="mt-2 text-sm font-semibold text-slate-950">
                {transferForm.fromEmployeeCode || "-"} {transferForm.fromEmployeeName ? `- ${transferForm.fromEmployeeName}` : ""}
              </div>
              <div className="mt-1 text-xs text-slate-500">{transferForm.fromEmployeeEmail || "-"}</div>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">To Employee</span>
              <select
                value={transferForm.toEmployeeId}
                onChange={(event) => handleTransferEmployeeChange(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                required
              >
                <option value="">Select employee</option>
                {employees
                  .filter((employee) => employee.id !== transferForm.fromEmployeeId)
                  .map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.code} - {employee.name}
                    </option>
                  ))}
              </select>
              {transferForm.toEmployeeId ? (
                <span className="text-xs text-slate-500">
                  {transferForm.toEmployeeEmail || "-"}
                </span>
              ) : null}
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">From Location</span>
              <input
                value={transferForm.fromLocation}
                readOnly
                className="h-11 rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-600 outline-none"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">To Location</span>
              <input
                value={transferForm.toLocation}
                onChange={(event) => setTransferForm((current) => ({ ...current, toLocation: event.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                placeholder="Enter new location"
                required
              />
            </label>
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Transfer Date</span>
              <input
                type="date"
                value={transferForm.transferDate}
                onChange={(event) => setTransferForm((current) => ({ ...current, transferDate: event.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                required
              />
            </label>
          </div>

          <div className="flex justify-end gap-3">
            <ActionButton
              type="button"
              className="bg-slate-200 text-slate-900 hover:bg-slate-300"
              onClick={() => {
                setTransferModalOpen(false)
                setTransferForm(emptyTransferForm())
              }}
            >
              Cancel
            </ActionButton>
            <ActionButton type="submit">Transfer Item</ActionButton>
          </div>
        </form>
      </Modal>

      {/* Catalog Modal */}
      <Modal
        open={!!catalogModal}
        onClose={() => setCatalogModal(null)}
        title={
          catalogModal?.target === "type" ? "Add Type"
            : catalogModal?.target === "category" ? "Add Category"
            : "Add Sub Category"
        }
        description={
          catalogModal?.target === "type" ? "Add a new asset type option."
            : catalogModal?.target === "category" ? `Add a new category under ${assetForm.type}.`
            : `Add a new sub category under ${assetForm.type} / ${assetForm.category}.`
        }
        widthClass="max-w-xl"
      >
        <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); addCatalogOption() }}>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Name</span>
            <input
              value={catalogModal?.value || ""}
              onChange={(event) => setCatalogModal((current) => ({ ...(current ?? { target: "type", value: "" }), value: event.target.value }))}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              placeholder={
                catalogModal?.target === "type" ? "Example: Location"
                  : catalogModal?.target === "category" ? "Example: Network Equipment"
                  : "Example: Laptops"
              }
            />
          </label>
          {catalogModal?.target !== "type" ? (
            <p className="text-xs text-slate-500">
              {catalogModal?.target === "category" ? (
                <>This category will be attached to <span className="font-medium text-slate-700">{assetForm.type}</span>.</>
              ) : (
                <>This sub category will be attached to <span className="font-medium text-slate-700">{assetForm.type} / {assetForm.category}</span>.</>
              )}
            </p>
          ) : null}
          <div className="flex justify-end gap-3">
            <ActionButton type="button" className="bg-slate-200 text-slate-900 hover:bg-slate-300" onClick={() => setCatalogModal(null)}>
              Cancel
            </ActionButton>
            <ActionButton type="submit">Save</ActionButton>
          </div>
        </form>
      </Modal>

      {/* Invoice Preview Modal */}
      <Modal
        open={!!invoicePreview}
        onClose={() => setInvoicePreview(null)}
        title="Invoice Preview"
        description={invoicePreview?.fileName || ""}
      >
        {invoicePreview ? (
          <div className="space-y-4">
            {invoicePreview.fileType?.startsWith("image/") ? (
              <img
                src={invoicePreview.dataUrl}
                alt={invoicePreview.fileName}
                className="max-h-[70vh] w-full rounded-2xl object-contain"
              />
            ) : (
              <iframe
                title={invoicePreview.fileName}
                src={invoicePreview.dataUrl}
                className="h-[70vh] w-full rounded-2xl border border-slate-200"
              />
            )}
            <div className="flex justify-end">
              <ActionButton type="button" className="bg-slate-200 text-slate-900 hover:bg-slate-300" onClick={() => setInvoicePreview(null)}>
                Close
              </ActionButton>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

export default InventoryDashboard

import { useEffect, useMemo, useState } from "react"
import { ArrowLeftRight, CircleCheckBig, Eye, FileText, Package, Plus, Search, Upload, Users } from "lucide-react"
import Sidebar from "@/components/Sidebar"
import Modal from "@/components/Modal"
import campusImage from "@/assets/rcb-campus.jpg"
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
import { formatDate, generateAssetId, loadInventoryState, saveInventoryState } from "@/lib/inventory"
import { ActionButton, StatCard, SectionShell } from "@/components/dashboard-ui"
import AssetsSection from "@/components/AssetsSection"
import StocksSection from "@/components/StocksSection"
import EmployeesSection from "@/components/EmployeesSection"
import IssueReturnSection from "@/components/IssueReturnSection"

function todayISO() {
  return new Date().toISOString().slice(0, 10)
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
    useSerialNumbers: true,
    serialNumbers: [""],
    invoiceNo: "",
    invoiceFile: null,
    invoiceFileName: "",
    invoiceFileType: "",
    purchaseDate: todayISO(),
    orderDate: "",
    supplyDate: "",
  }
}

function emptyEmployeeForm() {
  return {
    code: "",
    name: "",
    email: "",
  }
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

function normalizeIssueStatus(status) {
  return String(status || "").trim().toLowerCase()
}

function emptyNoteForm() {
  return {
    inoteDate: todayISO(),
    invoiceNo: "",
    orderNo: "",
    orderDate: "",
    indentorName: "",
    supplierName: "",
  }
}

function normalizeSerials(values, quantity) {
  const serials = [...values]
  while (serials.length < quantity) serials.push("")
  return serials.slice(0, quantity)
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

function generateNoteId(inventory) {
  const year = new Date().getFullYear().toString().slice(-2)
  const noteCounters = inventory.counters?.noteCounter ?? 0
  const nextCounter = noteCounters + 1
  const noteId = `RCB/INOTE/${year}/${String(nextCounter).padStart(3, '0')}`
  return { noteId, nextCounter }
}

function escapeCsvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

function buildAssetsCsv(assets, catalog) {
  const headers = [
    "assetId",
    "type",
    "category",
    "subCategory",
    "make",
    "model",
    "quantity",
    "serialNumbers",
    "invoiceNo",
    "purchaseDate",
    "orderDate",
    "supplyDate",
    "availableQuantity",
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
    asset.orderDate || "",
    asset.supplyDate || "",
    asset.availableQuantity ?? "",
  ])

  return [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n")
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

function InventoryDashboard() {
  const initial = loadInventoryState()
  const [inventory, setInventory] = useState(initial)
  const [activeSection, setActiveSection] = useState("dashboard")
  const [searchTerm, setSearchTerm] = useState("")
  const [stocksSearchTerm, setStocksSearchTerm] = useState("")
  const [activeStocksTab, setActiveStocksTab] = useState("IT")
  const [issueStatusFilter, setIssueStatusFilter] = useState("all")
  const [issueSearchTerm, setIssueSearchTerm] = useState("")
  const [hydrated, setHydrated] = useState(false)
  const [assetModalOpen, setAssetModalOpen] = useState(false)
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false)
  const [issueModalOpen, setIssueModalOpen] = useState(false)
  const [noteModalOpen, setNoteModalOpen] = useState(false)
  const [noteForm, setNoteForm] = useState(emptyNoteForm())
  const [invoicePreview, setInvoicePreview] = useState(null)
  const [catalogModal, setCatalogModal] = useState(null)
  const [editingAssetId, setEditingAssetId] = useState(null)
  const [editingEmployeeId, setEditingEmployeeId] = useState(null)
  const [editingIssueId, setEditingIssueId] = useState(null)
  const [toast, setToast] = useState(null)
  const [assetForm, setAssetForm] = useState(emptyAssetForm(initial.catalog ?? createDefaultCatalog()))
  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm())
  const [issueForm, setIssueForm] = useState(emptyIssueForm())
  const [assetSearchTerm, setAssetSearchTerm] = useState("")
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("")
  const [showAssetDropdown, setShowAssetDropdown] = useState(false)
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false)

  const catalog = useMemo(
    () => normalizeCatalog(inventory.catalog ?? createDefaultCatalog()),
    [inventory.catalog],
  )

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
    return () => {
      cancelled = true
    }
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
    () =>
      assets.map((asset) => ({
        ...asset,
        availableQuantity: assetAvailability.get(asset.assetId) ?? 0,
      })),
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
  const stockQuantityTotal = useMemo(
    () => stockAssets.reduce((total, asset) => total + (Number(asset.availableQuantity ?? 0) || 0), 0),
    [stockAssets],
  )
  const assetSubCategoryOptions = getSubCategoriesForTypeAndCategory(catalog, assetForm.type, assetForm.category)

  const filteredAssets = useMemo(() => {
    if (!showAssetDropdown) return []
    const term = assetSearchTerm.toLowerCase()
    if (!term) return availableIssueAssets
    return availableIssueAssets.filter((asset) => {
      return (
        asset.assetId.toLowerCase().includes(term) ||
        asset.subCategory?.toLowerCase().includes(term) ||
        asset.model?.toLowerCase().includes(term) ||
        asset.make?.toLowerCase().includes(term)
      )
    })
  }, [assetSearchTerm, showAssetDropdown, availableIssueAssets])

  const filteredEmployees = useMemo(() => {
    if (!showEmployeeDropdown) return []
    const term = employeeSearchTerm.toLowerCase()
    if (!term) return employees
    return employees.filter((emp) => {
      return (
        emp.code.toLowerCase().includes(term) ||
        emp.name?.toLowerCase().includes(term) ||
        emp.email?.toLowerCase().includes(term)
      )
    })
  }, [employeeSearchTerm, showEmployeeDropdown, employees])

  const counts = {
    dashboard: "",
    assets: assets.length,
    stocks: stockQuantityTotal,
    employees: employees.length,
    "issue-return": issues.length,
    inote: notes.length,
  }


  const filteredStocks = useMemo(() => {
    const term = stocksSearchTerm.trim().toLowerCase()
    // Filter by active tab type first, then search term
    const tabFiltered = stockAssets.filter((asset) => asset.type === activeStocksTab)
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
  }, [stockAssets, stocksSearchTerm, activeStocksTab])

  function openAssetModal() {
    setEditingAssetId(null)
    setAssetForm(emptyAssetForm(catalog))
    setAssetModalOpen(true)
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
      orderDate: asset.orderDate || "",
      supplyDate: asset.supplyDate || "",
    })
    setAssetModalOpen(true)
  }

  function openEditEmployeeModal(employee) {
    setEditingEmployeeId(employee.id)
    setEmployeeForm({
      code: employee.code || "",
      name: employee.name || "",
      email: employee.email || "",
    })
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

  function openCatalogModal(target) {
    setCatalogModal({ target, value: "" })
  }

  function showSuccess(message) {
    setToast({ type: "success", message })
  }

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
  }

  function handleIssueAssetChange(nextAssetId) {
    const nextAsset = assets.find((asset) => asset.assetId === nextAssetId)
    setIssueForm((current) => ({
      ...current,
      assetId: nextAssetId,
      subCategory: nextAsset?.subCategory || "",
      // Each asset now has exactly 1 serial number ” auto-fill it
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
    setAssetForm((current) => ({
      ...current,
      subCategory: nextSubCategory,
    }))
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
      setAssetForm((current) => ({
        ...current,
        invoiceFile: null,
        invoiceFileName: "",
        invoiceFileType: "",
      }))
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
      ? normalizeSerials(assetForm.serialNumbers, quantity).map((serial) => serial.trim())
      : []

    if (useSerialNumbers && serialNumbers.some((serial) => !serial)) return

    const now = new Date().toISOString()

    // Edit mode: update single existing asset as before
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
        orderDate: assetForm.orderDate,
        supplyDate: assetForm.supplyDate,
        createdAt: now,
        updatedAt: now,
      }
      setInventory((current) => ({
        ...current,
        assets: (current.assets ?? []).map((asset) =>
          asset.assetId === editingAssetId ? updatedAsset : asset,
        ),
        counters: nextCounters,
      }))
      setAssetModalOpen(false)
      setEditingAssetId(null)
      setAssetForm(emptyAssetForm(catalog))
      showSuccess("Asset updated successfully.")
      return
    }

    // Add mode: keep serial-tracked items separate, otherwise store quantity in one record.
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
        orderDate: assetForm.orderDate,
        supplyDate: assetForm.supplyDate,
        createdAt: now,
        updatedAt: now,
      })
    }

    if (useSerialNumbers) {
      for (let i = 0; i < quantity; i++) {
        createAssetRecord(1, [serialNumbers[i]])
      }
    } else {
      createAssetRecord(quantity, [])
    }

    setInventory((current) => ({
      ...current,
      assets: [...newAssets, ...(current.assets ?? [])],
      counters: runningCounters,
    }))
    setAssetModalOpen(false)
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
      createdAt: now,
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

  function removeAsset(assetId) {
    setInventory((current) => ({
      ...current,
      assets: (current.assets ?? []).filter((asset) => asset.assetId !== assetId),
    }))
  }

  function exportAssetsCsv() {
    const csv = buildAssetsCsv(assetsWithAvailability, catalog)
    const dateStamp = new Date().toISOString().slice(0, 10)
    downloadTextFile(`sku_assets_export_${dateStamp}.csv`, csv, "text/csv;charset=utf-8")
    showSuccess("CSV exported successfully.")
  }

  function removeEmployee(employeeId) {
    setInventory((current) => ({
      ...current,
      employees: (current.employees ?? []).filter((employee) => employee.id !== employeeId),
    }))
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

  const stats = [
    { label: "Total Assets", value: assets.length, icon: Package },
    { label: "Total Stock Records", value: assets.length, icon: FileText },
    { label: "Employees", value: employees.length, icon: Users },
    { label: "Issue Records", value: issues.length, icon: ArrowLeftRight },
  ]

  let recentAssets = [...assets]
  recentAssets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  recentAssets = recentAssets.slice(0, 10)

  return (
    <div className="h-screen overflow-hidden bg-[#eef2f6] text-slate-900">
      <div className="grid h-full lg:grid-cols-[280px_1fr]">
        <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} counts={counts} />

        <main className="flex h-full flex-col overflow-hidden px-4 py-4 md:px-6 md:py-6">
          {toast ? (
            <div className="fixed right-4 top-4 z-50 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 shadow-lg shadow-emerald-950/10">
              {toast.message}
            </div>
          ) : null}
          <div className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden">
            {activeSection === "dashboard" ? (
              <div className="flex-1 space-y-6 overflow-y-auto">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {stats.map((stat) => (
                    <StatCard key={stat.label} {...stat} />
                  ))}
                </div>
                <div className="relative min-h-[620px] overflow-hidden rounded-3xl border border-slate-200 bg-slate-950/5 shadow-sm md:min-h-[740px]">
                  {/* <div className="absolute inset-0 bg-gradient-to-br from-slate-950/5 via-white/10 to-slate-950/10" /> */}
                  <div className="absolute inset-0">
                    <img
                      src={campusImage}
                      alt="RCB Campus"
                      className="h-full w-full object-cover object-center"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-950/50 via-blue-950/30 to-blue-950/5" />
                  <div className="relative z-10 flex min-h-[620px] items-start px-6 pt-12 md:min-h-[740px] md:px-10 md:pt-16">
                    <div className="max-w-2xl p-6 text-white md:p-8">
                      <h2 className="text-3xl font-bold tracking-tight text-white md:text-5xl">
                        Regional Centre for Biotechnology
                      </h2>
                      <p className="mt-4 max-w-xl text-base leading-7 text-white/90 md:text-lg">
                        A centralized platform designed to efficiently manage organizational assets and resources across all departments.
                      </p>
                      <div className="mt-7 space-y-3">
                        <div className="flex items-center gap-3 text-white">
                          <CircleCheckBig className="size-5 flex-shrink-0 text-emerald-400" />
                          <span className="text-base font-medium">Real-time Stock Monitoring</span>
                        </div>
                        <div className="flex items-center gap-3 text-white">
                          <CircleCheckBig className="size-5 flex-shrink-0 text-emerald-400" />
                          <span className="text-base font-medium">Category-wise Asset Tracking</span>
                        </div>
                        <div className="flex items-center gap-3 text-white">
                          <CircleCheckBig className="size-5 flex-shrink-0 text-emerald-400" />
                          <span className="text-base font-medium">Easy Data Access & Reports</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeSection === "assets" ? (
              <AssetsSection
                catalog={catalog}
                filteredAssets={filteredAssets}
                recentAssets={recentAssets}
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
                onAddAsset={openAssetModal}
                onExportCsv={exportAssetsCsv}
                onEditAsset={openEditAssetModal}
                onIssueAsset={issueAsset}
                onRemoveAsset={removeAsset}
                onViewInvoice={setInvoicePreview}
              />
            ) : null}

            {activeSection === "stocks" ? (
              <StocksSection
                catalog={catalog}
                stockAssets={stockAssets}
                filteredStocks={filteredStocks}
                assetsWithAvailability={assetsWithAvailability}
                activeStocksTab={activeStocksTab}
                onActiveStocksTabChange={setActiveStocksTab}
                searchTerm={stocksSearchTerm}
                onSearchTermChange={setStocksSearchTerm}
                onViewInvoice={setInvoicePreview}
              />
            ) : null}

            {activeSection === "employees" ? (
              <EmployeesSection
                employees={employees}
                onAddEmployee={openEmployeeModal}
                onEditEmployee={openEditEmployeeModal}
                onRemoveEmployee={removeEmployee}
              />
            ) : null}

            {activeSection === "issue-return" ? (
              <IssueReturnSection
                issues={issues}
                issueAssetById={issueAssetById}
                issueStatusFilter={issueStatusFilter}
                onIssueStatusFilterChange={setIssueStatusFilter}
                issueSearchTerm={issueSearchTerm}
                onIssueSearchTermChange={setIssueSearchTerm}
                onAddIssue={openIssueModal}
                onEditIssue={openEditIssueModal}
                onReturnIssue={returnIssue}
              />
            ) : null}

            {activeSection === "inote" ? (
              <SectionShell
                title="I-Note"
                description="I-Note number, dates, invoice, order, indentor, and supplier details."
                action={
                  <ActionButton onClick={() => { setNoteForm(emptyNoteForm()); setNoteModalOpen(true) }}>
                    <Plus className="size-4" />
                    Generate I-Note
                  </ActionButton>
                }
              >
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                      <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-medium">S.No.</th>
                          <th className="px-4 py-3 font-medium">i-Note No.</th>
                          <th className="px-4 py-3 font-medium">i-Note Date</th>
                          <th className="px-4 py-3 font-medium">Invoice No</th>
                          <th className="px-4 py-3 font-medium">Order No</th>
                          <th className="px-4 py-3 font-medium">Order Date</th>
                          <th className="px-4 py-3 font-medium">Name of the Indentor</th>
                          <th className="px-4 py-3 font-medium">Supplier Name</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {notes.length ? (
                          notes.map((note, index) => (
                            <tr key={note.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-semibold text-slate-900">{index + 1}</td>
                              <td className="px-4 py-3 font-semibold text-slate-900">{note.noteId || `RCB/INOTE/${String(new Date().getFullYear()).slice(-2)}/${String(notes.length - index).padStart(3, '0')}`}</td>
                              <td className="px-4 py-3 text-slate-700">{formatDate(note.inoteDate)}</td>
                              <td className="px-4 py-3 text-slate-700">{note.invoiceNo || "â€”"}</td>
                              <td className="px-4 py-3 text-slate-700">{note.orderNo || "â€”"}</td>
                              <td className="px-4 py-3 text-slate-700">{formatDate(note.orderDate)}</td>
                              <td className="px-4 py-3 text-slate-700">{note.indentorName || "â€”"}</td>
                              <td className="px-4 py-3 text-slate-700">{note.supplierName || "â€”"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                              No I-Notes created yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </SectionShell>
            ) : null}
          </div>
        </main>
      </div>

      <Modal
        open={assetModalOpen}
        onClose={() => {
          setAssetModalOpen(false)
          setEditingAssetId(null)
        }}
        title={editingAssetId ? "Edit Asset" : "Add Asset"}
        description="Create or update an asset with quantity, serial numbers, and invoice details."
      >
        <form className="space-y-5" onSubmit={submitAssetForm}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-700">Type</span>
                <button type="button" className="text-xs font-medium text-lime-600 hover:text-lime-900" onClick={() => openCatalogModal("type")}>
                  + Add
                </button>
              </div>
              <select
                value={assetForm.type}
                onChange={(event) => handleAssetTypeChange(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              >
                {getTypeOptions(catalog).map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
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
                  <option key={category.label} value={category.label}>
                    {category.label}
                  </option>
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
                  <option key={subCategory.label} value={subCategory.label}>
                    {subCategory.label}
                  </option>
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
                value={assetForm.warrantyDate}
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
                <p className="text-xs text-slate-500">Enter one serial number for each quantity item.</p>
              </div>
              <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={assetForm.useSerialNumbers}
                  onChange={(event) => handleAssetSerialTrackingChange(event.target.checked)}
                  className="mt-0.5 size-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
                />
                <span>If serial no available mark this box</span>
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
              Serial numbers are disabled for this asset. It will save with quantity only.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <ActionButton type="button" className="bg-slate-200 text-blue-900 hover:bg-slate-300" onClick={() => setAssetModalOpen(false)}>
              Cancel
            </ActionButton>
            <ActionButton type="submit">{editingAssetId ? "Update Asset" : "Save Asset"}</ActionButton>
          </div>
        </form>
      </Modal>

      <Modal
        open={employeeModalOpen}
        onClose={() => {
          setEmployeeModalOpen(false)
          setEditingEmployeeId(null)
        }}
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
            {/* Searchable Asset Dropdown - Combined with all details */}
            <div className="relative grid gap-2">
              <span className="text-sm font-medium text-slate-700">Select Asset</span>
              <div className="text-xs text-slate-500 mb-1">ID | Sub Category | Make/Model | Serial</div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Start typing Asset ID, Sub Category, Make, or Model... (e.g., RCB or Laptop)"
                  value={showAssetDropdown ? assetSearchTerm : (issueForm.assetId ? `${issueForm.assetId}` : "")}
                  onChange={(e) => {
                    setAssetSearchTerm(e.target.value)
                    setShowAssetDropdown(true)
                  }}
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

            {/* Searchable Employee Dropdown - Combined with all details */}
            <div className="relative grid gap-2">
              <span className="text-sm font-medium text-slate-700">Select Employee</span>
              <div className="text-xs text-slate-500 mb-1">Code | Name | Email</div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Start typing Employee Code or Name... (e.g., EMP or John)"
                  value={showEmployeeDropdown
                    ? employeeSearchTerm
                    : (issueForm.employeeCode
                      ? `${issueForm.employeeCode}${issueForm.employeeName ? ` - ${issueForm.employeeName}` : ""}`
                      : "")}
                  onChange={(e) => {
                    setEmployeeSearchTerm(e.target.value)
                    setShowEmployeeDropdown(true)
                  }}
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

            {/* Location & Issue Date */}
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

      <Modal
        open={!!catalogModal}
        onClose={() => setCatalogModal(null)}
        title={
          catalogModal?.target === "type"
            ? "Add Type"
            : catalogModal?.target === "category"
              ? "Add Category"
              : "Add Sub Category"
        }
        description={
          catalogModal?.target === "type"
            ? "Add a new asset type option."
            : catalogModal?.target === "category"
              ? `Add a new category under ${assetForm.type}.`
              : `Add a new sub category under ${assetForm.type} / ${assetForm.category}.`
        }
        widthClass="max-w-xl"
      >
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault()
            addCatalogOption()
          }}
        >
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Name</span>
            <input
              value={catalogModal?.value || ""}
              onChange={(event) => setCatalogModal((current) => ({ ...(current ?? { target: "type", value: "" }), value: event.target.value }))}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              placeholder={
                catalogModal?.target === "type"
                  ? "Example: Location"
                  : catalogModal?.target === "category"
                    ? "Example: Network Equipment"
                    : "Example: Laptops"
              }
            />
          </label>

          {catalogModal?.target !== "type" ? (
            <p className="text-xs text-slate-500">
              {catalogModal?.target === "category" ? (
                <>
                  This category will be attached to <span className="font-medium text-slate-700">{assetForm.type}</span>.
                </>
              ) : (
                <>
                  This sub category will be attached to <span className="font-medium text-slate-700">{assetForm.type} / {assetForm.category}</span>.
                </>
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

      <Modal
        open={noteModalOpen}
        onClose={() => setNoteModalOpen(false)}
        title="Generate I-Note"
        description="Add the I-Note number, dates, invoice, order, indentor, and supplier details."
        widthClass="max-w-2xl"
      >
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault()
            const now = new Date().toISOString()
            const { noteId, nextCounter } = generateNoteId(inventory)

            const nextNote = {
              id: `note-${now}`,
              noteId,
              inoteDate: noteForm.inoteDate,
              invoiceNo: noteForm.invoiceNo.trim(),
              orderNo: noteForm.orderNo.trim(),
              orderDate: noteForm.orderDate,
              indentorName: noteForm.indentorName.trim(),
              supplierName: noteForm.supplierName.trim(),
              createdAt: now,
              updatedAt: now,
            }

            if (!nextNote.invoiceNo || !nextNote.indentorName || !nextNote.supplierName) return

            setInventory((current) => ({
              ...current,
              notes: [nextNote, ...(current.notes ?? [])],
              counters: { ...(current.counters ?? {}), noteCounter: nextCounter },
            }))
            setNoteModalOpen(false)
            setNoteForm(emptyNoteForm())
            showSuccess("I-Note created successfully.")
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">I-Note No.</span>
              <input
                value={`RCB/INOTE/${String(new Date().getFullYear()).slice(-2)}/${String((inventory.counters?.noteCounter ?? 0) + 1).padStart(3, "0")}`}
                readOnly
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">I-Note Date</span>
              <input
                type="date"
                value={noteForm.inoteDate}
                onChange={(e) => setNoteForm((c) => ({ ...c, inoteDate: e.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Invoice No.</span>
              <input
                value={noteForm.invoiceNo}
                onChange={(e) => setNoteForm((c) => ({ ...c, invoiceNo: e.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                placeholder="Invoice number"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Order No</span>
              <input
                value={noteForm.orderNo}
                onChange={(e) => setNoteForm((c) => ({ ...c, orderNo: e.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                placeholder="Order number"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Order Date</span>
              <input
                type="date"
                value={noteForm.orderDate}
                onChange={(e) => setNoteForm((c) => ({ ...c, orderDate: e.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Name of the Indentor</span>
              <input
                value={noteForm.indentorName}
                onChange={(e) => setNoteForm((c) => ({ ...c, indentorName: e.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                placeholder="Indentor name"
              />
            </label>

            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Supplier Name</span>
              <input
                value={noteForm.supplierName}
                onChange={(e) => setNoteForm((c) => ({ ...c, supplierName: e.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                placeholder="Supplier name"
              />
            </label>
          </div>

          <div className="flex justify-end gap-3">
            <ActionButton type="button" className="bg-slate-200 text-slate-900 hover:bg-slate-300" onClick={() => setNoteModalOpen(false)}>
              Cancel
            </ActionButton>
            <ActionButton type="submit">Save I-Note</ActionButton>
          </div>
        </form>
      </Modal>

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

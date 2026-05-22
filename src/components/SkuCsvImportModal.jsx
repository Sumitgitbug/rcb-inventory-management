import { useEffect, useMemo, useState } from "react"
import { Download, FileText, Upload } from "lucide-react"
import Modal from "@/components/Modal"
import { ActionButton } from "@/components/dashboard-ui"
import { getCategoriesForType, getTypeOptions } from "@/data/inventoryCatalog"

const CSV_TEMPLATE_HEADERS = [
  "type",
  "category",
  "sku",
  "make",
  "model",
  "quantity", 
  "serialNumbers",
  "invoiceNo",
  "purchaseDate",
  "orderDate",
  "supplyDate",
]

function splitCsvLine(line, delimiter) {
  const cells = []
  let current = ""
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          current += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }

    if (char === delimiter) {
      cells.push(current)
      current = ""
      continue
    }

    current += char
  }

  cells.push(current)
  return cells
}

function parseCsvText(text) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const firstLine = normalized.split("\n").find((line) => line.trim().length > 0) || ""
  const delimiter = firstLine.includes(";") && firstLine.split(";").length > firstLine.split(",").length ? ";" : ","
  const lines = normalized.split("\n").filter((line) => line.trim().length > 0)

  if (!lines.length) {
    return { headers: [], rows: [] }
  }

  const headers = splitCsvLine(lines[0], delimiter).map((header) => header.trim())
  const rows = lines.slice(1).map((line) => splitCsvLine(line, delimiter))

  return { headers, rows }
}

function normalizeKey(key) {
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, "")
}

function getRowValue(row, aliases) {
  for (const alias of aliases) {
    const key = normalizeKey(alias)
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const value = String(row[key] ?? "").trim()
      if (value) return value
    }
  }
  return ""
}

function splitSerialNumbers(value) {
  return String(value || "")
    .split(/[|;/\n]+/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeDateValue(value) {
  const text = String(value || "").trim()
  if (!text) return ""

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text
  }

  const matched = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (matched) {
    const first = Number(matched[1])
    const second = Number(matched[2])
    const year = matched[3]
    if (first <= 12 && second <= 12) {
      return ""
    }
    const day = first > 12 ? matched[1].padStart(2, "0") : matched[2].padStart(2, "0")
    const month = first > 12 ? matched[2].padStart(2, "0") : matched[1].padStart(2, "0")
    if (Number(day) >= 1 && Number(day) <= 31 && Number(month) >= 1 && Number(month) <= 12) {
      return `${year}-${month}-${day}`
    }
  }

  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }

  return ""
}

function normalizeImportedRows(headers, rows, catalog) {
  const keyMap = headers.map((header) => normalizeKey(header))
  const defaultType = getTypeOptions(catalog)[0]?.value ?? "IT"

  return rows
    .map((cells) => {
      const hasAnySourceValue = cells.some((cell) => String(cell ?? "").trim().length > 0)
      if (!hasAnySourceValue) return null

      const row = {}
      keyMap.forEach((key, index) => {
        row[key] = cells[index] ?? ""
      })

      const type = getRowValue(row, ["type"]) || defaultType
      const categoryOptions = getCategoriesForType(catalog, type)
      const category = getRowValue(row, ["category"]) || categoryOptions[0]?.label || ""
      const subCategory =
        getRowValue(row, ["sku", "subCategory", "subcategory", "skuName", "name", "item"]) || ""
      const serialNumbers = splitSerialNumbers(getRowValue(row, ["serialNumbers", "serialNumber", "serial", "serialNo"]))

      return {
        type,
        category,
        subCategory,
        make: getRowValue(row, ["make", "brand"]),
        model: getRowValue(row, ["model"]),
        quantity: Math.max(1, Number(getRowValue(row, ["quantity", "qty"])) || 1),
        serialNumbers,
        invoiceNo: getRowValue(row, ["invoiceNo", "invoice", "billNo"]),
        purchaseDate: normalizeDateValue(getRowValue(row, ["purchaseDate", "purchase", "warrantyDate"])),
        orderDate: normalizeDateValue(getRowValue(row, ["orderDate", "order"])),
        supplyDate: normalizeDateValue(getRowValue(row, ["supplyDate", "deliveryDate", "supply"])),
      }
    })
    .filter(Boolean)
}

function getTemplateCsv() {
  const sampleRows = [
    [
      "IT",
      "Computers/Peripherals",
      "Laptop",
      "Dell",
      "Latitude 5440",
      "2",
      "DL-001|DL-002",
      "INV-1001",
      "2026-05-01",
      "2026-04-25",
      "2026-04-30",
    ],
  ]

  return [CSV_TEMPLATE_HEADERS, ...sampleRows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")
}

function SkuCsvImportModal({ open, catalog, onClose, onImport }) {
  const [selectedFileName, setSelectedFileName] = useState("")
  const [rawPreviewRows, setRawPreviewRows] = useState([])
  const [parsedHeaders, setParsedHeaders] = useState([])
  const [parseError, setParseError] = useState("")
  const [isReading, setIsReading] = useState(false)

  useEffect(() => {
    if (open) return
    setSelectedFileName("")
    setRawPreviewRows([])
    setParsedHeaders([])
    setParseError("")
    setIsReading(false)
  }, [open])

  const importedRows = useMemo(
    () => normalizeImportedRows(parsedHeaders, rawPreviewRows, catalog),
    [catalog, parsedHeaders, rawPreviewRows],
  )

  const skippedCount = rawPreviewRows.length - importedRows.length

  async function handleFileChange(file) {
    if (!file) return
    setIsReading(true)
    setParseError("")

    try {
      const text = await file.text()
      const parsed = parseCsvText(text)
      if (!parsed.headers.length || !parsed.rows.length) {
        throw new Error("CSV file is empty or missing rows.")
      }

      setSelectedFileName(file.name)
      setParsedHeaders(parsed.headers)
      setRawPreviewRows(parsed.rows)
    } catch (error) {
      setSelectedFileName("")
      setParsedHeaders([])
      setRawPreviewRows([])
      setParseError(error instanceof Error ? error.message : "Failed to read CSV file.")
    } finally {
      setIsReading(false)
    }
  }

  function handleDownloadTemplate() {
    const blob = new Blob([getTemplateCsv()], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "sku_import_template.csv"
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  function handleImport() {
    if (!importedRows.length) return
    onImport(importedRows)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import SKU CSV"
      description="Upload a CSV exported from Excel and map the rows into inventory assets."
      widthClass="max-w-5xl"
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <FileText className="size-4" />
                Supported columns
              </div>
              <p className="mt-1 text-sm text-slate-600">
                <code>type</code>, <code>category</code>, <code>sku</code>, <code>make</code>, <code>model</code>, <code>quantity</code>,{" "}
                <code>serialNumbers</code>, <code>invoiceNo</code>, <code>purchaseDate</code>, <code>orderDate</code>,{" "}
                <code>supplyDate</code>
              </p>
            </div>
            <ActionButton type="button" className="bg-slate-200 text-slate-900 hover:bg-slate-300" onClick={handleDownloadTemplate}>
              <Download className="size-4" />
              Download template
            </ActionButton>
          </div>

          <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center">
            <Upload className="size-6 text-slate-700" />
            <span className="mt-3 text-sm font-semibold text-slate-900">
              {selectedFileName || "Choose a CSV file to import"}
            </span>
            <span className="mt-1 text-xs text-slate-500">
             Save the file in Excel and export it as a CSV, or upload the CSV directly.
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => handleFileChange(event.target.files?.[0] || null)}
            />
          </label>
        </div>

        {parseError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {parseError}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full bg-slate-900 px-3 py-1 font-semibold text-white">
            Parsed: {rawPreviewRows.length}
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
            Ready: {importedRows.length}
          </span>
          <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-700">
            Skipped: {skippedCount}
          </span>
          {isReading ? <span className="text-slate-500">Reading file...</span> : null}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="max-h-[320px] overflow-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">SKU / Sub Category</th>
                  <th className="px-4 py-3 font-medium">Make / Model</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Serials</th>
                  <th className="px-4 py-3 font-medium">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {importedRows.length ? (
                  importedRows.slice(0, 8).map((row, index) => (
                    <tr key={`${row.subCategory}-${index}`} className="align-top">
                      <td className="px-4 py-3 text-slate-700">{row.type || "-"}</td>
                      <td className="px-4 py-3 text-slate-700">{row.category || "-"}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{row.subCategory || "-"}</td>
                      <td className="px-4 py-3 text-slate-700">
                        <div>{row.make || "-"}</div>
                        <div className="text-xs text-slate-500">{row.model || "-"}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.quantity}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.serialNumbers.length ? row.serialNumbers.join(", ") : "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.invoiceNo || "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                      Upload a CSV to preview imported SKU rows here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <ActionButton type="button" className="bg-slate-200 text-slate-900 hover:bg-slate-300" onClick={onClose}>
            Cancel
          </ActionButton>
          <ActionButton type="button" onClick={handleImport} disabled={!importedRows.length}>
            Import {importedRows.length || ""} Row{importedRows.length === 1 ? "" : "s"}
          </ActionButton>
        </div>
      </div>
    </Modal>
  )
}

export default SkuCsvImportModal

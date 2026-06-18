import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, Loader2, Printer } from "lucide-react"
import { fetchINoteDetail, extractINoteDetail } from "@/lib/iNoteApi"

function normalizeText(value) {
  return String(value ?? "").trim()
}

function readField(source, keys) {
  for (const key of keys) {
    const value = source?.[key]
    if (value !== undefined && value !== null && String(value).trim() !== "") return value
  }
  return ""
}

function valueText(value) {
  if (value === undefined || value === null) return "-"
  if (Array.isArray(value)) return value.map((item) => valueText(item)).join(", ")
  if (typeof value === "object") return JSON.stringify(value)
  const text = String(value).trim()
  return text || "-"
}

function formatLabel(key) {
  return String(key)
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function flattenPayload(value, prefix = "", output = []) {
  if (value === undefined || value === null) return output

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const nextKey = prefix ? `${prefix}[${index}]` : `[${index}]`
      if (item && typeof item === "object") {
        flattenPayload(item, nextKey, output)
      } else {
        output.push([nextKey, item])
      }
    })
    return output
  }

  if (typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => {
      const nextKey = prefix ? `${prefix}.${key}` : key
      if (child && typeof child === "object") {
        flattenPayload(child, nextKey, output)
      } else {
        output.push([nextKey, child])
      }
    })
    return output
  }

  output.push([prefix || "value", value])
  return output
}

function readCachedNoteMeta(noteNo) {
  if (typeof window === "undefined") return {}
  const key = `inventory.i-note.meta.${String(noteNo || "").trim()}`
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function DetailLine({ index, leftLabel, leftValue, rightLabel, rightValue }) {
  return (
    <div className="grid gap-2 py-1.5 text-[15px] leading-7 lg:grid-cols-[minmax(0,1fr)_minmax(280px,auto)] lg:gap-8 print:text-[13px]">
      <div className="min-w-0">
        <span className="mr-2">{index}.</span>
        <span>{leftLabel}</span>
        <span className="mx-2">:</span>
        <span className="font-medium underline decoration-slate-400 underline-offset-2">{leftValue || "-"}</span>
      </div>
      <div className="min-w-0 lg:text-right">
        {rightLabel ? <span>{rightLabel}</span> : null}
        {rightLabel ? <span className="mx-2">:</span> : null}
        {rightValue ? <span className="font-medium underline decoration-slate-400 underline-offset-2">{rightValue}</span> : null}
      </div>
    </div>
  )
}

function TableRow({ item, index }) {
  return (
    <tr className="align-top">
      <td className="px-3 py-1.5 text-center text-[15px]">{item?.sr_no ?? index + 1}</td>
      <td className="px-3 py-1.5 text-center text-[15px]">{valueText(item?.item_desc || item?.description || "-")}</td>
      <td className="px-3 py-1.5 text-center text-[15px]">{valueText(item?.qty_tendered || item?.quantity_tendered || item?.tendered_qty || item?.tender_qty || "-")}</td>
      <td className="px-3 py-1.5 text-center text-[15px]">{valueText(item?.accepted_qty || item?.qty_accepted || item?.quantity_accepted || item?.accepted_quantity || "-")}</td>
      <td className="px-3 py-1.5 text-center text-[15px]">{valueText(item?.rejected_balance || item?.rejected_balance_qty || item?.balance || item?.balance_qty || item?.rejected_qty || item?.rejected || "-")}</td>
      <td className="px-3 py-1.5 text-center text-[15px]">{valueText(item?.remarks || item?.remark || "-")}</td>
    </tr>
  )
}

function INoteDetailPage({ noteNo, onBack }) {
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [noteMeta, setNoteMeta] = useState(() => readCachedNoteMeta(noteNo))

  useEffect(() => {
    let cancelled = false

    async function load() {
      const nextNote = normalizeText(noteNo)
      if (!nextNote) {
        setError("Missing I-Note number")
        setPayload(null)
        return
      }

      setLoading(true)
      setError("")
      try {
        const result = await fetchINoteDetail(nextNote)
        if (cancelled) return
        setPayload(result)
      } catch (err) {
        if (cancelled) return
        setPayload(null)
        setError(err instanceof Error ? err.message : "Failed to load I-Note detail")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [noteNo])

  useEffect(() => {
    setNoteMeta(readCachedNoteMeta(noteNo))
  }, [noteNo])

  const summary = useMemo(() => extractINoteDetail(payload), [payload])
  const record = summary.record
  const items = Array.isArray(record?.items) ? record.items : Array.isArray(payload?.items) ? payload.items : []

  const supplierName = normalizeText(
    noteMeta.agency ||
      noteMeta.supplier_name ||
      readField(record, ["supplier_name", "agency", "agency_name", "department", "vendor_name"]) ||
      payload?.agency ||
      "",
  )
  const noteDate = normalizeText(
    noteMeta.inote_dt ||
      readField(record, ["inote_dt", "order_dt", "createdAt", "updatedAt"]) ||
      payload?.inote_dt ||
      "",
  )
  const deliveryDate = normalizeText(
    noteMeta.delivery_date ||
      noteMeta.supply_date ||
      readField(record, ["delivery_date", "supply_date", "supplyDate", "order_dt"]) ||
      payload?.order_dt ||
      "",
  )
  const orderDate = normalizeText(
    noteMeta.order_dt ||
      readField(record, ["order_dt", "orderDate"]) ||
      payload?.order_dt ||
      "",
  )
  const invoiceDate = normalizeText(
    noteMeta.invoice_dt ||
      readField(record, ["invoice_dt", "invoiceDate", "createdAt", "updatedAt"]) ||
      payload?.invoice_dt ||
      "",
  )
  const flattenedFields = useMemo(() => {
    if (!payload || typeof payload !== "object") return []
    return flattenPayload(payload)
      .filter(([key, value]) => key !== "items" && key !== "status" && key !== "message" && valueText(value) !== "-")
      .sort(([a], [b]) => a.localeCompare(b))
  }, [payload])

  const titleINote = normalizeText(record?.i_note_no || payload?.i_note_no || noteNo)
  const orderNo = normalizeText(record?.order_no || payload?.order_no || "")

  return (
    <div className="min-h-screen bg-white px-4 py-4 text-slate-900">
      <div className="mx-auto w-full max-w-[1200px]">
        <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ChevronLeft className="size-4" />
            Back
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Printer className="size-4" />
            Print
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 py-10 text-sm text-slate-600">
            <Loader2 className="size-4 animate-spin" />
            <span>Loading I-Note detail...</span>
          </div>
        ) : error ? (
          <div className="py-10 text-sm text-rose-700">{error}</div>
        ) : (
          <div className="font-serif text-black">
            <div className="text-center">
              <div className="text-[28px] font-bold leading-tight">REGIONAL CENTRE FOR BIOTECHNOLOGY</div>
              <div className="text-[24px] font-bold leading-tight">क्षेत्रीय जैव प्रौद्योगिकी केंद्र</div>
            </div>

            <div className="mt-14 space-y-1">
              <DetailLine index={1} leftLabel="Inspection Note No." leftValue={titleINote} rightLabel="Date" rightValue={noteDate} />
              <DetailLine index={2} leftLabel="Name of supplier." leftValue={supplierName} rightLabel="Date of Delivery" rightValue={deliveryDate} />
              <DetailLine index={3} leftLabel="Date of Receipt" leftValue={noteDate} rightLabel="Date" rightValue={invoiceDate} />
              <DetailLine index={4} leftLabel="Supply Order No." leftValue={orderNo || normalizeText(readField(record, ["order_no", "purchaseDemandNo", "purchase_demand_no", "invoice_no"]))} rightLabel="Date" rightValue={orderDate} />
              <DetailLine index={5} leftLabel="Invoice / Challan No." leftValue={normalizeText(readField(record, ["invoice_no", "invoiceNo", "challan_no", "challanNo"]))} rightLabel="Date" rightValue={invoiceDate} />
            </div>

            <div className="mt-10">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-black text-[17px] leading-tight">
                    <th className="w-[48px] px-2 py-2 text-center align-bottom">S. No.</th>
                    <th className="px-2 py-2 text-center align-bottom">Name of Articles</th>
                    <th className="w-[140px] px-2 py-2 text-center align-bottom">Quantity Tendered</th>
                    <th className="w-[140px] px-2 py-2 text-center align-bottom">Quantity Accepted</th>
                    <th className="w-[170px] px-2 py-2 text-center align-bottom">Quantity Rejected / Balance</th>
                    <th className="w-[120px] px-2 py-2 text-center align-bottom">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length ? (
                    items.map((item, index) => <TableRow key={item?.sr_no || index} item={item} index={index} />)
                  ) : (
                    <tr>
                      <td className="px-2 py-6 text-sm text-slate-500" colSpan={6}>
                        No item rows found in the response.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {flattenedFields.length ? (
              <div className="mt-8 border-t border-black pt-4">
                <div className="mb-3 text-[18px] font-bold">Additional API Data</div>
                <div className="space-y-1 text-[14px] leading-6">
                  {flattenedFields.map(([key, value]) => (
                    <div key={key}>
                      <span>{formatLabel(key)}</span>
                      <span className="mx-2">:</span>
                      <span className="font-medium">{valueText(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

export default INoteDetailPage

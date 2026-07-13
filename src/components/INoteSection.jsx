import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Plus } from "lucide-react"
import { SectionShell } from "@/components/dashboard-ui"
import Modal from "@/components/Modal"
import INoteRecordsTab from "@/components/inote/INoteRecordsTab"
import { extractINoteDetail, extractINotePage, fetchINoteDetail, fetchINoteRecords, normalizeINoteValue } from "@/lib/iNoteApi"
import { buildINoteAssetPrefill } from "@/lib/iNoteAssetPrefill"

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

function getDetailValue(source, keys) {
  return normalizeText(readField(source, keys))
}

function getItemValue(item, keys) {
  return normalizeText(readField(item, keys))
}

function formatQuantityValue(value) {
  const text = normalizeText(value)
  return text || "-"
}

function cacheNoteMeta(noteNo, noteMeta) {
  if (typeof window === "undefined") return
  const key = `inventory.i-note.meta.${String(noteNo || "").trim()}`
  try {
    window.sessionStorage.setItem(key, JSON.stringify(noteMeta || {}))
  } catch {
    // ignore
  }
}

function DocumentLine({ index, leftLabel, leftValue, rightLabel, rightValue }) {
  return (
    <div className="grid gap-2 py-1.5 text-[15px] leading-7 lg:grid-cols-[minmax(0,1fr)_minmax(280px,auto)] lg:gap-8">
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

function DocumentItemRow({ item, index, noteNo, noteMeta, record, onAddAsset }) {
  const acceptedQuantity = getItemValue(item, ["accepted_qty", "qty_accepted", "quantity_accepted", "accepted_quantity"])

  return (
    <tr className="align-top">
      <td className="pr-4 py-1.5 text-[15px]">{item?.sr_no ?? index + 1}</td>
      <td className="pr-4 py-1.5 text-[15px]">
        {getItemValue(item, ["item_desc", "description", "item_description", "desc", "particulars"]) || "-"}
      </td>
      <td className="pr-4 py-1.5 text-[15px]">
        {formatQuantityValue(getItemValue(item, ["qty_tendered", "quantity_tendered", "tendered_qty", "tender_qty", "qty", "quantity"]))}
      </td>
      <td className="pr-4 py-1.5 text-[15px]">
        {formatQuantityValue(getItemValue(item, ["accepted_qty", "qty_accepted", "quantity_accepted", "accepted_quantity"]))}
      </td>
      <td className="pr-4 py-1.5 text-[15px]">
        {formatQuantityValue(getItemValue(item, ["rejected_balance", "rejected_balance_qty", "balance", "balance_qty", "rejected_qty", "rejected"]))}
      </td>
      <td className="py-1.5 text-[15px]">{getItemValue(item, ["remarks", "remark"]) || "-"}</td>
      {onAddAsset ? (
        <td className="py-1.5 pl-4 text-right">
          <button
            type="button"
            onClick={() =>
              onAddAsset(buildINoteAssetPrefill({
                noteNo,
                noteMeta,
                record,
                item,
                acceptedQuantity,
              }))
            }
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-orange-700"
          >
            <Plus className="size-3.5" />
            Add Asset
          </button>
        </td>
      ) : null}
    </tr>
  )
}

function INoteInlineDetail({ noteNo, noteMeta = {}, payload, loading, error, loaded, onAddAsset }) {
  const summary = useMemo(() => extractINoteDetail(payload), [payload])
  const record = summary.record
  const items = Array.isArray(record?.items) ? record.items : Array.isArray(payload?.items) ? payload.items : []

  const supplierName = normalizeText(
    noteMeta.agency || readField(record, ["supplier_name", "agency", "agency_name", "department", "vendor_name"]) || payload?.agency || "",
  )
  const noteDate = normalizeText(
    noteMeta.inote_dt || readField(record, ["inote_dt", "order_dt", "createdAt", "updatedAt"]) || payload?.inote_dt || "",
  )
  const deliveryDate = normalizeText(
    noteMeta.order_dt || readField(record, ["delivery_date", "supply_date", "supplyDate", "order_dt"]) || payload?.order_dt || "",
  )
  const orderDate = normalizeText(noteMeta.order_dt || readField(record, ["order_dt", "orderDate"]) || payload?.order_dt || "")
  const invoiceDate = normalizeText(noteMeta.invoice_dt || readField(record, ["invoice_dt", "invoiceDate", "createdAt", "updatedAt"]) || "")

  return (
    <div className="bg-white px-1 py-2 font-mono text-[15px] leading-7 text-slate-900">
      {loading ? (
        <div className="flex items-center gap-3 py-10 text-sm text-slate-600">
          <Loader2 className="size-4 animate-spin" />
          <span>Loading I-Note detail...</span>
        </div>
      ) : error ? (
        <div className="py-8 text-sm text-rose-700">{error}</div>
      ) : loaded ? (
        <>
          <div className="text-center">
            <div className="text-[18px] tracking-wide">REGIONAL CENTRE FOR BIOTECHNOLOGY</div>
            <div className="text-[17px]">क्षेत्रीय जैव प्रौद्योगिकी केन्द्र</div>
          </div>
          <div className="mt-6 space-y-1">
            <DocumentLine index={1} leftLabel="Inspection Note No." leftValue={getDetailValue(record, ["inote_no", "note_uid", "i_note", "id", "uid"]) || noteNo} rightLabel="Date" rightValue={noteDate} />
            <DocumentLine index={2} leftLabel="Name of supplier." leftValue={supplierName} />
            <DocumentLine index={3} leftLabel="Date of Receipt" leftValue={noteDate} rightLabel="Date of Delivery" rightValue={deliveryDate} />
            <DocumentLine index={4} leftLabel="Supply Order No." leftValue={getDetailValue(record, ["order_no", "purchaseDemandNo", "purchase_demand_no", "invoice_no"])} rightLabel="Date" rightValue={orderDate} />
            <DocumentLine index={5} leftLabel="Invoice / Challan No." leftValue={getDetailValue(record, ["invoice_no", "invoiceNo", "challan_no", "challanNo"])} rightLabel="Date" rightValue={invoiceDate} />
          </div>
          <div className="mt-10 overflow-x-auto">
            <table className="min-w-full border-collapse text-left">
              <thead>
                <tr className="text-[15px] font-normal">
                  <th className="pr-4 pb-3">S. No.</th>
                  <th className="pr-4 pb-3">Name of Articles</th>
                  <th className="pr-4 pb-3">Quantity Tendered</th>
                  <th className="pr-4 pb-3">Quantity Accepted</th>
                  <th className="pr-4 pb-3">Quantity Rejected / Balance</th>
                  <th className="pb-3">Remarks</th>
                  {onAddAsset ? <th className="pb-3 pl-4 text-right">Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {items.length ? (
                  items.map((item, index) => (
                    <DocumentItemRow
                      key={item?.sr_no || index}
                      item={item}
                      index={index}
                      noteNo={noteNo}
                      noteMeta={noteMeta}
                      record={record}
                      onAddAsset={onAddAsset}
                    />
                  ))
                ) : (
                  <tr>
                    <td className="py-6 text-sm text-slate-500" colSpan={onAddAsset ? 7 : 6}>No item rows found in the response.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="py-8 text-sm text-slate-600">Click any I-Note number above to open the detail on this same page.</div>
      )}
    </div>
  )
}

function INoteSection({ notes = [], onAddAssetFromINote }) {
  const [remoteNotes, setRemoteNotes] = useState([])
  const [loadingRemoteNotes, setLoadingRemoteNotes] = useState(false)
  const [remoteNotesError, setRemoteNotesError] = useState("")
  const [remoteNotesLoaded, setRemoteNotesLoaded] = useState(false)
  const [remotePage, setRemotePage] = useState(1)
  const [remotePageSize] = useState(10)
  const [remoteTotalPages, setRemoteTotalPages] = useState(1)
  const [remoteTotalRecords, setRemoteTotalRecords] = useState(0)
  const [recordsSearchTerm, setRecordsSearchTerm] = useState("") //debonce
const [searchInput, setSearchInput] = useState("")
  const [recordsGroup, setRecordsGroup] = useState("all")
  const [selectedINote, setSelectedINote] = useState("")
  const [selectedNoteMeta, setSelectedNoteMeta] = useState({})
  const [detailPayload, setDetailPayload] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState("")
  const [detailLoaded, setDetailLoaded] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const detailCacheRef = useRef(new Map())
  const pageCacheRef = useRef(new Map())

  //  FIX: also searchitem pass and api
  const loadRemoteNotes = useCallback(
    async (page = 1, searchTerm = "", group = "all", options = {}) => {
      const { force = false, isCancelled = () => false } = options
      const normalizedGroup = group === "equipment" || group === "consumables" ? group : "all"
      const cacheKey = `${page}__${searchTerm.trim()}__${normalizedGroup}`

      if (!force && pageCacheRef.current.has(cacheKey)) {
        const pageData = pageCacheRef.current.get(cacheKey)
        setRemoteNotes(pageData.records)
        setRemotePage(pageData.page)
        setRemoteTotalPages(pageData.totalPages)
        setRemoteTotalRecords(pageData.totalRecords)
        setRemoteNotesLoaded(true)
        setRemoteNotesError("")
        setLoadingRemoteNotes(false)
        return
      }

      setLoadingRemoteNotes(true)
      setRemoteNotesError("")
      setRemoteNotesLoaded(false)
      try {
        //  term is passing on apicall
        const payload = await fetchINoteRecords(
          page,
          remotePageSize,
          searchTerm.trim(),
          normalizedGroup === "all" ? "" : normalizedGroup,
        )
        if (isCancelled()) return
        const pageData = extractINotePage(payload)
        pageCacheRef.current.set(cacheKey, pageData)
        setRemoteNotes(pageData.records)
        setRemotePage(pageData.page)
        setRemoteTotalPages(pageData.totalPages)
        setRemoteTotalRecords(pageData.totalRecords)
        setRemoteNotesLoaded(true)
      } catch (error) {
        if (isCancelled()) return
        setRemoteNotes([])
        setRemoteNotesError(error instanceof Error ? error.message : "Failed to load I-Note records")
      } finally {
        if (!isCancelled()) setLoadingRemoteNotes(false)
      }
    },
    [remotePageSize],
  )

  const loadDetailForNote = useCallback(async (noteValue, options = {}) => {
    const { force = false, isCancelled = () => false, noteMeta = {} } = options
    const nextNote = normalizeText(noteValue)
    if (!nextNote) return

    setSelectedINote(nextNote)
    setSelectedNoteMeta(noteMeta || {})

    if (!force && detailCacheRef.current.has(nextNote)) {
      const cached = detailCacheRef.current.get(nextNote)
      setDetailPayload(cached)
      setDetailError("")
      setDetailLoaded(true)
      setDetailLoading(false)
      return
    }

    setDetailLoading(true)
    setDetailError("")
    setDetailLoaded(false)
    try {
      const payload = await fetchINoteDetail(nextNote)
      if (isCancelled()) return
      detailCacheRef.current.set(nextNote, payload)
      setDetailPayload(payload)
      setDetailLoaded(true)
    } catch (error) {
      if (isCancelled()) return
      setDetailPayload(null)
      setDetailError(error instanceof Error ? error.message : "Failed to load I-Note detail")
    } finally {
      if (!isCancelled()) setDetailLoading(false)
    }
  }, [])

  //   API call on page or searchitem     debounce 
  useEffect(() => {
  const timer = setTimeout(() => {
    const term = searchInput.trim()

    // don't call API on one character
    if (term.length > 0 && term.length < 2) return

    setRecordsSearchTerm(term)
    setRemotePage(1)
  }, 500)

  return () => clearTimeout(timer)
}, [searchInput])
  useEffect(() => {
    let cancelled = false
    void loadRemoteNotes(remotePage, recordsSearchTerm, recordsGroup, { isCancelled: () => cancelled })
    return () => { cancelled = true }
  }, [loadRemoteNotes, remotePage, recordsSearchTerm, recordsGroup])

  //  gp back on 1 page when search term changes, and call API with new term
  const handleSearchTermChange = useCallback((term) => {
  setSearchInput(term)
}, [])

  const handleGroupChange = useCallback((group) => {
    setRecordsGroup(group)
    setRemotePage(1)
  }, [])

  const tableNotes = remoteNotesLoaded ? remoteNotes : notes

  const sortedNotes = useMemo(
    () => [...tableNotes].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)),
    [tableNotes],
  )

  const goToPage = (nextPage) => {
    const bounded = Math.max(1, Math.min(nextPage, remoteTotalPages || 1))
    if (bounded !== remotePage) setRemotePage(bounded)
  }

  const handleSelectNote = (note) => {
    const nextINote = normalizeINoteValue(note)
    if (!nextINote) return
    cacheNoteMeta(nextINote, note)
    setDetailModalOpen(true)
    void loadDetailForNote(nextINote, { noteMeta: note })
  }

  const handleAddAssetFromINote = (prefill) => {
    onAddAssetFromINote?.(prefill)
    setDetailModalOpen(false)
  }

  return (
    <SectionShell
      title="I-Note"
      description="Review generated I-Note records and open a printable detail page."
      action={
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
            {remoteTotalRecords} record{remoteTotalRecords === 1 ? "" : "s"}
          </div>
        </div>
      }
    >
      <INoteRecordsTab
        notes={sortedNotes}
        loading={loadingRemoteNotes}
        error={remoteNotesError}
        onRefresh={() => loadRemoteNotes(remotePage, recordsSearchTerm, recordsGroup, { force: true })}
       searchTerm={searchInput}
        onSearchTermChange={handleSearchTermChange}
        group={recordsGroup}
        onGroupChange={handleGroupChange}
        page={remotePage}
        totalPages={remoteTotalPages}
        totalRecords={remoteTotalRecords}
        pageSize={remotePageSize}
        onPreviousPage={() => goToPage(remotePage - 1)}
        onNextPage={() => goToPage(remotePage + 1)}
        onPageSelect={goToPage}
        hasPreviousPage={remotePage > 1}
        hasNextPage={remotePage < remoteTotalPages}
        onSelectNote={handleSelectNote}
        selectedINote={selectedINote}
        detailLoading={detailLoading}
      />

      <Modal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title="I-Note Detail"
        description={selectedINote ? `i-note: ${selectedINote}` : ""}
        widthClass="max-w-6xl"
      >
        <INoteInlineDetail
          noteNo={selectedINote}
          noteMeta={selectedNoteMeta}
          payload={detailPayload}
          loading={detailLoading}
          error={detailError}
          loaded={detailLoaded}
          onAddAsset={onAddAssetFromINote ? handleAddAssetFromINote : null}
        />
      </Modal>
    </SectionShell>
  )
}

export default INoteSection

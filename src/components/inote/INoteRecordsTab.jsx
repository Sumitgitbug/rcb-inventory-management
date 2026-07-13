import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Loader2 } from "lucide-react"

function normalizeText(value) {
  return String(value || "").trim()
}

function getINoteNo(note) {
  return note.inote_no || note.note_uid || note.id || note.uid || "-"
}

function getIndentNo(note) {
  return note.indent_no || note.indentNo || note.indentNumber || note.indent_number || "-"
}

function getPurchaseDemandNo(note) {
  return note.order_no || note.purchaseDemandNo || note.purchase_demand_no || note.invoice_no || "-"
}

function getSortKey(note) {
  return note.inote_dt || note.order_dt || note.updatedAt || note.createdAt || ""
}

function getPaginationItems(currentPage, totalPages) {
  const current = Math.max(1, Number(currentPage) || 1)
  const total = Math.max(1, Number(totalPages) || 1)
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)

  const items = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  if (start > 2) items.push("ellipsis-start")

  for (let page = start; page <= end; page += 1) {
    items.push(page)
  }

  if (end < total - 1) items.push("ellipsis-end")

  items.push(total)
  return items
}

function INoteRecordsTab({
  notes = [],
  loading = false,
  error = "",
  onRefresh,
  searchTerm = "",
  onSearchTermChange,
  group = "all",
  onGroupChange,
  page = 1,
  pageSize = 10,
  totalPages = 1,
  totalRecords = 0,
  onPreviousPage,
  onNextPage,
  hasPreviousPage = false,
  hasNextPage = false,
  onSelectNote,
  onPageSelect,
  selectedINote = "",
  detailLoading = false,
  iNoteStatusByNo = {},
}) {
  const sortedNotes = [...notes].sort((a, b) => String(getSortKey(b)).localeCompare(String(getSortKey(a))))
  const paginationItems = getPaginationItems(page, totalPages)
  const groupOptions = [
    { value: "all", label: "All" },
    { value: "equipment", label: "Equipment" },
    { value: "consumables", label: "Consumables" },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex-none border-b border-slate-200 px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid gap-3 lg:max-w-2xl lg:flex-1">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Search Records</span>
              <input
                value={searchTerm}
                onChange={(event) => onSearchTermChange?.(event.target.value)}
                placeholder="Search I-Note, indent no, order no, invoice no, agency..."
                className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <div className="flex flex-wrap gap-2" aria-label="I-Note groups">
              {groupOptions.map((option) => {
                const active = group === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onGroupChange?.(option.value)}
                    className={[
                      "rounded-full border px-3 py-1.5 text-xs font-bold transition",
                      active
                        ? "border-orange-600 bg-orange-600 text-white shadow-sm"
                        : "border-orange-200 bg-orange-50 text-orange-700 hover:border-orange-300 hover:bg-orange-100",
                    ].join(" ")}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm text-slate-600">
              {loading ? "Loading I-Note records..." : error ? error : "Live records loaded from API."}
            </div>
            <div className="rounded-full bg-orange-100 px-3 py-2 text-xs font-medium text-orange-600">
              Page {page} of {totalPages}
            </div>
            <div className="rounded-full bg-orange-100 px-3 py-2 text-xs font-medium text-orange-600">
              {totalRecords} total
            </div>
            {onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                className="rounded-full border border-slate-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 transition hover:border-orange-300 hover:bg-orange-100"
              >
                Refresh
              </button>
            ) : null}
          </div>
        </div>
        {searchTerm.trim() || group !== "all" ? (
          <div className="mt-3 text-xs text-slate-500">
            {group !== "all" ? `Showing ${group} records` : "Search is filtering records from the API."}
          </div>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
         <thead className="bg-slate-50">
  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
    <th className="px-4 py-3">Sr.No</th>
    <th className="px-4 py-3">Indent No</th>
    <th className="px-4 py-3">Order No</th>
    <th className="px-4 py-3">I-Note No</th>
    <th className="px-4 py-3">Status</th>
  </tr>
</thead>
            
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={5}>
                  Loading records...
                </td>
              </tr>
            ) : sortedNotes.length ? (
              sortedNotes.map((note, index) => {
                const noteNo = normalizeText(getINoteNo(note))
                const serialNo = (Math.max(1, page) - 1) * Math.max(1, pageSize) + index + 1
                const isSelected = selectedINote && noteNo === selectedINote
                const status = iNoteStatusByNo[noteNo] || "pending"
                const statusLabel = status === "completed" ? "Completed" : status === "partial" ? "Partial" : "Pending"
                return (
                  <tr
                    key={note.id || `${noteNo || "note"}-${index}`}
                    className={`text-slate-700 ${isSelected ? "bg-cyan-50/60" : ""}`}
                  >
                   <td className="px-4 py-3 font-medium text-slate-500">
  {serialNo}
</td>

{/* INDENT NO */}
<td className="px-4 py-3">
  <div className="font-medium text-slate-900">
    {getIndentNo(note)}
  </div>
  <div className="mt-1 text-xs text-slate-500">
    {note.inote_dt || "-"}
  </div>
</td>

{/* ORDER NO */}
<td className="px-4 py-3">
  <div className="font-medium text-slate-900">
    {getPurchaseDemandNo(note)}
  </div>

  {/* Agency Name */}
  <div className="mt-1 text-xs text-slate-500">
    {note.agency || "-"}
  </div>
</td>

{/* I-NOTE NO */}
<td className="px-4 py-3">
  <button
    type="button"
    onClick={() => onSelectNote?.(note)}
    className={`inline-flex items-center gap-2 font-semibold underline-offset-4 transition hover:underline hover:text-blue-800 ${
      isSelected ? "text-blue-900" : "text-blue-700"
    }`}
    aria-busy={isSelected && detailLoading}
  >
    {isSelected && detailLoading ? (
      <Loader2 className="size-4 animate-spin" />
    ) : null}

    <span>{noteNo || "N/A"}</span>
  </button>

  <div className="mt-1 text-xs text-slate-500">
    {note.inote_dt || note.order_dt || "-"}
  </div>
</td>

<td className="px-4 py-3">
  <span
    className={[
      "inline-flex rounded-md border px-2 py-1 text-xs font-semibold",
      status === "completed"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : status === "partial"
          ? "border-sky-200 bg-sky-50 text-sky-700"
        : "border-amber-200 bg-amber-50 text-amber-700",
    ].join(" ")}
  >
    {statusLabel}
  </span>
</td>

            
                  </tr>
                )
              })
            ) : (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={5}>
                  No I-Note records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <div className="flex w-full flex-none items-center gap-3 border-t border-slate-200 px-4 py-2.5">
        <div className="min-w-0 flex-1 text-xs font-medium text-slate-500">
          Showing {sortedNotes.length} record{sortedNotes.length === 1 ? "" : "s"} on this page
        </div>
        <div className="ml-auto flex shrink-0 items-center justify-end">
          <Pagination className="w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious onClick={onPreviousPage} disabled={!hasPreviousPage || loading} />
            </PaginationItem>

            {paginationItems.map((item) => {
              if (item === "ellipsis-start" || item === "ellipsis-end") {
                return (
                  <PaginationItem key={item}>
                    <PaginationEllipsis />
                  </PaginationItem>
                )
              }

              return (
                <PaginationItem key={item}>
                  <PaginationLink isActive={item === page} onClick={() => onPageSelect?.(item)} disabled={loading}>
                    {item}
                  </PaginationLink>
                </PaginationItem>
              )
            })}

            <PaginationItem>
              <PaginationNext onClick={onNextPage} disabled={!hasNextPage || loading} />
            </PaginationItem>
          </PaginationContent>
          </Pagination>
        </div>
      </div>
    </div>
  )
}

export default INoteRecordsTab

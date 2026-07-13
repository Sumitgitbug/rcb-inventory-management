import { ArrowRightLeft, Plus, Search } from "lucide-react"
import { ActionButton, SectionShell } from "@/components/dashboard-ui"
import { formatDate } from "@/lib/inventory"

function normalizeIssueStatus(status) {
  return String(status || "").trim().toLowerCase()
}

function employeeText(code, name) {
  const parts = [code, name].map((value) => String(value || "").trim()).filter(Boolean)
  return parts.length ? parts.join(" - ") : "-"
}

function hasTransferRecord(issue) {
  return Array.isArray(issue.transferHistory) && issue.transferHistory.length > 0
}

function IssueReturnSection({
  issues,
  issueAssetById,
  issueStatusFilter,
  onIssueStatusFilterChange,
  issueSearchTerm,
  onIssueSearchTermChange,
  onAddIssue,
  onEditIssue,
  onReturnIssue,
  onTransferIssue,
}) {
  const issueFilterOptions = [
    { value: "all", label: "All" },
    { value: "issued", label: "Issued" },
    { value: "returned", label: "Returned" },
    { value: "transfer", label: "Transfer" },
  ]

  const search = issueSearchTerm.trim().toLowerCase()
  const filteredIssues = issues.filter((issue) => {
    const status = normalizeIssueStatus(issue.status) || "issued"
    if (issueStatusFilter === "transfer" && !hasTransferRecord(issue)) return false
    if (issueStatusFilter !== "all" && issueStatusFilter !== "transfer" && status !== issueStatusFilter) return false
    if (!search) return true
    const issueDateText = formatDate(issue.issueDate).toLowerCase()
    const returnDateText = formatDate(issue.returnDate).toLowerCase()
    const transferText = (issue.transferHistory || [])
      .map((transfer) => [
        transfer.fromEmployeeCode,
        transfer.fromEmployeeName,
        transfer.toEmployeeCode,
        transfer.toEmployeeName,
        transfer.fromLocation,
        transfer.toLocation,
        formatDate(transfer.transferDate),
      ].filter(Boolean).join(" "))
      .join(" ")
    return [
      issue.assetId,
      issue.serialNumber,
      issue.employeeName,
      issue.employeeCode,
      issue.employeeEmail,
      issue.location,
      status,
      issueDateText,
      returnDateText,
      transferText,
      issueAssetById.get(issue.assetId)?.subCategory,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search))
  })

  return (
    <SectionShell
      title="Issue / Return"
      description="Track issued assets, returned history, employee details, and return dates in one place."
      action={
        // "Issue Item" button — already orange, keeping consistent
        <ActionButton onClick={onAddIssue} style={{ backgroundColor: "#f97316", color: "#fff" }}>
          <Plus className="size-4" />
          Issue Item
        </ActionButton>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="relative mb-4 flex-none">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={issueSearchTerm}
            onChange={(event) => onIssueSearchTermChange(event.target.value)}
            placeholder="Search by asset ID, employee, location, serial, status, or date"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 text-sm outline-none focus:border-orange-400"
          />
        </div>

        {/* Filter buttons — orange theme */}
        <div className="mb-4 flex flex-none flex-wrap gap-2">
          {issueFilterOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onIssueStatusFilterChange(opt.value)}
              style={
                issueStatusFilter === opt.value
                  ? { backgroundColor: "#f97316", borderColor: "#f97316", color: "#fff" }
                  : { backgroundColor: "#fff", borderColor: "#fed7aa", color: "#ea580c" }
              }
              className="inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition hover:opacity-90"
            >
              {opt.label}
              <span style={issueStatusFilter === opt.value ? { background: "rgba(255,255,255,0.2)", color: "#fff" } : { background: "#fff7ed", color: "#ea580c" }}
                className="rounded-full px-1.5 py-0.5 text-xs font-bold">
                {opt.value === "all"
                  ? issues.length
                  : opt.value === "transfer"
                    ? issues.filter(hasTransferRecord).length
                  : issues.filter((i) => normalizeIssueStatus(i.status) === opt.value).length}
              </span>
            </button>
          ))}
        </div>

        <div className="min-h-0 max-w-full flex-1 overflow-auto rounded-2xl border border-slate-200">
          <table className="min-w-[1180px] table-fixed divide-y divide-slate-200 text-left text-sm xl:min-w-full">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[9%]" />
              <col className="w-[15%]" />
              <col className="w-[9%]" />
              <col className="w-[18%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[13%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Asset ID</th>
                <th className="px-4 py-3 font-medium">Sub Category</th>
                <th className="px-4 py-3 font-medium">Employee Details</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Transfer Record</th>
                <th className="px-4 py-3 font-medium">Issue Date</th>
                <th className="px-4 py-3 font-medium">Return Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="sticky right-0 bg-slate-50 px-4 py-3 font-medium shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.5)]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredIssues.length ? (
                filteredIssues.map((issue) => (
                  <tr key={issue.id} className="align-top">
                    <td className="px-4 py-4 font-medium text-slate-900">
                      <div className="break-words">{issue.assetId}</div>
                      {issue.serialNumber ? <div className="text-xs text-slate-500">Serial: {issue.serialNumber}</div> : null}
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {issueAssetById.get(issue.assetId)?.subCategory || "-"}
                    </td>
                    <td className="break-words px-4 py-4 text-slate-700">
                      <div className="break-words font-medium text-slate-900">{issue.employeeName}</div>
                      <div className="break-words text-xs text-slate-500">{issue.employeeCode}</div>
                      <div className="break-all text-xs text-slate-500">{issue.employeeEmail}</div>
                    </td>
                    <td className="break-words px-4 py-4 text-slate-700">{issue.location}</td>
                    <td className="px-4 py-4 text-slate-700">
                      {Array.isArray(issue.transferHistory) && issue.transferHistory.length ? (
                        <div className="space-y-2">
                          {issue.transferHistory.map((transfer, transferIndex) => (
                            <div
                              key={transfer.id || `${issue.id}-transfer-${transferIndex}`}
                              className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-slate-700"
                            >
                              <div className="break-words font-semibold text-blue-800">
                                Transfer {transferIndex + 1} · {formatDate(transfer.transferDate)}
                              </div>
                              <div className="mt-1 break-words">
                                <span className="font-medium text-slate-900">From:</span>{" "}
                                {employeeText(transfer.fromEmployeeCode, transfer.fromEmployeeName)}
                              </div>
                              <div className="break-words text-slate-500">{transfer.fromLocation || "-"}</div>
                              <div className="mt-1 break-words">
                                <span className="font-medium text-slate-900">To:</span>{" "}
                                {employeeText(transfer.toEmployeeCode, transfer.toEmployeeName)}
                              </div>
                              <div className="break-words text-slate-500">{transfer.toLocation || "-"}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">No transfer</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-slate-700">{formatDate(issue.issueDate)}</td>
                    <td className="px-4 py-4 text-slate-700">
                      {normalizeIssueStatus(issue.status) === "returned" ? formatDate(issue.returnDate) : "-"}
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <span className={[
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                          normalizeIssueStatus(issue.status) === "returned"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700",
                        ].join(" ")}>
                          {normalizeIssueStatus(issue.status) || "issued"}
                        </span>
                        {normalizeIssueStatus(issue.status) === "returned" && issue.returnDate ? (
                          <div className="text-xs text-emerald-700">
                            Returned on {formatDate(issue.returnDate)}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="sticky right-0 bg-white px-4 py-4 text-slate-700 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.5)]">
                      <div className="grid gap-2">
                        {/* Edit button — orange */}
                        <button
                          type="button"
                          style={{ backgroundColor: "#16a34a", color: "#fff" }}
                          className="w-full rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:opacity-90"
                          onClick={() => onEditIssue(issue)}
                        >
                          Edit
                        </button>
                        {/* Return button — darker orange */}
                        <button
                          type="button"
                          style={{
                            backgroundColor: normalizeIssueStatus(issue.status) === "returned" ? "#fd74b461" : "#ea580c",
                            color: "#fff",
                            cursor: normalizeIssueStatus(issue.status) === "returned" ? "not-allowed" : "pointer",
                          }}
                          className="w-full rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:opacity-90"
                          onClick={() => onReturnIssue(issue.id)}
                          disabled={normalizeIssueStatus(issue.status) === "returned"}
                        >
                          Return
                        </button>
                        {onTransferIssue ? (
                          <button
                            type="button"
                            style={{
                              backgroundColor: normalizeIssueStatus(issue.status) === "returned" ? "#94a3b8" : "#2563eb",
                              color: "#fff",
                              cursor: normalizeIssueStatus(issue.status) === "returned" ? "not-allowed" : "pointer",
                            }}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:opacity-90"
                            onClick={() => onTransferIssue(issue)}
                            disabled={normalizeIssueStatus(issue.status) === "returned"}
                          >
                            <ArrowRightLeft className="size-3.5" />
                            Transfer
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500">
                    No {issueStatusFilter !== "all" ? issueStatusFilter : ""} records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SectionShell>
  )
}

export default IssueReturnSection

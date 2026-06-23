import { Plus, Search } from "lucide-react"
import { ActionButton, SectionShell } from "@/components/dashboard-ui"
import { formatDate } from "@/lib/inventory"

function normalizeIssueStatus(status) {
  return String(status || "").trim().toLowerCase()
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
}) {
  const issueFilterOptions = [
    { value: "all", label: "All" },
    { value: "issued", label: "Issued" },
    { value: "returned", label: "Returned" },
  ]

  const search = issueSearchTerm.trim().toLowerCase()
  const filteredIssues = issues.filter((issue) => {
    const status = normalizeIssueStatus(issue.status) || "issued"
    if (issueStatusFilter !== "all" && status !== issueStatusFilter) return false
    if (!search) return true
    const issueDateText = formatDate(issue.issueDate).toLowerCase()
    const returnDateText = formatDate(issue.returnDate).toLowerCase()
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
        onAddIssue ? (
          <ActionButton onClick={onAddIssue}>
            <Plus className="size-4" />
            Issue Item
          </ActionButton>
        ) : null
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

        {/* Orange status filters */}
        <div className="mb-4 flex flex-none flex-wrap gap-2">
          {issueFilterOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onIssueStatusFilterChange(opt.value)}
              style={
                issueStatusFilter === opt.value
                  ? { backgroundColor: "#f04405", borderColor: "#f04405", color: "#fff" }
                  : { backgroundColor: "#fff", borderColor: "#fed7aa", color: "#f04405" }
              }
              className="inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition hover:opacity-90"
            >
              {opt.label}
              <span style={issueStatusFilter === opt.value ? { background: "rgba(255,255,255,0.2)", color: "#fff" } : { background: "#fff7ed", color: "#f04405" }}
                className="rounded-full px-1.5 py-0.5 text-xs font-bold">
                {opt.value === "all"
                  ? issues.length
                  : issues.filter((i) => normalizeIssueStatus(i.status) === opt.value).length}
              </span>
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Asset ID</th>
                <th className="px-4 py-3 font-medium">Sub Category</th>
                <th className="px-4 py-3 font-medium">Employee Details</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Issue Date</th>
                <th className="px-4 py-3 font-medium">Return Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {onEditIssue || onReturnIssue ? <th className="px-4 py-3 font-medium">Action</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredIssues.length ? (
                filteredIssues.map((issue) => (
                  <tr key={issue.id} className="align-top">
                    <td className="px-4 py-4 font-medium text-slate-900">
                      <div>{issue.assetId}</div>
                      {issue.serialNumber ? <div className="text-xs text-slate-500">Serial: {issue.serialNumber}</div> : null}
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {issueAssetById.get(issue.assetId)?.subCategory || "-"}
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      <div className="font-medium text-slate-900">{issue.employeeName}</div>
                      <div className="text-xs text-slate-500">{issue.employeeCode}</div>
                      <div className="text-xs text-slate-500">{issue.employeeEmail}</div>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{issue.location}</td>
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
                    {onEditIssue || onReturnIssue ? (
                      <td className="px-4 py-4 text-slate-700">
                        <div className="flex flex-wrap gap-1.5">
                          {onEditIssue ? (
                            <button
                              type="button"
                              className="rounded bg-lime-900 px-2 py-1 text-xs font-semibold text-white transition hover:bg-lime-800"
                              onClick={() => onEditIssue(issue)}
                            >
                              Edit
                            </button>
                          ) : null}
                          {onReturnIssue ? (
                            <button
                              type="button"
                              className={[
                                "rounded px-2 py-1 text-xs font-semibold text-white transition",
                                normalizeIssueStatus(issue.status) === "returned"
                                  ? "cursor-not-allowed bg-orange-300"
                                  : "bg-orange-600 hover:bg-orange-700",
                              ].join(" ")}
                              onClick={() => onReturnIssue(issue.id)}
                              disabled={normalizeIssueStatus(issue.status) === "returned"}
                            >
                              Return
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={onEditIssue || onReturnIssue ? 8 : 7} className="px-4 py-8 text-center text-sm text-slate-500">
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

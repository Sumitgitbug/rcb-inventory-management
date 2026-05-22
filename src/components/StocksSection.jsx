import { Download, Eye, Search } from "lucide-react"
import { ActionButton, SectionShell } from "@/components/dashboard-ui"
import { formatDate } from "@/lib/inventory"
import { getTypeOptions } from "@/data/inventoryCatalog"

function getAvailableUnits(items) {
  return items.reduce((total, asset) => total + (Number(asset.availableQuantity ?? 0) || 0), 0)
}

function StocksSection({
  catalog,
  filteredStocks,
  assetsWithAvailability,
  activeStocksTab,
  onActiveStocksTabChange,
  onExportCsv,
  searchTerm,
  onSearchTermChange,
  onViewInvoice,
}) {
  const stockTypeOptions = getTypeOptions(catalog)
  const activeTypeAssets = filteredStocks.filter((asset) => asset.type === activeStocksTab)

  const subCategoryMap = new Map()
  activeTypeAssets.forEach((asset) => {
    const key = String(asset.subCategory || "").trim() || "Unspecified"
    if (!subCategoryMap.has(key)) subCategoryMap.set(key, [])
    subCategoryMap.get(key).push(asset)
  })
  const subCategoryGroups = [...subCategoryMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <SectionShell
      title="Stocks"
      description="Type and sub-category wise asset breakdown."
      action={
        <ActionButton onClick={onExportCsv} className="bg-slate-200 text-slate-900 hover:bg-slate-300">
          <Download className="size-4" />
          Export CSV
        </ActionButton>
      }
    >
      <div className="mb-5 flex flex-wrap gap-2">
        {stockTypeOptions.map((tab) => {
          const tabCount = getAvailableUnits(assetsWithAvailability.filter((a) => a.type === tab.value))
          const isActive = activeStocksTab === tab.value
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                onActiveStocksTabChange(tab.value)
                onSearchTermChange("")
              }}
              className={[
                "inline-flex items-center gap-2 rounded-2xl border px-5 py-2.5 text-sm font-semibold transition",
                isActive
                  ? "border-slate-900 bg-slate-900 text-white shadow-md"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50",
              ].join(" ")}
            >
              {tab.label}
              <span className={[
                "rounded-full px-2 py-0.5 text-xs font-bold",
                isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700",
              ].join(" ")}>
                Q-{tabCount}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mb-5 relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
          placeholder={`Search in ${activeStocksTab} by sub-category, serial no, make, model, invoice...`}
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 text-sm outline-none focus:border-slate-400"
        />
      </div>

      {subCategoryGroups.length ? (
        <div className="space-y-3">
          {subCategoryGroups.map(([subCat, subAssets]) => (
            <details key={subCat} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50 transition">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
                    {subCat.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{subCat}</div>
                    <div className="text-xs text-slate-500">
                      {getAvailableUnits(subAssets)} item{getAvailableUnits(subAssets) !== 1 ? "s" : ""} click to expand
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-bold text-white">
                    Q-{getAvailableUnits(subAssets)}
                  </span>
                </div>
              </summary>
              <div className="border-t border-slate-100">
                <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Asset ID</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Make / Model</th>
                      <th className="px-4 py-3 font-medium">Serial No</th>
                      <th className="px-4 py-3 font-medium">Invoice No / File</th>
                      <th className="px-4 py-3 font-medium">Purchase Date</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 bg-white">
                    {subAssets.map((asset) => (
                      <tr key={asset.assetId} className="align-top hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{asset.assetId}</td>
                        <td className="px-4 py-3 text-slate-600">{asset.category || "-"}</td>
                        <td className="px-4 py-3 text-slate-700">
                          <div>{asset.make || "-"}</div>
                          {asset.model ? <div className="text-xs text-slate-500">{asset.model}</div> : null}
                        </td>
                        <td className="px-4 py-3">
                          {(asset.serialNumbers ?? []).map((s, i) => (
                            <div key={i} className="rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-700 mb-0.5">
                              {s || "-"}
                            </div>
                          ))}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          <div className="flex flex-col gap-1">
                            <span>{asset.invoiceNo || "-"}</span>
                            {asset.invoiceFile ? (
                              <ActionButton
                                className="px-2 py-1 text-xs"
                                onClick={() =>
                                  onViewInvoice({
                                    fileName: asset.invoiceFileName || asset.invoiceNo || "Invoice",
                                    fileType: asset.invoiceFileType || "",
                                    dataUrl: asset.invoiceFile,
                                  })
                                }
                              >
                                <Eye className="size-3" /> View
                              </ActionButton>
                            ) : (
                              <span className="text-xs text-slate-400">No file</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{formatDate(asset.purchaseDate)}</td>
                        <td className="px-4 py-3">
                          <span className={[
                            "rounded-full px-2.5 py-1 text-xs font-semibold",
                            (asset.availableQuantity ?? 1) > 0
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700",
                          ].join(" ")}>
                            {(asset.availableQuantity ?? 1) > 0 ? "Available" : "Issued"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
          No stock records found for <span className="font-semibold">{activeStocksTab}</span>
          {searchTerm ? ` matching "${searchTerm}"` : ""}.
        </div>
      )}
    </SectionShell>
  )
}

export default StocksSection

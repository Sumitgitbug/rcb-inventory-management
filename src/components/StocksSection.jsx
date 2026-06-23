import { ChevronDown, Download, Search } from "lucide-react"
import { useState } from "react"
import { ActionButton, SectionShell } from "@/components/dashboard-ui"
import { formatDate } from "@/lib/inventory"
import { getTypeOptions } from "@/data/inventoryCatalog"

function getAvailableUnits(items) {
  return items.reduce((total, asset) => total + (Number(asset.availableQuantity ?? 0) || 0), 0)
}

export function StockDetailsPanel({
  catalog,
  filteredStocks,
  assetsWithAvailability,
  activeStocksTab,
  onActiveStocksTabChange,
  searchTerm,
  onSearchTermChange,
  onViewInvoice,
  onEditAsset,
  onIssueAsset,
  onRemoveAsset,
}) {
  const stockTypeOptions = getTypeOptions(catalog)
  const effectiveActiveStocksTab = stockTypeOptions.some((tab) => tab.value === activeStocksTab)
    ? activeStocksTab
    : stockTypeOptions[0]?.value || activeStocksTab
  const activeTypeAssets = filteredStocks.filter((asset) => asset.type === effectiveActiveStocksTab)
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set())

  const subCategoryMap = new Map()
  activeTypeAssets.forEach((asset) => {
    const key = String(asset.subCategory || "").trim() || "Unspecified"
    if (!subCategoryMap.has(key)) subCategoryMap.set(key, [])
    subCategoryMap.get(key).push(asset)
  })
  const subCategoryGroups = [...subCategoryMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const groupKeys = subCategoryGroups.map(([subCat]) => `${effectiveActiveStocksTab}:${subCat}`)

  const allExpanded = groupKeys.length > 0 && groupKeys.every((key) => !collapsedGroups.has(key))
  const showActions = Boolean(onEditAsset || onIssueAsset || onRemoveAsset)

  function toggleGroup(subCat) {
    const groupKey = `${effectiveActiveStocksTab}:${subCat}`
    setCollapsedGroups((current) => {
      const next = new Set(current)
      if (next.has(groupKey)) next.delete(groupKey)
      else next.add(groupKey)
      return next
    })
  }

  function toggleAllGroups() {
    setCollapsedGroups((current) => {
      const next = new Set(current)
      if (allExpanded) groupKeys.forEach((key) => next.add(key))
      else groupKeys.forEach((key) => next.delete(key))
      return next
    })
  }

  return (
      <div className="flex h-full min-h-0 flex-col">

        {/* Type Tabs */}
        <div className="mb-5 flex flex-none flex-wrap gap-2">
          {stockTypeOptions.map((tab) => {
            const tabCount = getAvailableUnits(assetsWithAvailability.filter((a) => a.type === tab.value))
            const isActive = effectiveActiveStocksTab === tab.value
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  onActiveStocksTabChange(tab.value)
                  onSearchTermChange("")
                }}
                style={
                  isActive
                    ? { backgroundColor: "#f04405", borderColor: "#f04405", color: "#fff", border: "2px solid #f04405", borderRadius: "16px", padding: "10px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px" }
                    : { backgroundColor: "#fff", borderColor: "#fed7aa", color: "#f04405", border: "2px solid #fed7aa", borderRadius: "16px", padding: "10px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px" }
                }
              >
                {tab.label}
                <span
                  style={
                    isActive
                      ? { backgroundColor: "rgba(255,255,255,0.25)", color: "#fff", borderRadius: "999px", padding: "2px 8px", fontSize: "12px", fontWeight: 700 }
                      : { backgroundColor: "#fff7ed", color: "#f04405", borderRadius: "999px", padding: "2px 8px", fontSize: "12px", fontWeight: 700 }
                  }
                >
                  Q-{tabCount}
                </span>
              </button>
            )
          })}
        </div>

        <div className="mb-4 grid flex-none items-center gap-3 md:grid-cols-[minmax(260px,0.5fr)_1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder={`Search in ${effectiveActiveStocksTab}`}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 text-sm outline-none focus:border-slate-400"
            />
          </div>
          <div />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={toggleAllGroups}
              style={{ border: "1px solid #fed7aa", color: "#c2410c", backgroundColor: "#fff", borderRadius: "999px", padding: "8px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              {allExpanded ? "Collapse all" : "Expand all"}
            </button>
          </div>
        </div>

        {subCategoryGroups.length ? (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
            {/* Groups */}
            {subCategoryGroups.map(([subCat, subAssets]) => {
              const isExpanded = !collapsedGroups.has(`${effectiveActiveStocksTab}:${subCat}`)
              return (
                <section key={subCat} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => toggleGroup(subCat)}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50"
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
                        {subCat.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{subCat}</div>
                        <div className="text-xs text-slate-500">
                          {subAssets.length} asset record{subAssets.length !== 1 ? "s" : ""} / {getAvailableUnits(subAssets)} available
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-bold text-white">
                        Q-{getAvailableUnits(subAssets)}
                      </span>
                      <ChevronDown className={`size-4 text-slate-500 transition ${isExpanded ? "rotate-180" : ""}`} />
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="overflow-x-auto border-t border-slate-100">
                      <table className="min-w-[1060px] w-full divide-y divide-slate-100 text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Asset ID</th>
                            <th className="px-4 py-3 font-semibold">Category</th>
                            <th className="px-4 py-3 font-semibold">Make / Model</th>
                            <th className="px-4 py-3 font-semibold">Serial No</th>
                            <th className="px-4 py-3 font-semibold">Invoice</th>
                            <th className="px-4 py-3 font-semibold">Dates</th>
                            <th className="px-4 py-3 font-semibold">Status</th>
                            {showActions ? <th className="px-4 py-3 font-semibold">Actions</th> : null}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 bg-white">
                          {subAssets.map((asset) => (
                            <tr key={asset.assetId} className="align-top hover:bg-slate-50">
                              <td className="px-4 py-3 font-semibold text-slate-900">{asset.assetId}</td>
                              <td className="px-4 py-3 text-slate-600">{asset.category || "-"}</td>
                              <td className="px-4 py-3 text-slate-700">
                                <div className="font-medium text-slate-900">{asset.make || "-"}</div>
                                <div className="text-xs text-slate-500">{asset.model || "-"}</div>
                              </td>
                              <td className="px-4 py-3">
                                {(asset.serialNumbers ?? []).filter(Boolean).length ? (
                                  (asset.serialNumbers ?? []).map((serial, index) => (
                                    <div key={index} className="mb-1 rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-700">
                                      {serial || "-"}
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-xs text-slate-400">No serial</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-slate-700">
                                <div>{asset.invoiceNo || "-"}</div>
                                {asset.invoiceFile ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onViewInvoice({
                                        fileName: asset.invoiceFileName || asset.invoiceNo || "Invoice",
                                        fileType: asset.invoiceFileType || "",
                                        dataUrl: asset.invoiceFile,
                                      })
                                    }
                                    className="text-xs text-blue-600 hover:underline"
                                  >
                                    View
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-400">No file</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-600">
                                <div>Warranty: {formatDate(asset.warrantyDate || asset.purchaseDate)}</div>
                                <div>Order: {formatDate(asset.orderDate)}</div>
                                <div>Supply: {formatDate(asset.supplyDate)}</div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                  Available ({asset.availableQuantity ?? 1})
                                </span>
                              </td>
                              {showActions ? (
                                <td className="px-4 py-3">
                                  <div className="flex flex-col gap-1">
                                    {onEditAsset ? (
                                      <button className="rounded bg-lime-900 px-2 py-1 text-xs text-white hover:bg-lime-800" onClick={() => onEditAsset(asset)}>
                                        Edit
                                      </button>
                                    ) : null}
                                    {onIssueAsset ? (
                                      <button
                                        className="rounded bg-yellow-200 px-2 py-1 text-xs text-slate-900 hover:bg-yellow-300"
                                        onClick={() => onIssueAsset(asset)}
                                        disabled={(asset.availableQuantity ?? asset.quantity ?? 0) <= 0}
                                      >
                                        Issue
                                      </button>
                                    ) : null}
                                    {onRemoveAsset ? (
                                      <button className="rounded bg-orange-500 px-2 py-1 text-xs text-white hover:bg-orange-600" onClick={() => onRemoveAsset(asset.assetId)}>
                                        Delete
                                      </button>
                                    ) : null}
                                  </div>
                                </td>
                              ) : null}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </section>
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
            No stock records found for <span className="font-semibold">{effectiveActiveStocksTab}</span>
            {searchTerm ? ` matching "${searchTerm}"` : ""}.
          </div>
        )}
      </div>
  )
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
  return (
    <SectionShell
      title="Stocks"
      description="Type and sub-category wise asset breakdown."
      action={
        <ActionButton onClick={onExportCsv}>
          <Download style={{ width: "16px", height: "16px" }} />
          Export CSV
        </ActionButton>
      }
    >
      <StockDetailsPanel
        catalog={catalog}
        filteredStocks={filteredStocks}
        assetsWithAvailability={assetsWithAvailability}
        activeStocksTab={activeStocksTab}
        onActiveStocksTabChange={onActiveStocksTabChange}
        searchTerm={searchTerm}
        onSearchTermChange={onSearchTermChange}
        onViewInvoice={onViewInvoice}
      />
    </SectionShell>
  )
}

export default StocksSection

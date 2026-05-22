import { Search } from "lucide-react"
import { getTypeLabel } from "@/data/inventoryCatalog"
import { formatDate } from "@/lib/inventory"

function AssetListPanel({
  catalog,
  assets,
  searchTerm,
  onSearchTermChange,
  onEditAsset,
  onIssueAsset,
  onRemoveAsset,
  onViewInvoice,
}) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Search by asset id, serial no, invoice no"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 text-sm outline-none"
          />
        </div>
        <div className="text-sm text-slate-500">
          Showing {assets.length} asset{assets.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Type/Category/Sub Category</th>
                <th className="px-3 py-2 font-medium">Make/Model</th>
                <th className="px-3 py-2 font-medium text-center">Qty</th>
                <th className="px-3 py-2 font-medium">Serial</th>
                <th className="px-3 py-2 font-medium">Invoice</th>
                <th className="px-3 py-2 font-medium">Dates</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {assets.length ? (
                assets.map((asset) => (
                  <tr key={asset.assetId} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-semibold text-slate-900">{asset.assetId}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{getTypeLabel(catalog, asset.type)}</div>
                      <div className="text-xs text-slate-500">{asset.category || "-"}</div>
                      <div className="text-xs font-semibold text-slate-700">{asset.subCategory || "-"}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-slate-900">{asset.make || "-"}</div>
                      <div className="text-xs text-slate-500">{asset.model || "-"}</div>
                    </td>
                    <td className="px-3 py-2 text-center font-semibold text-slate-900">{asset.availableQuantity ?? (asset.quantity || 1)}</td>
                    <td className="px-3 py-2">
                      {(asset.serialNumbers ?? []).map((s) => (
                        <div key={s} className="mb-1 rounded bg-slate-50 px-1.5 py-0.5 text-xs">
                          {s}
                        </div>
                      ))}
                    </td>
                    <td className="px-3 py-2">
                      <div>{asset.invoiceNo || "-"}</div>
                      {asset.invoiceFile ? (
                        <button
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
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div className="space-y-0.5">
                        <div>
                          <span className="font-semibold">O:</span> {formatDate(asset.orderDate)}
                        </div>
                        <div>
                          <span className="font-semibold">S:</span> {formatDate(asset.supplyDate)}
                        </div>
                        <div>
                          <span className="font-semibold">W:</span> {formatDate(asset.purchaseDate)}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        <button className="rounded bg-lime-900 px-2 py-1 text-xs text-white hover:bg-lime-800" onClick={() => onEditAsset(asset)}>
                          Edit
                        </button>
                        <button
                          className="rounded bg-yellow-200 px-2 py-1 text-xs text-slate-900 hover:bg-yellow-300"
                          onClick={() => onIssueAsset(asset)}
                          disabled={(asset.availableQuantity ?? asset.quantity ?? 0) <= 0}
                        >
                          Issue
                        </button>
                        <button className="rounded bg-orange-500 px-2 py-1 text-xs text-white hover:bg-orange-600" onClick={() => onRemoveAsset(asset.assetId)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-500">
                    No assets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export default AssetListPanel

import { Plus, Trash2 } from "lucide-react"

function INoteItemsEditor({ items, onAddItem, onChangeItem, onRemoveItem }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Items</h3>
          <p className="text-xs text-slate-500">Fill article and quantity details manually.</p>
        </div>
        <button
          type="button"
          onClick={onAddItem}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          <Plus className="size-3.5" />
          Add Row
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">S. No.</th>
              <th className="px-3 py-2 font-medium">Name of Articles</th>
              <th className="px-3 py-2 font-medium">Quantity Tendered</th>
              <th className="px-3 py-2 font-medium">Quantity Accepted</th>
              <th className="px-3 py-2 font-medium">Quantity Rejected / Balance</th>
              <th className="px-3 py-2 font-medium">Remarks</th>
              <th className="px-3 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {items.map((item, index) => (
              <tr key={index} className="align-top">
                <td className="px-3 py-3 font-semibold text-slate-900">{index + 1}</td>
                <td className="px-3 py-3">
                  <input
                    value={item.articleName}
                    onChange={(event) => onChangeItem(index, "articleName", event.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none"
                    placeholder="Article name"
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    min="0"
                    value={item.quantityTendered}
                    onChange={(event) => onChangeItem(index, "quantityTendered", event.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none"
                    placeholder="0"
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    min="0"
                    value={item.quantityAccepted}
                    onChange={(event) => onChangeItem(index, "quantityAccepted", event.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none"
                    placeholder="0"
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    min="0"
                    value={item.quantityRejected}
                    onChange={(event) => onChangeItem(index, "quantityRejected", event.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none"
                    placeholder="0"
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    value={item.remarks}
                    onChange={(event) => onChangeItem(index, "remarks", event.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none"
                    placeholder="Remarks"
                  />
                </td>
                <td className="px-3 py-3">
                  {items.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => onRemoveItem(index)}
                      className="inline-flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      <Trash2 className="size-3.5" />
                      Remove
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default INoteItemsEditor

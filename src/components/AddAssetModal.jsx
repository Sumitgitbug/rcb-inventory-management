console.log("ACTION BUTTON UPDATED")
import { Upload } from "lucide-react"
import Modal from "@/components/Modal"
import { ActionButton } from "@/components/dashboard-ui"
import { getCategoriesForType, getTypeOptions } from "@/data/inventoryCatalog"


function AddAssetModal({
  open,
  onClose,
  editingAssetId,
  catalog,
  assetForm,
  assetSubCategoryOptions,
  onOpenCatalogModal,
  onTypeChange,
  onCategoryChange,
  onSubCategoryChange,
  onQuantityChange,
  onSerialTrackingChange,
  onSerialChange,
  onAssetFileChange,
  onSubmit,
  setAssetForm,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingAssetId ? "Edit Asset" : "Add Asset"}
      description="Create or update an asset with quantity, serial numbers, and invoice details."
    >
      <form className="space-y-5" onSubmit={onSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <div className="flex items-center just y-between gap-3">
              <span className="text-sm font-medium text-slate-700">Type</span>
              <button type="button" className="text-xs font-medium text-orange-600 hover:text-orange-900" onClick={() => onOpenCatalogModal("type")}>
                + Add
              </button>
            </div>
            <select
              value={assetForm.type}
              onChange={(event) => onTypeChange(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            >
              {getTypeOptions(catalog).map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-700">Category</span>
              <button type="button" className="text-xs font-medium text-cyan-600 hover:text-cyan-900" onClick={() => onOpenCatalogModal("category")}>
                + Add
              </button>
            </div>
            <select
              value={assetForm.category}

              onChange={(event) => onCategoryChange(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            >
              {getCategoriesForType(catalog, assetForm.type).map((category) => (
                <option key={category.label} value={category.label}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-700">Sub Category</span>
              <button type="button" className="text-xs font-medium text-lime-600 hover:text-lime-900" onClick={() => onOpenCatalogModal("subcategory")}>
                + Add
                
              </button>
            </div>
            <select
              value={assetForm.subCategory}
              onChange={(event) => onSubCategoryChange(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            >
              <option value="">Select sub category</option>
              {assetSubCategoryOptions.some((item) => item.label === assetForm.subCategory) || !assetForm.subCategory ? null : (
                <option value={assetForm.subCategory}>{assetForm.subCategory}</option>
              )}
              {assetSubCategoryOptions.map((subCategory) => (
                <option key={subCategory.label} value={subCategory.label}>
                  {subCategory.label}
                </option>
              ))}
            </select>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Make</span>
            <input
              value={assetForm.make}
              onChange={(event) => setAssetForm((current) => ({ ...current, make: event.target.value }))}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Model</span>
            <input
              value={assetForm.model}
              onChange={(event) => setAssetForm((current) => ({ ...current, model: event.target.value }))}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Quantity</span>
            <input
              type="number"
              min="1"
              value={assetForm.quantity}
              onChange={(event) => onQuantityChange(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2 md:col-span-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Invoice No</span>
              <input
                value={assetForm.invoiceNo}
                onChange={(event) => setAssetForm((current) => ({ ...current, invoiceNo: event.target.value }))}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              />
              <span className="text-xs text-slate-600">Optional</span>
            </label>

            <div className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Invoice File</span>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition hover:border-slate-400 hover:bg-slate-100">
                <Upload className="size-4 shrink-0 text-slate-500" />
                <span className="font-medium">{assetForm.invoiceFileName || "Choose file"}</span>
                <span className="ml-auto text-xs text-slate-500">PDF / Image</span>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={async (event) => onAssetFileChange(event.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </label>
              <span className="text-xs text-slate-600">Optional</span>
            </div>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Date of Warranty</span>
            <input
              type="date"
              value={assetForm.warrantyDate}
              onChange={(event) => setAssetForm((current) => ({ ...current, warrantyDate: event.target.value }))}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Order Date</span>
            <input
              type="date"
              value={assetForm.orderDate}
              onChange={(event) => setAssetForm((current) => ({ ...current, orderDate: event.target.value }))}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Supply Date</span>
            <input
              type="date"
              value={assetForm.supplyDate}
              onChange={(event) => setAssetForm((current) => ({ ...current, supplyDate: event.target.value }))}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            />
          </label>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Serial Numbers</h3>
              <p className="text-xs text-slate-500">Tick to add serial numbers. Entered serial numbers cannot match another asset.</p>
            </div>
            <label className="inline-flex w-fit max-w-full items-start gap-2 rounded-xl border border-slate-200 bg-lime-50/50 px-3 py-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={assetForm.useSerialNumbers}
                onChange={(event) => onSerialTrackingChange(event.target.checked)}
                className="mt-0.5 size-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
              />
              <span> Tick to add serial no  </span>
            </label>
          </div>
          {assetForm.useSerialNumbers ? (
            <div className="grid gap-3 rounded-2xl border border-lime-200 bg-lime-50/50 p-4 md:grid-cols-2">
              {Array.from({ length: assetForm.quantity }).map((_, index) => (
                <label key={index} className="grid gap-2">
                  <span className="text-sm font-medium text-slate-700">Serial No {index + 1}</span>
                  <input
                    value={assetForm.serialNumbers[index] ?? ""}
                    onChange={(event) => onSerialChange(index, event.target.value)}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                  />
                </label>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-lime-200 bg-lime-50/50 p-4 text-sm text-slate-500">
              Serial numbers are disabled for this asset. It will save without serial numbers.
            </div>
          )}

          {!editingAssetId ? (
            <div className="flex justify-end">
              <label className="inline-flex w-fit max-w-full items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={Boolean(assetForm.generateINote)}
                  onChange={(event) => setAssetForm((current) => ({ ...current, generateINote: event.target.checked }))}
                  className="mt-0.5 size-4 rounded border-slate-300 text-lime-700 focus:ring-lime-300"
                />
                <span>Tick to Generate I-note</span>
              </label>
            </div>
          ) : null}
          {assetForm.generateINote ? (
            <div className="grid gap-4 rounded-2xl border border-dashed border-lime-300 bg-lime-50/50 p-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Supplier Name</span>
                <input
                  value={assetForm.supplierName ?? ""}
                  onChange={(event) => setAssetForm((current) => ({ ...current, supplierName: event.target.value }))}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                  placeholder="Enter supplier name"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Supply Order No.</span>
                <input
                  value={assetForm.supplyOrderNo ?? ""}
                  onChange={(event) => setAssetForm((current) => ({ ...current, supplyOrderNo: event.target.value }))}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                  placeholder="Enter supply order no."
                />
              </label>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-3">
          <ActionButton
  type="button"
  onClick={onClose}
  style={{
    backgroundColor: "#94b8aad6",
    color: "#fff",
  }}
>
  Cancel
</ActionButton>

<ActionButton
  type="submit"
  style={{
    backgroundColor: "#cbf916de",
    color: "#fff",
  }}
>
  Save Asset
</ActionButton>
        </div>
      </form>
    </Modal>
  )
}

export default AddAssetModal

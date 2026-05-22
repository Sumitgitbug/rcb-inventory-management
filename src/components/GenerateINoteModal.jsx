import Modal from "@/components/Modal"
import { ActionButton } from "@/components/dashboard-ui"
import INoteItemsEditor from "@/components/INoteItemsEditor"

function FieldRow({ label, children }) {
  return (
    <div className="grid gap-2 md:grid-cols-[180px_1fr] md:items-center">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <div>{children}</div>
    </div>
  )
}

function FieldPair({ leftLabel, leftField, rightLabel, rightField }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FieldRow label={leftLabel}>{leftField}</FieldRow>
      <FieldRow label={rightLabel}>{rightField}</FieldRow>
    </div>
  )
}

function GenerateINoteModal({
  open,
  onClose,
  noteForm,
  setNoteForm,
  nextNoteId,
  onSubmit,
}) {
  const updateItem = (index, key, value) => {
    setNoteForm((current) => ({
      ...current,
      items: (current.items ?? []).map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    }))
  }

  const addItem = () => {
    setNoteForm((current) => ({
      ...current,
      items: [
        ...(current.items ?? []),
        {
          articleName: "",
          quantityTendered: "",
          quantityAccepted: "",
          quantityRejected: "",
          remarks: "",
        },
      ],
    }))
  }

  const removeItem = (index) => {
    setNoteForm((current) => {
      const nextItems = (current.items ?? []).filter((_, itemIndex) => itemIndex !== index)
      return {
        ...current,
        items: nextItems.length
          ? nextItems
          : [
              {
                articleName: "",
                quantityTendered: "",
                quantityAccepted: "",
                quantityRejected: "",
                remarks: "",
              },
            ],
      }
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate I-Note"
      description="Enter I-Note details manually. Only the I-Note number is system generated."
      widthClass="max-w-5xl"
    >
      <form className="space-y-5" onSubmit={onSubmit}>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[180px_1fr] md:items-center">
            <div className="text-sm font-medium text-slate-700">Inspection Note No.</div>
            <div>
              <input
                value={nextNoteId}
                readOnly
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-blue-700 outline-none"
              />
            </div>
          </div>

          <FieldPair
            leftLabel="Date"
            leftField={
              <input
                type="date"
                value={noteForm.inoteDate}
                onChange={(e) => setNoteForm((c) => ({ ...c, inoteDate: e.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              />
            }
            rightLabel="Name of supplier"
            rightField={
              <input
                value={noteForm.supplierName}
                onChange={(e) => setNoteForm((c) => ({ ...c, supplierName: e.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                placeholder="Supplier name"
              />
            }
          />

          <FieldPair
            leftLabel="Date of Receipt"
            leftField={
              <input
                type="date"
                value={noteForm.dateOfReceipt}
                onChange={(e) => setNoteForm((c) => ({ ...c, dateOfReceipt: e.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              />
            }
            rightLabel="Date of Delivery"
            rightField={
              <input
                type="date"
                value={noteForm.dateOfDelivery}
                onChange={(e) => setNoteForm((c) => ({ ...c, dateOfDelivery: e.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              />
            }
          />

          <FieldPair
            leftLabel="Supply Order No."
            leftField={
              <input
                value={noteForm.supplyOrderNo}
                onChange={(e) => setNoteForm((c) => ({ ...c, supplyOrderNo: e.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                placeholder="Supply order number"
              />
            }
            rightLabel="Date"
            rightField={
              <input
                type="date"
                value={noteForm.supplyOrderDate}
                onChange={(e) => setNoteForm((c) => ({ ...c, supplyOrderDate: e.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              />
            }
          />

          <FieldPair
            leftLabel="Invoice / Challan No."
            leftField={
              <input
                value={noteForm.invoiceNo}
                onChange={(e) => setNoteForm((c) => ({ ...c, invoiceNo: e.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                placeholder="Invoice or challan number"
              />
            }
            rightLabel="Date"
            rightField={
              <input
                type="date"
                value={noteForm.invoiceDate}
                onChange={(e) => setNoteForm((c) => ({ ...c, invoiceDate: e.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              />
            }
          />
        </div>

        <INoteItemsEditor
          items={noteForm.items ?? []}
          onAddItem={addItem}
          onChangeItem={updateItem}
          onRemoveItem={removeItem}
        />

        <div className="flex justify-end gap-3">
          <ActionButton type="button" className="bg-slate-200 text-slate-900 hover:bg-slate-300" onClick={onClose}>
            Cancel
          </ActionButton>
          <ActionButton type="submit">Save I-Note</ActionButton>
        </div>
      </form>
    </Modal>
  )
}

export default GenerateINoteModal

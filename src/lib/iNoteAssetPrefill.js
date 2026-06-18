export const I_NOTE_ITEM_DESCRIPTION_KEYS = [
  "item_desc",
  "description",
  "item_description",
  "desc",
  "particulars",
]

export const I_NOTE_ACCEPTED_QUANTITY_KEYS = [
  "accepted_qty",
  "qty_accepted",
  "quantity_accepted",
  "accepted_quantity",
]

const I_NOTE_INVOICE_KEYS = ["invoice_no", "invoiceNo", "challan_no", "challanNo"]
const I_NOTE_ORDER_KEYS = ["order_no", "purchaseDemandNo", "purchase_demand_no", "supply_order_no"]
const I_NOTE_ORDER_DATE_KEYS = ["order_dt", "orderDate", "supply_order_date"]
const I_NOTE_DELIVERY_DATE_KEYS = ["delivery_date", "supply_date", "supplyDate", "deliveryDate"]
const I_NOTE_INVOICE_DATE_KEYS = ["invoice_dt", "invoiceDate"]

export function normalizeINoteText(value) {
  return String(value ?? "").trim()
}

export function readINoteField(source, keys) {
  for (const key of keys) {
    const value = source?.[key]
    if (value !== undefined && value !== null && String(value).trim() !== "") return value
  }
  return ""
}

export function parseINoteQuantity(value) {
  const text = normalizeINoteText(value).replace(/,/g, "")
  if (!text) return 0
  const match = text.match(/\d+(?:\.\d+)?/)
  if (!match) return 0
  return Math.max(0, Math.floor(Number(match[0]) || 0))
}

export function getINoteItemDescription(item) {
  return normalizeINoteText(readINoteField(item, I_NOTE_ITEM_DESCRIPTION_KEYS))
}

export function getINoteAcceptedQuantity(item) {
  return readINoteField(item, I_NOTE_ACCEPTED_QUANTITY_KEYS)
}

export function buildINoteAssetPrefill({ noteNo, noteMeta = {}, record = {}, item = {}, acceptedQuantity }) {
  const quantity = parseINoteQuantity(acceptedQuantity ?? getINoteAcceptedQuantity(item))

  return {
    noteNo: normalizeINoteText(noteNo || readINoteField(record, ["inote_no", "note_uid", "i_note", "id", "uid"])),
    noteMeta,
    detail: record,
    item,
    itemDescription: getINoteItemDescription(item),
    quantity,
    invoiceNo: normalizeINoteText(
      readINoteField(item, I_NOTE_INVOICE_KEYS) ||
        readINoteField(record, I_NOTE_INVOICE_KEYS) ||
        readINoteField(noteMeta, I_NOTE_INVOICE_KEYS),
    ),
    orderNo: normalizeINoteText(
      readINoteField(item, I_NOTE_ORDER_KEYS) ||
        readINoteField(record, I_NOTE_ORDER_KEYS) ||
        readINoteField(noteMeta, I_NOTE_ORDER_KEYS),
    ),
    orderDate: normalizeINoteText(
      readINoteField(item, I_NOTE_ORDER_DATE_KEYS) ||
        readINoteField(record, I_NOTE_ORDER_DATE_KEYS) ||
        readINoteField(noteMeta, I_NOTE_ORDER_DATE_KEYS),
    ),
    supplyDate: normalizeINoteText(
      readINoteField(item, I_NOTE_DELIVERY_DATE_KEYS) ||
        readINoteField(record, I_NOTE_DELIVERY_DATE_KEYS) ||
        readINoteField(noteMeta, I_NOTE_DELIVERY_DATE_KEYS) ||
        readINoteField(record, I_NOTE_ORDER_DATE_KEYS) ||
        readINoteField(noteMeta, I_NOTE_ORDER_DATE_KEYS),
    ),
    invoiceDate: normalizeINoteText(
      readINoteField(item, I_NOTE_INVOICE_DATE_KEYS) ||
        readINoteField(record, I_NOTE_INVOICE_DATE_KEYS) ||
        readINoteField(noteMeta, I_NOTE_INVOICE_DATE_KEYS),
    ),
  }
}

import { formatDate } from "@/lib/inventory"

function displayValue(value) {
  return value === 0 || value ? value : "-"
}

function ValueLine({ children, align = "left", widthClass = "min-w-40" }) {
  return (
    <span
      className={[
        "inline-flex items-end border-b border-black/70 px-1 pb-0.5 font-semibold",
        widthClass,
        align === "right" ? "justify-end text-right" : "justify-start text-left",
      ].join(" ")}
    >
      {displayValue(children)}
    </span>
  )
}

function INotePrintableA4({ note }) {
  if (!note) {
    return (
      <div className="flex min-h-[620px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
        Select an I-Note number to open the printable page.
      </div>
    )
  }

  const items = Array.isArray(note.items) ? note.items : []

  return (
    <div className="overflow-auto rounded-2xl border border-slate-200 bg-white">
      <div className="mx-auto w-full max-w-[210mm] bg-white px-6 py-8 font-serif text-black md:px-10 md:py-10">
        <div className="text-center">
          <h2 className="text-[26px] font-bold leading-tight tracking-wide">
            REGIONAL CENTRE FOR BIOTECHNOLOGY
          </h2>
          <p className="text-[22px] font-bold leading-tight">क्षेत्रीय जैव प्रौद्योगिकी केंद्र</p>
        </div>

        <div className="mt-10 space-y-3 text-[16px] leading-snug">
          <div className="grid grid-cols-2 gap-4">
            <div>
              1. Inspection Note No. <ValueLine widthClass="min-w-44">{note.noteId}</ValueLine>
            </div>
            <div className="text-right">
              Date: <ValueLine align="right" widthClass="min-w-28">{formatDate(note.inoteDate)}</ValueLine>
            </div>
          </div>

          <div>
            2. Name of supplier: <ValueLine widthClass="min-w-[320px]">{note.supplierName}</ValueLine>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              3. Date of Receipt <ValueLine widthClass="min-w-28">{formatDate(note.dateOfReceipt)}</ValueLine>
            </div>
            <div className="text-right">
              Date of Delivery:{" "}
              <ValueLine align="right" widthClass="min-w-28">
                {formatDate(note.dateOfDelivery)}
              </ValueLine>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              4. Supply Order No. <ValueLine widthClass="min-w-[260px]">{note.supplyOrderNo}</ValueLine>
            </div>
            <div className="text-right">
              Date: <ValueLine align="right" widthClass="min-w-28">{formatDate(note.supplyOrderDate)}</ValueLine>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              5. Invoice / Challan No. <ValueLine widthClass="min-w-[220px]">{note.invoiceNo}</ValueLine>
            </div>
            <div className="text-right">
              Date: <ValueLine align="right" widthClass="min-w-28">{formatDate(note.invoiceDate)}</ValueLine>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <table className="w-full border-collapse text-[15px]">
            <thead>
              <tr className="border-y border-black">
                <th className="px-2 py-2 text-left font-bold">S. No.</th>
                <th className="px-2 py-2 text-left font-bold">Name of Articles</th>
                <th className="px-2 py-2 text-center font-bold">Quantity Tendered</th>
                <th className="px-2 py-2 text-center font-bold">Quantity Accepted</th>
                <th className="px-2 py-2 text-center font-bold">Quantity Rejected / Balance</th>
                <th className="px-2 py-2 text-left font-bold">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {items.length ? (
                items.map((item, index) => (
                  <tr key={index} className="border-b border-black/40 align-top">
                    <td className="px-2 py-3">{index + 1}</td>
                    <td className="px-2 py-3">{displayValue(item.articleName)}</td>
                    <td className="px-2 py-3 text-center">{displayValue(item.quantityTendered)}</td>
                    <td className="px-2 py-3 text-center">{displayValue(item.quantityAccepted)}</td>
                    <td className="px-2 py-3 text-center">{displayValue(item.quantityRejected)}</td>
                    <td className="px-2 py-3">{displayValue(item.remarks)}</td>
                  </tr>
                ))
              ) : (
                <tr className="border-b border-black/40">
                  <td colSpan={6} className="px-2 py-6 text-center text-slate-500">
                    No item rows saved.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-8 text-[15px] leading-snug">
          <p>
            The concerned Inspecting Authority certified in the respective bills that the quantities are correct, their quality good, and checked found
            strictly in accordance with the ordered specifications &amp; terms.
          </p>
          <p className="mt-2">
            संबंधित निरीक्षण प्राधिकारी ने संबंधित बिलों में प्रमाणित किया कि मात्रा सही है, उनकी गुणवत्ता अच्छी है, और जांच की गई है कि वे आदेशित
            विनिर्देशों और शर्तों के अनुसार कड़ाई से पाए गए हैं।
          </p>
        </div>
      </div>
    </div>
  )
}

export default INotePrintableA4

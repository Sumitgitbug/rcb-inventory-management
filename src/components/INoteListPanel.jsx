import { Search } from "lucide-react"

function INoteListPanel({ notes, searchTerm, onSearchTermChange, selectedNoteId, onSelectNote }) {
  const filteredNotes = notes.filter((note) => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return true
    return [
      note.noteId,
      note.invoiceNo,
      note.supplyOrderNo,
      note.supplierName,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term))
  })

  return (
    <>
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Search by I-Note no, invoice no, supplier name"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 text-sm outline-none"
          />
        </div>
        <div className="text-sm text-slate-500">
          Showing {filteredNotes.length} I-Note{filteredNotes.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">S.No.</th>
                <th className="px-4 py-3 font-medium">I-Note No.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredNotes.length ? (
                filteredNotes.map((note, index) => {
                  const isActive = selectedNoteId === note.noteId
                  return (
                    <tr key={note.id} className={isActive ? "bg-blue-50/50" : "hover:bg-slate-50"}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{index + 1}</td>
                      <td className="px-4 py-3 font-semibold">
                        <button
                          type="button"
                          onClick={() => onSelectNote(note.noteId)}
                          className="font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                        >
                          {note.noteId}
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-sm text-slate-500">
                    No I-Notes created yet.
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

export default INoteListPanel


import { ActionButton } from "@/components/dashboard-ui"

function GetINoteTab({ lookupTerm, onLookupTermChange, onClear, matchCount, hasSearch, hasMatches }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Get I-Note</p>
      <h3 className="mt-2 text-2xl font-semibold text-slate-900">Find a note quickly</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Search by I-Note number, title, type, related reference, or body text.
      </p>

      <div className="mt-5 space-y-4">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">I-Note No. / Search Text</span>
          <input
            value={lookupTerm}
            onChange={(event) => onLookupTermChange(event.target.value)}
            placeholder="Enter note number, title, or reference"
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <ActionButton type="button" onClick={onClear} className="bg-slate-200 text-slate-900 hover:bg-slate-300">
            Clear
          </ActionButton>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
          {hasSearch
            ? hasMatches
              ? `${matchCount} note${matchCount === 1 ? "" : "s"} found.`
              : "No matching I-Note found."
            : "Enter a note number or title to search."}
        </div>
      </div>
    </section>
  )
}

export default GetINoteTab

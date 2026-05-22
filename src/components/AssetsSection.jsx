import { useState } from "react"
import { Plus } from "lucide-react"
import { ActionButton, SectionShell } from "@/components/dashboard-ui"
import AssetListPanel from "@/components/AssetListPanel"
import INoteListPanel from "@/components/INoteListPanel"

function AssetsSection({
  catalog,
  recentAssets,
  notes = [],
  searchTerm,
  onSearchTermChange,
  onAddAsset,
  onGenerateNote,
  onEditAsset,
  onIssueAsset,
  onRemoveAsset,
  onViewInvoice,
  onOpenNote,
}) {
  const [activeList, setActiveList] = useState("assets")
  const [noteSearchTerm, setNoteSearchTerm] = useState("")
  const [selectedNoteId, setSelectedNoteId] = useState("")

  return (
    <SectionShell
      title="Assets"
      description="Switch between asset inventory and I-Note records from the same screen."
      action={
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={onAddAsset}>
            <Plus className="size-4" />
            Add Asset
          </ActionButton>
          <ActionButton onClick={onGenerateNote} className="bg-slate-200 text-slate-900 hover:bg-slate-300">
            <Plus className="size-4" />
            Generate I-Note
          </ActionButton>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setActiveList("assets")}
            className={[
              "rounded-full px-5 py-2.5 text-sm font-semibold transition",
              activeList === "assets"
                ? "bg-slate-900 text-white shadow-md"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
            ].join(" ")}
          >
            Assets List
          </button>
          <button
            type="button"
            onClick={() => setActiveList("inote")}
            className={[
              "rounded-full px-5 py-2.5 text-sm font-semibold transition",
              activeList === "inote"
                ? "bg-slate-900 text-white shadow-md"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
            ].join(" ")}
          >
            I-Note List
          </button>
        </div>

        {activeList === "assets" ? (
          <AssetListPanel
            catalog={catalog}
            assets={recentAssets}
            searchTerm={searchTerm}
            onSearchTermChange={onSearchTermChange}
            onEditAsset={onEditAsset}
            onIssueAsset={onIssueAsset}
            onRemoveAsset={onRemoveAsset}
            onViewInvoice={onViewInvoice}
          />
        ) : (
          <INoteListPanel
            notes={notes}
            searchTerm={noteSearchTerm}
            onSearchTermChange={setNoteSearchTerm}
            selectedNoteId={selectedNoteId}
            onSelectNote={(noteId) => {
              setSelectedNoteId(noteId)
              onOpenNote?.(noteId)
            }}
          />
        )}
      </div>
    </SectionShell>
  )
}

export default AssetsSection

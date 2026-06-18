import { Plus } from "lucide-react"
import { ActionButton, SectionShell } from "@/components/dashboard-ui"
import AssetListPanel from "@/components/AssetListPanel"

function AssetsSection({
  catalog,
  recentAssets,
  searchTerm,
  onSearchTermChange,
  onAddAsset,
  onExportCsv,
  onEditAsset,
  onIssueAsset,
  onRemoveAsset,
  onViewInvoice,
}) {
  return (
    <SectionShell
      title="Assets"
      description="View, edit, issue, and export asset inventory from one place."
      action={
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={onAddAsset} className="!bg-orange-600 hover:!bg-orange-700 !text-white">
            <Plus className="size-4" />
            Add Asset
          </ActionButton>
          <ActionButton onClick={onExportCsv} className="!bg-orange-600 hover:!bg-orange-700 !text-white">
            <Plus className="size-4" />
            Export CSV
          </ActionButton>
        </div>
      }
    >
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
    </SectionShell>
  )
}

export default AssetsSection

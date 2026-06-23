import { Plus } from "lucide-react"
import { ActionButton, SectionShell } from "@/components/dashboard-ui"
import { StockDetailsPanel } from "@/components/StocksSection"

function AssetsSection({
  catalog,
  filteredStocks,
  assetsWithAvailability,
  activeStocksTab,
  onActiveStocksTabChange,
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
          {onAddAsset ? (
            <ActionButton onClick={onAddAsset} className="!bg-orange-600 hover:!bg-orange-700 !text-white">
              <Plus className="size-4" />
              Add Asset
            </ActionButton>
          ) : null}
          <ActionButton onClick={onExportCsv} className="!bg-orange-600 hover:!bg-orange-700 !text-white">
            <Plus className="size-4" />
            Export CSV
          </ActionButton>
        </div>
      }
    >
      <StockDetailsPanel
        catalog={catalog}
        filteredStocks={filteredStocks}
        assetsWithAvailability={assetsWithAvailability}
        activeStocksTab={activeStocksTab}
        onActiveStocksTabChange={onActiveStocksTabChange}
        searchTerm={searchTerm}
        onSearchTermChange={onSearchTermChange}
        onViewInvoice={onViewInvoice}
        onEditAsset={onEditAsset}
        onIssueAsset={onIssueAsset}
        onRemoveAsset={onRemoveAsset}
      />
    </SectionShell>
  )
}

export default AssetsSection

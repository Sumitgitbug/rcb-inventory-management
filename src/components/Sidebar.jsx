import {
  ArrowLeftRight,
  Boxes,
  Layers3,
  Package,
  ShieldCheck,
  Users,
} from "lucide-react"

const items = [
  { id: "dashboard", label: "Dashboard", icon: Layers3 },
  { id: "assets", label: "Assets", icon: Package },
  { id: "stocks", label: "Stocks", icon: Boxes },
  { id: "employees", label: "Employee Details", icon: Users },
  { id: "issue-return", label: "Issue / Return", icon: ArrowLeftRight },
]

function Sidebar({ activeSection, onSectionChange, counts }) {
  return (
    <aside className="flex h-full flex-col border-r border-slate-200 bg-slate-950 text-slate-100">
      <div className="border-b border-white/10 px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Inventory</p>
            <h1 className="text-lg font-semibold">Management</h1>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-400">
          Structured asset, stock, employee, and issue tracking in one place.
        </p>
      </div>

      <nav className="flex-1 px-3 py-4">
        <div className="space-y-2">
          {items.map((item) => {
            const Icon = item.icon
            const active = activeSection === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSectionChange(item.id)}
                className={[
                  "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition",
                  active
                  ? "bg-white text-slate-950 shadow-lg"
                    : "text-slate-300 hover:bg-white/5 hover:text-white",
                ].join(" ")}
              >
                <Icon className="size-4" />
                <span className="flex-1">{item.label}</span>
                <span className={active ? "text-slate-500" : "text-slate-500"}>
                  {counts?.[item.id] ?? ""}
                </span>
              </button>
            )
          })}
        </div>
      </nav>

      <div className="border-t border-white/10 px-6 py-5 text-xs text-slate-400">
        Type filter is linked to category options automatically.
      </div>
    </aside>
  )
}

export default Sidebar

import { useState } from "react"
import {
  ArrowLeftRight,
  Boxes,
  ChevronLeft,
  ChevronRight,
  FileText,
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
  { id: "i-note", label: "I-Note", icon: FileText },
  { id: "issue-return", label: "Issue / Return", icon: ArrowLeftRight },
]

function Sidebar({ activeSection, onSectionChange, counts }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      style={{ width: collapsed ? 68 : 280, minWidth: collapsed ? 68 : 280 }}
      className="relative flex h-full flex-col border-r border-white/10 bg-slate-950 text-slate-100 transition-all duration-300 overflow-visible z-20"
    >
      {/* Toggle Button */}
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className="absolute -right-3.5 top-6 z-30 flex size-7 items-center justify-center rounded-full border border-white/15 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-3.5 py-5" style={{ minHeight: 80 }}>
        <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white/10">
          <ShieldCheck className="size-5" />
        </div>
        <div
          className="overflow-hidden transition-all duration-300"
          style={{ width: collapsed ? 0 : 180, opacity: collapsed ? 0 : 1 }}
        >
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Inventory</p>
          <h1 className="text-base font-semibold whitespace-nowrap">Management</h1>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 px-2 py-3">
        {items.map((item) => {
          const Icon = item.icon
          const active = activeSection === item.id
          const count = counts?.[item.id]
          return (
            <div key={item.id} className="group relative">
              <button
                type="button"
                onClick={() => onSectionChange(item.id)}
                className={[
                  "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition",
                  active
                    ? "bg-white text-slate-950 shadow-lg"
                    : "text-slate-300 hover:bg-white/5 hover:text-white",
                ].join(" ")}
              >
                <Icon className="size-[18px] flex-shrink-0" />
                <div
                  className="flex flex-1 items-center gap-2 overflow-hidden transition-all duration-300"
                  style={{ width: collapsed ? 0 : 160, opacity: collapsed ? 0 : 1 }}
                >
                  <span className="flex-1 whitespace-nowrap text-sm">{item.label}</span>
                  {count !== "" && count !== undefined && (
                    <span className={active ? "text-slate-500 text-xs" : "text-slate-500 text-xs"}>{count}</span>
                  )}
                </div>
              </button>

              {/* Tooltip when collapsed */}
              {collapsed && (
                <div className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                  {item.label}{count ? ` · ${count}` : ""}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div
        className="overflow-hidden transition-all duration-300 border-t border-white/10"
        style={{ opacity: collapsed ? 0 : 1, maxHeight: collapsed ? 0 : 80 }}
      >
        <p className="px-5 py-4 text-xs text-slate-400">
         Developed by IT Team, RCB
        </p>
      </div>
    </aside>
  )
}

export default Sidebar
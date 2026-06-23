import { useState } from "react"
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  FileText,
  Layers3,
  Package,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react"

const items = [
  { id: "dashboard", label: "Dashboard", icon: Layers3 },
  { id: "assets", label: "Assets", icon: Package },
  { id: "employees", label: "Employee Details", icon: Users },
  { id: "i-note", label: "I-Note", icon: FileText },
  { id: "issue-return", label: "Issue / Return", icon: ArrowLeftRight },
  { id: "users", label: "Users", icon: UserCog, adminOnly: true },
]

function Sidebar({ activeSection, onSectionChange, currentUser, onLogout }) {
  const [collapsed, setCollapsed] = useState(false)
  const displayName = currentUser?.fullName || currentUser?.username || "Admin"
  const roleName = currentUser?.role || "admin"
  const visibleItems = items.filter((item) => !item.adminOnly || currentUser?.role === "admin")
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A"

  return (
    <aside
      style={{ width: collapsed ? 68 : 280, minWidth: collapsed ? 68 : 280 }}
      className="relative flex h-full flex-col border-r border-slate-500/30 bg-slate-700 text-slate-100 transition-all duration-300 overflow-visible z-20"
    >
      {/* Toggle Button */}
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className="absolute -right-3.5 top-6 z-30 flex size-7 items-center justify-center rounded-full border border-white/20 bg-slate-600 text-slate-200 hover:bg-slate-500 hover:text-white transition"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/15 px-3.5 py-5" style={{ minHeight: 80 }}>
        <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15">
          <ShieldCheck className="size-5" />
        </div>
        <div
          className="overflow-hidden transition-all duration-300"
          style={{ width: collapsed ? 0 : 180, opacity: collapsed ? 0 : 1 }}
        >
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300 whitespace-nowrap">Inventory</p>
          <h1 className="text-base font-semibold whitespace-nowrap">Management</h1>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 px-2 py-3">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const active = activeSection === item.id
          return (
            <div key={item.id} className="group relative">
              <button
                type="button"
                onClick={() => onSectionChange(item.id)}
                className={[
                  "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition",
                  active
                    ? "bg-white text-slate-950 shadow-lg"
                    : "text-slate-200 hover:bg-white/10 hover:text-white",
                ].join(" ")}
              >
                <Icon className="size-[18px] flex-shrink-0" />
                <div
                  className="flex flex-1 items-center gap-2 overflow-hidden transition-all duration-300"
                  style={{ width: collapsed ? 0 : 160, opacity: collapsed ? 0 : 1 }}
                >
                  <span className="flex-1 whitespace-nowrap text-sm">{item.label}</span>
                </div>
              </button>

              {/* Tooltip when collapsed */}
              {collapsed && (
                <div className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-lg bg-slate-700 px-2.5 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                  {item.label}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className="border-t border-white/15 p-2">
        {collapsed ? (
          <button
            type="button"
            onClick={onLogout}
            title={`${displayName} - Logout`}
            className="flex size-11 w-full items-center justify-center rounded-2xl bg-white/15 text-sm font-semibold text-white hover:bg-white/20"
          >
            {initials}
          </button>
        ) : (
          <div className="rounded-2xl bg-white/10 p-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white text-sm font-bold text-slate-950">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">{displayName}</div>
                <div className="text-xs uppercase tracking-wide text-slate-300">{roleName}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="mt-3 h-9 w-full rounded-xl border border-white/15 bg-slate-800 text-xs font-semibold text-slate-100 transition hover:bg-white hover:text-slate-950"
            >
              Logout
            </button>
          </div>
        )}
        {!collapsed ? (
          <p className="px-3 pt-3 text-xs text-slate-300">
            Developed by IT Team, RCB
          </p>
        ) : null}
      </div>
    </aside>
  )
}

export default Sidebar

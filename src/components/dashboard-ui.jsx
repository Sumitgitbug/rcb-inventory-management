function ActionButton({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

function StatCard({ label, value, icon }) {
  const Icon = icon
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
        </div>
        <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-900">
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  )
}

function SectionShell({ title, description, action, children }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex-none border-b border-slate-200 px-6 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          {action ? <div className="flex shrink-0">{action}</div> : null}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
    </div>
  )
}

export { ActionButton, SectionShell, StatCard }

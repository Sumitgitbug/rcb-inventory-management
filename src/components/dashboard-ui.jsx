function ActionButton({ children, style = {}, ...props }) {
  return (
    <button
      type="button"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        border: "none",
        borderRadius: "999px",
        padding: "8px 16px",
        fontSize: "14px",
        fontWeight: 500,
        cursor: "pointer",
        transition: "opacity 0.15s",
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  )
}

function StatCard({ label, value, icon }) {
  const Icon = icon
  return (
    <div style={{
      background: "rgba(15, 42, 34, 0.47)",
      border: "1px solid rgba(255, 255, 255, 0.79)",
      borderRadius: "20px",
      padding: "20px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    }}>
      <div>
        <p style={{ color: "rgba(255, 255, 255, 0.79)", fontSize: "13px", marginBottom: "6px" }}>{label}</p>
        <p style={{ color: "#ffffff", fontSize: "32px", fontWeight: 700, lineHeight: 1 }}>{value}</p>
      </div>
      <div style={{
        width: "52px", height: "52px", borderRadius: "14px",
        background: "rgba(255, 255, 255, 0.66)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon style={{ width: "22px", height: "22px", color: "rgba(158, 50, 20, 0.92)" }} />
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
      <div className="flex-1 min-h-0 px-6 py-6">{children}</div>
    </div>
  )
}

export { ActionButton, SectionShell, StatCard }
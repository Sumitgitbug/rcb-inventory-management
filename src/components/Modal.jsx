import { X } from "lucide-react"

function Modal({ open, title, description, onClose, children, widthClass = "max-w-5xl" }) {
  if (!open) return null

  return (
    <div className="fied inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className={`w-full ${widthClass} overflow-hidden rounded-3xl bg-white shadow-2xl`}>
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close modal"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </div>
  )
}

export default Modal

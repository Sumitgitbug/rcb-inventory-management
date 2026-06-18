import { useEffect } from "react"
import { X } from "lucide-react"

function Modal({ open, title, description, onClose, children, widthClass = "max-w-5xl" }) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined

    const previousHtmlOverflow = document.documentElement.style.overflow
    const previousBodyPosition = document.body.style.position
    const previousBodyTop = document.body.style.top
    const previousBodyLeft = document.body.style.left
    const previousBodyRight = document.body.style.right
    const previousBodyWidth = document.body.style.width
    const previousOverflow = document.body.style.overflow
    const scrollY = window.scrollY || window.pageYOffset || 0
    document.documentElement.style.overflow = "hidden"
    document.body.style.position = "fixed"
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = "0"
    document.body.style.right = "0"
    document.body.style.width = "100%"
    document.body.style.overflow = "hidden"
    document.body.classList.add("modal-open")

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow
      document.body.style.position = previousBodyPosition
      document.body.style.top = previousBodyTop
      document.body.style.left = previousBodyLeft
      document.body.style.right = previousBodyRight
      document.body.style.width = previousBodyWidth
      document.body.style.overflow = previousOverflow
      document.body.classList.remove("modal-open")
      window.scrollTo(0, scrollY)
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overscroll-contain">
      <div className={`flex h-[calc(100vh-2rem)] w-full ${widthClass} flex-col overflow-hidden rounded-3xl bg-white shadow-2xl`}>
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6">{children}</div>
      </div>
    </div>
  )
}

export default Modal

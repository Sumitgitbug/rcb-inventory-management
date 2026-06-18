import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function Pagination({ className = "", ...props }) {
  return <nav role="navigation" aria-label="pagination" className={cn("mx-auto flex w-full justify-center", className)} {...props} />
}

function PaginationContent({ className = "", ...props }) {
  return <ul className={cn("flex flex-row items-center gap-1", className)} {...props} />
}

function PaginationItem({ className = "", ...props }) {
  return <li className={cn("", className)} {...props} />
}

function PaginationLink({ isActive = false, className = "", ...props }) {
  return (
    <Button
      variant={isActive ? "outline" : "ghost"}
      size="sm"
      className={cn(
        "rounded-xl px-3 text-sm font-medium",
        isActive && "border-orange-300 bg-orange text-slate-900 shadow-sm hover:bg-orange",
        className,
      )}
      {...props}
    />
  )
}

function PaginationPrevious({ className = "", ...props }) {
  return (
    <PaginationLink
      aria-label="Go to previous page"
      className={cn("gap-1 pl-3 pr-4", className)}
      {...props}
    >
      <ChevronLeft className="size-4" />
      <span>Previous</span>
    </PaginationLink>
  )
}

function PaginationNext({ className = "", ...props }) {
  return (
    <PaginationLink
      aria-label="Go to next page"
      className={cn("gap-1 pl-4 pr-3", className)}
      {...props}
    >
      <span>Next</span>
      <ChevronRight className="size-4" />
    </PaginationLink>
  )
}

function PaginationEllipsis({ className = "", ...props }) {
  return (
    <span className={cn("flex size-9 items-center justify-center", className)} aria-hidden="true" {...props}>
      <MoreHorizontal className="size-4" />
      <span className="sr-only">More pages</span>
    </span>
  )
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
}

"use client"

import { useState, type ReactNode } from "react"
import { BookDemoModal } from "@/components/shared/book-demo-modal"

export function DemoCtaButton({ className, children }: { className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      <BookDemoModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}

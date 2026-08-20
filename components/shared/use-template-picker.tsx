"use client"

import { useEffect, useRef, useState } from "react"
import { IconTemplate, IconChevronDown } from "@tabler/icons-react"

type EmailTemplate = {
  id: string
  name: string
  subject: string
  body: string
}

/** Dropdown that fetches a brand's saved templates and, on selection, calls
 *  the render endpoint (substituting {{name}}/{{handle}} for the given
 *  recipient email) and hands the result to onApply. Used identically from
 *  Inbox compose, Inbox reply, and EmailModal. */
export function UseTemplatePicker({
  brandId,
  recipientEmail,
  onApply,
}: {
  brandId: string | null | undefined
  recipientEmail: string
  onApply: (subject: string, body: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && brandId && templates.length === 0 && !loading) {
      setLoading(true)
      fetch(`/api/brand/${brandId}/templates`)
        .then((r) => r.json())
        .then((data) => setTemplates(data.templates || []))
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }

  const apply = async (template: EmailTemplate) => {
    if (!brandId) return
    setApplyingId(template.id)
    try {
      const url = new URL(`/api/brand/${brandId}/templates/${template.id}/render`, window.location.origin)
      if (recipientEmail) url.searchParams.set("email", recipientEmail)
      const res = await fetch(url.toString())
      const data = await res.json()
      if (res.ok) onApply(data.subject, data.body)
    } finally {
      setApplyingId(null)
      setOpen(false)
    }
  }

  if (!brandId) return null

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
      >
        <IconTemplate size={14} /> Use template <IconChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-64 max-h-64 overflow-y-auto bg-white border border-gray-100 rounded-lg shadow-lg py-1">
          {loading ? (
            <p className="px-3 py-2 text-xs text-gray-400">Loading…</p>
          ) : templates.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400">No templates yet</p>
          ) : (
            templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => apply(t)}
                disabled={applyingId === t.id}
                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 disabled:opacity-50 transition"
              >
                <p className="font-medium text-gray-800 truncate">{t.name}</p>
                <p className="text-gray-400 truncate">{applyingId === t.id ? "Applying…" : t.subject}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

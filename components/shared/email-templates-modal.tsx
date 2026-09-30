"use client"

import { useEffect, useState } from "react"
import { IconX, IconPlus, IconEdit, IconTrash, IconArrowLeft } from "@tabler/icons-react"

type EmailTemplate = {
  id: string
  name: string
  subject: string
  body: string
}

export function EmailTemplatesModal({
  isOpen,
  onClose,
  brandId,
}: {
  isOpen: boolean
  onClose: () => void
  brandId: string | null
}) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<EmailTemplate | "new" | null>(null)
  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!isOpen || !brandId) return
    setLoading(true)
    fetch(`/api/brand/${brandId}/templates`)
      .then((r) => r.json())
      .then((data) => setTemplates(data.templates || []))
      .catch(() => setError("Failed to load templates"))
      .finally(() => setLoading(false))
    setEditing(null)
    setError("")
  }, [isOpen, brandId])

  if (!isOpen) return null

  const openNew = () => {
    setEditing("new")
    setName("")
    setSubject("")
    setBody("")
    setError("")
  }

  const openEdit = (t: EmailTemplate) => {
    setEditing(t)
    setName(t.name)
    setSubject(t.subject)
    setBody(t.body)
    setError("")
  }

  const save = async () => {
    if (!brandId || !name.trim() || !subject.trim() || !body.trim()) {
      setError("Name, subject, and body are all required")
      return
    }
    setSaving(true)
    setError("")
    try {
      const isNew = editing === "new"
      const url = isNew
        ? `/api/brand/${brandId}/templates`
        : `/api/brand/${brandId}/templates/${(editing as EmailTemplate).id}`
      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), subject: subject.trim(), body: body.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to save template")

      setTemplates((prev) =>
        isNew ? [data.template, ...prev] : prev.map((t) => (t.id === data.template.id ? data.template : t))
      )
      setEditing(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save template")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!brandId) return
    setTemplates((prev) => prev.filter((t) => t.id !== id))
    try {
      await fetch(`/api/brand/${brandId}/templates/${id}`, { method: "DELETE" })
    } catch {
      // Best-effort — a failed delete just means it reappears on next open.
    }
  }

  const isFormView = editing !== null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-[480px] max-w-[90vw] max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {isFormView && (
              <button
                onClick={() => setEditing(null)}
                className="p-1 -ml-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                <IconArrowLeft size={18} />
              </button>
            )}
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                {isFormView ? (editing === "new" ? "New Template" : "Edit Template") : "Email Templates"}
              </h3>
              {!isFormView && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {templates.length} {templates.length === 1 ? "template" : "templates"}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
            <IconX size={18} />
          </button>
        </div>

        {isFormView ? (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Initial Outreach 1"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. {{handle}}, your audience will love this!"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                placeholder="Hi {{name}}, ..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none transition resize-none"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Use <code className="bg-gray-100 px-1 rounded">{"{{name}}"}</code> and{" "}
                <code className="bg-gray-100 px-1 rounded">{"{{handle}}"}</code> — filled in automatically with the
                recipient&apos;s real name and social handle when you use the template.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto min-h-0 px-5 py-3">
            {loading ? (
              <p className="text-center text-sm text-gray-400 py-8">Loading…</p>
            ) : templates.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-sm text-gray-400">No templates yet</p>
                <p className="text-xs text-gray-300 mt-1">Add one to get started</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {templates.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 group px-2.5 py-2.5 rounded-lg hover:bg-gray-50 transition">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{t.name}</p>
                      <p className="text-xs text-gray-400 truncate">{t.subject}</p>
                    </div>
                    <button
                      onClick={() => openEdit(t)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md opacity-0 group-hover:opacity-100 transition"
                    >
                      <IconEdit size={14} />
                    </button>
                    <button
                      onClick={() => remove(t.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition"
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
          {isFormView ? (
            <>
              <button onClick={() => setEditing(null)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          ) : (
            <button
              onClick={openNew}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition"
            >
              <IconPlus size={15} /> New Template
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

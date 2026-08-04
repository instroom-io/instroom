"use client"

import { useEffect, useState, useCallback } from "react"
import { IconSearch } from "@tabler/icons-react"

interface AdminCampaign {
  id: string
  name: string
  brandName: string
  budget: number | null
  status: string
  createdAt: string
}

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  active: "bg-green-100 text-green-700",
  closed: "bg-blue-100 text-blue-700",
  archived: "bg-gray-200 text-gray-500",
}

export default function AdminCampaignsPage() {
  const [rows, setRows] = useState<AdminCampaign[]>([])
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editing, setEditing] = useState<AdminCampaign | null>(null)
  const [editName, setEditName] = useState("")
  const [editBudget, setEditBudget] = useState("")

  const load = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/campaigns${query ? `?q=${encodeURIComponent(query)}` : ""}`)
      const json = await res.json()
      setRows(json.campaigns || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load("") }, [load])
  useEffect(() => {
    const t = setTimeout(() => load(q), 300)
    return () => clearTimeout(t)
  }, [q, load])

  const applyStatus = async (id: string, action: "close" | "archive") => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        const { campaign } = await res.json()
        setRows((prev) => prev.map((c) => (c.id === id ? { ...c, status: campaign.status } : c)))
      }
    } finally {
      setBusyId(null)
    }
  }

  const openEdit = (c: AdminCampaign) => {
    setEditing(c)
    setEditName(c.name)
    setEditBudget(c.budget != null ? String(c.budget) : "")
  }

  const saveEdit = async () => {
    if (!editing) return
    setBusyId(editing.id)
    try {
      const res = await fetch(`/api/admin/campaigns/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, budget: editBudget ? Number(editBudget) : undefined }),
      })
      if (res.ok) {
        const { campaign } = await res.json()
        setRows((prev) => prev.map((c) => (c.id === editing.id ? { ...c, name: campaign.name, budget: campaign.budget != null ? Number(campaign.budget) : null } : c)))
        setEditing(null)
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-gray-500">View all campaigns across the platform</p>
      </div>

      <div className="relative max-w-xs">
        <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search campaigns…"
          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#1FAE5B]/40 focus:border-[#1FAE5B]"
        />
      </div>

      <div className="bg-white border border-[#0F6B3E]/10 rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Campaign Name", "Brand", "Budget", "Status", "Created Date", ""].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 font-semibold text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">No campaigns found.</td></tr>
            ) : rows.map((c) => (
              <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50/60">
                <td className="px-4 py-2.5 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-2.5 text-gray-600">{c.brandName}</td>
                <td className="px-4 py-2.5 text-gray-700">{c.budget != null ? `$${c.budget.toLocaleString()}` : "—"}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[c.status] || "bg-gray-100 text-gray-600"}`}>
                    {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{new Date(c.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => openEdit(c)} className="text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50">Edit</button>
                    {c.status !== "closed" && c.status !== "archived" && (
                      <button disabled={busyId === c.id} onClick={() => applyStatus(c.id, "close")} className="text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50">Close</button>
                    )}
                    {c.status !== "archived" && (
                      <button disabled={busyId === c.id} onClick={() => applyStatus(c.id, "archive")} className="text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50">Archive</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-xl shadow-xl w-[420px] max-w-[92vw] max-h-[90svh] overflow-y-auto p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-4">Edit Campaign</h3>
            <label className="text-xs font-medium text-gray-500">Campaign Name</label>
            <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full mt-1 mb-3 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#1FAE5B]/40 focus:border-[#1FAE5B]" />
            <label className="text-xs font-medium text-gray-500">Budget</label>
            <input type="number" value={editBudget} onChange={(e) => setEditBudget(e.target.value)} className="w-full mt-1 mb-4 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#1FAE5B]/40 focus:border-[#1FAE5B]" />
            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className="flex-1 text-sm font-medium py-2 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
              <button disabled={busyId === editing.id} onClick={saveEdit} className="flex-1 text-sm font-medium py-2 rounded-lg bg-[#1FAE5B] text-white hover:bg-[#178a48] disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

"use client"

import { useEffect, useState, useCallback } from "react"
import { IconSearch, IconDownload } from "@tabler/icons-react"

interface EarlyAccessUser {
  id: string
  name: string | null
  email: string
  role: string | null
  invited_at: string | null
  created_at: string
}

export default function AdminEarlyAccessPage() {
  const [rows, setRows] = useState<EarlyAccessUser[]>([])
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/early-access${query ? `?q=${encodeURIComponent(query)}` : ""}`)
      const json = await res.json()
      setRows(json.users || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load("") }, [load])
  useEffect(() => {
    const t = setTimeout(() => load(q), 300)
    return () => clearTimeout(t)
  }, [q, load])

  const exportCsv = () => {
    window.location.href = `/api/admin/early-access?format=csv${q ? `&q=${encodeURIComponent(q)}` : ""}`
  }

  const approve = async (id: string) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/early-access/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      })
      if (res.ok) {
        const { signup } = await res.json()
        setRows((prev) => prev.map((x) => (x.id === id ? { ...x, invited_at: signup.invited_at } : x)))
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Early Access Signups</h1>
        <p className="text-sm text-gray-500 mt-0.5">People who requested early access via the waitlist</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <button onClick={exportCsv} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">
          <IconDownload size={14} /> Export CSV
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Name", "Email", "Role", "Registration Date", "Status"].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 font-semibold text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">No early access signups found.</td></tr>
            ) : rows.map((u) => (
              <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50/60">
                <td className="px-4 py-2.5 font-medium text-gray-900">{u.name || "—"}</td>
                <td className="px-4 py-2.5 text-gray-600">{u.email}</td>
                <td className="px-4 py-2.5 text-gray-600">{u.role || "—"}</td>
                <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {u.invited_at ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                      Approved
                    </span>
                  ) : (
                    <button
                      disabled={busyId === u.id}
                      onClick={() => approve(u.id)}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg bg-[#1FAE5B] text-white hover:bg-[#178a48] disabled:opacity-50"
                    >
                      {busyId === u.id ? "Approving…" : "Approve"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

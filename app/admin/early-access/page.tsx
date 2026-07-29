"use client"

import { useEffect, useState, useCallback } from "react"
import { IconSearch, IconDownload } from "@tabler/icons-react"

interface EarlyAccessUser {
  name: string | null
  email: string
  created_at: string
}

export default function AdminEarlyAccessPage() {
  const [rows, setRows] = useState<EarlyAccessUser[]>([])
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Early Access Users</h1>
        <p className="text-sm text-gray-500 mt-0.5">Users who joined during the Early Access phase</p>
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
              {["Name", "Email", "Registration Date"].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 font-semibold text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="text-center py-8 text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={3} className="text-center py-8 text-gray-400">No early access users found.</td></tr>
            ) : rows.map((u, i) => (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50/60">
                <td className="px-4 py-2.5 font-medium text-gray-900">{u.name || "—"}</td>
                <td className="px-4 py-2.5 text-gray-600">{u.email}</td>
                <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

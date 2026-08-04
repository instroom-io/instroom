"use client"

import { useEffect, useState } from "react"

interface AuditLog {
  id: string
  admin_email: string
  action: string
  target_type: string
  target_id: string | null
  target_label: string | null
  created_at: string
}

function actionLabel(action: string): string {
  return action
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/audit-logs")
      .then((r) => r.json())
      .then((json) => setLogs(json.logs || []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-gray-500">Every administrator action, most recent first</p>
      </div>

      <div className="bg-white border border-[#0F6B3E]/10 rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Action", "Target", "Admin", "Date & Time"].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 font-semibold text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-8 text-gray-400">Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-gray-400">No admin actions recorded yet.</td></tr>
            ) : logs.map((l) => (
              <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50/60">
                <td className="px-4 py-2.5 font-medium text-gray-900">{actionLabel(l.action)}</td>
                <td className="px-4 py-2.5 text-gray-600">
                  {l.target_label || l.target_id || "—"}
                  <span className="text-xs text-gray-400 ml-1.5">({l.target_type})</span>
                </td>
                <td className="px-4 py-2.5 text-gray-500">{l.admin_email}</td>
                <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

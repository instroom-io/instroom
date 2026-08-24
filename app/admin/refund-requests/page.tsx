"use client"

import { useCallback, useState } from "react"
import { useCachedFetch } from "@/lib/data-cache"

interface RefundRequestRow {
  id: string
  user: { id?: string; email: string; name: string | null }
  amount: number
  currency: string
  plan_name: string | null
  reason: string
  status: "pending" | "approved" | "denied"
  admin_notes: string | null
  decided_by: string | null
  decided_at: string | null
  created_at: string
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  denied: "bg-gray-100 text-gray-600 border-gray-200",
}

export default function AdminRefundRequestsPage() {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [denyingId, setDenyingId] = useState<string | null>(null)
  const [denyNotes, setDenyNotes] = useState("")

  const url = "/api/admin/refund-requests"

  const fetchRequests = useCallback(async () => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to load refund requests (${res.status})`)
    return (await res.json()) as { requests?: RefundRequestRow[] }
  }, [])

  const { data, isLoading: loading, mutate } = useCachedFetch(url, fetchRequests)
  const rows = data?.requests ?? []

  const setRows = useCallback(
    (updater: (prev: RefundRequestRow[]) => RefundRequestRow[]) => {
      mutate({ requests: updater(rows) })
    },
    [mutate, rows]
  )

  const decide = async (id: string, action: "approve" | "deny", adminNotes?: string) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/refund-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, adminNotes }),
      })
      if (res.ok) {
        const { refundRequest } = await res.json()
        setRows((prev) => prev.map((x) => (x.id === id ? { ...x, ...refundRequest } : x)))
      }
    } finally {
      setBusyId(null)
      setDenyingId(null)
      setDenyNotes("")
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-gray-500">In-app refund requests from first-time subscribers within their 7-day window</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5 text-sm text-amber-800">
        <strong>Approving a request here does not refund the customer.</strong> It only marks the request as
        approved and notifies them. You must still process the refund manually in the Lemon Squeezy dashboard.
      </div>

      <div className="bg-white border border-[#0F6B3E]/10 rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["User", "Amount", "Plan", "Requested", "Reason", "Status", ""].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 font-semibold text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">No refund requests found.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/60 align-top">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-gray-900">{r.user.name || "—"}</div>
                  <div className="text-gray-500">{r.user.email}</div>
                </td>
                <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{r.amount} {r.currency}</td>
                <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{r.plan_name || "—"}</td>
                <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-2.5 text-gray-600 max-w-xs">
                  <span className="line-clamp-3" title={r.reason}>{r.reason}</span>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_STYLE[r.status]}`}>
                    {r.status}
                  </span>
                  {r.status !== "pending" && r.decided_by && (
                    <div className="text-xs text-gray-400 mt-1 whitespace-nowrap">
                      by {r.decided_by}{r.decided_at ? ` · ${new Date(r.decided_at).toLocaleDateString()}` : ""}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {r.status !== "pending" ? null : denyingId === r.id ? (
                    <div className="flex flex-col gap-1.5 min-w-[200px]">
                      <textarea
                        value={denyNotes}
                        onChange={(e) => setDenyNotes(e.target.value)}
                        placeholder="Reason for denial (optional, internal only)"
                        rows={2}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-[#1FAE5B]/30"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          disabled={busyId === r.id}
                          onClick={() => decide(r.id, "deny", denyNotes)}
                          className="text-xs font-medium px-2.5 py-1 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {busyId === r.id ? "Denying…" : "Confirm deny"}
                        </button>
                        <button onClick={() => { setDenyingId(null); setDenyNotes("") }} className="text-xs font-medium px-2.5 py-1 rounded-xl border border-gray-200 hover:bg-gray-50">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        disabled={busyId === r.id}
                        onClick={() => decide(r.id, "approve")}
                        className="text-xs font-medium px-2.5 py-1 rounded-xl bg-[#1FAE5B] text-white hover:bg-[#178a48] disabled:opacity-50"
                      >
                        {busyId === r.id ? "Approving…" : "Approve"}
                      </button>
                      <button
                        disabled={busyId === r.id}
                        onClick={() => setDenyingId(r.id)}
                        className="text-xs font-medium px-2.5 py-1 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Deny
                      </button>
                    </div>
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

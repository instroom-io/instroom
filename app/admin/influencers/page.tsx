"use client"

import { useEffect, useState, useCallback } from "react"
import { IconSearch } from "@tabler/icons-react"

interface AdminInfluencer {
  id: string
  handle: string
  fullName: string | null
  platform: string
  profileImageUrl: string | null
  followerCount: number
  category: string | null
  verificationStatus: string
  isSuspended: boolean
  campaignCount: number
  createdAt: string
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K"
  return String(n)
}

export default function AdminInfluencersPage() {
  const [rows, setRows] = useState<AdminInfluencer[]>([])
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [viewInf, setViewInf] = useState<AdminInfluencer | null>(null)

  const load = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/influencers${query ? `?q=${encodeURIComponent(query)}` : ""}`)
      const json = await res.json()
      setRows(json.influencers || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load("") }, [load])
  useEffect(() => {
    const t = setTimeout(() => load(q), 300)
    return () => clearTimeout(t)
  }, [q, load])

  const act = async (id: string, action: "approve" | "reject" | "suspend" | "reactivate") => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/influencers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        const { influencer } = await res.json()
        setRows((prev) => prev.map((x) => (x.id === id ? { ...x, verificationStatus: influencer.verification_status, isSuspended: influencer.is_suspended } : x)))
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Influencer Management</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage influencer accounts</p>
      </div>

      <div className="relative max-w-xs">
        <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search by handle or name…"
          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Influencer", "Followers", "Category", "Verification Status", "Campaign Count", ""].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 font-semibold text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">No influencers found.</td></tr>
            ) : rows.map((inf) => (
              <tr key={inf.id} className={`border-b border-gray-100 hover:bg-gray-50/60 ${inf.isSuspended ? "opacity-60" : ""}`}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    {inf.profileImageUrl
                      ? <img src={inf.profileImageUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                      : <div className="w-7 h-7 rounded-full bg-[#1FAE5B]/15 text-[#0F6B3E] flex items-center justify-center text-xs font-semibold">{(inf.fullName || inf.handle).charAt(0).toUpperCase()}</div>}
                    <div>
                      <div className="font-medium text-gray-900">{inf.fullName || inf.handle}</div>
                      <div className="text-xs text-gray-500">@{inf.handle} · {inf.platform}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-gray-700">{formatFollowers(inf.followerCount)}</td>
                <td className="px-4 py-2.5 text-gray-600">{inf.category || "—"}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    inf.verificationStatus === "verified" ? "bg-green-100 text-green-700"
                      : inf.verificationStatus === "rejected" ? "bg-red-100 text-red-600"
                      : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {inf.verificationStatus.charAt(0).toUpperCase() + inf.verificationStatus.slice(1)}
                  </span>
                  {inf.isSuspended && <span className="ml-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">Suspended</span>}
                </td>
                <td className="px-4 py-2.5 text-gray-700">{inf.campaignCount}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => setViewInf(inf)} className="text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50">View</button>
                    {inf.verificationStatus !== "verified" && (
                      <button disabled={busyId === inf.id} onClick={() => act(inf.id, "approve")} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-[#1FAE5B] text-white hover:bg-[#178a48] disabled:opacity-50">Approve</button>
                    )}
                    {inf.verificationStatus !== "rejected" && (
                      <button disabled={busyId === inf.id} onClick={() => act(inf.id, "reject")} className="text-xs font-medium px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50">Reject</button>
                    )}
                    <button disabled={busyId === inf.id} onClick={() => act(inf.id, inf.isSuspended ? "reactivate" : "suspend")} className="text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50">
                      {inf.isSuspended ? "Reactivate" : "Suspend"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewInf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setViewInf(null)}>
          <div className="bg-white rounded-xl shadow-xl w-[420px] max-w-[92vw] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              {viewInf.profileImageUrl
                ? <img src={viewInf.profileImageUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
                : <div className="w-12 h-12 rounded-full bg-[#1FAE5B]/15 text-[#0F6B3E] flex items-center justify-center text-lg font-semibold">{(viewInf.fullName || viewInf.handle).charAt(0).toUpperCase()}</div>}
              <div>
                <div className="font-semibold text-gray-900">{viewInf.fullName || viewInf.handle}</div>
                <div className="text-sm text-gray-500">@{viewInf.handle} · {viewInf.platform}</div>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-gray-400 text-xs uppercase">Followers</dt><dd className="text-gray-800">{formatFollowers(viewInf.followerCount)}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase">Category</dt><dd className="text-gray-800">{viewInf.category || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase">Verification</dt><dd className="text-gray-800 capitalize">{viewInf.verificationStatus}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase">Campaigns</dt><dd className="text-gray-800">{viewInf.campaignCount}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase">Added</dt><dd className="text-gray-800">{new Date(viewInf.createdAt).toLocaleDateString()}</dd></div>
            </dl>
            <button onClick={() => setViewInf(null)} className="mt-5 w-full text-sm font-medium py-2 rounded-lg border border-gray-200 hover:bg-gray-50">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

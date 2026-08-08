"use client"

import { useEffect, useState, useCallback } from "react"
import { IconSearch } from "@tabler/icons-react"

interface AdminUser {
  id: string
  name: string | null
  email: string
  image: string | null
  platform_role: string
  is_active: boolean
  created_at: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [viewUser, setViewUser] = useState<AdminUser | null>(null)

  const load = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users${query ? `?q=${encodeURIComponent(query)}` : ""}`)
      const json = await res.json()
      setUsers(json.users || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load("") }, [load])
  useEffect(() => {
    const t = setTimeout(() => load(q), 300)
    return () => clearTimeout(t)
  }, [q, load])

  const toggleSuspend = async (u: AdminUser) => {
    setBusyId(u.id)
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: u.is_active ? "suspend" : "reactivate" }),
      })
      if (res.ok) {
        setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_active: !x.is_active } : x)))
      }
    } finally {
      setBusyId(null)
    }
  }

  const deleteUser = async (id: string) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" })
      if (res.ok) setUsers((prev) => prev.filter((x) => x.id !== id))
    } finally {
      setBusyId(null)
      setConfirmDeleteId(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-gray-500">Manage all registered users</p>
      </div>

      <div className="relative max-w-xs">
        <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#1FAE5B]/40 focus:border-[#1FAE5B]"
        />
      </div>

      <div className="bg-white border border-[#0F6B3E]/10 rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Profile", "Name", "Email", "Account Type", "Status", "Join Date", ""].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 font-semibold text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">No users found.</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50/60">
                <td className="px-4 py-2.5">
                  {u.image
                    ? <img src={u.image} alt="" className="w-7 h-7 rounded-full object-cover" />
                    : <div className="w-7 h-7 rounded-full bg-[#1FAE5B]/15 text-[#0F6B3E] flex items-center justify-center text-xs font-semibold">{(u.name || u.email).charAt(0).toUpperCase()}</div>}
                </td>
                <td className="px-4 py-2.5 font-medium text-gray-900">{u.name || "—"}</td>
                <td className="px-4 py-2.5 text-gray-600">{u.email}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.platform_role === "admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
                    {u.platform_role === "admin" ? "Admin" : "User"}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                    {u.is_active ? "Active" : "Suspended"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => setViewUser(u)} className="text-xs font-medium px-2.5 py-1 rounded-xl border border-gray-200 hover:bg-gray-50">View</button>
                  {u.platform_role !== "admin" && (
                    <>
                      <button
                        disabled={busyId === u.id}
                        onClick={() => toggleSuspend(u)}
                        className="text-xs font-medium px-2.5 py-1 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {u.is_active ? "Suspend" : "Reactivate"}
                      </button>
                      {confirmDeleteId === u.id ? (
                        <>
                          <button disabled={busyId === u.id} onClick={() => deleteUser(u.id)} className="text-xs font-medium px-2.5 py-1 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">Confirm</button>
                          <button onClick={() => setConfirmDeleteId(null)} className="text-xs font-medium px-2.5 py-1 rounded-xl border border-gray-200 hover:bg-gray-50">Cancel</button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(u.id)} className="text-xs font-medium px-2.5 py-1 rounded-xl border border-red-200 text-red-600 hover:bg-red-50">Delete</button>
                      )}
                    </>
                  )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setViewUser(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-[420px] max-w-[92vw] max-h-[90svh] overflow-y-auto p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              {viewUser.image
                ? <img src={viewUser.image} alt="" className="w-12 h-12 rounded-full object-cover" />
                : <div className="w-12 h-12 rounded-full bg-[#1FAE5B]/15 text-[#0F6B3E] flex items-center justify-center text-lg font-semibold">{(viewUser.name || viewUser.email).charAt(0).toUpperCase()}</div>}
              <div>
                <div className="font-semibold text-gray-900">{viewUser.name || "—"}</div>
                <div className="text-sm text-gray-500">{viewUser.email}</div>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-gray-400 text-xs uppercase">Account Type</dt><dd className="text-gray-800">{viewUser.platform_role === "admin" ? "Admin" : "User"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase">Status</dt><dd className="text-gray-800">{viewUser.is_active ? "Active" : "Suspended"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase">Join Date</dt><dd className="text-gray-800">{new Date(viewUser.created_at).toLocaleDateString()}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase">User ID</dt><dd className="text-gray-800 truncate" title={viewUser.id}>{viewUser.id}</dd></div>
            </dl>
            <button onClick={() => setViewUser(null)} className="mt-5 w-full text-sm font-medium py-2 rounded-xl border border-gray-200 hover:bg-gray-50">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

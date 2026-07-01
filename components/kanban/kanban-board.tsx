"use client"

import { useState, useEffect } from "react"
import {
  IconLayoutKanban,
  IconList,
  IconSearch,
  IconPlus,
  IconAlertCircle
} from "@tabler/icons-react"

type Campaign = {
  id: string
  name: string
  status: string
  influencers?: unknown[]
}

type Influencer = {
  id: string
  name: string
  handle: string
  followers: string
  status: string
}

const columns = [
  { key: "prospects", title: "Prospects", color: "bg-yellow-400" },
  { key: "reached", title: "Reached Out", color: "bg-orange-400" },
  { key: "conversation", title: "In Conversation", color: "bg-blue-400" },
  { key: "onboarded", title: "Onboarded", color: "bg-[#1FAE5B]" },
  { key: "rejected", title: "Rejected", color: "bg-red-500" },
]

interface KanbanBoardProps {
  brandId: string
}

export default function KanbanBoard({ brandId }: KanbanBoardProps) {
  const [view, setView] = useState<"kanban" | "list">("kanban")
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [limitError, setLimitError] = useState<{ message: string; current: number; max: number } | null>(null)
  const [search, setSearch] = useState("")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newCampaignName, setNewCampaignName] = useState("")
  const [creating, setCreating] = useState(false)

  // Fetch campaigns from API
  useEffect(() => {
    async function fetchCampaigns() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/brand/${brandId}/campaigns`)
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || "Failed to fetch campaigns")
          return
        }

        setCampaigns(data.campaigns || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }

    if (brandId) {
      fetchCampaigns()
    }
  }, [brandId])

  // Create new campaign
  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) return

    try {
      setCreating(true)
      setError(null)
      setLimitError(null)
      const res = await fetch(`/api/brand/${brandId}/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCampaignName.trim(),
          status: "active"
        })
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 403) {
          // Limit exceeded - show upgrade prompt
          setLimitError({
            message: data.error,
            current: data.current,
            max: data.max
          })
          // Close the create modal
          setShowCreateModal(false)
        } else {
          setError(data.error || "Failed to create campaign")
        }
        return
      }

      // Add new campaign to list
      setCampaigns([...campaigns, data.campaign])
      setNewCampaignName("")
      setShowCreateModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="h-8 w-8 rounded-full border-2 border-[#1FAE5B] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading campaigns...</p>
        </div>
      </div>
    )
  }

  // Mock data mapped to campaigns (for display purposes)
  const mockInfluencers: Influencer[] = [
    { id: "1", name: "Marisha Nicole", handle: "@luxe_liftin", followers: "56.6k", status: "prospects" },
    { id: "2", name: "Emma Murray", handle: "@emmabrah", followers: "35.1k", status: "prospects" },
    { id: "3", name: "Shaquille", handle: "@shaquille", followers: "13k", status: "reached" },
    { id: "4", name: "Audrey", handle: "@bestie_audrey", followers: "44.8k", status: "conversation" },
    { id: "5", name: "Flo", handle: "@theblended", followers: "14k", status: "onboarded" },
    { id: "6", name: "John Merola", handle: "@johnmerola", followers: "47.2k", status: "rejected" },
  ]

  const filtered = mockInfluencers.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.handle.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-4 p-6">

      {/* LIMIT EXCEEDED UPGRADE PROMPT */}
      {limitError && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-yellow-50 mx-auto mb-4">
              <IconAlertCircle size={24} className="text-yellow-600" />
            </div>
            <h2 className="text-xl font-bold text-center mb-2">Campaign Limit Reached</h2>
            <p className="text-center text-gray-600 text-sm mb-4">
              You've reached your campaign limit ({limitError.current}/{limitError.max}).
            </p>
            <p className="text-center text-gray-700 text-sm font-medium mb-6">
              {limitError.message}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setLimitError(null)
                  setShowCreateModal(false)
                }}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <a
                href="/pricing"
                className="flex-1 px-4 py-2 bg-[#1FAE5B] text-white rounded-lg text-sm font-medium hover:bg-[#0F6B3E] transition text-center"
              >
                Upgrade Plan
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ERROR MESSAGE */}
      {error && (
        <div className="flex gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <IconAlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="text-xs text-red-600 hover:underline mt-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex items-center justify-between">

        {/* SEARCH */}
        <div className="relative w-full max-w-md">

          <IconSearch
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search influencer..."
            className="w-full pl-9 pr-3 h-10 border border-[#0F6B3E]/20 rounded-lg outline-none focus:ring-2 focus:ring-[#1FAE5B]"
          />

        </div>

        {/* ACTIONS */}
        <div className="flex gap-2">

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-2 rounded-lg text-sm flex items-center gap-2 bg-[#1FAE5B] text-white hover:bg-[#0F6B3E] transition"
          >
            <IconPlus size={16} />
            New Campaign
          </button>

          {/* VIEW SWITCH */}
          <div className="flex gap-2">
            <button
              onClick={() => setView("kanban")}
              className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 ${
                view === "kanban"
                  ? "bg-[#1FAE5B] text-white"
                  : "border border-[#0F6B3E]/20"
              }`}
            >
              <IconLayoutKanban size={16}/>
              Kanban
            </button>

            <button
              onClick={() => setView("list")}
              className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 ${
                view === "list"
                  ? "bg-[#1FAE5B] text-white"
                  : "border border-[#0F6B3E]/20"
              }`}
            >
              <IconList size={16}/>
              List
            </button>
          </div>

        </div>

      </div>

      {/* CREATE CAMPAIGN MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold mb-4">Create New Campaign</h2>
            <input
              type="text"
              value={newCampaignName}
              onChange={(e) => setNewCampaignName(e.target.value)}
              placeholder="Campaign name..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg mb-4 outline-none focus:ring-2 focus:ring-[#1FAE5B]"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateCampaign()
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setNewCampaignName("")
                  setError(null)
                }}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCampaign}
                disabled={creating || !newCampaignName.trim()}
                className="flex-1 px-4 py-2 bg-[#1FAE5B] text-white rounded-lg text-sm font-medium hover:bg-[#0F6B3E] disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KANBAN */}
      {view === "kanban" && (

        <div className="rounded-xl border border-[#0F6B3E]/10 bg-white p-5">

          <div className="grid grid-cols-5 gap-4">

            {columns.map((col) => {

              const items = filtered.filter(
                (i) => i.status === col.key
              )

              return (

                <div key={col.key} className="flex flex-col gap-3">

                  {/* COLUMN HEADER */}
                  <div className={`${col.color} text-white rounded-lg px-3 py-2 text-sm font-semibold flex justify-between`}>
                    <span>{items.length} {col.title}</span>
                  </div>

                  {/* CARDS */}
                  {items.map((inf) => (

                    <div
                      key={inf.id}
                      className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:shadow-sm"
                    >

                      <div className="flex items-center gap-3">

                        <div className="w-9 h-9 rounded-full bg-[#1FAE5B]/20 flex items-center justify-center text-[#0F6B3E] font-semibold text-sm">
                          {inf.name.charAt(0)}
                        </div>

                        <div className="flex flex-col text-sm">
                          <span className="font-medium">{inf.name}</span>
                          <span className="text-xs text-gray-500">{inf.handle}</span>
                          <span className="text-xs text-gray-400">👥 {inf.followers}</span>
                        </div>

                      </div>

                    </div>

                  ))}

                  {/* DROP AREA */}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-sm text-gray-500 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition">
                    <span>Drop Here</span>
                    <IconPlus size={16} />
                  </div>

                </div>

              )

            })}

          </div>

        </div>

      )}

      {/* LIST VIEW */}
      {view === "list" && (

        <div className="bg-white border rounded-xl overflow-hidden">

          <table className="w-full text-sm">

            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">Influencer</th>
                <th className="px-4 py-3 text-left">Handle</th>
                <th className="px-4 py-3 text-left">Followers</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>

            <tbody>

              {filtered.map((inf) => (

                <tr key={inf.id} className="border-t hover:bg-gray-50">

                  <td className="px-4 py-3 flex items-center gap-3">

                    <div className="w-9 h-9 rounded-full bg-[#1FAE5B]/20 flex items-center justify-center font-semibold text-[#0F6B3E]">
                      {inf.name.charAt(0)}
                    </div>

                    {inf.name}

                  </td>

                  <td className="px-4 py-3 text-gray-600">
                    {inf.handle}
                  </td>

                  <td className="px-4 py-3">
                    {inf.followers}
                  </td>

                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded text-xs bg-[#1FAE5B]/15 text-[#0F6B3E]">
                      {inf.status}
                    </span>
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      )}

    </div>
  )
}
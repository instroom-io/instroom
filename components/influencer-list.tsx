"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { IconSearch, IconTrash } from "@tabler/icons-react"

export default function InfluencerList() {
  const [showFilter, setShowFilter] = useState(false)

  const mockData = [
    { username: "https://www.a", followers: "3K", eng: "1.5%", status: "For Outreach" },
    { username: "https://www.b", followers: "5K", eng: "2.3%", status: "For Outreach" },
    { username: "https://www.c", followers: "10K", eng: "3.1%", status: "For Outreach" },
    { username: "https://www.d", followers: "1.2K", eng: "0.9%", status: "For Outreach" },
    { username: "https://www.e", followers: "7.8K", eng: "4.5%", status: "For Outreach" },
  ]

  return (
    <div className="min-h-screen">

      <div className="p-6 flex flex-col gap-6">

        {/* HEADER */}
        <div className="flex items-center justify-between gap-6 flex-wrap">

          {/* SEARCH */}
          <div className="flex-1 min-w-[320px] max-w-[650px] relative">

            <IconSearch
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <Input
              placeholder="Search influencer"
              className="pl-9 h-10 w-full border-[#0F6B3E]/20 focus-visible:ring-[#1FAE5B]"
            />

          </div>

          {/* ACTION BUTTONS */}
          <div className="flex items-center gap-2 flex-wrap">

            <button className="bg-[#1FAE5B] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#0F6B3E] transition">
              + New Influencer
            </button>

            <button className="border border-[#0F6B3E]/30 px-4 py-2 rounded-lg text-sm hover:bg-[#0F6B3E]/10">
              Import
            </button>

            <button className="border border-[#0F6B3E]/30 px-4 py-2 rounded-lg text-sm hover:bg-[#0F6B3E]/10">
              Export
            </button>

            <button
              onClick={() => setShowFilter(!showFilter)}
              className="border border-[#0F6B3E]/30 px-4 py-2 rounded-lg text-sm hover:bg-[#0F6B3E]/10"
            >
              Filter
            </button>

          </div>

        </div>

        {/* BULK ACTIONS */}
        <div className="flex justify-end gap-2 text-sm">

          <button className="border border-[#0F6B3E]/20 px-3 py-1 rounded hover:bg-[#0F6B3E]/10">
            Add to Pipeline
          </button>

          <button className="border border-red-300 px-3 py-1 rounded text-red-500 hover:bg-red-50">
            Remove
          </button>

        </div>

        {/* TABLE */}
        <div className="border border-[#0F6B3E]/10 rounded-xl overflow-hidden">

          <table className="w-full text-sm">

            <thead className="border-b border-[#0F6B3E]/10 text-[#1E1E1E]">
              <tr>
                <th className="px-3 py-2"></th>
                <th className="px-3 py-2">Profile</th>
                <th className="px-3 py-2">Username</th>
                <th className="px-3 py-2">Followers</th>
                <th className="px-3 py-2">ENG</th>
                <th className="px-3 py-2">Avg Views</th>
                <th className="px-3 py-2">GMV</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>

            <tbody>
              {mockData.map((item, index) => (
                <tr
                  key={index}
                  className="border-t border-[#0F6B3E]/10 hover:bg-[#0F6B3E]/5 transition"
                >

                  <td className="px-3 py-2">
                    <input type="checkbox" />
                  </td>

                  <td className="px-3 py-2">
                    <div className="w-9 h-9 rounded-full bg-[#1FAE5B]/20" />
                  </td>

                  <td className="px-3 py-2 text-[#0F6B3E] font-medium">
                    {item.username}
                  </td>

                  <td className="px-3 py-2">{item.followers}</td>

                  <td className="px-3 py-2">{item.eng}</td>

                  <td className="px-3 py-2">—</td>

                  <td className="px-3 py-2">$</td>

                  <td className="px-3 py-2">
                    <span className="bg-[#1FAE5B]/15 text-[#0F6B3E] px-2 py-[2px] rounded-md text-[11px] font-medium">
                      {item.status}
                    </span>
                  </td>

                  <td className="px-3 py-2">
                    <div className="w-7 h-7 rounded-full bg-[#1FAE5B]/20" />
                  </td>

                  <td className="px-3 py-2">
                    <button className="p-1 rounded hover:bg-red-50 text-red-500">
                      <IconTrash size={16} />
                    </button>
                  </td>

                </tr>
              ))}
            </tbody>

          </table>

        </div>

        {/* PAGINATION */}
        <div className="flex justify-between items-center text-sm text-[#1E1E1E]/70">

          <div className="flex items-center gap-2">
            Result per page
            <select className="border border-[#0F6B3E]/20 rounded px-2 py-1">
              <option>25</option>
              <option>50</option>
              <option>100</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            Showing 1 - 25 out of 1

            <button className="border border-[#0F6B3E]/20 px-2 py-1 rounded hover:bg-[#0F6B3E]/10">
              ◀
            </button>

            <button className="border border-[#0F6B3E]/20 px-2 py-1 rounded hover:bg-[#0F6B3E]/10">
              ▶
            </button>
          </div>

        </div>

      </div>

    </div>
  )
}
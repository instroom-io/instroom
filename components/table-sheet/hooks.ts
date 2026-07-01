"use client"
// table-sheet/hooks.ts
// useInfluencerAPI — fetch influencer data from Instroom API
// useToast          — toast notification state

import { useState, useCallback } from "react"
import type { InfluencerRow } from "./types"
import type { ToastNotification } from "./types"
import { parseFormattedNumber, cleanHandle, getProfileUrl } from "./utils"

// ── Instroom API ──────────────────────────────────────────────────────────────

const INSTROOM_API: Record<string, (u: string) => string> = {
  instagram: (u) => `https://api.instroom.io/v2/${u}/instagram`,
  tiktok:    (u) => `https://api.instroom.io/${u}/tiktok`,
}

async function fetchInfluencerFromAPI(handle: string, platform: string): Promise<Partial<InfluencerRow> | null> {
  const clean = handle.trim().replace(/^@/, "").toLowerCase()
  if (!clean || clean.length < 2) return null
  const endpointFn = INSTROOM_API[platform]
  if (!endpointFn) return null
  try {
    const res = await fetch(endpointFn(clean))
    if (!res.ok) return null
    const json = await res.json()
    const d = json.data || json.user || json
    if (!d || typeof d !== "object") return null
    const followerCount = Number(d.followers || d.follower_count || 0)
    const engRate = parseFloat(String(d.engagement_rate || "0")) || 0
    const profileUrl = platform === "tiktok" ? `https://tiktok.com/@${clean}` : `https://instagram.com/${clean}`
    const email = d.email && d.email !== "Not Available" ? d.email : ""
    const fullName = d.full_name || d.name || ""
    return {
      full_name: fullName,
      first_name: fullName.split(" ")[0] || "",
      follower_count: String(followerCount),
      engagement_rate: String(engRate),
      email,
      contact_info: email,
      social_link: profileUrl,
      location: d.location || d.country || "",
      niche: d.category || d.business_category || "",
      gender: d.gender || "",
      profile_image_url: d.photo || d.avatar || "",
      avg_likes: parseFormattedNumber(d.avg_likes || d.avg_hearts),
      avg_comments: parseFormattedNumber(d.avg_comments),
      avg_views: parseFormattedNumber(d.avg_video_views || d.avg_views),
    }
  } catch (err) {
    console.error(`API fetch error for ${handle}:`, err)
    return null
  }
}

// ── useToast ──────────────────────────────────────────────────────────────────

export function useToast() {
  const [toasts, setToasts] = useState<ToastNotification[]>([])

  const addToast = useCallback((type: ToastNotification["type"], message: string) => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, addToast, dismissToast }
}

// ── useAutoFetch ──────────────────────────────────────────────────────────────

export function useAutoFetch({
  rows,
  onRowsChange,
  onFetchComplete,
  addToast,
  setDuplicateRowIds,
  setPendingDuplicateInfo,
}: {
  rows: InfluencerRow[]
  onRowsChange?: (rows: InfluencerRow[]) => void
  onFetchComplete?: (row: InfluencerRow) => void
  addToast: (type: ToastNotification["type"], message: string) => void
  setDuplicateRowIds: React.Dispatch<React.SetStateAction<Set<string>>>
  setPendingDuplicateInfo: React.Dispatch<React.SetStateAction<{ rowId: string; handle: string; existingName: string } | null>>
}) {
  const [fetchingRows, setFetchingRows] = useState<Set<string>>(new Set())

  const autoFetchInfluencer = useCallback(async (rowId: string, handle: string, platform: string) => {
    const clean = handle.trim().replace(/^@/, "").toLowerCase()
    if (!clean || clean.length < 2) return
    if (platform !== "instagram" && platform !== "tiktok") return

    const existingRow = rows.find(r => r.id === rowId)
    if (existingRow && Number(existingRow.follower_count) > 0) return

    const duplicate = rows.find(r =>
      r.id !== rowId &&
      cleanHandle(r.handle).toLowerCase() === clean &&
      r.platform === platform
    )
    if (duplicate) {
      setPendingDuplicateInfo({ rowId, handle: clean, existingName: duplicate.full_name || duplicate.handle })
      setDuplicateRowIds(prev => { const n = new Set(prev); n.add(rowId); return n })
      return
    }
    setDuplicateRowIds(prev => { if (!prev.has(rowId)) return prev; const n = new Set(prev); n.delete(rowId); return n })

    setFetchingRows(prev => { const n = new Set(prev); n.add(rowId); return n })
    try {
      const data = await fetchInfluencerFromAPI(handle, platform)
      if (!data) { addToast("error", `${clean} not found on ${platform}`); return }

      if (data.email) {
        const emailLower = data.email.toLowerCase()
        const emailDuplicate = rows.find(r =>
          r.id !== rowId &&
          ((r.email || "").toLowerCase() === emailLower ||
           (r.contact_info || "").toLowerCase() === emailLower)
        )
        if (emailDuplicate) {
          addToast("warning", `@${clean} shares an email with @${emailDuplicate.handle} — possible duplicate`)
        }
      }

      // Rows setter is passed in via callback pattern to avoid stale closure
      const applyUpdate = (prev: InfluencerRow[]): InfluencerRow[] => {
        const next = prev.map(row => {
          if (row.id !== rowId) return row
          const u = { ...row }
          if (!u.full_name && data.full_name) u.full_name = data.full_name
          if (!u.email && data.email) u.email = data.email
          if (!u.contact_info && data.contact_info) u.contact_info = data.contact_info
          if (!u.social_link && data.social_link) u.social_link = data.social_link
          if (!u.location && data.location) u.location = data.location
          if (!u.niche && data.niche) u.niche = data.niche
          if (!u.gender && data.gender) u.gender = data.gender
          if (data.profile_image_url) u.profile_image_url = data.profile_image_url
          if (data.first_name) u.first_name = data.first_name
          if (data.follower_count && data.follower_count !== "0") u.follower_count = data.follower_count
          if (data.engagement_rate && data.engagement_rate !== "0") u.engagement_rate = data.engagement_rate
          if (data.avg_likes !== undefined) u.avg_likes = data.avg_likes
          if (data.avg_comments !== undefined) u.avg_comments = data.avg_comments
          if (data.avg_views !== undefined) u.avg_views = data.avg_views
          return u
        })
        onRowsChange?.(next)
        const updatedRow = next.find(r => r.id === rowId)
        if (updatedRow) setTimeout(() => onFetchComplete?.(updatedRow), 0)
        return next
      }

      return applyUpdate
    } catch (err) {
      console.error("Auto-fetch failed:", err)
      return undefined
    } finally {
      setFetchingRows(prev => { const n = new Set(prev); n.delete(rowId); return n })
    }
  }, [rows, onRowsChange, onFetchComplete, addToast, setDuplicateRowIds, setPendingDuplicateInfo])

  return { fetchingRows, autoFetchInfluencer }
}
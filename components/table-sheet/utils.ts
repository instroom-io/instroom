// table-sheet/utils.ts
// Pure utility functions — no React, no side effects

import { CustomColumn, InfluencerRow, SortOrder } from "./types"
import { PLATFORM_URL_MAP, CSV_EXPORT_FIELDS, IMPORT_FIELDS, platforms, DEFAULT_GENDERS, DEFAULT_CONTACT_STATUSES } from "./constants"

// ── Handle helpers ────────────────────────────────────────────────────────────

export function cleanHandle(raw: string): string {
  return raw.trim().replace(/^@/, "")
}

export function displayHandle(handle: string): string {
  return cleanHandle(handle)
}

export function getProfileUrl(platform: string, handle: string): string {
  if (!handle || handle === "@" || handle === "") return ""
  const fn = PLATFORM_URL_MAP[platform]
  return fn ? fn(handle) : ""
}

// ── Avatar helpers ────────────────────────────────────────────────────────────

export function stringToColor(str: string): { bg: string; text: string } {
  const colors = [
    { bg: "#dbeafe", text: "#1e40af" },
    { bg: "#dcfce7", text: "#166534" },
    { bg: "#fce7f3", text: "#9d174d" },
    { bg: "#ede9fe", text: "#5b21b6" },
    { bg: "#ffedd5", text: "#9a3412" },
    { bg: "#cffafe", text: "#155e75" },
    { bg: "#fef9c3", text: "#854d0e" },
    { bg: "#f1f5f9", text: "#334155" },
  ]
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export function getInitials(name?: string, handle?: string): string {
  const source = name?.trim() || handle?.trim().replace(/^@/, "") || ""
  if (!source) return "?"
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

// ── Number formatting ─────────────────────────────────────────────────────────

export function formatFollowers(n: number): string {
  if (!n || isNaN(n)) return "0"
  if (n >= 1_000_000) {
    const v = n / 1_000_000
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, "")) + "M"
  }
  if (n >= 1_000) {
    const v = n / 1_000
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, "")) + "K"
  }
  return String(n)
}

export function parseFormattedNumber(val: string | number | undefined): string {
  if (!val || val === "Not Available") return ""
  const s = String(val).toLowerCase().trim()
  if (s.includes("m")) return String(Math.round(parseFloat(s) * 1_000_000))
  if (s.includes("k")) return String(Math.round(parseFloat(s) * 1_000))
  const n = parseFloat(s)
  return isNaN(n) ? "" : String(Math.round(n))
}

// ── URL helpers ───────────────────────────────────────────────────────────────

export function isValidUrl(str: string): boolean {
  if (!str) return false
  try {
    const u = new URL(str.startsWith("http") ? str : `https://${str}`)
    return u.hostname.includes(".")
  } catch { return false }
}

export function normalizeUrl(str: string): string {
  if (!str) return ""
  return str.startsWith("http") ? str : `https://${str}`
}

// ── Approval state machine ────────────────────────────────────────────────────

export function handleApprovalChange(
  row: InfluencerRow,
  newStatus: string,
  declineReason?: string
): InfluencerRow {
  const r = { ...row }
  if (newStatus === "Approved" && row.approval_status !== "Approved") {
    const t = new Date()
    r.transferred_date = [
      t.getFullYear(),
      String(t.getMonth() + 1).padStart(2, "0"),
      String(t.getDate()).padStart(2, "0"),
    ].join("-")
  } else if (newStatus !== "Approved") {
    r.transferred_date = ""
  }
  if (newStatus === "Declined" && row.approval_status !== "Declined") {
    r.contact_status = "not_contacted"; r.stage = "1"; r.agreed_rate = ""; r.notes = ""
    if (declineReason) { r.approval_notes = declineReason; r.decline_reason = declineReason }
  }
  r.approval_status = newStatus as "Approved" | "Declined" | "Pending"
  return r
}

// ── Row factory ───────────────────────────────────────────────────────────────

export function newEmptyRow(customCols: CustomColumn[]): InfluencerRow {
  const custom: Record<string, string> = {}
  customCols.forEach((c) => { custom[c.field_key] = c.field_type === "boolean" ? "No" : "" })
  return {
    id: crypto.randomUUID(), handle: "", platform: "instagram", full_name: "", email: "",
    follower_count: "", engagement_rate: "", niche: "", contact_status: "not_contacted",
    stage: "1", agreed_rate: "", notes: "", custom, gender: "", location: "",
    social_link: "", first_name: "", contact_info: "", approval_status: "Pending",
    transferred_date: "", approval_notes: "", decline_reason: "", tier: "Bronze",
    community_status: "Pending", profile_image_url: "",
    created_at: new Date().toISOString(),
  }
}

// ── Sort helper ───────────────────────────────────────────────────────────────

export function sortRows(rows: InfluencerRow[], order: SortOrder): InfluencerRow[] {
  const hasTimestamps = rows.some(r => r.created_at)
  if (hasTimestamps) {
    return [...rows].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0
      return order === "newest" ? tb - ta : ta - tb
    })
  }
  return order === "newest" ? [...rows].reverse() : [...rows]
}

// ── Column definitions ────────────────────────────────────────────────────────

export function getStaticCols(niches: string[], locations: string[]) {
  return [
    { key: "handle",          label: "Handle",           group: "Influencer Details" as const, minWidth: 110, type: "text" as const },
    { key: "platform",        label: "Platform",         group: "Influencer Details" as const, minWidth: 80,  type: "select" as const, options: ["instagram","tiktok","youtube","twitter","other"] },
    { key: "niche",           label: "Niche",            group: "Influencer Details" as const, minWidth: 80,  type: "select" as const, options: niches },
    { key: "gender",          label: "Gender",           group: "Influencer Details" as const, minWidth: 70,  type: "select" as const, options: ["Male","Female","Non-binary","Other"] },
    { key: "location",        label: "Location",         group: "Influencer Details" as const, minWidth: 85,  type: "select" as const, options: locations },
    { key: "follower_count",  label: "Followers",        group: "Influencer Details" as const, minWidth: 70,  type: "number" as const },
    { key: "engagement_rate", label: "Engagement Rate ",              group: "Influencer Details" as const, minWidth: 60,  type: "number" as const },
    { key: "first_name",      label: "First Name",       group: "Influencer Details" as const, minWidth: 75,  type: "text" as const },
    { key: "contact_info",    label: "Contact Info",     group: "Influencer Details" as const, minWidth: 120, type: "text" as const },
    { key: "approval_status", label: "Approve/Decline",  group: "Approval Details" as const,  minWidth: 95,  type: "select" as const, options: ["Approved","Declined","Pending"] },
    { key: "transferred_date",label: "Date Reviewed",      group: "Approval Details" as const,  minWidth: 95,  type: "date" as const },
    { key: "approval_notes",  label: "Notes",            group: "Approval Details" as const,  minWidth: 110, type: "text" as const },
  ]
}
// ── CSV import ────────────────────────────────────────────────────────────────

export function escapeCSV(val: string): string {
  if (!val) return ""
  if (val.includes(",") || val.includes('"') || val.includes("\n")) return `"${val.replace(/"/g, '""')}"`
  return val
}

export function exportToCSV(rows: InfluencerRow[], cc: CustomColumn[]): void {
  const af = [...CSV_EXPORT_FIELDS, ...cc.map(c => ({ key: `custom.${c.field_key}`, label: c.field_name }))]
  const h = af.map(f => escapeCSV(f.label)).join(",")
  const l = rows.map(r =>
    af.map(f => {
      let v = ""
      if (f.key.startsWith("custom.")) v = r.custom[f.key.slice(7)] ?? ""
      else v = String((r as Record<string, unknown>)[f.key] ?? "")
      return escapeCSV(v)
    }).join(",")
  )
  const csv = [h, ...l].join("\n")
  const b = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const u = URL.createObjectURL(b)
  const a = document.createElement("a")
  a.href = u; a.download = `influencers_export_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  URL.revokeObjectURL(u)
}

export function downloadTemplate(cc: CustomColumn[]): void {
  const af = [...IMPORT_FIELDS, ...cc.map(c => ({ key: `custom.${c.field_key}`, label: c.field_name }))]
  const h = af.map(f => escapeCSV(f.label)).join(",")
  const sample = [
    "aliyahbeauty","instagram","Aliyah","Beauty","Female","Philippines","45000","3.2",
    "https://instagram.com/aliyahbeauty","aliyah@email.com",
    ...cc.map(() => ""),
  ].map(escapeCSV).join(",")
  const csv = [h, sample].join("\n")
  const b = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const u = URL.createObjectURL(b)
  const a = document.createElement("a")
  a.href = u; a.download = "instroom_import_template.csv"; a.click()
  URL.revokeObjectURL(u)
}

export function parseCSV(text: string): string[][] {
  const rows: string[][] = []; let cur: string[] = []; let cell = ""; let inQ = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') inQ = false
      else cell += ch
    } else {
      if (ch === '"') inQ = true
      else if (ch === ',') { cur.push(cell); cell = "" }
      else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        cur.push(cell); cell = ""; rows.push(cur); cur = []
        if (ch === '\r') i++
      } else cell += ch
    }
  }
  if (cell || cur.length) { cur.push(cell); rows.push(cur) }
  return rows
}

export function importFromCSV(
  text: string,
  cc: CustomColumn[]
): { rows: InfluencerRow[]; niches: string[]; locations: string[] } {
  const p = parseCSV(text)
  if (p.length < 2) return { rows: [], niches: [], locations: [] }
  const hd = p[0].map(h => h.trim().toLowerCase())

  const fm: Record<string, string> = {}
  CSV_EXPORT_FIELDS.forEach(f => { fm[f.label.toLowerCase()] = f.key })
  IMPORT_FIELDS.forEach(f => { fm[f.label.toLowerCase()] = f.key })

  fm["platform"]                  = "platform"
  fm["platform link"]             = "social_link"
  fm["new: location"]             = "location"
  fm["new: niche"]                = "niche"
  fm["username"]                  = "handle"
  fm["email address/ handlename"] = "contact_info"
  fm["email address/handlename"]  = "contact_info"
  fm["dm ig username"]            = "_dm_handle"
  fm["first name"]                = "first_name"
  fm["followers count"]           = "follower_count"
  fm["big rate"]                  = "engagement_rate"
  fm["average views"]             = "avg_views"
  fm["pipeline status"]           = "contact_status"

  cc.forEach(c => { fm[c.field_name.toLowerCase()] = `custom.${c.field_key}` })

  const rows: InfluencerRow[] = []
  const discoveredNiches = new Set<string>()
  const discoveredLocations = new Set<string>()

  for (let i = 1; i < p.length; i++) {
    const vals = p[i]
    if (vals.every(v => !v.trim())) continue
    const row = newEmptyRow(cc)
    hd.forEach((h, ci) => {
      const key = fm[h]
      if (!key || ci >= vals.length) return
      const val = vals[ci].trim()
      if (!val) return
      if (key.startsWith("custom.")) row.custom[key.slice(7)] = val
      else (row as Record<string, unknown>)[key] = val
    })
    if (!["Approved", "Declined", "Pending"].includes(row.approval_status || "")) row.approval_status = "Pending"

    const dmHandle = (row as any)["_dm_handle"]
    if (!row.handle && dmHandle) row.handle = cleanHandle(dmHandle)
    else row.handle = cleanHandle(row.handle)

    if (row.platform) {
      const pl = row.platform.toLowerCase()
      const map: Record<string, string> = {
        instagram: "instagram", tiktok: "tiktok", youtube: "youtube",
        "x (twitter)": "twitter", twitter: "twitter", facebook: "other", other: "other",
      }
      row.platform = map[pl] || "instagram"
    }

    if (row.contact_status) {
      const ps = row.contact_status.toLowerCase().trim()
      const statusMap: Record<string, string> = {
        "contacted":           "contacted", "replied": "contacted",
        "in progress":         "interested", "not interested": "not_contacted",
        "for order creation":  "agreed", "in transit": "agreed",
        "delivered":           "agreed", "posted": "agreed", "agreed": "agreed",
        "interested":          "interested", "not_contacted": "not_contacted",
      }
      row.contact_status = statusMap[ps] ?? "not_contacted"
    }

    if (row.niche?.trim()) discoveredNiches.add(row.niche.trim())
    if (row.location?.trim()) discoveredLocations.add(row.location.trim())

    if (row.email && !row.contact_info) row.contact_info = row.email
    if (row.contact_info && !row.email) row.email = row.contact_info
    if (!row.first_name && row.full_name) row.first_name = row.full_name.split(" ")[0]
    if (!row.handle) continue
    rows.push(row)
  }

  const seenHandles = new Map<string, number>()
  const seenEmails = new Map<string, number>()
  const deduped: InfluencerRow[] = []
  rows.forEach((row, idx) => {
    const hk = `${row.handle.toLowerCase()}@${row.platform}`
    const em = (row.contact_info || row.email || "").toLowerCase().trim()
    let isDupe = false
    if (seenHandles.has(hk)) isDupe = true
    else seenHandles.set(hk, idx)
    if (!isDupe && em && seenEmails.has(em)) isDupe = true
    else if (em) seenEmails.set(em, idx)
    if (!isDupe) deduped.push(row)
  })

  return { rows: deduped, niches: [...discoveredNiches], locations: [...discoveredLocations] }
}
"use client"
// table-sheet/mobile-row-cards.tsx
// Phone layout for the Influencers List.
//
// The spreadsheet grid is good on desktop and unusable on a phone: 15+ columns
// behind a horizontal scrollbar, 12px cells, hover-only row actions. This
// renders the SAME page of rows as a card list, driven by the same state and
// callbacks — selection, profile sidebar, delete. No new data, no new logic.
//
// Layout: two rows of content, not four. Identity + status on line one, meta
// and stats on line two. Keeping it to ~104px per card means roughly six fit on
// a 375×667 screen, so the list still scans like a list.
//
// Rendered under `md`; the table takes over from `md` up.

import { IconEye, IconTrash, IconLoader2, IconCheck, IconX, IconAlertTriangle } from "@tabler/icons-react"
import { MobileCard, MobileChip, MobileIconButton, type ChipTone } from "@/components/mobile/primitives"
import type { InfluencerRow } from "./types"

const PLATFORM_TONE: Record<string, ChipTone> = {
  Instagram: "purple",
  TikTok:    "neutral",
  YouTube:   "red",
  Facebook:  "blue",
  Twitter:   "blue",
  X:         "neutral",
}

const APPROVAL: Record<string, { tone: ChipTone; icon: React.ReactNode }> = {
  Approved: { tone: "brand", icon: <IconCheck size={11} /> },
  Declined: { tone: "red",   icon: <IconX size={11} /> },
  Pending:  { tone: "amber", icon: null },
}

function initials(name: string, handle: string) {
  const source = (name || handle || "?").trim()
  const [a, b] = source.split(/\s+/)
  return ((a?.[0] ?? "") + (b?.[0] ?? "")).toUpperCase() || source[0]?.toUpperCase() || "?"
}

function compact(value: string | number | undefined) {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? "").replace(/[^0-9.]/g, ""))
  if (!n || Number.isNaN(n)) return null
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K"
  return String(n)
}

export function MobileRowCards({
  rows,
  selectedRowIds,
  fetchingRows,
  duplicateRowIds,
  readOnly,
  onToggleSelect,
  onOpenProfile,
  onDelete,
}: {
  rows: InfluencerRow[]
  selectedRowIds: Set<string>
  fetchingRows: Set<string>
  duplicateRowIds: Set<string>
  readOnly?: boolean
  onToggleSelect: (id: string) => void
  onOpenProfile: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <ul className="md:hidden m-0 flex list-none flex-col gap-2.5 p-0">
      {rows.map((row) => {
        const isSel      = selectedRowIds.has(row.id)
        const isFetching = fetchingRows.has(row.id)
        const isDup      = duplicateRowIds.has(row.id)
        const approval   = APPROVAL[row.approval_status ?? "Pending"] ?? APPROVAL.Pending
        const followers  = compact(row.follower_count)
        const engagement = row.engagement_rate ? String(row.engagement_rate).replace(/%$/, "") : null
        const name       = row.full_name || row.handle || "Untitled"

        return (
          <li key={row.id}>
            <MobileCard selected={isSel} className={isDup ? "opacity-60" : undefined}>
              {/* Line 1 — identity, status, actions */}
              <div className="flex items-center gap-3">
                {!readOnly && (
                  // -my-2 keeps the 44px hit area without adding card height
                  <label className="-my-2 -ml-1 flex h-11 w-9 shrink-0 cursor-pointer items-center justify-center">
                    {isFetching ? (
                      <IconLoader2 size={16} className="animate-spin text-[#1FAE5B]" />
                    ) : (
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => onToggleSelect(row.id)}
                        aria-label={`Select ${name}`}
                        className="h-[18px] w-[18px] cursor-pointer rounded accent-[#1FAE5B]"
                      />
                    )}
                  </label>
                )}

                {row.profile_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.profile_image_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1FAE5B]/10 text-[13px] font-semibold text-[#0F6B3E]">
                    {initials(row.full_name, row.handle)}
                  </div>
                )}

                {/* min-w-0 is what stops long names forcing the card wider
                    than the viewport */}
                <button onClick={() => onOpenProfile(row.id)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[15px] font-semibold leading-tight text-gray-900">{name}</p>
                  <p className="mt-0.5 truncate text-[12.5px] leading-tight text-gray-500">
                    {row.handle ? `@${row.handle.replace(/^@/, "")}` : row.platform || "—"}
                  </p>
                </button>

                <MobileChip tone={approval.tone} icon={approval.icon} className="shrink-0">
                  {row.approval_status ?? "Pending"}
                </MobileChip>
              </div>

              {/* Line 2 — meta + stats + actions on one baseline */}
              <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-2.5">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                  {row.platform && (
                    <MobileChip tone={PLATFORM_TONE[row.platform] ?? "neutral"}>{row.platform}</MobileChip>
                  )}
                  {row.gender && <MobileChip>{row.gender}</MobileChip>}
                  {followers && (
                    <span className="whitespace-nowrap text-[12px] text-gray-500">
                      <strong className="font-semibold text-gray-800">{followers}</strong> followers
                    </span>
                  )}
                  {engagement && (
                    <span className="whitespace-nowrap text-[12px] text-gray-500">
                      <strong className="font-semibold text-gray-800">{engagement}%</strong> eng
                    </span>
                  )}
                  {isDup && (
                    <MobileChip tone="amber" icon={<IconAlertTriangle size={11} />}>Duplicate</MobileChip>
                  )}
                </div>

                {/* Always visible — the table's hover-reveal has no touch equivalent */}
                <div className="-my-2 flex shrink-0 items-center">
                  <MobileIconButton label={`View ${name}`} onClick={() => onOpenProfile(row.id)}>
                    <IconEye size={18} />
                  </MobileIconButton>
                  {!readOnly && (
                    <MobileIconButton label={`Delete ${name}`} tone="danger" onClick={() => onDelete(row.id)}>
                      <IconTrash size={17} />
                    </MobileIconButton>
                  )}
                </div>
              </div>
            </MobileCard>
          </li>
        )
      })}
    </ul>
  )
}

// app/analytics/page.tsx
"use client"

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from "react"
// Tabler, not lucide: the other dashboard pages (post-tracker,
// manage-influencers, table-sheet) all draw their toolbar icons from Tabler.
import { IconFilter, IconDownload, IconX, IconChevronDown, IconSearch } from "@tabler/icons-react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { DashboardSkeleton } from "@/components/shared/skeletons"
import { PlatformBadge } from "@/components/shared/platform-icon"

// ============================================================
// Types
// ============================================================

interface AnalyticsInfluencer {
  id: string
  platform: string
  /** Influencer.full_name — searchable, same as the Post Tracker toolbar. */
  name: string | null
  instagramHandle: string | null
  niche: string
  location: string
  createdAt: string
  pipelineStatus: string
  rejectionReason: string | null
  rejectionBucket: "hard" | "soft" | null
  views: number
  likes: number
  comments: number
  clicks: number
  salesQty: number
  salesAmt: number
  prodCost: number
  feesPaid: number
  commissionPaid: number
  // null = no column exists in the schema for this yet (see the analytics
  // route's DATA-GAPS note). Distinct from false, which would claim a real zero.
  usageRights: boolean | null
  contentSaved: boolean | null
  adCode: boolean | null
  deliveredDaysAgo: number | null
}

// ============================================================
// Helper Functions
// ============================================================

const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

const formatMoney = (num: number) => {
  return num === 0 ? '$0' : '$' + num.toLocaleString()
}

const formatPercent = (value: number, total: number) => {
  if (total === 0) return '—'
  return Math.round((value / total) * 100) + '%'
}

// ============================================================
// Design tokens — taken from the rest of the app, not invented here
// ------------------------------------------------------------
// Every value below is the one already used by the other dashboard pages, so
// Analytics reads as the same product rather than a lookalike:
//
//   card shell      bg-white border border-gray-200 rounded-xl
//                   — post-tracker, brand-partners, manage-influencers
//   control height  h-9 rounded-lg text-sm            — post-tracker toolbar
//   select          border-gray-200 bg-gray-50 + brand focus ring
//                   — app/dashboard/post-tracker/page.tsx:1228
//   field label     text-xs text-gray-500             — same
//   divider         border-gray-100                   — same
//   brand green     #1FAE5B (mid) · #0F6B3E (deep) · #178a48 (hover)
//
// The green matters most: this page previously used Tailwind's green-600 (#16A34A),
// a visibly different green from the #1FAE5B used everywhere else in Instroom
// and by the charts on this very page.
// ============================================================

/** Card shell: same border, radius and background everywhere. No shadows. */
const CARD = "rounded-xl border border-gray-200 bg-white"
/** Section card padding. KPI tiles use the tighter p-4 on their own. */
const CARD_PAD = "p-4 sm:p-5"
/** Section heading. */
const CARD_TITLE = "text-sm font-semibold text-gray-900"
/** Muted label above a metric. */
const LABEL = "text-[11px] font-medium uppercase tracking-wide text-gray-500"
/** Footnote / helper text — the quietest step on the page. */
const HELP = "text-[11px] leading-relaxed text-gray-400"
/** Every figure on the page aligns in columns. */
const NUM = "tabular-nums"
/** Positive / branded figure. */
const VALUE_BRAND = "text-[#1FAE5B]"
/** Toolbar control geometry, shared by both buttons and every select. */
const CONTROL = "h-9 rounded-lg text-sm"
/** Secondary button — post-tracker's neutral toolbar button. */
const BTN_SECONDARY =
  `${CONTROL} flex items-center gap-1.5 border border-gray-200 px-3 font-medium text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1`
/** Field label above a select. */
const FIELD_LABEL = "text-xs text-gray-500"
/** Select control, matching the post-tracker filter panel exactly. */
const SELECT =
  `${CONTROL} w-full cursor-pointer appearance-none border border-gray-200 bg-gray-50 px-3 pr-8 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1FAE5B]`

// ============================================================
// UI Components
// ============================================================

const ReasonTooltip = ({ reason }: { reason: string }) => {
  const tips: Record<string, string> = {
    'Fee too low / unpaid': 'Creator treats this as a business — your offer didn\'t meet their rate card or they require payment, not just gifting.',
    'Brief too scripted': 'Your creative brief left no room for the creator\'s own voice. Try giving a key message + full creative freedom.',
    "Won't allow content reuse": 'Creator won\'t let you repurpose their content without extra compensation.',
    'Working with a competitor': 'Creator has an active exclusive deal with a direct competitor.',
    "Product doesn't fit their brand": 'The product feels out of place in their content.',
    'Wrong audience fit': 'The creator\'s followers don\'t match your target customer.',
    'Seen bad reviews about us': 'Creator came across negative reviews about your brand.',
    'Fully booked': 'Content calendar is at capacity. Re-approach next campaign.',
    "Temporarily unavailable / can't shoot": 'Creator is travelling or unavailable. Flag for follow-up.',
    "Can't ship to their location": 'Your product can\'t be delivered to their location.',
    'Ghosted / no longer active': 'Stopped responding after initial contact.',
    'Rate / deadline too tight': 'Pay was below their rate or deadline too rushed.',
    'Others': 'Reason wasn\'t captured or doesn\'t fit any category.',
  }

  return (
    <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover:block bg-gray-900 text-white text-xs rounded-lg p-3 w-64 max-w-[85vw] shadow-lg">
      {tips[reason] || 'No additional context available.'}
    </div>
  )
}

/* ── Card shells ──────────────────────────────────────────────────────────
   h-full on both so that any two cards sharing a grid row end up the same
   height without anyone hard-coding one.
   ------------------------------------------------------------------------ */

const SectionCard = ({
  title,
  hint,
  footnote,
  footer,
  className = "",
  children,
}: {
  title: string
  /** Quiet clarifier next to the title — units, formula, "hover for context". */
  hint?: string
  /** Quiet explanatory line pinned under the content. */
  footnote?: string
  /** Structured footer (aligned figures) for when a sentence is too noisy. */
  footer?: React.ReactNode
  className?: string
  children: React.ReactNode
}) => (
  /* No h-full: the analytics grids are items-start, and a height:100% here
     resolved against the grid row and re-stretched every short card — the
     "excessive empty space" in the shorter of any two paired cards. */
  <div className={`${CARD} ${CARD_PAD} flex min-w-0 flex-col ${className}`}>
    <h3 className={`${CARD_TITLE} mb-3.5 flex flex-wrap items-baseline gap-x-2`}>
      {title}
      {hint && <span className="text-[11px] font-normal text-gray-400">{hint}</span>}
    </h3>
    <div className="min-w-0 flex-1">{children}</div>
    {footer && <div className="mt-3 border-t border-gray-100 pt-2.5">{footer}</div>}
    {footnote && <p className={`${HELP} mt-3`}>{footnote}</p>}
  </div>
)

/**
 * Is a displayed figure actually positive?
 *
 * Green means "positive" on this page, but a 0% closing rate or a $0 revenue
 * was still being tinted green — reading as success where there is none.
 * Parses the formatted value ("0%", "$0", "—", "1.4x") back to a number.
 */
const isPositiveValue = (value: string | number): boolean => {
  if (typeof value === "number") return value > 0
  const numeric = parseFloat(String(value).replace(/[^0-9.-]/g, ""))
  return Number.isFinite(numeric) && numeric > 0
}

/** The one empty state on the page: same voice, same weight, everywhere. */
const EmptyState = ({ children }: { children: React.ReactNode }) => (
  <p className={`${HELP} py-1`}>{children}</p>
)

/* ── Metric card ──────────────────────────────────────────────────────────
   Muted label → prominent value → subtle supporting line. The supporting
   line is pushed to the bottom (mt-auto) so values and descriptions line up
   across a row even when one description wraps to two lines.
   ------------------------------------------------------------------------ */
const MetricCard = ({
  label, value, subLabel, isGreen = false, nested = false,
}: {
  label: string; value: string | number; subLabel?: string; isGreen?: boolean
  /**
   * Drop the card shell. A bordered card inside a bordered card reads as a
   * different component family — these tiles sit inside SectionCards on the
   * Reach and Conversion tabs, so there they are plain rows on the card's own
   * surface, with only the type hierarchy doing the work.
   */
  nested?: boolean
}) => {
  if (nested) {
    return (
      <div className="flex min-w-0 flex-col">
        <div className={LABEL}>{label}</div>
        <div className={`mt-1 text-xl font-semibold leading-none tracking-tight ${NUM} ${isGreen && isPositiveValue(value) ? VALUE_BRAND : 'text-gray-900'}`}>
          {value}
        </div>
        {subLabel && <div className="mt-1 text-xs leading-snug text-gray-500">{subLabel}</div>}
      </div>
    )
  }

  return (
    <div className={`${CARD} flex h-full min-w-0 flex-col p-4`}>
      <div className={LABEL}>{label}</div>
      <div className={`mt-1.5 text-[26px] font-semibold leading-none tracking-tight ${NUM} ${isGreen && isPositiveValue(value) ? VALUE_BRAND : 'text-gray-900'}`}>
        {value}
      </div>
      {subLabel && <div className="mt-auto pt-2 text-xs leading-snug text-gray-500">{subLabel}</div>}
    </div>
  )
}

/* ── Stat tile ────────────────────────────────────────────────────────────
   The compact figure-first tile used across the reach and conversion tabs.
   Replaces four hand-rolled copies of the same markup per tab.
   ------------------------------------------------------------------------ */
const StatTile = ({ value, label, sub }: { value: string | number; label: string; sub?: string }) => (
  <div className={`${CARD} flex h-full min-w-0 flex-col p-4`}>
    <div className={`text-[26px] font-semibold leading-none tracking-tight ${NUM} ${isPositiveValue(value) ? VALUE_BRAND : 'text-gray-900'}`}>{value}</div>
    <div className="mt-1.5 text-xs text-gray-600">{label}</div>
    {sub && <div className="mt-auto pt-2 text-xs leading-snug text-gray-500">{sub}</div>}
  </div>
)

/* ── Funnel step ──────────────────────────────────────────────────────────
   Progression is carried by an index marker and a connector rail down the
   left, so the four stages read as a sequence rather than four unrelated
   bars. The maths is untouched: the bar and the percentage are both
   value ÷ total, exactly as before, and `total` still varies per stage.
   ------------------------------------------------------------------------ */
const FunnelStep = ({
  name, value, total, color, dropOff, index, isLast = false,
}: {
  name: string; value: number; total: number; color: string; dropOff?: string; index: number; isLast?: boolean
}) => {
  const percentage = total === 0 ? 0 : (value / total) * 100

  return (
    <div className="relative flex min-w-0 gap-3">
      {/* Stage number + connector rail. "01" rather than a filled badge: the
          sequence is legible without another coloured shape competing with
          the bars. */}
      <div className="flex flex-col items-center">
        <span className={`w-5 shrink-0 text-right text-[10px] font-semibold leading-5 text-gray-400 ${NUM}`}>
          {String(index).padStart(2, '0')}
        </span>
        {!isLast && <span aria-hidden className="mt-0.5 w-px flex-1 bg-gray-100" />}
      </div>

      <div className={`min-w-0 flex-1 ${isLast ? '' : 'pb-3.5'}`}>
        {/* Label left, then two fixed-width right columns so percentages and
            counts line up vertically down all four stages. */}
        <div className="flex items-baseline gap-3">
          <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{name}</span>
          <span className={`w-10 shrink-0 text-right text-xs text-gray-500 ${NUM}`}>{formatPercent(value, total)}</span>
          <span className={`w-8 shrink-0 text-right text-sm font-semibold text-gray-900 ${NUM}`}>{value}</span>
        </div>
        {/* Track always full width so the four stages read against a common
            scale; fill is neutral grey at zero so an empty stage never shows a
            coloured sliver. Rows are ≤100% by construction now, but Math.min
            keeps a bar inside its track if a future denominator changes. */}
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(percentage, 100)}%`,
              backgroundColor: value === 0 ? '#E5E7EB' : color,
            }}
          />
        </div>
        {/* Drop-off: stated plainly, weighted down. The caret carries the only
            colour so the line reads as information, not as an alarm. */}
        {dropOff && (
          <div className={`mt-1.5 inline-flex items-center gap-1 text-[11px] text-gray-500 ${NUM}`}>
            <span aria-hidden className="text-rose-500">▼</span>
            {dropOff.replace(/^▼\s*/, '')}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Reason row ───────────────────────────────────────────────────────────
   Reason → bar → count → share. The hard/soft badge that used to sit on
   every row is gone: rows live under a Hard pass / Soft pass heading, so
   repeating it per row was noise. Hover context is unchanged.
   ------------------------------------------------------------------------ */
const ReasonRow = ({ name, count, total, max, color }: { name: string; count: number; total: number; max: number; color: string }) => {
  // Scale against the biggest count on the card, not against this row's own
  // count — the latter made every bar exactly 100% wide.
  const barWidth = max > 0 ? (count / max) * 100 : 0

  return (
    <div className="group relative min-w-0 py-1.5">
      <div className="flex min-w-0 items-baseline gap-3">
        <span className="min-w-0 flex-1 cursor-help truncate text-[13px] text-gray-700">
          {name}
          <span className="ml-1 text-gray-300">ⓘ</span>
        </span>
        <span className={`w-8 shrink-0 text-right text-[13px] font-semibold text-gray-900 ${NUM}`}>{count}</span>
        <span className={`w-9 shrink-0 text-right text-xs text-gray-400 ${NUM}`}>{formatPercent(count, total)}</span>
      </div>
      {/* Bar sits under the row at full width, so counts stay in one column and
          the bars share a scale instead of each being its own little gauge. */}
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full" style={{ width: `${barWidth}%`, backgroundColor: color }} />
      </div>
      <ReasonTooltip reason={name} />
    </div>
  )
}

/** Hard pass / Soft pass heading: a colour dot instead of an emoji. */
const ReasonGroupHeading = ({ tone, label, note, total }: { tone: 'hard' | 'soft'; label: string; note: string; total: number }) => (
  <div className="mb-1.5 flex items-baseline justify-between gap-3">
    <span className="flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${tone === 'hard' ? 'bg-rose-500' : 'bg-sky-500'}`} />
      <span className={`text-[11px] font-semibold uppercase tracking-wide ${tone === 'hard' ? 'text-rose-700' : 'text-sky-700'}`}>
        {label}
      </span>
      {/* The explanatory clause moves to a title attribute: it was the single
          noisiest element in the card and it repeats twice. */}
      <span className="cursor-help text-gray-300" title={note}>ⓘ</span>
    </span>
    <span className={`text-xs text-gray-500 ${NUM}`}>{total}</span>
  </div>
)

const PlatformRow = ({ platform, posted, received, color, iconBg }: { platform: string; posted: number; received: number; color: string; iconBg: string }) => {
  const rate = received === 0 ? 0 : (posted / received) * 100

  return (
    <div className="mb-3 min-w-0 last:mb-0">
      <div className="flex min-w-0 items-center gap-2">
        <PlatformBadge platform={platform} size={24} tint={iconBg} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{platform}</span>
        <span className={`shrink-0 text-[11px] text-gray-500 ${NUM}`}>{posted} posted / {received} received</span>
        <span className={`w-10 shrink-0 text-right text-sm font-semibold text-[#1FAE5B] ${NUM}`}>{Math.round(rate)}%</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full" style={{ width: `${rate}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

const EMVRow = ({ platform, views, emv, maxEmv, color, iconBg, rate }: { platform: string; views: number; emv: number; maxEmv: number; color: string; iconBg: string; rate: number }) => {
  // Relative to the highest-EMV platform, so the three bars are comparable.
  // Previously each was divided by itself and all three rendered full width.
  const percentage = maxEmv > 0 ? (emv / maxEmv) * 100 : 0

  return (
    <div className="mb-3 flex min-w-0 items-center gap-2.5 last:mb-0">
      <PlatformBadge platform={platform} size={24} tint={iconBg} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm font-medium text-gray-900">{platform}</span>
          <span className={`shrink-0 text-[11px] text-gray-500 ${NUM}`}>${rate}/1k views</span>
        </div>
        <div className={`mt-0.5 text-[11px] text-gray-500 ${NUM}`}>{formatNumber(views)} views</div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: color }} />
        </div>
      </div>
      <div className={`w-[70px] shrink-0 text-right text-sm font-semibold text-[#1FAE5B] ${NUM}`}>${emv.toLocaleString()}</div>
    </div>
  )
}

const PipelineItem = ({ status, count, total, color, agingData }: { status: string; count: number; total: number; color: string; agingData?: any[] }) => {
  const percentage = total === 0 ? 0 : (count / total) * 100

  return (
    <div className="mb-2 min-w-0 last:mb-0">
      <div className="flex min-w-0 items-center gap-2.5 rounded-lg bg-gray-50 px-2.5 py-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="min-w-0 flex-1 truncate text-sm text-gray-600">{status}</span>
        <span className={`shrink-0 text-sm font-semibold text-gray-900 ${NUM}`}>{count}</span>
        <span className={`w-10 shrink-0 text-right text-[11px] text-gray-400 ${NUM}`}>{Math.round(percentage)}%</span>
      </div>
      {agingData && agingData.length > 0 && (
        <div className="mt-1 ml-5 space-y-1">
          {agingData.map((item, idx) => (
            <div key={idx} className="flex min-w-0 items-center gap-2.5 rounded-md px-2.5 py-1.5">
              <span className="min-w-0 flex-1 truncate text-[11px] text-gray-500">{item.label}</span>
              <div className="hidden h-1 w-16 shrink-0 overflow-hidden rounded-full bg-gray-100 sm:block">
                <div className="h-full rounded-full" style={{ width: `${item.percentage}%`, backgroundColor: item.color }} />
              </div>
              <span className={`w-8 shrink-0 text-right text-[11px] font-semibold text-gray-900 ${NUM}`}>{item.count}</span>
              <span className={`w-9 shrink-0 text-right text-[11px] text-gray-400 ${NUM}`}>{item.percent}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Tab ──────────────────────────────────────────────────────────────────
   The underline is the button's own bottom border, so it is always exactly
   as wide as the tab it belongs to.
   ------------------------------------------------------------------------ */
const Tab = ({ label, isActive, onClick }: { label: string; isActive: boolean; onClick: () => void }) => {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={isActive}
      className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
        isActive
          ? 'border-[#1FAE5B] font-semibold text-[#0F6B3E]'
          : 'border-transparent font-medium text-gray-500 hover:border-gray-200 hover:text-gray-900'
      }`}
    >
      {label}
    </button>
  )
}

const InlineFilterPanel = ({
  isOpen,
  filters,
  onFilterChange,
  platformOptions,
  dateOptions,
  nicheOptions,
  locationOptions,
  onReset,
  hasActiveFilters,
}: {
  isOpen: boolean;
  filters: any;
  onFilterChange: (key: string, value: string) => void;
  platformOptions: any[];
  dateOptions: any[];
  nicheOptions: any[];
  locationOptions: any[];
  onReset: () => void;
  hasActiveFilters: boolean;
}) => {
  if (!isOpen) return null

  return (
    <div className="animate-slideIn">
      {/* "FILTER BY" + Clear all — the same panel header the post-tracker
          filter panel uses, down to the weights and the red hover. */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wide text-gray-800">Filter by</span>
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-xs text-gray-400 transition hover:text-red-500"
          >
            <IconX size={12} /> Clear all
          </button>
        )}
      </div>

      {/* One row of four from lg, where the popover is button-anchored and has
          room. Fixed 150px columns, not fractions: a viewport breakpoint like
          `md:grid-cols-4` squeezed four selects into ~90px inside the panel and
          truncated their labels. Two up below lg, where the panel is a
          header-width sheet. */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-3 lg:grid-cols-[repeat(4,150px)]">
        <FilterField label="Platform" value={filters.platform} options={platformOptions} onChange={(v) => onFilterChange('platform', v)} />
        <FilterField label="Date range" value={filters.dateRange} options={dateOptions} onChange={(v) => onFilterChange('dateRange', v)} />
        <FilterField label="Niche" value={filters.niche} options={nicheOptions} onChange={(v) => onFilterChange('niche', v)} />
        <FilterField label="Location" value={filters.location} options={locationOptions} onChange={(v) => onFilterChange('location', v)} />
      </div>
    </div>
  )
}

/**
 * One labelled select. `appearance-none` strips the OS dropdown arrow, so the
 * chevron is drawn explicitly — that is what keeps the control identical
 * across browsers and matching the rest of the app.
 */
const FilterField = ({
  label, value, options, onChange,
}: {
  label: string; value: string; options: any[]; onChange: (value: string) => void
}) => (
  <div className="flex min-w-0 flex-col gap-1">
    <label className={FIELD_LABEL}>{label}</label>
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={SELECT} aria-label={label}>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <IconChevronDown
        size={14}
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"
      />
    </div>
  </div>
)

const DonutChart = ({ segments, centerLabel, centerSub, size = 130 }: { segments: { label: string; value: number; color: string }[]; centerLabel: string | number; centerSub: string; size?: number }) => {
  const total = segments.reduce((a, s) => a + s.value, 0)
  if (total === 0) {
    return <div className="flex h-[130px] items-center justify-center"><EmptyState>No data for the current filter.</EmptyState></div>
  }

  const r = 44, cx = size / 2, cy = size / 2, stroke = 18
  let paths = '', offset = 0
  const circ = 2 * Math.PI * r

  segments.forEach(s => {
    if (s.value === 0) return
    const frac = s.value / total
    const dash = frac * circ
    const gap = circ - dash
    paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${stroke}" stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}" stroke-dashoffset="${(-offset * circ).toFixed(2)}" stroke-linecap="butt" transform="rotate(-90 ${cx} ${cy})"/>`
    offset += frac
  })

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f0f0ee" strokeWidth={stroke} />
        <g dangerouslySetInnerHTML={{ __html: paths }} />
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#1E1E1E" fontFamily="Inter, sans-serif">{centerLabel}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" fill="#888" fontFamily="Inter, sans-serif">{centerSub}</text>
      </svg>
      {/* min-w-[240px]: below that the legend wraps under the chart and takes the
          card's full width, rather than truncating its longest label. */}
      <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
        {segments.map(s => (
          <div key={s.label} className="flex min-w-0 items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="min-w-0 flex-1 truncate text-xs text-gray-600">{s.label}</span>
            <span className={`w-8 shrink-0 text-right text-xs font-semibold text-gray-900 ${NUM}`}>{s.value}</span>
            <span className={`w-9 shrink-0 text-right text-[11px] text-gray-400 ${NUM}`}>{formatPercent(s.value, total)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// Main Analytics Component
// ============================================================

function AnalyticsPageContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const brandId = searchParams.get("brandId")

  const [influencers, setInfluencers] = useState<AnalyticsInfluencer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(0)
  const [filters, setFilters] = useState({
    platform: "all",
    niche: "all",
    location: "all",
    dateRange: "all"
  })
  const [showFilters, setShowFilters] = useState(false)
  const [search, setSearch] = useState("")
  const filterContainerRef = useRef<HTMLDivElement>(null)

  // Close the filter popover on an outside click — the behaviour the other
  // toolbars have, and what filterContainerRef was always declared for.
  useEffect(() => {
    if (!showFilters) return
    const onPointerDown = (event: MouseEvent) => {
      if (!filterContainerRef.current?.contains(event.target as Node)) setShowFilters(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [showFilters])

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
    }
  }, [status, router])

  // Fetch analytics data
  const fetchAnalytics = useCallback(async () => {
    if (!session?.user?.id || !brandId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        brandId,
        platform: filters.platform,
        niche: filters.niche,
        location: filters.location,
        dateRange: filters.dateRange,
      })

      const response = await fetch(`/api/analytics?${params.toString()}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      setInfluencers(result.data || [])
    } catch (err) {
      console.error("[Analytics] Error fetching data:", err)
      setError(err instanceof Error ? err.message : "Failed to load analytics data")
    } finally {
      setIsLoading(false)
    }
  }, [session?.user?.id, brandId, filters.platform, filters.niche, filters.location, filters.dateRange])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const resetFilters = () => {
    setFilters({
      platform: "all",
      niche: "all",
      location: "all",
      dateRange: "all"
    })
  }

  const hasActiveFilters = filters.platform !== "all" || filters.niche !== "all" || filters.location !== "all" || filters.dateRange !== "all"
  // Presentation only — how many of the four filters are narrowed, for the
  // count pill on the Filters button (the pattern used in post-tracker).
  const activeFilterCount = [filters.platform, filters.niche, filters.location, filters.dateRange]
    .filter(v => v !== "all").length

  /**
   * Name/handle search, applied to the server-filtered dataset.
   *
   * This is the ONLY place search is applied, and it happens upstream of
   * calculateMetrics — so every KPI, funnel stage, rejection breakdown,
   * platform row, EMV figure and donut on every tab is computed from the
   * matching subset. Matching mirrors the Post Tracker's search exactly
   * (name OR handle, case-insensitive substring).
   */
  const visibleInfluencers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return influencers
    return influencers.filter(i =>
      (i.name ?? "").toLowerCase().includes(q) ||
      (i.instagramHandle ?? "").toLowerCase().includes(q)
    )
  }, [influencers, search])

  // Calculate metrics from real data
  const calculateMetrics = () => {
    const dataToUse = visibleInfluencers

    // ── Funnel stages are CUMULATIVE ────────────────────────────────────────
    // pipelineStatus is a mutually-exclusive CURRENT state, so an influencer who
    // has already Posted is not sitting in "In Conversation" any more. The old
    // definitions mixed the two ideas: `responded` counted only the two earliest
    // states while `closed` counted the four later ones, so closed/responded
    // could exceed 100% (2 closed ÷ 1 responded = 200%) and "not interested"
    // was divided by `responded` instead of everyone reached (150%).
    //
    // A funnel stage must count everyone who reached it OR PASSED THROUGH it:
    //   responded ⊇ closed, so closing rate can no longer exceed 100% by
    //   construction — no clamping involved.
    const RESPONDED_OR_BEYOND = ["In Conversation", "Onboarded", "In Transit", "Content Pending", "Posted"]
    const CLOSED_OR_BEYOND    = ["Onboarded", "In Transit", "Content Pending", "Posted"]

    const totalOutreach = dataToUse.length
    const responded = dataToUse.filter(i => RESPONDED_OR_BEYOND.includes(i.pipelineStatus)).length
    const closed = dataToUse.filter(i => CLOSED_OR_BEYOND.includes(i.pipelineStatus)).length
    // "Rejected" is left out of `responded`: a decline can be recorded without
    // the creator ever replying (e.g. "Ghosted / no longer active"), so counting
    // every rejection as a response would inflate the response rate.
    const notInterested = dataToUse.filter(i => i.pipelineStatus === "Rejected").length
    const responseRate = totalOutreach > 0 ? (responded / totalOutreach) * 100 : 0
    const closingRate = responded > 0 ? (closed / responded) * 100 : 0

    // Hard/Soft pass breakdown
    const hardPassReasons = [
      'Fee too low / unpaid', 'Brief too scripted', "Won't allow content reuse",
      'Working with a competitor', "Product doesn't fit their brand",
      'Wrong audience fit', 'Seen bad reviews about us', 'Others'
    ]
    const softPassReasons = ['Fully booked', "Temporarily unavailable / can't shoot", "Can't ship to their location", 'Ghosted / no longer active', 'Rate / deadline too tight']

    const reasonsBreakdown: Record<string, number> = {}
    const allReasons = [...hardPassReasons, ...softPassReasons]
    allReasons.forEach(r => { reasonsBreakdown[r] = 0 })

    dataToUse.filter(i => i.rejectionReason).forEach(i => {
      const reason = i.rejectionReason || 'Others'
      if (allReasons.includes(reason)) {
        reasonsBreakdown[reason] = (reasonsBreakdown[reason] || 0) + 1
      }
      else reasonsBreakdown['Others'] = (reasonsBreakdown['Others'] || 0) + 1
    })

    const hardTotal = hardPassReasons.reduce((sum, r) => sum + (reasonsBreakdown[r] || 0), 0)
    const softTotal = softPassReasons.reduce((sum, r) => sum + (reasonsBreakdown[r] || 0), 0)

    const noOrderYet = dataToUse.filter(i => i.pipelineStatus === "Prospect" || i.pipelineStatus === "Reached Out").length
    const inTransit = dataToUse.filter(i => i.pipelineStatus === "In Transit").length
    const deliveryProblem = dataToUse.filter(i => i.pipelineStatus === "Delivery Problem").length
    const noPost = dataToUse.filter(i => i.pipelineStatus === "Content Pending").length
    const posted = dataToUse.filter(i => i.pipelineStatus === "Posted").length
    const closedCollaborations = closed
    const receivedProduct = noPost + posted
    const postRate = receivedProduct > 0 ? (posted / receivedProduct) * 100 : 0

    const platformStats = {
      Instagram: { posted: 0, received: 0, views: 0, likes: 0, comments: 0 },
      TikTok: { posted: 0, received: 0, views: 0, likes: 0, comments: 0 },
      YouTube: { posted: 0, received: 0, views: 0, likes: 0, comments: 0 }
    }

    dataToUse.forEach(i => {
      const platform = i.platform
      if (platform === 'Instagram' || platform === 'TikTok' || platform === 'YouTube') {
        const p = platform as keyof typeof platformStats
        if (i.pipelineStatus === 'Posted') {
          platformStats[p].posted++
          platformStats[p].views += i.views || 0
          platformStats[p].likes += i.likes || 0
          platformStats[p].comments += i.comments || 0
        }
        if (i.pipelineStatus === 'Posted' || i.pipelineStatus === 'Content Pending') {
          platformStats[p].received++
        }
      }
    })

    const emvRates = { Instagram: 10, TikTok: 6, YouTube: 18 }
    const totalViews = Object.values(platformStats).reduce((sum, p) => sum + p.views, 0)
    const totalLikes = Object.values(platformStats).reduce((sum, p) => sum + p.likes, 0)
    const totalComments = Object.values(platformStats).reduce((sum, p) => sum + p.comments, 0)
    const engagementRate = totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0

    const platformEMV = {
      Instagram: (platformStats.Instagram.views / 1000) * emvRates.Instagram,
      TikTok: (platformStats.TikTok.views / 1000) * emvRates.TikTok,
      YouTube: (platformStats.YouTube.views / 1000) * emvRates.YouTube
    }
    const totalEMV = Object.values(platformEMV).reduce((sum, v) => sum + v, 0)

    const totalClicks = dataToUse.reduce((sum, i) => sum + (i.clicks || 0), 0)
    const totalSalesQty = dataToUse.reduce((sum, i) => sum + (i.salesQty || 0), 0)
    const totalRevenue = dataToUse.reduce((sum, i) => sum + (i.salesAmt || 0), 0)
    const conversionRate = totalClicks > 0 ? (totalSalesQty / totalClicks) * 100 : 0
    const aov = totalSalesQty > 0 ? totalRevenue / totalSalesQty : 0
    const avgSalePerInfluencer = posted > 0 ? totalRevenue / posted : 0
    const influencersWithSales = dataToUse.filter(i => (i.salesQty || 0) > 0).length
    const totalProductCost = dataToUse.reduce((sum, i) => sum + (i.prodCost || 0), 0)

    // Spend/ROI metrics — every component is a stored per-partner figure
    // (BrandPartner.fees_paid / commission_paid / product_cost). The previous
    // code assumed a flat $300 fee per posted influencer and a 10% commission,
    // which invented spend that was never recorded and made ROAS/ROI/profit
    // fiction whenever the real figures differed.
    const totalFeesPaid = dataToUse.reduce((sum, i) => sum + (i.feesPaid || 0), 0)
    const totalCommPaid = dataToUse.reduce((sum, i) => sum + (i.commissionPaid || 0), 0)
    const totalSpend = totalProductCost + totalFeesPaid + totalCommPaid
    const roas = totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : '—'
    const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend * 100).toFixed(1) + '%' : '—'
    const profit = totalRevenue - totalSpend

    // UGC flags have no backing column yet, so the API sends null. Counting
    // nulls as false would render a confident "0 of N" for something that was
    // never recorded — ugcTracked lets the UI say "not tracked" instead.
    const ugcTracked = dataToUse.some(
      i => i.usageRights !== null || i.contentSaved !== null || i.adCode !== null
    )
    const usageRights = dataToUse.filter(i => i.usageRights === true).length
    const contentSaved = dataToUse.filter(i => i.contentSaved === true).length
    const adCodesGiven = dataToUse.filter(i => i.adCode === true).length

    // Aging data for No Post
    const noPostItems = dataToUse.filter(i => i.pipelineStatus === 'Content Pending' && i.deliveredDaysAgo)
    // Every bucket previously reported percentage: 25 and percent: "—", i.e. four
    // identical bars regardless of the data. Both are now derived from the counts.
    const agingBuckets = [
      { label: "≤ 7 days",   color: "#1FAE5B", count: noPostItems.filter(i => i.deliveredDaysAgo! <= 7).length },
      { label: "8–14 days",  color: "#F4B740", count: noPostItems.filter(i => i.deliveredDaysAgo! > 7  && i.deliveredDaysAgo! <= 14).length },
      { label: "15–30 days", color: "#E24B4A", count: noPostItems.filter(i => i.deliveredDaysAgo! > 14 && i.deliveredDaysAgo! <= 30).length },
      { label: "30+ days",   color: "#A32D2D", count: noPostItems.filter(i => i.deliveredDaysAgo! > 30).length },
    ]
    const agingTotal = agingBuckets.reduce((sum, b) => sum + b.count, 0)
    const agingData = agingBuckets.map(b => ({
      ...b,
      percent: formatPercent(b.count, agingTotal),
      percentage: agingTotal === 0 ? 0 : (b.count / agingTotal) * 100,
    }))

    return {
      totalOutreach, responded, closed, notInterested, responseRate, closingRate,
      reasonsBreakdown, hardTotal, softTotal, noOrderYet, inTransit, deliveryProblem,
      noPost, posted, closedCollaborations, receivedProduct, postRate, platformStats,
      platformEMV, totalViews, totalLikes, totalComments, engagementRate, totalEMV,
      totalClicks, totalSalesQty, totalRevenue, conversionRate, aov, avgSalePerInfluencer,
      influencersWithSales, totalProductCost, totalFeesPaid, totalCommPaid, totalSpend,
      ugcTracked,
      roas, roi, profit, usageRights, contentSaved, adCodesGiven, agingData
    }
  }

  const metrics = calculateMetrics()

  // `bg` is the tint behind the platform logo, `color` the progress-bar fill.
  // The logo itself comes from <PlatformBadge>, which owns the brand marks —
  // there is no icon to configure here any more.
  const platformConfig = {
    Instagram: { bg: "#fce4ec", color: "#1FAE5B" },
    TikTok: { bg: "#e8f5e9", color: "#222" },
    YouTube: { bg: "#ffebee", color: "#E24B4A" }
  }

  const reasonColors: Record<string, string> = {
    'Fee too low / unpaid': '#E24B4A', 'Brief too scripted': '#E8724A', "Won't allow content reuse": '#F4A240',
    'Working with a competitor': '#C97B3A', "Product doesn't fit their brand": '#888780', 'Wrong audience fit': '#6B7F7A',
    'Seen bad reviews about us': '#A32D2D', 'Fully booked': '#2C8EC4', "Temporarily unavailable / can't shoot": '#5BAFD4',
    "Can't ship to their location": '#7DC4E4', 'Ghosted / no longer active': '#B4B2A9', 'Rate / deadline too tight': '#F4B740',
    'Others': '#D3D1C7'
  }

  /**
   * Export every analytics section, for the dataset the toolbar is showing.
   *
   * Reads `metrics` — the same object the cards render from — so there is no
   * second copy of any calculation here and the file can never disagree with
   * the screen. `metrics` is derived from `visibleInfluencers`, which already
   * has the server-side filters and the name/handle search applied, so the
   * export matches the user's current selection by construction.
   *
   * The sections mirror the tabs: Campaign Summary, Post Summary, Post Reach &
   * Impression, Conversion & UGC, then the per-influencer detail rows.
   */
  const exportCSV = () => {
    const pctOf = (value: number, total: number) => formatPercent(value, total)
    const untracked = 'Not tracked'

    const sections: (string | number)[][] = []
    const section = (title: string) => { sections.push([], [title]) }
    const row = (...cells: (string | number)[]) => { sections.push(cells) }

    // ── Context: what this file is a snapshot of ────────────────────────────
    section('EXPORT CONTEXT')
    row('Generated', new Date().toISOString())
    row('Brand ID', brandId ?? '')
    row('Search', search.trim() || '(none)')
    row('Platform filter', filters.platform)
    row('Date range filter', filters.dateRange)
    row('Niche filter', filters.niche)
    row('Location filter', filters.location)
    row('Influencers in scope', metrics.totalOutreach)

    // ── Campaign Summary ───────────────────────────────────────────────────
    section('CAMPAIGN SUMMARY')
    row('Metric', 'Value', 'Basis')
    row('Total outreach', metrics.totalOutreach, 'influencers contacted')
    row('Responded', metrics.responded, `of ${metrics.totalOutreach} reached out`)
    row('Response rate', `${Math.round(metrics.responseRate)}%`, 'responded ÷ reached out')
    row('Closed collaborations', metrics.closed, 'agreed to work')
    row('Closing rate', `${Math.round(metrics.closingRate)}%`, 'closed ÷ responded')

    section('CAMPAIGN FUNNEL')
    row('Stage', 'Count', 'Percent', 'Basis')
    row('1. Reached out', metrics.totalOutreach, pctOf(metrics.totalOutreach, metrics.totalOutreach), 'all influencers in scope')
    row('2. Responded', metrics.responded, pctOf(metrics.responded, metrics.totalOutreach), 'of reached out')
    row('3. Closed collaboration', metrics.closed, pctOf(metrics.closed, metrics.responded), 'of responded')
    row('4. Not interested', metrics.notInterested, pctOf(metrics.notInterested, metrics.totalOutreach), 'of reached out')

    section('REASONS NOT INTERESTED')
    row('Bucket', 'Reason', 'Count', 'Percent of declines')
    hardPassReasonsList.filter(r => (metrics.reasonsBreakdown[r] || 0) > 0).forEach(r =>
      row('Hard pass', r, metrics.reasonsBreakdown[r] || 0, pctOf(metrics.reasonsBreakdown[r] || 0, metrics.notInterested)))
    softPassReasonsList.filter(r => (metrics.reasonsBreakdown[r] || 0) > 0).forEach(r =>
      row('Soft pass', r, metrics.reasonsBreakdown[r] || 0, pctOf(metrics.reasonsBreakdown[r] || 0, metrics.notInterested)))
    row('Total', 'All declines', metrics.notInterested, '')
    row('Total', 'Hard pass', metrics.hardTotal, pctOf(metrics.hardTotal, metrics.notInterested))
    row('Total', 'Soft pass (re-approachable)', metrics.softTotal, pctOf(metrics.softTotal, metrics.notInterested))

    // ── Post Summary ───────────────────────────────────────────────────────
    section('POST SUMMARY')
    row('Metric', 'Value', 'Basis')
    row('Closed collaborations', metrics.closedCollaborations, 'agreed to work')
    row('Received product', metrics.receivedProduct, `posted (${metrics.posted}) + no post (${metrics.noPost})`)
    row('Posted', metrics.posted, `of ${metrics.receivedProduct} who received`)
    row('Post rate', `${Math.round(metrics.postRate)}%`, 'posted ÷ received product')

    section('PIPELINE STATUS BREAKDOWN')
    row('Status', 'Count', 'Percent of influencers in scope')
    row('No Order Yet', metrics.noOrderYet, pctOf(metrics.noOrderYet, metrics.totalOutreach))
    row('In Transit', metrics.inTransit, pctOf(metrics.inTransit, metrics.totalOutreach))
    row('Delivery Problem', metrics.deliveryProblem, pctOf(metrics.deliveryProblem, metrics.totalOutreach))
    row('No Post', metrics.noPost, pctOf(metrics.noPost, metrics.totalOutreach))
    row('Posted', metrics.posted, pctOf(metrics.posted, metrics.totalOutreach))

    section('NO-POST AGEING (since delivery)')
    row('Bucket', 'Count', 'Percent')
    metrics.agingData.forEach(b => row(b.label, b.count, b.percent))

    // ── Post Reach & Impression ────────────────────────────────────────────
    section('REACH & ENGAGEMENT TOTALS')
    row('Metric', 'Value', 'Basis')
    row('Total views', metrics.totalViews, 'detected posts')
    row('Total likes', metrics.totalLikes, '')
    row('Total comments', metrics.totalComments, '')
    row('Engagement rate', `${metrics.engagementRate.toFixed(2)}%`, '(likes + comments) ÷ views')
    row('Avg views / influencer', metrics.posted > 0 ? Math.round(metrics.totalViews / metrics.posted) : '—', `${metrics.posted} posted`)
    row('Total EMV', Math.round(metrics.totalEMV), 'all platforms combined')

    section('PLATFORM METRICS')
    row('Platform', 'Posted', 'Received', 'Post rate', 'Views', 'Likes', 'Comments', 'EMV ($)', 'EMV rate ($/1k views)')
    Object.entries(metrics.platformStats).forEach(([platform, stats]) => {
      const emv = metrics.platformEMV[platform as keyof typeof metrics.platformEMV]
      row(
        platform, stats.posted, stats.received,
        stats.received > 0 ? `${Math.round((stats.posted / stats.received) * 100)}%` : '—',
        stats.views, stats.likes, stats.comments, Math.round(emv),
        platform === 'Instagram' ? 10 : platform === 'TikTok' ? 6 : 18
      )
    })

    // ── Conversion & UGC ───────────────────────────────────────────────────
    section('CONVERSION')
    row('Metric', 'Value', 'Basis')
    row('Web clicks', metrics.totalClicks, 'affiliate attribution')
    row('Total sales (units)', metrics.totalSalesQty, '')
    row('Total revenue ($)', metrics.totalRevenue, 'influencer-driven sales')
    row('Conversion rate', `${metrics.conversionRate.toFixed(1)}%`, 'units ÷ clicks')
    row('Avg order value ($)', Math.round(metrics.aov), 'revenue ÷ units sold')
    row('Avg sale per influencer ($)', Math.round(metrics.avgSalePerInfluencer), 'revenue ÷ all who posted')
    row('Influencers with sales', metrics.influencersWithSales, pctOf(metrics.influencersWithSales, metrics.posted) + ' of those who posted')

    section('CAMPAIGN SPEND & RETURN')
    row('Metric', 'Value', 'Basis')
    row('Total revenue ($)', metrics.totalRevenue, 'from influencer-driven sales')
    row('Product cost / COGS ($)', metrics.totalProductCost, 'per-partner product cost')
    row('Creator fees paid ($)', metrics.totalFeesPaid, 'per-partner fees paid')
    row('Commission paid ($)', metrics.totalCommPaid, 'per-partner commission paid')
    row('Total spend ($)', metrics.totalSpend, 'COGS + fees + commission')
    row('Net profit / loss ($)', metrics.profit, 'revenue − total spend')
    row('ROAS', metrics.roas === '—' ? '—' : `${metrics.roas}x`, 'revenue ÷ total spend')
    row('ROI', metrics.roi, 'net profit ÷ total spend')
    row('Break-even ($)', metrics.totalSpend, 'min revenue needed')

    section('UGC')
    row('Metric', 'Value', 'Basis')
    // Mirrors the UI: these have no backing column yet, so the export says so
    // rather than writing a 0 that reads as a real measurement.
    row('Usage rights granted', metrics.ugcTracked ? metrics.usageRights : untracked,
      metrics.ugcTracked ? pctOf(metrics.usageRights, metrics.posted) + ' of those who posted' : 'no source field in schema')
    row('Content saved', metrics.ugcTracked ? metrics.contentSaved : untracked,
      metrics.ugcTracked ? pctOf(metrics.contentSaved, metrics.usageRights) + ' of usage rights granted' : 'no source field in schema')
    row('Ad codes given', metrics.ugcTracked ? metrics.adCodesGiven : untracked,
      metrics.ugcTracked ? pctOf(metrics.adCodesGiven, metrics.posted) + ' of those who posted' : 'no source field in schema')

    // ── Per-influencer detail (the original export, unchanged in meaning) ───
    section('INFLUENCER DETAIL')
    row('Name', 'Handle', 'Platform', 'Niche', 'Location', 'Date Added', 'Pipeline Status',
      'Rejection Reason', 'Views', 'Likes', 'Comments', 'Web Clicks', 'Sales (Units)',
      'Revenue ($)', 'Product Cost ($)', 'Fees Paid ($)', 'Commission Paid ($)',
      'Usage Rights', 'Content Saved', 'Ad Code Given')
    const flag = (v: boolean | null) => v === null ? untracked : v ? 'Yes' : 'No'
    visibleInfluencers.forEach(i => row(
      i.name || '', i.instagramHandle || '', i.platform || '', i.niche || '', i.location || '',
      i.createdAt?.split('T')[0] || '', i.pipelineStatus || '', i.rejectionReason || '',
      i.views || 0, i.likes || 0, i.comments || 0, i.clicks || 0, i.salesQty || 0, i.salesAmt || 0,
      i.prodCost || 0, i.feesPaid || 0, i.commissionPaid || 0,
      flag(i.usageRights), flag(i.contentSaved), flag(i.adCode)
    ))

    // Proper RFC-4180 quoting. The previous export joined raw values with
    // commas, so any reason, niche or location containing a comma silently
    // shifted every later column in that row.
    const escape = (cell: string | number) => {
      const text = String(cell ?? '')
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    }
    const csvContent = sections.map(r => r.map(escape).join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'instroom_analytics.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const platformOptions = [
    { value: "all", label: "All platforms" },
    { value: "Instagram", label: "Instagram" },
    { value: "YouTube", label: "YouTube" },
    { value: "TikTok", label: "TikTok" }
  ]

  const dateOptions = [
    { value: "all", label: "All time" },
    { value: "7", label: "Last 7 days" },
    { value: "30", label: "Last 30 days" },
    { value: "90", label: "Last 90 days" },
    { value: "month", label: "This month" }
  ]

  const nicheOptions = [
    { value: "all", label: "All niches" },
    { value: "Beauty", label: "Beauty" },
    { value: "Fitness", label: "Fitness" },
    { value: "Lifestyle", label: "Lifestyle" },
    { value: "Food", label: "Food" },
    { value: "Tech", label: "Tech" }
  ]

  const locationOptions = [
    { value: "all", label: "All locations" },
    { value: "PH", label: "Philippines" },
    { value: "SG", label: "Singapore" },
    { value: "US", label: "United States" },
    { value: "AU", label: "Australia" }
  ]

  const hardPassReasonsList = [
    'Fee too low / unpaid', 'Brief too scripted', "Won't allow content reuse",
    'Working with a competitor', "Product doesn't fit their brand",
    'Wrong audience fit', 'Seen bad reviews about us', 'Others'
  ]
  const softPassReasonsList = ['Fully booked', "Temporarily unavailable / can't shoot", "Can't ship to their location", 'Ghosted / no longer active', 'Rate / deadline too tight']

  const visibleHardReasons = hardPassReasonsList.filter(r => (metrics.reasonsBreakdown[r] || 0) > 0)
  const visibleSoftReasons = softPassReasonsList.filter(r => (metrics.reasonsBreakdown[r] || 0) > 0)
  // Same selection as before — hoisted out of the JSX so the card can tell
  // whether it has anything to show before it starts rendering rows.
  // Highest platform EMV — the shared scale for the EMV bars.
  const maxPlatformEMV = Math.max(0, ...Object.values(metrics.platformEMV).map(v => Math.round(v)))
  // Largest single reason count on the card — the shared scale for its bars.
  const maxReasonCount = Math.max(
    0,
    ...[...visibleHardReasons, ...visibleSoftReasons].map(r => metrics.reasonsBreakdown[r] || 0)
  )
  const topRejectionReasons = Object.entries(metrics.reasonsBreakdown)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  if (status === "loading" || isLoading) {
    return <DashboardSkeleton label="Fetching data..." />
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <div className="mb-2 text-lg text-red-600">Error loading data</div>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => fetchAnalytics()}
            className="mt-4 h-9 rounded-lg bg-[#1FAE5B] px-4 text-sm font-medium text-white transition-colors hover:bg-[#178a48] focus:outline-none focus:ring-2 focus:ring-[#1FAE5B] focus:ring-offset-1"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* ── Toolbar + tabs ────────────────────────────────────────────────
          One sticky block instead of two independently stuck bars. The tabs
          used to carry a hard-coded top-[73px] that had to match the
          toolbar's exact height; nesting both in a single sticky container
          means the offset can't fall out of sync.
          ------------------------------------------------------------------ */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        {/* Search → Filters → count. Same order, controls and geometry as the
            Post Tracker / Manage Influencers toolbars (post-tracker/page.tsx:1193). */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6">
          <div className="relative min-w-[200px] max-w-xs flex-1">
            <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              aria-label="Search influencer"
              data-tour="analytics-search"
              className="h-9 w-full rounded-lg border border-[#0F6B3E]/20 pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-[#1FAE5B]"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
              >
                <IconX size={14} />
              </button>
            )}
          </div>

          {/* Anchor: static below lg so the panel spans the header (no overflow),
              button-anchored from lg up where the single row fits. */}
          <div className="static lg:relative" ref={filterContainerRef}>
            <button
              onClick={() => setShowFilters(!showFilters)}
              aria-expanded={showFilters}
              data-tour="analytics-filters"
              className={`${CONTROL} flex items-center gap-1.5 border px-3 font-medium transition-colors ${
                hasActiveFilters
                  ? 'border-[#1FAE5B] bg-[#1FAE5B] text-white'
                  : 'border-[#0F6B3E]/20 text-gray-700 hover:border-[#0F6B3E]/40'
              }`}
            >
              <IconFilter size={15} />
              Filters
              {activeFilterCount > 0 && (
                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                  hasActiveFilters ? 'bg-white/20 text-white' : 'bg-[#1FAE5B] text-white'
                } ${NUM}`}>
                  {activeFilterCount}
                </span>
              )}
            </button>

            {showFilters && (
              /* Width is content-driven (w-max) rather than a fixed 420px: the
                 four dropdowns set their own widths below, so the panel is
                 exactly as wide as one clean row needs and no wider. On mobile
                 it spans the viewport minus the page gutter instead. p-4 keeps
                 it compact; left-0 hangs it directly under the button. */
              <div className="absolute left-4 right-4 top-full z-30 mt-2 rounded-xl border border-gray-200 bg-white p-4 shadow-lg lg:left-0 lg:right-auto lg:w-max lg:max-w-[calc(100vw-3rem)]">
                <InlineFilterPanel
                  isOpen={showFilters}
                  filters={filters}
                  onFilterChange={handleFilterChange}
                  platformOptions={platformOptions}
                  dateOptions={dateOptions}
                  nicheOptions={nicheOptions}
                  locationOptions={locationOptions}
                  onReset={resetFilters}
                  hasActiveFilters={hasActiveFilters}
                />
              </div>
            )}
          </div>

          {/* Subtle metadata, and it counts the subset actually being charted. */}
          <p className={`text-xs text-gray-500 ${NUM}`}>
            Showing {metrics.totalOutreach} influencer{metrics.totalOutreach !== 1 ? 's' : ''}
            {search && <span className="text-gray-400"> for “{search}”</span>}
          </p>

          <button onClick={exportCSV} data-tour="analytics-export" className={`${BTN_SECONDARY} ml-auto`}>
            <IconDownload size={16} className="text-[#1FAE5B]" />
            Export CSV
          </button>
        </div>

        {/* Scrolls horizontally on narrow screens rather than wrapping into
            two rows of tabs; the scrollbar itself is hidden. */}
        <div
          role="tablist"
          aria-label="Analytics views"
          data-tour="analytics-tabs"
          className="flex gap-1 overflow-x-auto border-t border-gray-100 px-4 sm:px-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <Tab label="Campaign Summary" isActive={activeTab === 0} onClick={() => setActiveTab(0)} />
          <Tab label="Post Summary" isActive={activeTab === 1} onClick={() => setActiveTab(1)} />
          <Tab label="Post Reach & Impression" isActive={activeTab === 2} onClick={() => setActiveTab(2)} />
          <Tab label="Conversion & UGC" isActive={activeTab === 3} onClick={() => setActiveTab(3)} />
        </div>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 p-4 sm:p-6">
        {/* Tab 0: Campaign Summary */}
        {activeTab === 0 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <MetricCard label="Total outreach" value={metrics.totalOutreach} subLabel="influencers contacted" />
              <MetricCard label="Responded" value={metrics.responded} subLabel={`of ${metrics.totalOutreach} reached out`} />
              <MetricCard label="Response rate" value={`${Math.round(metrics.responseRate)}%`} subLabel={`${metrics.responded} responded`} isGreen />
              <MetricCard label="Closed collaborations" value={metrics.closed} subLabel="agreed to work" />
              <MetricCard label="Closing rate" value={`${Math.round(metrics.closingRate)}%`} subLabel={`of ${metrics.responded} who responded`} isGreen />
            </div>

            <div className="grid items-start gap-4 md:grid-cols-2">
              {/* Campaign Funnel */}
              <SectionCard title="Campaign funnel">
                <FunnelStep index={1} name="Reached out" value={metrics.totalOutreach} total={metrics.totalOutreach} color="#1FAE5B" />
                <FunnelStep index={2} name="Responded" value={metrics.responded} total={metrics.totalOutreach} color="#1FAE5B"
                  dropOff={metrics.totalOutreach > 0 ? `▼ ${Math.round((1 - metrics.responded / metrics.totalOutreach) * 100)}% drop-off` : undefined} />
                <FunnelStep index={3} name="Closed collaboration" value={metrics.closed} total={metrics.responded} color="#5BC98A"
                  dropOff={metrics.responded > 0 ? `▼ ${Math.round((1 - metrics.closed / metrics.responded) * 100)}% closing drop-off` : undefined} />
                <FunnelStep index={4} name="Not interested" value={metrics.notInterested} total={metrics.totalOutreach} color="#E24B4A" isLast />
              </SectionCard>

              {/* Reasons not interested */}
              <SectionCard
                title="Reasons not interested"
                hint="· hover a reason for context"
                footer={
                  metrics.notInterested > 0 ? (
                    /* Three aligned figures instead of a sentence — the same
                       information, but scannable and far quieter. */
                    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                      <span className={`text-xs text-gray-500 ${NUM}`}>
                        <span className="font-semibold text-gray-900">{metrics.notInterested}</span> total declines
                      </span>
                      <span className={`text-xs text-gray-500 ${NUM}`}>
                        <span className="font-semibold text-rose-700">{metrics.hardTotal}</span> hard pass
                      </span>
                      <span className={`text-xs text-gray-500 ${NUM}`}>
                        <span className="font-semibold text-sky-700">{metrics.softTotal}</span> soft pass
                      </span>
                    </div>
                  ) : undefined
                }
              >
                <div className="space-y-5">
                  <div>
                    <ReasonGroupHeading tone="hard" label="Hard pass" note="— don't reach out soon" total={metrics.hardTotal} />
                    {visibleHardReasons.length > 0 ? (
                      visibleHardReasons.map(reason => (
                        <ReasonRow key={reason} name={reason} count={metrics.reasonsBreakdown[reason] || 0} total={metrics.notInterested} max={maxReasonCount} color={reasonColors[reason]} />
                      ))
                    ) : (
                      <EmptyState>None in current filter.</EmptyState>
                    )}
                  </div>

                  <div className="border-t border-gray-100 pt-3">
                    <ReasonGroupHeading tone="soft" label="Soft pass" note="— timing/logistics only, follow up next campaign" total={metrics.softTotal} />
                    {visibleSoftReasons.length > 0 ? (
                      visibleSoftReasons.map(reason => (
                        <ReasonRow key={reason} name={reason} count={metrics.reasonsBreakdown[reason] || 0} total={metrics.notInterested} max={maxReasonCount} color={reasonColors[reason]} />
                      ))
                    ) : (
                      <EmptyState>None in current filter.</EmptyState>
                    )}
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Hard vs Soft Pass Donut */}
            <div className="grid items-start gap-4 md:grid-cols-2">
              <SectionCard title="Hard pass vs Soft pass">
                <DonutChart
                  segments={[
                    { label: 'Hard pass', value: metrics.hardTotal, color: '#E24B4A' },
                    { label: 'Soft pass (re-approachable)', value: metrics.softTotal, color: '#2C8EC4' }
                  ]}
                  centerLabel={metrics.notInterested}
                  centerSub="total declines"
                />
              </SectionCard>

              <SectionCard title="Top rejection reasons">
                <div className="space-y-1.5">
                  {topRejectionReasons.length === 0 && (
                    <EmptyState>No rejections in current filter.</EmptyState>
                  )}
                  {topRejectionReasons
                    .map(([reason, count]) => (
                      <div key={reason} className="flex min-w-0 items-center gap-2.5 rounded-lg bg-gray-50 px-2.5 py-2">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: reasonColors[reason] || '#888' }} />
                        <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{reason}</span>
                        <span className={`shrink-0 text-[10px] font-semibold uppercase ${hardPassReasonsList.includes(reason) ? 'text-rose-600' : 'text-sky-600'}`}>
                          {hardPassReasonsList.includes(reason) ? 'Hard' : 'Soft'}
                        </span>
                        <span className={`w-8 shrink-0 text-right text-sm font-semibold text-gray-900 ${NUM}`}>{count}</span>
                      </div>
                    ))}
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {/* Tab 1: Post Summary */}
        {activeTab === 1 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard label="Closed collaborations" value={metrics.closedCollaborations} subLabel="agreed to work" />
              <MetricCard label="Received product" value={metrics.receivedProduct} subLabel={`posted (${metrics.posted}) + no post (${metrics.noPost})`} />
              <MetricCard label="Posted" value={metrics.posted} subLabel={`of ${metrics.receivedProduct} who received`} isGreen />
              <MetricCard label="Post rate" value={`${Math.round(metrics.postRate)}%`} subLabel="posted ÷ received product" isGreen />
            </div>

            <div className="grid items-start gap-4 md:grid-cols-2">
              <SectionCard
                title="Pipeline status breakdown"
                footnote="% is each state's share of all influencers in view — these stages are mutually exclusive. Post rate uses received (Posted + No Post) as its base."
              >
                <PipelineItem status="No Order Yet" count={metrics.noOrderYet} total={metrics.totalOutreach} color="#B4B2A9" />
                <PipelineItem status="In Transit" count={metrics.inTransit} total={metrics.totalOutreach} color="#2C8EC4" />
                <PipelineItem status="Delivery Problem" count={metrics.deliveryProblem} total={metrics.totalOutreach} color="#E24B4A" />
                <PipelineItem status="No Post" count={metrics.noPost} total={metrics.totalOutreach} color="#F4B740" agingData={metrics.agingData} />
                <PipelineItem status="Posted" count={metrics.posted} total={metrics.totalOutreach} color="#1FAE5B" />
              </SectionCard>

              <SectionCard title="Post rate by platform" hint="Posted ÷ Received">
                {Object.entries(metrics.platformStats).map(([platform, stats]) => (
                  <PlatformRow key={platform} platform={platform} posted={stats.posted} received={stats.received}
                    color={platformConfig[platform as keyof typeof platformConfig].color}
                    iconBg={platformConfig[platform as keyof typeof platformConfig].bg} />
                ))}
              </SectionCard>
            </div>

            <SectionCard title="Posted vs Not Posted">
              <DonutChart
                segments={[
                  { label: 'Posted', value: metrics.posted, color: '#1FAE5B' },
                  { label: 'No Post', value: metrics.noPost, color: '#F4B740' },
                  { label: 'No Order Yet', value: metrics.noOrderYet, color: '#B4B2A9' },
                  { label: 'In Transit', value: metrics.inTransit, color: '#2C8EC4' },
                  { label: 'Delivery Problem', value: metrics.deliveryProblem, color: '#E24B4A' }
                ]}
                centerLabel={Math.round(metrics.postRate)}
                centerSub="post rate"
              />
            </SectionCard>
          </div>
        )}

        {/* Tab 2: Post Reach & Impression */}
        {activeTab === 2 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile value={formatNumber(metrics.totalViews)} label="Total views" />
              <StatTile value={formatNumber(metrics.totalLikes)} label="Total likes" />
              <StatTile value={formatNumber(metrics.totalComments)} label="Total comments" />
              <StatTile value={formatMoney(Math.round(metrics.totalEMV))} label="Total EMV" />
            </div>

            <div className="grid items-start gap-4 md:grid-cols-2">
              <SectionCard
                title="EMV by platform"
                hint="(Estimated Media Value)"
                footnote="Rates: Instagram $10 · TikTok $6 · YouTube $18 per 1,000 views"
              >
                {Object.entries(metrics.platformEMV).map(([platform, emv]) => (
                  <EMVRow key={platform} platform={platform} views={metrics.platformStats[platform as keyof typeof metrics.platformStats].views}
                    emv={Math.round(emv)} maxEmv={maxPlatformEMV} color={platformConfig[platform as keyof typeof platformConfig].color}
                    iconBg={platformConfig[platform as keyof typeof platformConfig].bg}
                    rate={platform === 'Instagram' ? 10 : platform === 'TikTok' ? 6 : 18} />
                ))}
              </SectionCard>

              <SectionCard title="Engagement breakdown">
                <div className="divide-y divide-gray-100 [&>*]:py-3 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
                  <MetricCard nested label="Engagement rate" value={`${metrics.engagementRate.toFixed(2)}%`} subLabel="(likes + comments) ÷ views" isGreen />
                  <MetricCard nested label="Avg views / influencer" value={metrics.posted > 0 ? formatNumber(Math.round(metrics.totalViews / metrics.posted)) : '—'} subLabel={`${metrics.posted} posted`} />
                  <MetricCard nested label="Total EMV" value={formatMoney(Math.round(metrics.totalEMV))} subLabel="all platforms combined" isGreen />
                </div>
              </SectionCard>
            </div>

            <div className="grid items-start gap-4 md:grid-cols-2">
              <SectionCard title="Views share by platform">
                <DonutChart
                  segments={Object.entries(metrics.platformStats).map(([platform, stats]) => ({ label: platform, value: stats.views, color: platformConfig[platform as keyof typeof platformConfig].color }))}
                  centerLabel={formatNumber(metrics.totalViews)} centerSub="total views"
                />
              </SectionCard>
              <SectionCard title="EMV share by platform">
                <DonutChart
                  segments={Object.entries(metrics.platformEMV).map(([platform, emv]) => ({ label: platform, value: Math.round(emv), color: platformConfig[platform as keyof typeof platformConfig].color }))}
                  centerLabel={`$${Math.round(metrics.totalEMV / 1000)}K`} centerSub="total EMV"
                />
              </SectionCard>
            </div>
          </div>
        )}

        {/* Tab 3: Conversion & UGC */}
        {activeTab === 3 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile value={metrics.totalClicks.toLocaleString()} label="Web clicks" />
              <StatTile value={metrics.totalSalesQty} label="Total sales (units)" />
              <StatTile value={formatMoney(metrics.totalRevenue)} label="Total revenue" />
              <StatTile value={`${metrics.conversionRate.toFixed(1)}%`} label="Conversion rate" />
            </div>

            {/* Campaign Spend & Return */}
            <SectionCard
              title="Campaign spend & return"
              footnote="Total spend = product cost (COGS) + creator fees paid + commission paid"
            >
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-3">
                <MetricCard nested label="Total revenue" value={formatMoney(metrics.totalRevenue)} subLabel="from influencer-driven sales" isGreen />
                <MetricCard nested label="Total spend" value={formatMoney(metrics.totalSpend)} subLabel="COGS + fees + commission" />
                <MetricCard nested label="Net profit / loss" value={`${metrics.profit >= 0 ? '+' : ''}${formatMoney(metrics.profit)}`} subLabel={metrics.profit >= 0 ? 'profitable campaign' : 'loss-making campaign'} isGreen={metrics.profit >= 0} />
                <MetricCard nested label="ROAS" value={metrics.roas !== '—' ? `${metrics.roas}x` : '—'} subLabel="revenue ÷ total spend" isGreen={typeof metrics.roas === 'string' ? parseFloat(metrics.roas) >= 1 : false} />
                <MetricCard nested label="ROI" value={metrics.roi} subLabel="net profit ÷ total spend" isGreen={metrics.profit >= 0} />
                <MetricCard nested label="Break-even" value={formatMoney(metrics.totalSpend)} subLabel="min revenue needed" />
              </div>

              <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-4">
                <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-gray-50 px-2.5 py-2">
                  <span className="min-w-0 truncate text-sm text-gray-600">🛍 Product cost (COGS)</span>
                  <span className={`shrink-0 text-sm font-semibold text-gray-900 ${NUM}`}>{formatMoney(metrics.totalProductCost)}</span>
                </div>
                <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-gray-50 px-2.5 py-2">
                  <span className="min-w-0 truncate text-sm text-gray-600">💸 Creator fees paid</span>
                  <span className={`shrink-0 text-sm font-semibold text-gray-900 ${NUM}`}>{formatMoney(metrics.totalFeesPaid)}</span>
                </div>
                <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-gray-50 px-2.5 py-2">
                  <span className="min-w-0 truncate text-sm text-gray-600">🔗 Commission paid (10%)</span>
                  <span className={`shrink-0 text-sm font-semibold text-gray-900 ${NUM}`}>{formatMoney(metrics.totalCommPaid)}</span>
                </div>
              </div>
            </SectionCard>

            <div className="grid items-start gap-4 md:grid-cols-2">
              <SectionCard title="Additional conversion metrics">
                <div className="divide-y divide-gray-100 [&>*]:py-3 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
                  <MetricCard nested label="Avg order value (AOV)" value={formatMoney(Math.round(metrics.aov))} subLabel="revenue ÷ units sold" isGreen />
                  <MetricCard nested label="Avg sale per influencer" value={formatMoney(Math.round(metrics.avgSalePerInfluencer))} subLabel="revenue ÷ all who posted" isGreen />
                  <MetricCard nested label="Influencers with sales" value={`${metrics.influencersWithSales} (${formatPercent(metrics.influencersWithSales, metrics.posted)})`} subLabel="of those who posted" isGreen />
                  <MetricCard nested label="Product cost (total)" value={formatMoney(metrics.totalProductCost)} subLabel="cost of products sent" />
                </div>
              </SectionCard>

              <SectionCard title="Influencers with sales vs without">
                <DonutChart
                  segments={[
                    { label: 'With sales', value: metrics.influencersWithSales, color: '#1FAE5B' },
                    { label: 'No sales', value: metrics.posted - metrics.influencersWithSales, color: '#f0f0ee' }
                  ]}
                  centerLabel={formatPercent(metrics.influencersWithSales, metrics.posted)}
                  centerSub="conversion rate"
                />
              </SectionCard>
            </div>

            {/* UGC Overview */}
            <div className="space-y-3">
              <div className={LABEL}>UGC overview</div>
              {/* Usage rights, content saved and ad codes have no column in the
                  schema yet, so the API reports them as untracked. Showing "—"
                  and saying so is the honest rendering; a confident "0" would
                  read as "nobody granted rights" rather than "never recorded". */}
              {metrics.ugcTracked ? (
                <>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                    <StatTile value={metrics.usageRights} label="Usage rights granted" sub={`${formatPercent(metrics.usageRights, metrics.posted)} of those who posted`} />
                    <StatTile value={metrics.contentSaved} label="Content saved" sub={`${formatPercent(metrics.contentSaved, metrics.usageRights)} of usage rights granted`} />
                    <StatTile value={metrics.adCodesGiven} label="Ad codes given" sub={`${formatPercent(metrics.adCodesGiven, metrics.posted)} of those who posted`} />
                  </div>

                  <SectionCard
                    title="UGC rights breakdown"
                    footnote={`Content saved (${metrics.contentSaved}) is always ≤ usage rights granted (${metrics.usageRights}). You can only save content you have the rights to use.`}
                  >
                    <DonutChart
                      segments={[
                        { label: 'Usage rights granted', value: metrics.usageRights, color: '#1FAE5B' },
                        { label: 'Content saved', value: metrics.contentSaved, color: '#2C8EC4' },
                        { label: 'Ad code given', value: metrics.adCodesGiven, color: '#F4B740' },
                        { label: 'No rights', value: metrics.posted - metrics.usageRights, color: '#e0e0de' }
                      ]}
                      centerLabel={formatPercent(metrics.usageRights, metrics.posted)}
                      centerSub="rights granted"
                    />
                  </SectionCard>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  <StatTile value="—" label="Usage rights granted" sub="not tracked yet" />
                  <StatTile value="—" label="Content saved" sub="not tracked yet" />
                  <StatTile value="—" label="Ad codes given" sub="not tracked yet" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slideIn { animation: slideIn 0.3s ease-out; }
        .group:hover .group-hover\\:block { display: block; }
      `}</style>
    </div>
  )
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<DashboardSkeleton label="Fetching data..." />}>
      <AnalyticsPageContent />
    </Suspense>
  )
}

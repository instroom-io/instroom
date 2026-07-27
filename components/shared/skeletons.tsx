// Shared skeleton loaders — one visual language (gray-200/gray-100, animate-pulse,
// rounded-xl) reused across every dashboard page instead of ad-hoc spinners and
// "Loading X…" text. Mirrors the shapes already established by the Pipeline
// kanban skeleton (app/dashboard/pipeline/page.tsx).

import type { CSSProperties, ReactNode } from "react"

function Bar({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div className={`bg-gray-200 rounded-md animate-pulse ${className}`} style={style} />
}

function Block({ className = "", style, children }: { className?: string; style?: CSSProperties; children?: ReactNode }) {
  return <div className={`bg-gray-100 rounded-xl border border-gray-200 animate-pulse ${className}`} style={style}>{children}</div>
}

/** Tiny inline spinner — not the big centered kind, just enough to read as "still working". */
function MiniSpinner() {
  return (
    <span className="relative inline-block w-3 h-3 flex-shrink-0">
      <span className="absolute inset-0 rounded-full border-2 border-gray-200" />
      <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#1FAE5B] animate-spin" />
    </span>
  )
}

/** Small, quiet text row sitting above a skeleton — a hint, not a second loading state. */
function SkeletonLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-3 -mb-1 text-xs font-medium text-gray-400">
      <MiniSpinner />
      {children}
    </div>
  )
}

/** Spreadsheet / data-table pages (Influencers List, Brand Partners, etc.) */
export function TableSkeleton({ rows = 8, cols = 6, label }: { rows?: number; cols?: number; label?: string }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      {label && <SkeletonLabel>{label}</SkeletonLabel>}
      {/* toolbar row */}
      <div className="flex items-center gap-2">
        <Bar className="h-9 w-56" />
        <Bar className="h-9 w-24" />
        <div className="flex-1" />
        <Bar className="h-9 w-24" />
        <Bar className="h-9 w-24" />
      </div>

      {/* table */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200">
          {Array.from({ length: cols }).map((_, c) => (
            <Bar key={c} className="h-3 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 last:border-b-0">
            {Array.from({ length: cols }).map((_, c) => (
              <Bar key={c} className={`h-3 flex-1 ${c === 0 ? "max-w-[140px]" : ""}`} style={{ animationDelay: `${r * 30}ms` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Stat-card row, e.g. Analytics summary tiles. */
export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(count, 5)}, minmax(0, 1fr))` }}>
      {Array.from({ length: count }).map((_, i) => (
        <Block key={i} className="h-20 p-3 flex flex-col justify-between" style={{ animationDelay: `${i * 40}ms` }}>
          <Bar className="h-2.5 w-2/3" />
          <Bar className="h-5 w-1/2" />
        </Block>
      ))}
    </div>
  )
}

/** Chart placeholder — donut/bar/line, all read as a soft rounded block. */
export function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <Block className="w-full flex items-center justify-center" style={{ height }}>
      <div className="w-28 h-28 rounded-full border-[14px] border-gray-200" />
    </Block>
  )
}

/** Analytics-style dashboard: stat row(s) + paired charts. */
export function DashboardSkeleton({ label }: { label?: string }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      {label && <SkeletonLabel>{label}</SkeletonLabel>}
      <StatCardsSkeleton count={5} />
      <div className="grid md:grid-cols-2 gap-4">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <StatCardsSkeleton count={4} />
      <div className="grid md:grid-cols-2 gap-4">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  )
}

/** Message/notification-style lists, e.g. Inbox. */
export function ListSkeleton({ rows = 6, label }: { rows?: number; label?: string }) {
  return (
    <div className="flex flex-col gap-2 p-4">
      {label && <SkeletonLabel>{label}</SkeletonLabel>}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100" style={{ animationDelay: `${i * 30}ms` }}>
          <div className="w-9 h-9 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
          <div className="flex-1 flex flex-col gap-1.5">
            <Bar className="h-3 w-1/3" />
            <Bar className="h-2.5 w-2/3" />
          </div>
          <Bar className="h-2.5 w-10 flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}

/** Kanban / board columns — same shape as the Pipeline skeleton, reusable for Post Tracker's board view. */
export function BoardSkeleton({ columns = 4, cardsPerColumn = 3, label }: { columns?: number; cardsPerColumn?: number; label?: string }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      {label && <SkeletonLabel>{label}</SkeletonLabel>}
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: columns }).map((_, col) => (
          <div key={col} className="w-[240px] flex-shrink-0 flex flex-col gap-3">
            <Bar className="h-9 rounded-xl" />
            {Array.from({ length: cardsPerColumn }).map((_, card) => (
              <Block key={card} className="h-24" style={{ animationDelay: `${(col * cardsPerColumn + card) * 30}ms` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

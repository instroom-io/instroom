"use client"
// The loading state for the whole client.
//
// This is a skeleton of the *real* layout, not a spinner and not a generic list
// of grey bars: the same three columns at the same widths, the same header
// height, the same composer at the bottom. That matters for more than looks —
// because the boxes land where the content will land, nothing jumps when the
// data arrives, so there is no reflow to watch.
//
// It is also the ONLY loading state on the way in. There is deliberately no
// spinner before it and no second skeleton after it: one shell appears
// immediately and its contents fill in.

import { motion } from "framer-motion"

/** Staggered so the shell reads as one surface waking up, not 40 separate bars. */
function Bar({
  className,
  delay = 0,
  width,
}: {
  className: string
  delay?: number
  width?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, delay }}
      style={width ? { width } : undefined}
      className={`animate-pulse rounded bg-gray-200/70 ${className}`}
    />
  )
}

function ChannelRailSkeleton() {
  // Two categories with a handful of channels each — the shape of a real server,
  // so the rail doesn't visibly restructure when the true list lands.
  const groups = [5, 3]
  let n = 0
  return (
    <div className="flex h-full flex-col bg-[#F7F9F8]">
      {/* Server switcher header. The padding and icon size are copied from
          ServerSwitcher's own header rather than approximated — a 4px
          difference here is a visible jump in the rail when the real one
          replaces this, which is exactly what a skeleton exists to prevent. */}
      <div className="flex items-center gap-1 border-b border-gray-200/70 px-2 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 px-1.5 py-1">
          <Bar className="h-6 w-6 flex-shrink-0 !rounded-lg" />
          <Bar className="h-3 min-w-0 flex-1" delay={0.04} />
          <Bar className="h-3.5 w-3.5 flex-shrink-0" delay={0.06} />
        </div>
        <Bar className="h-[22px] w-[22px] flex-shrink-0 !rounded" delay={0.08} />
      </div>
      <div className="flex-1 overflow-hidden px-2 py-2">
        {groups.map((count, gi) => (
          <div key={gi} className="mb-3">
            <Bar className="mb-2 ml-1 h-2 w-20" delay={(n++ * 0.03)} />
            <div className="flex flex-col gap-[3px] pl-1">
              {Array.from({ length: count }).map((_, i) => (
                // Varied widths — uniform bars read as a loading graphic,
                // varied ones read as channel names that haven't arrived.
                <div key={i} className="flex items-center gap-1.5 px-2 py-[5px]">
                  <Bar className="h-3.5 w-3.5 flex-shrink-0" delay={n * 0.03} />
                  <Bar className="h-3" delay={n++ * 0.03} width={`${44 + ((i * 17) % 46)}%`} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MessagesSkeleton() {
  const rows = [
    { lines: [72, 46], avatar: true },
    { lines: [58], avatar: true },
    { lines: [88, 64, 36], avatar: true },
    { lines: [42], avatar: true },
    { lines: [76, 52], avatar: true },
    { lines: [64], avatar: true },
  ]
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-end gap-5 px-3 pb-4 sm:px-5">
      {rows.map((r, i) => (
        <div key={i} className="flex gap-3">
          <Bar className="h-9 w-9 flex-shrink-0 !rounded-full" delay={i * 0.05} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Bar className="h-3 w-24" delay={i * 0.05} />
              <Bar className="h-2 w-14" delay={i * 0.05 + 0.02} />
            </div>
            {r.lines.map((w, li) => (
              <Bar key={li} className="h-3" delay={i * 0.05 + li * 0.03} width={`${w}%`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function MemberRailSkeleton() {
  const groups = [4, 3]
  let n = 0
  return (
    <div className="flex h-full flex-col bg-[#F7F9F8]">
      <div className="flex items-center gap-1.5 border-b border-gray-200/70 px-3 py-2.5">
        <Bar className="h-2.5 w-16" />
      </div>
      <div className="flex-1 overflow-hidden px-2 py-2">
        {groups.map((count, gi) => (
          <div key={gi} className="mb-3">
            <Bar className="mb-2 ml-2 h-2 w-16" delay={n++ * 0.03} />
            <div className="flex flex-col gap-[3px]">
              {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1">
                  <Bar className="h-[26px] w-[26px] flex-shrink-0 !rounded-full" delay={n * 0.03} />
                  <Bar className="h-3 flex-1" delay={n++ * 0.03} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CommunitySkeleton() {
  return (
    <div
      // Identical container to the real client, so the swap is a crossfade
      // rather than a layout change.
      className="flex h-[calc(100svh-var(--header-height))] min-h-0 overflow-hidden border-t border-gray-100 bg-white"
      role="status"
      aria-busy="true"
      aria-label="Loading community"
    >
      <aside className="hidden w-[228px] flex-shrink-0 border-r border-gray-100 md:block">
        <ChannelRailSkeleton />
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {/* Channel header */}
        <header className="flex h-12 flex-shrink-0 items-center gap-2 border-b border-gray-100 px-3 sm:px-4">
          <Bar className="h-4 w-4 flex-shrink-0" />
          <Bar className="h-3.5 w-32" delay={0.04} />
          <div className="ml-auto flex items-center gap-2">
            <Bar className="h-7 w-7 !rounded-lg" delay={0.08} />
          </div>
        </header>

        <MessagesSkeleton />

        {/* Composer */}
        <div className="flex-shrink-0 px-3 pb-2.5 sm:px-5">
          <div className="h-4" />
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-1.5">
            <div className="flex items-center gap-1">
              <Bar className="h-8 w-8 !rounded-lg" delay={0.1} />
              <Bar className="h-3 flex-1" delay={0.12} />
              <Bar className="h-8 w-8 !rounded-lg" delay={0.14} />
              <Bar className="h-8 w-8 !rounded-lg" delay={0.16} />
            </div>
          </div>
          <div className="mt-1 px-1">
            <Bar className="h-2 w-56" delay={0.18} />
          </div>
        </div>
      </main>

      <aside className="hidden w-[212px] flex-shrink-0 border-l border-gray-100 lg:block">
        <MemberRailSkeleton />
      </aside>
    </div>
  )
}

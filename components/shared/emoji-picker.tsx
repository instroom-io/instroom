"use client"
// A small emoji picker.
//
// Hand-rolled rather than pulled in as a dependency: the popular pickers ship a
// few hundred KB of emoji metadata and their own virtualised grid, which is a
// lot of bundle for a composer accessory. This covers the emoji people actually
// reach for, with keyword search, and adds nothing to the dependency tree.
//
// Shared by the Discord-style community composer and the inbox's email
// compose editor, so the same shortcut set and "recently used" list appear in
// both.

import { memo, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { IconSearch } from "@tabler/icons-react"

type Group = { name: string; emoji: [string, string][] }

// [emoji, search keywords]
const GROUPS: Group[] = [
  {
    name: "Reactions",
    emoji: [
      ["👍", "thumbs up yes approve like"], ["👎", "thumbs down no disapprove"],
      ["❤️", "heart love red"], ["🔥", "fire hot lit"],
      ["🎉", "tada party celebrate congrats"], ["👏", "clap applause bravo"],
      ["🙌", "raised hands praise yay"], ["💯", "hundred perfect score"],
      ["✅", "check done complete yes"], ["❌", "cross no wrong"],
      ["👀", "eyes looking watching"], ["🚀", "rocket ship launch ship it"],
      ["✨", "sparkles shiny nice"], ["🙏", "pray thanks please"],
      ["🤝", "handshake deal agree"], ["💪", "muscle strong"],
    ],
  },
  {
    name: "Smileys",
    emoji: [
      ["😀", "grin happy smile"], ["😃", "smiley happy"], ["😄", "laugh happy"],
      ["😁", "beam grin"], ["😅", "sweat laugh phew"], ["😂", "joy lol laughing tears"],
      ["🤣", "rofl rolling laughing"], ["🙂", "slight smile"], ["😉", "wink"],
      ["😊", "blush smile shy"], ["😍", "heart eyes love"], ["😘", "kiss"],
      ["😎", "sunglasses cool"], ["🤔", "thinking hmm"], ["🤨", "raised eyebrow skeptical"],
      ["😐", "neutral meh"], ["😴", "sleeping tired zzz"], ["😢", "cry sad tear"],
      ["😭", "sob crying loud"], ["😤", "triumph huff"], ["😡", "rage angry mad"],
      ["🥳", "partying celebrate"], ["🥲", "smiling tear"], ["🤯", "mind blown shocked"],
      ["😱", "scream shocked fear"], ["🤗", "hug"], ["🤫", "shush quiet"],
      ["🫠", "melting"], ["🙃", "upside down"], ["😬", "grimace awkward"],
    ],
  },
  {
    name: "Gestures",
    emoji: [
      ["👋", "wave hello hi bye"], ["🤚", "raised back hand"], ["✋", "raised hand stop"],
      ["👌", "ok perfect"], ["🤌", "pinched fingers"], ["✌️", "victory peace"],
      ["🤞", "crossed fingers hope luck"], ["🤟", "love you"], ["🤙", "call me shaka"],
      ["👈", "point left"], ["👉", "point right"], ["👆", "point up this"],
      ["👇", "point down"], ["☝️", "index up"], ["🖐️", "hand fingers splayed"],
    ],
  },
  {
    name: "Objects",
    emoji: [
      ["💡", "idea bulb light"], ["📌", "pin pushpin"], ["📎", "paperclip attach"],
      ["📈", "chart up growth increase"], ["📉", "chart down decrease"],
      ["📊", "bar chart stats data"], ["🗓️", "calendar date schedule"],
      ["⏰", "alarm clock time"], ["⚠️", "warning caution"], ["🔒", "lock secure private"],
      ["🔑", "key access"], ["🛠️", "tools fix build"], ["🐛", "bug issue defect"],
      ["💰", "money bag cash revenue"], ["🎯", "target goal bullseye"],
      ["📱", "phone mobile"], ["💻", "laptop computer"], ["☕", "coffee"],
      ["🍕", "pizza food"], ["🎂", "cake birthday"],
    ],
  },
  {
    name: "Symbols",
    emoji: [
      ["💚", "green heart"], ["💙", "blue heart"], ["💜", "purple heart"],
      ["🖤", "black heart"], ["🤍", "white heart"], ["🧠", "brain smart"],
      ["⭐", "star favourite"], ["🌟", "glowing star"], ["⚡", "zap lightning fast"],
      ["🌈", "rainbow"], ["☀️", "sun sunny"], ["🌙", "moon night"],
      ["♻️", "recycle"], ["🔴", "red circle live"], ["🟢", "green circle online"],
      ["🟡", "yellow circle idle"], ["⚪", "white circle offline"],
    ],
  },
]

const RECENT_KEY = "instroom:recent-emoji"
const MAX_RECENT = 16

function loadRecent(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((e) => typeof e === "string").slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}

export function rememberEmoji(emoji: string) {
  try {
    const next = [emoji, ...loadRecent().filter((e) => e !== emoji)].slice(0, MAX_RECENT)
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* non-fatal */
  }
}

export const EmojiPicker = memo(function EmojiPicker({
  onPick,
  onClose,
  align = "right",
  side = "top",
}: {
  onPick: (emoji: string) => void
  onClose: () => void
  /** Which edge the popover hangs from, so it can't open off-screen. */
  align?: "left" | "right"
  /** Which side of the trigger the picker opens toward. "top" suits a
   *  composer pinned to the bottom of the screen (Discord); "bottom" suits
   *  a toolbar near the top of a modal (inbox compose), where opening
   *  upward would cover the modal's own header/fields instead. */
  side?: "top" | "bottom"
}) {
  const [query, setQuery] = useState("")
  // Read lazily on mount rather than in an effect. Safe here because the picker
  // only ever mounts in response to a click, so it never renders on the server
  // and there is no hydration pass to mismatch.
  const [recent] = useState<string[]>(loadRecent)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Dismiss on outside click or Escape — the two things a user will try.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.stopPropagation(); onClose() }
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [onClose])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    const hits: string[] = []
    for (const g of GROUPS) {
      for (const [emoji, keywords] of g.emoji) {
        if (keywords.includes(q) || keywords.split(" ").some((k) => k.startsWith(q))) hits.push(emoji)
      }
    }
    return hits
  }, [query])

  function pick(emoji: string) {
    rememberEmoji(emoji)
    onPick(emoji)
  }

  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-label="Pick an emoji"
      initial={{ opacity: 0, y: side === "top" ? 6 : -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: side === "top" ? 6 : -6, scale: 0.97 }}
      transition={{ duration: 0.13, ease: "easeOut" }}
      className={`absolute z-40 w-[min(292px,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl ${
        side === "top" ? "bottom-full mb-2" : "top-full mt-2"
      } ${align === "right" ? "right-0" : "left-0"}`}
    >
      <div className="border-b border-gray-100 p-2">
        <div className="relative">
          <IconSearch size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search emoji"
            aria-label="Search emoji"
            className="h-8 w-full rounded-lg border border-gray-200 bg-gray-50 pl-7 pr-2 text-[12.5px] outline-none focus:border-[#0F6B3E]/40 focus:bg-white"
          />
        </div>
      </div>

      <div className="max-h-[248px] overflow-y-auto p-2">
        {results ? (
          results.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-gray-400">No emoji found.</p>
          ) : (
            <Grid emoji={results} onPick={pick} />
          )
        ) : (
          <>
            {recent.length > 0 && (
              <Section name="Frequently used">
                <Grid emoji={recent} onPick={pick} />
              </Section>
            )}
            {GROUPS.map((g) => (
              <Section key={g.name} name={g.name}>
                <Grid emoji={g.emoji.map(([e]) => e)} onPick={pick} />
              </Section>
            ))}
          </>
        )}
      </div>
    </motion.div>
  )
})

function Section({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
        {name}
      </div>
      {children}
    </div>
  )
}

function Grid({ emoji, onPick }: { emoji: string[]; onPick: (e: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-0.5">
      {emoji.map((e, i) => (
        <button
          key={`${e}-${i}`}
          type="button"
          onClick={() => onPick(e)}
          aria-label={e}
          className="flex h-8 w-8 items-center justify-center rounded-md text-[19px] leading-none transition-transform hover:scale-110 hover:bg-gray-100"
        >
          {e}
        </button>
      ))}
    </div>
  )
}

/** The one-tap row shown in the hover actions, before the full picker. */
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "👀", "🔥"]

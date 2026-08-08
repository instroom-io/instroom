"use client"
// Per-channel unread tracking.
//
// Discord does not expose a user's read state to bots — there is no REST
// endpoint for "which messages has this person seen". So rather than invent a
// number, unread is derived from something real: Discord snowflake ids encode
// their creation time in the high bits, so they sort chronologically. Comparing
// a channel's `lastMessageId` against the last id this browser marked as read
// gives an accurate "there is something newer here" signal.
//
// The consequence worth knowing: read state is per-browser, not per-account, and
// it says *that* a channel has new messages, not how many. A count would need
// the Gateway, and guessing one from a polled history window would be wrong
// often enough to be worse than no number at all.

import { useCallback, useEffect, useMemo, useState } from "react"
import type { Channel } from "./types"

const KEY_PREFIX = "instroom:discord:read:"

type ReadState = Record<string, string>

function load(brandId: string): ReadState {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + brandId)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === "object" ? (parsed as ReadState) : {}
  } catch {
    // Private mode, quota, or corrupt JSON — unread simply degrades to "none".
    return {}
  }
}

/** Snowflakes exceed Number.MAX_SAFE_INTEGER, so compare as BigInt. */
function isNewer(a: string | null, b: string | null | undefined): boolean {
  if (!a) return false
  if (!b) return true
  try {
    return BigInt(a) > BigInt(b)
  } catch {
    return false
  }
}

export function useUnread(brandId: string, channels: Channel[] | null, activeId: string | null) {
  const [readState, setReadState] = useState<ReadState>({})

  // localStorage is read in an effect, not in the initial state, so server and
  // first client render agree and React doesn't report a hydration mismatch.
  useEffect(() => {
    setReadState(load(brandId))
  }, [brandId])

  const persist = useCallback(
    (next: ReadState) => {
      setReadState(next)
      try {
        window.localStorage.setItem(KEY_PREFIX + brandId, JSON.stringify(next))
      } catch {
        /* non-fatal — in-memory state still works for this session */
      }
    },
    [brandId]
  )

  const markRead = useCallback(
    (channelId: string, messageId: string | null) => {
      if (!messageId) return
      setReadState((prev) => {
        if (!isNewer(messageId, prev[channelId])) return prev
        const next = { ...prev, [channelId]: messageId }
        try {
          window.localStorage.setItem(KEY_PREFIX + brandId, JSON.stringify(next))
        } catch {
          /* non-fatal */
        }
        return next
      })
    },
    [brandId]
  )

  /**
   * The active channel is never unread — you are looking at it. Everything else
   * compares its newest message against what this browser has seen.
   */
  const unread = useMemo(() => {
    const set = new Set<string>()
    for (const c of channels ?? []) {
      if (c.id === activeId || c.type === "voice") continue
      if (isNewer(c.lastMessageId, readState[c.id])) set.add(c.id)
    }
    return set
  }, [channels, readState, activeId])

  /** Silences every channel at once, matching Discord's "mark as read". */
  const markAllRead = useCallback(() => {
    const next: ReadState = { ...readState }
    for (const c of channels ?? []) {
      if (c.lastMessageId && isNewer(c.lastMessageId, next[c.id])) next[c.id] = c.lastMessageId
    }
    persist(next)
  }, [channels, readState, persist])

  return { unread, markRead, markAllRead }
}

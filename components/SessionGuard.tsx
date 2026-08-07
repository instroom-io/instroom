"use client"
// Client-side session lifecycle: expiry, and keeping tabs in agreement.
//
// Replaces InactivityProvider, which enforced a 30-minute idle logout that
// contradicted the requirement for a session surviving a browser restart. What
// remains is the part that still matters: noticing the 7-day deadline and
// making every open tab act on it at the same moment.
//
// This is a backstop, not the enforcement. The deadline is baked into the JWT's
// own `exp` claim, so the server rejects an expired cookie whether or not this
// component ever runs. Its job is purely to stop a tab that is sitting open
// from silently becoming useless — every click failing — until someone reloads.

import { useCallback, useEffect, useRef } from "react"
import { useSession, signOut } from "next-auth/react"

/** Same key in every tab; a write in one is an event in the others. */
const LOGOUT_BROADCAST_KEY = "instroom:auth:logout"

/** Where to land, and why, when a session ends on its own. */
const EXPIRED_URL = "/login?reason=expired"

/**
 * How often to re-check the deadline.
 *
 * A timer set directly to the remaining time would not survive a laptop
 * sleeping through the deadline — setTimeout does not fire for time spent
 * suspended. Polling notices on the first tick after waking.
 */
const CHECK_INTERVAL_MS = 60 * 1000

/**
 * Tell every other tab to sign out.
 *
 * localStorage rather than BroadcastChannel: the `storage` event is the more
 * widely supported of the two, fires only in *other* tabs (so no self-trigger),
 * and needs no connection management. The value is a timestamp purely so each
 * broadcast differs from the last — `storage` does not fire when a write leaves
 * the value unchanged, which would swallow a second logout.
 *
 * Nothing about the session is stored here. It is a signal, not state; the
 * session itself stays in an httpOnly cookie the page cannot read.
 */
export function broadcastLogout() {
  try {
    window.localStorage.setItem(LOGOUT_BROADCAST_KEY, String(Date.now()))
  } catch {
    /* storage disabled — other tabs find out on their next session refetch */
  }
}

export default function SessionGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  /** Guards against several triggers racing to call signOut at once. */
  const signingOutRef = useRef(false)

  const endSession = useCallback(async (url: string) => {
    if (signingOutRef.current) return
    signingOutRef.current = true
    broadcastLogout()
    await signOut({ callbackUrl: url })
  }, [])

  // ── The server said this session is over ────────────────────────────────
  useEffect(() => {
    if (session?.error === "SessionExpired") {
      endSession(EXPIRED_URL)
    }
  }, [session?.error, endSession])

  // ── The deadline passes while the tab is open ───────────────────────────
  useEffect(() => {
    if (status !== "authenticated") return
    const expiresAt = session?.expiresAt
    if (typeof expiresAt !== "number") return

    const check = () => {
      if (Date.now() >= expiresAt) endSession(EXPIRED_URL)
    }
    check() // catch a deadline already passed while the tab was suspended
    const id = setInterval(check, CHECK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [status, session?.expiresAt, endSession])

  // ── Another tab signed out ──────────────────────────────────────────────
  // NextAuth already broadcasts its own session updates between tabs, but only
  // as "refetch your session". That leaves a window where a tab still believes
  // it is authenticated. This makes the logout immediate and unambiguous.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== LOGOUT_BROADCAST_KEY || e.newValue === null) return
      if (signingOutRef.current) return
      signingOutRef.current = true
      // No broadcast back — that would bounce the signal around every tab.
      signOut({ callbackUrl: "/login" })
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  return <>{children}</>
}

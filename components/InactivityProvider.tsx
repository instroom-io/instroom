"use client"

import { useEffect, useRef, useCallback } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"

const INACTIVITY_MS = 30 * 60 * 1000       // 30 minutes
const WARNING_BEFORE_MS = 2 * 60 * 1000    // warn 2 minutes before logout
const CHECK_INTERVAL_MS = 30 * 1000        // check every 30 seconds

// Activity events to track
const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
  "pointermove",
]

export default function InactivityProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const lastActivityRef = useRef<number>(Date.now())
  const warningShownRef = useRef<boolean>(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleLogout = useCallback(async () => {
    await signOut({ callbackUrl: "/login?reason=inactivity" })
  }, [])

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
    warningShownRef.current = false

    // Clear any pending warning
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current)
      warningTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    // Only run when authenticated
    if (status !== "authenticated") return

    // If the server already flagged inactivity timeout — log out immediately
    if ((session as any)?.error === "InactivityTimeout") {
      handleLogout()
      return
    }

    // Attach activity listeners
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, resetActivity, { passive: true })
    )

    // Poll every 30s to check inactivity
    intervalRef.current = setInterval(() => {
      const now = Date.now()
      const idle = now - lastActivityRef.current

      if (idle >= INACTIVITY_MS) {
        // 30 minutes of inactivity — log out
        handleLogout()
      } else if (idle >= INACTIVITY_MS - WARNING_BEFORE_MS && !warningShownRef.current) {
        // 2 minutes left — show browser notification / toast
        warningShownRef.current = true
        const remaining = Math.ceil((INACTIVITY_MS - idle) / 60000)

        // Use a simple confirm dialog — swap for your toast/modal if preferred
        const stayLoggedIn = window.confirm(
          `You've been inactive for a while. You'll be logged out in ${remaining} minute${remaining === 1 ? "" : "s"} due to inactivity.\n\nClick OK to stay logged in.`
        )
        if (stayLoggedIn) {
          resetActivity()
        } else {
          handleLogout()
        }
      }
    }, CHECK_INTERVAL_MS)

    return () => {
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, resetActivity)
      )
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
    }
  }, [status, session, handleLogout, resetActivity])

  // Handle redirect on /login?reason=inactivity — show a message
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (params.get("reason") === "inactivity") {
      // You can show a toast here instead — this just logs it
      console.info("Session ended due to inactivity.")
    }
  }, [])

  return <>{children}</>
}
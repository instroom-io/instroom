"use client"

import { SessionProvider } from "next-auth/react"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      // Re-check when a tab regains focus. This is what makes a backgrounded
      // tab notice a logout or an expiry that happened elsewhere, instead of
      // acting on a session that stopped being true hours ago.
      refetchOnWindowFocus
      // No polling. With a 7-day absolute lifetime there is nothing a timer
      // would discover that focus and SessionGuard's own deadline check do not
      // already catch, and an interval here is a request per tab, forever.
      refetchInterval={0}
      // Do not refetch while the browser reports no connection — those calls
      // can only fail, and a failure must not be mistaken for a lost session.
      refetchWhenOffline={false}
    >
      {children}
    </SessionProvider>
  )
}

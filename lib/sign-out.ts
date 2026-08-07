// lib/sign-out.ts
//
// The single logout path for the whole app.
//
// Three places used to call `signOut({ callbackUrl: "/login" })` directly. That
// clears the session cookie, which is most of the job, but it leaves two things
// undone: other open tabs carry on believing they are authenticated until they
// happen to refetch, and anything cached about the previous user survives into
// the next sign-in on the same browser.

"use client"

import { signOut } from "next-auth/react"
import { broadcastLogout } from "@/components/SessionGuard"

/**
 * Keys this app is allowed to drop on logout.
 *
 * An explicit list, not `localStorage.clear()`. Clearing wholesale would also
 * destroy unrelated state owned by other features and by third-party scripts,
 * and a logout that wipes a user's UI preferences is a bug of its own.
 *
 * Nothing security-sensitive is listed because nothing security-sensitive is
 * stored: the session lives in an httpOnly cookie the page cannot read. These
 * are conveniences that happen to be scoped to a person — remembering them
 * across an account switch is what makes the next user see the last one's
 * workspace.
 */
const CLEARABLE_PREFIXES = ["instroom:"]

function clearClientState() {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      const doomed: string[] = []
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)
        if (key && CLEARABLE_PREFIXES.some((p) => key.startsWith(p))) doomed.push(key)
      }
      for (const key of doomed) storage.removeItem(key)
    } catch {
      /* storage disabled or full — never block the logout itself */
    }
  }
}

/**
 * Sign out here, and everywhere else this browser has the app open.
 *
 * Order matters. State is cleared and the broadcast sent *before* signOut
 * navigates away, because once navigation starts this code stops running.
 */
export async function signOutEverywhere(callbackUrl: string = "/login") {
  clearClientState()
  broadcastLogout()
  await signOut({ callbackUrl })
}

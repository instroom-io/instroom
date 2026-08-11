"use client"
// table-sheet/hooks.ts
// useToast — toast notification state
//
// This file also used to hold a SECOND copy of fetchInfluencerFromAPI plus a
// useAutoFetch hook. Neither was imported anywhere — only useToast is — and the
// duplicate had already drifted from the live implementation in table-sheet.tsx:
// it kept the old hardcoded api.instroom.io host, skipped username
// normalization, and returned null on every failure so a 429 or 5xx looked
// identical to "not found". Removed rather than repaired, so there is one
// profile-fetch implementation. The live one is fetchInfluencerFromAPI in
// components/table-sheet/table-sheet.tsx, using the shared endpoints from
// ./constants.

import { useState, useCallback } from "react"
import type { ToastNotification } from "./types"

export function useToast() {
  const [toasts, setToasts] = useState<ToastNotification[]>([])

  const addToast = useCallback((type: ToastNotification["type"], message: string) => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, addToast, dismissToast }
}

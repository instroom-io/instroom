"use client"
// table-sheet/toast.tsx

import React from "react"
import { IconCheck, IconAlertCircle, IconAlertTriangle, IconX } from "@tabler/icons-react"
import type { ToastNotification } from "./types"

export function ToastContainer({ toasts, onDismiss }: { toasts: ToastNotification[]; onDismiss: (id: string) => void }) {
  if (!toasts.length) return null
  const styles: Record<string, string> = {
    success: "bg-green-50 border-green-200 text-green-800",
    error:   "bg-red-50 border-red-200 text-red-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    info:    "bg-blue-50 border-blue-200 text-blue-800",
  }
  const icons: Record<string, React.ReactNode> = {
    success: <IconCheck size={12} className="text-green-600" />,
    error:   <IconAlertCircle size={14} className="text-red-600" />,
    warning: <IconAlertTriangle size={14} className="text-amber-600" />,
    info:    <IconAlertCircle size={14} className="text-blue-600" />,
  }
  return (
    <div className="fixed top-4 right-4 z-[999] flex flex-col gap-2 max-w-sm">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-start gap-2 px-3 py-2 rounded-xl border shadow-lg ${styles[t.type]}`}>
          <span className="flex-shrink-0 mt-0.5">{icons[t.type]}</span>
          <span className="text-xs font-medium flex-1">{t.message}</span>
          <button onClick={() => onDismiss(t.id)} className="flex-shrink-0 opacity-60 hover:opacity-100"><IconX size={12} /></button>
        </div>
      ))}
    </div>
  )
}
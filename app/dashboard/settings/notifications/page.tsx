"use client"
// app/dashboard/settings/notifications/page.tsx

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { Bell, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Toast ─────────────────────────────────────────────────────────────────────

type Toast = { message: string; type: "success" | "error" }

function useToast() {
  const [toast, setToast] = useState<Toast | null>(null)
  const show = (message: string, type: Toast["type"]) => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }
  return { toast, show }
}

// ── Loading screen ────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
      <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        Loading
      </p>
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface NotifItem {
  apiKey: "influencer_reply" | "stage_change" | "deal_agreed" | null
  title:  string
  desc:   string
  on:     boolean
}

interface NotifGroup {
  group: string
  items: NotifItem[]
}

// ── Default groups ────────────────────────────────────────────────────────────

const DEFAULT_GROUPS: NotifGroup[] = [
  {
    group: "Pipeline",
    items: [
      {
        apiKey: "influencer_reply",
        title:  "Influencer replies",
        desc:   "When an influencer replies to your outreach",
        on:     true,
      },
      {
        apiKey: "stage_change",
        title:  "Stage changes",
        desc:   "When an influencer is moved to a new pipeline stage",
        on:     false,
      },
      {
        apiKey: "deal_agreed",
        title:  "Deal agreed",
        desc:   "When a deal is confirmed with an influencer",
        on:     true,
      },
    ],
  },
  {
    group: "Post Tracker",
    items: [
      {
        apiKey: null,
        title:  "Post detected",
        desc:   "When a new post is auto-tracked via hashtag or mention",
        on:     true,
      },
      {
        apiKey: null,
        title:  "Post overdue alert",
        desc:   "14 days after delivery with no post detected",
        on:     true,
      },
      {
        apiKey: null,
        title:  "Metrics snapshot ready",
        desc:   "When final post metrics are locked and saved",
        on:     false,
      },
    ],
  },
  {
    group: "Paid Collabs",
    items: [
      {
        apiKey: null,
        title:  "Payment due reminders",
        desc:   "3 days before a payment milestone is due",
        on:     true,
      },
      {
        apiKey: null,
        title:  "Content approved",
        desc:   "When a script or content submission is approved",
        on:     true,
      },
    ],
  },
  {
    group: "Brand Partners",
    items: [
      {
        apiKey: null,
        title:  "New partner suggestion",
        desc:   "When an influencer crosses the Brand Partner threshold",
        on:     true,
      },
    ],
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { data: session, status } = useSession()
  const router                   = useRouter()
  const { toast, show }          = useToast()

  const [groups,       setGroups]       = useState<NotifGroup[]>(DEFAULT_GROUPS)
  const [notifsLoaded, setNotifsLoaded] = useState(false)
  const [toggling,     setToggling]     = useState<string | null>(null)

  // ── Load saved preferences ────────────────────────────────────────────────
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }
    if (status !== "authenticated") return

    fetch("/api/settings/notifications")
      .then((r) => r.json())
      .then((data: Record<string, boolean>) => {
        setGroups((prev) =>
          prev.map((group) => ({
            ...group,
            items: group.items.map((item) => {
              if (!item.apiKey) return item
              const saved = data[item.apiKey]
              return saved !== undefined ? { ...item, on: saved } : item
            }),
          })),
        )
      })
      .catch(() => {})
      .finally(() => setNotifsLoaded(true))
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toggle + auto-save ────────────────────────────────────────────────────
  async function handleToggle(groupIndex: number, itemIndex: number) {
    const item = groups[groupIndex].items[itemIndex]
    if (!item.apiKey || toggling) return

    const newValue = !item.on

    // Optimistic update
    setGroups((prev) =>
      prev.map((g, gi) =>
        gi !== groupIndex
          ? g
          : {
              ...g,
              items: g.items.map((it, ii) =>
                ii !== itemIndex ? it : { ...it, on: newValue },
              ),
            },
      ),
    )

    setToggling(item.apiKey)
    try {
      const res = await fetch("/api/settings/notifications", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ [item.apiKey]: newValue }),
      })
      if (!res.ok) throw new Error()
      show(
        `${item.title} ${newValue ? "enabled" : "disabled"}`,
        "success",
      )
    } catch {
      // Revert on failure
      setGroups((prev) =>
        prev.map((g, gi) =>
          gi !== groupIndex
            ? g
            : {
                ...g,
                items: g.items.map((it, ii) =>
                  ii !== itemIndex ? it : { ...it, on: !newValue },
                ),
              },
        ),
      )
      show("Something went wrong", "error")
    } finally {
      setToggling(null)
    }
  }

  if (status === "loading" || !notifsLoaded) return <LoadingScreen />

  return (
    <div className="max-w-3xl px-9 py-7">
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "fixed top-5 right-6 z-[9999] rounded-[10px] px-4.5 py-2.5 text-[13px] font-medium text-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]",
            toast.type === "success" ? "bg-emerald-600" : "bg-red-500",
          )}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Notifications</h1>
        <p className="text-xs text-muted-foreground">
          Choose when and how you get notified
        </p>
      </div>

      <Card className="mb-4">
        {/* Email destination */}
        <div className="flex items-center gap-3 border-b px-5 py-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-emerald-50">
            <Bell className="h-4 w-4 text-emerald-600" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-foreground">
              Email notifications
            </p>
            <p className="text-xs leading-tight text-muted-foreground">
              Sent to {session?.user?.email}
            </p>
          </div>
        </div>

        <CardContent className="pt-4 pb-2">
          {groups.map((group, gi) => (
            <div key={group.group} className={gi === 0 ? "" : "mt-3.5"}>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                {group.group}
              </p>
              {group.items.map((item, ii) => {
                const isLast =
                  ii === group.items.length - 1 && gi === groups.length - 1
                const isToggling = toggling === item.apiKey

                return (
                  <div
                    key={item.title}
                    className={cn(
                      "flex items-center justify-between py-3 transition-opacity",
                      !isLast && "border-b",
                      !item.apiKey && "opacity-50",
                      isToggling && "opacity-60",
                    )}
                  >
                    <div>
                      <p className="text-xs font-medium text-foreground">
                        {item.title}
                        {!item.apiKey && (
                          <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                            coming soon
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {item.desc}
                      </p>
                    </div>
                    <Switch
                      checked={item.on}
                      onCheckedChange={() => handleToggle(gi, ii)}
                      disabled={!item.apiKey || isToggling}
                      className="data-[state=checked]:bg-emerald-600"
                    />
                  </div>
                )
              })}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
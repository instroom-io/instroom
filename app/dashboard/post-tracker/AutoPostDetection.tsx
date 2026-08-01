"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  IconHash,
  IconAt,
  IconLoader2,
  IconExternalLink,
  IconSparkles,
  IconLock,
  IconRadar2,
} from "@tabler/icons-react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"

type DetectedPost = {
  id: string
  platform: string
  postUrl: string
  matchedHashtag: string | null
  matchedMention: string | null
  detectedAt: string
}

function formatDetectedAt(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

// ─── Premium gate ────────────────────────────────────────────────────────────
// Reuses the brand's real subscription status (the same endpoint every other
// premium page in the dashboard already calls) rather than inventing a fake
// flag. "free" = locked, anything else (active/trialing) = unlocked. Swap the
// threshold here once a dedicated plan capability exists for this feature.
function usePlanAccess(brandId: string, preloadedStatus?: string) {
  const [access, setAccess] = useState<"loading" | "locked" | "unlocked">(
    preloadedStatus !== undefined ? (preloadedStatus === "free" ? "locked" : "unlocked") : "loading"
  )

  useEffect(() => {
    // Parent already fetched the same brand's subscription status moments
    // earlier (PostTrackerContent) — reuse it instead of firing a redundant
    // round-trip every time this card mounts (e.g. every influencer opened).
    if (preloadedStatus !== undefined) {
      setAccess(preloadedStatus === "free" ? "locked" : "unlocked")
      return
    }
    let cancelled = false
    fetch(`/api/subscription/status?brandId=${encodeURIComponent(brandId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setAccess(data.status === "free" || data.error ? "locked" : "unlocked")
      })
      .catch(() => {
        if (!cancelled) setAccess("locked")
      })
    return () => {
      cancelled = true
    }
  }, [brandId, preloadedStatus])

  return access
}

export default function AutoPostDetectionCard({
  brandId,
  biId,
  subscriptionStatus,
}: {
  brandId: string
  biId: string
  subscriptionStatus?: string
}) {
  const access = usePlanAccess(brandId, subscriptionStatus)

  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [hashtags, setHashtags] = useState("")
  const [mentions, setMentions] = useState("")
  const [posts, setPosts] = useState<DetectedPost[]>([])
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState("")

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/post-tracker/detection?brandId=${encodeURIComponent(brandId)}&biId=${encodeURIComponent(biId)}`)
      .then((r) => r.json())
      .then((data) => {
        setEnabled(data.enabled ?? false)
        setHashtags(data.hashtags ?? "")
        setMentions(data.mentions ?? "")
        setPosts(data.posts ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [brandId, biId])

  useEffect(() => {
    if (access === "unlocked") load()
    else setLoading(false)
  }, [access, load])

  async function patch(body: Record<string, unknown>) {
    setSaving(true)
    setSaveMsg("")
    try {
      const res = await fetch("/api/post-tracker/detection", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, biId, ...body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save")
      setEnabled(data.enabled)
      setHashtags(data.hashtags ?? "")
      setMentions(data.mentions ?? "")
      setSaveMsg("Saved")
      setTimeout(() => setSaveMsg(""), 2000)
    } catch {
      setSaveMsg("Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100">
        <div className="w-8 h-8 rounded-lg bg-[#0F6B3E]/10 flex items-center justify-center flex-shrink-0">
          <IconRadar2 size={16} className="text-[#0F6B3E]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-gray-900">Automatic Post Detection</span>
            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide bg-[#fff8e1] text-[#854F0B] rounded-full px-1.5 py-0.5">
              <IconSparkles size={9} />
              Premium
            </span>
          </div>
          <div className="text-[11px] text-gray-400">Detects posts via hashtag &amp; mention monitoring</div>
        </div>
        {access === "unlocked" && (
          <Switch
            checked={enabled}
            disabled={loading || saving}
            onCheckedChange={(v) => patch({ enabled: v })}
          />
        )}
      </div>

      {access === "loading" && (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-gray-400">
          <IconLoader2 size={14} className="animate-spin" />
          Checking access…
        </div>
      )}

      {access === "locked" && (
        <div className="flex flex-col items-center text-center gap-2 px-4 py-7">
          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <IconLock size={16} className="text-gray-400" />
          </div>
          <p className="text-xs font-medium text-gray-700">Upgrade required</p>
          <p className="text-[11px] text-gray-400 max-w-[240px]">
            Automatic Post Detection is available on paid plans. Upgrade to monitor hashtags and mentions for this influencer.
          </p>
          <Link href="/dashboard/settings/billing">
            <Button size="sm" className="mt-1 bg-[#0F6B3E] hover:bg-[#0a5a2f] text-xs h-8">
              Upgrade plan
            </Button>
          </Link>
        </div>
      )}

      {access === "unlocked" && (
        <div className="p-4 flex flex-col gap-3.5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-gray-400">
              <IconLoader2 size={14} className="animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5 text-[11px] font-medium">
                <span className={`h-1.5 w-1.5 rounded-full ${enabled ? "bg-[#1FAE5B]" : "bg-gray-300"}`} />
                <span className={enabled ? "text-[#0F6B3E]" : "text-gray-400"}>
                  {enabled ? "Monitoring active" : "Monitoring paused"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-500">
                    <IconHash size={12} />
                    Hashtags monitored
                  </label>
                  <input
                    className="w-full text-xs px-2.5 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 outline-none focus:border-[#0F6B3E]/40 focus:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    placeholder="#brandname, #campaign2026"
                    value={hashtags}
                    disabled={!enabled}
                    onChange={(e) => setHashtags(e.target.value)}
                    onBlur={() => patch({ hashtags })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-500">
                    <IconAt size={12} />
                    Mentions monitored
                  </label>
                  <input
                    className="w-full text-xs px-2.5 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 outline-none focus:border-[#0F6B3E]/40 focus:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    placeholder="@yourbrand"
                    value={mentions}
                    disabled={!enabled}
                    onChange={(e) => setMentions(e.target.value)}
                    onBlur={() => patch({ mentions })}
                  />
                </div>
              </div>
              {saveMsg && <div className="text-[10px] text-gray-400">{saveMsg}</div>}

              <div className="flex flex-col gap-1.5 pt-1">
                <div className="text-[11px] font-semibold text-gray-500">Recently detected posts</div>
                {posts.length === 0 ? (
                  <div className="text-[11px] text-gray-400 rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center">
                    {enabled
                      ? "No posts detected yet. We'll list them here as soon as a matching post is found."
                      : "Enable monitoring to start detecting posts automatically."}
                  </div>
                ) : (
                  posts.map((p) => (
                    <div key={p.id} className="flex items-center gap-2.5 rounded-lg border border-gray-100 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-medium text-gray-800">{p.platform}</span>
                          {p.matchedHashtag && (
                            <span className="text-[10px] text-[#0F6B3E] bg-[#0F6B3E]/10 rounded-full px-1.5 py-0.5">
                              #{p.matchedHashtag.replace(/^#/, "")}
                            </span>
                          )}
                          {p.matchedMention && (
                            <span className="text-[10px] text-[#2C8EC4] bg-[#2C8EC4]/10 rounded-full px-1.5 py-0.5">
                              @{p.matchedMention.replace(/^@/, "")}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400">{formatDetectedAt(p.detectedAt)}</div>
                      </div>
                      <a
                        href={p.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 flex items-center gap-1 text-[11px] font-medium text-[#0F6B3E] hover:underline"
                      >
                        View <IconExternalLink size={11} />
                      </a>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

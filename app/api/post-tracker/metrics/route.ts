import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma, withUtf8mb4 } from "@/lib/prisma"
import { checkBrandAccess } from "@/lib/brand-access"
import { hasBrandCapability } from "@/lib/permissions"
import { isAddonActive } from "@/lib/post-tracker/addon"
import { consumeApiQuota } from "@/lib/post-tracker/quota"
import { fetchPostByUrl, isEnsembleConfigured, parsePostUrl } from "@/lib/ensembledata"
import { getDeliverables, deliverablePostUrl } from "@/lib/deliverables"

// POST /api/post-tracker/metrics
// Body: { brandId, biId }
//
// Fills Likes, Comments and Views from the influencer's post link(s).
//
// Called by the Post Tracker right after a post link is saved, so the metrics
// appear without anyone copying them by hand. Every link on the row counts —
// the row-level Post URL and each campaign deliverable's link, de-duplicated —
// and their metrics are summed, so a 3-deliverable collab reports all three
// posts. Automatic Post Detection writes the same three fields itself when it
// moves a card (lib/post-tracker/monitor.ts).
//
// Same gates as detection: the Post Tracker Add-on, a configured EnsembleData
// token, and the brand's daily API quota (one request per link). A metric the
// provider does not return is left as stored rather than zeroed.
export const dynamic = "force-dynamic"
export const maxDuration = 60

const LOG = "[post-metrics]"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { brandId, biId } = await req.json()
    if (!brandId || !biId) {
      return NextResponse.json({ error: "brandId and biId are required" }, { status: 400 })
    }

    const brand = await checkBrandAccess(brandId, session.user.id)
    if (!brand) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (!(await hasBrandCapability(brandId, session.user.id, "approveInfluencers"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!(await isAddonActive(brandId))) {
      return NextResponse.json({ skipped: true, reason: "addon", addonRequired: true })
    }
    if (!isEnsembleConfigured()) {
      console.error(`${LOG} EnsembleData token missing — set ENSEMBLEDATA_TOKEN or ENSEMBLE_TOKEN`)
      return NextResponse.json({ skipped: true, reason: "not-configured" })
    }

    // Scoped by brand as well as id, so a guessed biId cannot read or write
    // another workspace's row.
    const row = await prisma.brandInfluencer.findFirst({
      where: { id: biId, brand_id: brandId },
      select: { post_url: true, product_details: true },
    })
    if (!row) {
      return NextResponse.json({ error: "Influencer not found" }, { status: 404 })
    }

    let paidCollab: unknown = null
    try {
      paidCollab = row.product_details ? JSON.parse(row.product_details).paidCollab ?? null : null
    } catch {
      paidCollab = null
    }

    const deliverables = getDeliverables(paidCollab)
    const links = Array.from(
      new Set(
        [
          ...deliverables.map((d, i) => deliverablePostUrl(d, i, row.post_url)),
          (row.post_url ?? "").trim(),
        ].filter((u) => u && parsePostUrl(u))
      )
    )

    if (links.length === 0) {
      return NextResponse.json({ skipped: true, reason: "no-link" })
    }

    let likes: number | null = null
    let comments: number | null = null
    let views: number | null = null
    let fetched = 0
    const errors: string[] = []
    // Each link's own numbers, so every deliverable keeps the metrics of ITS post.
    const byLink = new Map<string, { likes: number | null; comments: number | null; views: number | null }>()

    const add = (total: number | null, v: number | null) => (v == null ? total : (total ?? 0) + v)

    for (const link of links) {
      if (!(await consumeApiQuota(brandId, 1))) {
        errors.push("Daily API quota reached")
        break
      }
      const res = await fetchPostByUrl(link)
      if (res.apiCalls > 1) await consumeApiQuota(brandId, res.apiCalls - 1)
      if (!res.ok) {
        console.warn(`${LOG} ${biId} ${link}: ${res.error}`)
        errors.push(res.error)
        continue
      }
      fetched++
      byLink.set(link, { likes: res.data.likeCount, comments: res.data.commentCount, views: res.data.viewCount })
      likes = add(likes, res.data.likeCount)
      comments = add(comments, res.data.commentCount)
      views = add(views, res.data.viewCount)
    }

    // Only what the provider actually returned is written. With several links a
    // metric one post lacks still sums the others — it is not zeroed.
    const data: {
      likes_count?: number; comments_count?: number; views_count?: number; engagement_count?: number
      product_details?: string
    } = {}
    if (fetched > 0) {
      if (likes != null) data.likes_count = likes
      if (comments != null) data.comments_count = comments
      if (views != null) data.views_count = views
      if (likes != null && comments != null) data.engagement_count = likes + comments
    }

    // Per-deliverable metrics, written onto each deliverable whose post was
    // fetched. The rest of product_details is carried over untouched.
    const deliverableMetrics: { index: number; likes: number | null; comments: number | null; views: number | null }[] = []
    if (deliverables.length && byLink.size) {
      const nextDeliverables = deliverables.map((d, i) => {
        const m = byLink.get(deliverablePostUrl(d, i, row.post_url))
        if (!m) return d
        deliverableMetrics.push({ index: i, ...m })
        return {
          ...d,
          ...(m.likes != null && { likes: m.likes }),
          ...(m.comments != null && { comments: m.comments }),
          ...(m.views != null && { views: m.views }),
        }
      })
      if (deliverableMetrics.length) {
        try {
          const details = row.product_details ? JSON.parse(row.product_details) : {}
          details.paidCollab = { ...(details.paidCollab ?? {}), deliverables: nextDeliverables }
          data.product_details = JSON.stringify(details)
        } catch {
          // Unparseable product_details: leave it alone; the totals still save.
        }
      }
    }

    if (Object.keys(data).length > 0) {
      // product_details can carry emoji (captions, notes) — see withUtf8mb4.
      if (data.product_details && /[\u{10000}-\u{10FFFF}]/u.test(data.product_details)) {
        await withUtf8mb4((tx) => tx.brandInfluencer.updateMany({ where: { id: biId, brand_id: brandId }, data }))
      } else {
        await prisma.brandInfluencer.updateMany({ where: { id: biId, brand_id: brandId }, data })
      }
    }

    return NextResponse.json({
      ok: fetched > 0,
      fetched,
      links: links.length,
      likes: data.likes_count ?? null,
      comments: data.comments_count ?? null,
      views: data.views_count ?? null,
      deliverables: deliverableMetrics,
      ...(errors.length ? { error: errors.join("; ").slice(0, 500) } : {}),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error(`${LOG} failed: ${message}`, error)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

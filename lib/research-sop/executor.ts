// lib/research-sop/executor.ts
//
// The generic SOP pipeline. Nothing here knows about any particular SOP: a run
// carries a snapshot of its SOP's steps, the steps name the fields to research,
// and every field goes through the same gather → classify → validate → propose
// path. A different SOP is just different rows.
//
//   create run  → resolve targets (BrandInfluencer ids), snapshot steps, queued
//   process     → one bounded batch per request under a lease; each influencer
//                 is researched independently, so one failure never fails the run
//   review      → a person approves / rejects individual field proposals
//   apply       → approved values are re-validated, conflict-checked against the
//                 live record, written, and logged to the influencer's History
//
// Research never writes to Influencer or BrandInfluencer. Only apply does, and
// only for results a person approved.

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-log"
import {
  REVIEWABLE_RESULT_STATUSES,
  currentValueString,
  isFieldEmpty,
  isResearchField,
  normalizeFieldValue,
  toInfluencerData,
  type ResearchField,
  type RunTargetMode,
  type ValueType,
} from "./fields"
import { gatherResearchData, type ResearchData } from "./sources"
import { classifyWithAi, isAiConfigured, type SopStepInput } from "./ai"
import { writeMaybeUtf8mb4 } from "./db"

/** Influencers researched per processing request — keeps each request bounded. */
export const RUN_BATCH_SIZE = 3
/** Upper bound on one run's targets. */
export const MAX_RUN_TARGETS = 200
/** Lease on a run while a batch is processed; outlasts the route's maxDuration. */
const LEASE_MS = 5 * 60 * 1000
/** Below this, or when inferred / uncertain, a proposal is flagged for review. */
const REVIEW_CONFIDENCE = 0.8

const INFLUENCER_SELECT = {
  id: true,
  handle: true,
  platform: true,
  is_draft: true,
  location: true,
  niche: true,
  follower_count: true,
  engagement_rate: true,
  email: true,
  bio: true,
} as const

type InfluencerFields = {
  handle: string
  platform: string
  location: string | null
  niche: string | null
  follower_count: number
  engagement_rate: Prisma.Decimal | number
  email: string | null
  bio: string | null
}

/** The field list an SOP's steps research, in step order, de-duplicated. */
export function fieldsFromSteps(steps: { target_field: string | null }[]): ResearchField[] {
  const out: ResearchField[] = []
  for (const s of steps) if (isResearchField(s.target_field) && !out.includes(s.target_field)) out.push(s.target_field)
  return out
}

/* ── Targets ───────────────────────────────────────────────────────────────── */

/**
 * BrandInfluencer ids for a run, always scoped to `brandId`. "selected" takes
 * Influencer ids from the sheet (its row ids) and resolves them to this brand's
 * membership rows — an id from another brand simply resolves to nothing.
 */
export async function resolveRunTargets(
  brandId: string,
  mode: RunTargetMode,
  fields: ResearchField[],
  influencerIds: string[]
): Promise<string[]> {
  const base = { brand_id: brandId, influencer: { is: { is_draft: false } } }

  if (mode === "selected") {
    const ids = influencerIds.filter((id) => typeof id === "string" && id && !id.startsWith("temp-")).slice(0, 1000)
    if (!ids.length) return []
    const rows = await prisma.brandInfluencer.findMany({
      where: { ...base, influencer_id: { in: ids } },
      select: { id: true },
      orderBy: { created_at: "asc" },
    })
    return rows.map((r) => r.id)
  }

  const rows = await prisma.brandInfluencer.findMany({
    where: base,
    select: { id: true, influencer: { select: INFLUENCER_SELECT } },
    orderBy: { created_at: "asc" },
  })

  if (mode === "missing") {
    return rows
      .filter((r) => fields.some((f) => isFieldEmpty(f, (r.influencer as InfluencerFields)[f])))
      .map((r) => r.id)
  }
  return rows.map((r) => r.id)
}

/* ── Processing ────────────────────────────────────────────────────────────── */

interface ProposedRow {
  field: ResearchField | null
  current_value: string | null
  proposed_value: string | null
  source: string | null
  confidence: number | null
  value_type: ValueType | null
  status: string
  evidence: string | null
  error: string | null
}

interface Candidate {
  value: string | number | null
  confidence: number
  source: string
  value_type: ValueType
  evidence: string
}

const EMAIL_IN_TEXT = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i

/**
 * Research one influencer. Factual metrics come from the providers; the AI is
 * only asked for what the data cannot state directly (niche, and location when
 * no profile field gives it).
 */
async function researchOne(
  sop: { name: string; steps: SopStepInput[] },
  fields: ResearchField[],
  inf: InfluencerFields,
  taxonomy: { niches: string[]; locations: string[] }
): Promise<ProposedRow[]> {
  const lookup = await gatherResearchData(inf.platform, inf.handle, {
    engagement: fields.includes("engagement_rate"),
    content: fields.includes("niche") || fields.includes("location"),
  })
  if (!lookup.ok) {
    return [failedRow(lookup.error)]
  }
  const data = lookup.data
  const candidates = factualCandidates(fields, data)

  // AI only for fields still without a factual answer (niche is always a
  // classification, even when a provider category exists).
  const aiFields = fields.filter((f) => (f === "niche" || f === "location") && (f === "niche" || !candidates[f]))
  const hasContent = Boolean(data.bio || data.category || data.location || data.captions.length || data.hashtags.length)
  let aiNote: string | null = null
  if (aiFields.length && hasContent) {
    if (!isAiConfigured()) {
      aiNote = "AI research is not configured"
    } else {
      try {
        const known: Partial<Record<ResearchField, string>> = {}
        for (const f of fields) {
          const v = currentValueString(f, inf[f])
          if (v && f !== "bio") known[f] = v
        }
        const ai = await classifyWithAi({ sopName: sop.name, steps: sop.steps, fields: aiFields, known, data })
        for (const r of ai) {
          // A provider's own category stays a fallback: use the AI's niche only
          // when it found one.
          if (r.value === null && candidates[r.field]) continue
          candidates[r.field] = {
            value: r.value,
            confidence: r.confidence,
            source: `ai:${r.source}`.slice(0, 100),
            value_type: r.value === null ? "uncertain" : r.value_type,
            evidence: r.evidence,
          }
        }
      } catch (err) {
        console.error("[research-sop] AI classification failed:", err)
        aiNote = "AI classification was unavailable"
      }
    }
  }

  const verify = new Set(sop.steps.filter((s) => s.verification_required).map((s) => s.target_field))

  return fields.map((field) => {
    const current = currentValueString(field, inf[field])
    const c = candidates[field]
    const value = c ? normalizeFieldValue(field, c.value, taxonomy) : null

    if (!c || value === null) {
      return {
        field,
        current_value: current,
        proposed_value: null,
        source: c?.source ?? null,
        confidence: null,
        value_type: "uncertain",
        status: "not_found",
        evidence: c?.evidence?.slice(0, 500) ?? aiNote,
        error: null,
      }
    }

    const same = field === "location" || field === "niche" || field === "email"
      ? value.toLowerCase() === current.toLowerCase()
      : value === current
    const confidence = Math.max(0, Math.min(1, Math.round(c.confidence * 1000) / 1000))
    const needsReview =
      c.value_type === "inferred" ||
      c.value_type === "uncertain" ||
      confidence < REVIEW_CONFIDENCE ||
      verify.has(field) ||
      current !== "" // replacing an existing value is always a deliberate decision

    return {
      field,
      current_value: current,
      proposed_value: value,
      source: c.source,
      confidence,
      value_type: c.value_type,
      status: same ? "unchanged" : needsReview ? "needs_review" : "proposed",
      evidence: c.evidence.slice(0, 500),
      error: null,
    }
  })
}

/** Values a provider states directly. Nothing here is guessed. */
function factualCandidates(fields: ResearchField[], d: ResearchData): Partial<Record<ResearchField, Candidate>> {
  const out: Partial<Record<ResearchField, Candidate>> = {}
  for (const f of fields) {
    switch (f) {
      case "follower_count":
        if (d.followers) out[f] = { value: d.followers.value, confidence: 0.99, source: d.followers.source, value_type: "extracted", evidence: `Follower count reported by ${d.followers.source.split(":")[0]}` }
        break
      case "engagement_rate":
        if (d.engagementRate) {
          const calculated = d.engagementRate.source.includes("calculated")
          out[f] = { value: d.engagementRate.value, confidence: calculated ? 0.9 : 0.95, source: d.engagementRate.source, value_type: "extracted", evidence: calculated ? "Average likes + comments on recent posts ÷ followers" : "Engagement rate reported by the profile source" }
        }
        break
      case "email": {
        if (d.email) {
          out[f] = { value: d.email.value, confidence: 0.95, source: d.email.source, value_type: "explicit", evidence: "Public contact email on the profile" }
        } else {
          const inBio = d.bio?.value.match(EMAIL_IN_TEXT)?.[0]
          if (inBio) out[f] = { value: inBio, confidence: 0.9, source: "profile_bio", value_type: "explicit", evidence: `Email written in the bio: ${inBio}` }
        }
        break
      }
      case "bio":
        if (d.bio) out[f] = { value: d.bio.value, confidence: 0.99, source: d.bio.source, value_type: "explicit", evidence: "Profile bio text" }
        break
      case "location":
        if (d.location) out[f] = { value: d.location.value, confidence: 0.9, source: d.location.source, value_type: "extracted", evidence: `Profile location field: ${d.location.value}`.slice(0, 200) }
        break
      case "niche":
        if (d.category) out[f] = { value: d.category.value, confidence: 0.7, source: d.category.source, value_type: "extracted", evidence: `Profile category: ${d.category.value}`.slice(0, 200) }
        break
    }
  }
  return out
}

function failedRow(error: string): ProposedRow {
  return {
    field: null, current_value: null, proposed_value: null, source: null, confidence: null,
    value_type: null, status: "failed", evidence: null, error: error.slice(0, 500),
  }
}

async function brandTaxonomy(brandId: string) {
  const [niches, locations] = await Promise.all([
    prisma.brandNiche.findMany({ where: { brand_id: brandId }, select: { name: true } }),
    prisma.brandLocation.findMany({ where: { brand_id: brandId }, select: { name: true } }),
  ])
  return { niches: niches.map((n) => n.name), locations: locations.map((l) => l.name) }
}

export type ProcessOutcome = "processed" | "busy" | "done" | "not_found"

/**
 * Process the next batch of a run. Bounded: at most RUN_BATCH_SIZE influencers.
 * A lease (locked_until + the processed_count cursor) makes a second concurrent
 * request a no-op instead of double-processing.
 */
export async function processRunBatch(runId: string, brandId: string, userId: string): Promise<ProcessOutcome> {
  const run = await prisma.researchSopRun.findFirst({ where: { id: runId, brand_id: brandId } })
  if (!run) return "not_found"
  if (run.status === "completed" || run.status === "needs_review" || run.status === "failed") return "done"

  const now = new Date()
  const claimed = await prisma.researchSopRun.updateMany({
    where: {
      id: run.id,
      processed_count: run.processed_count,
      OR: [{ locked_until: null }, { locked_until: { lt: now } }],
    },
    data: {
      locked_until: new Date(now.getTime() + LEASE_MS),
      status: "running",
      started_at: run.started_at ?? now,
    },
  })
  if (claimed.count === 0) return "busy"

  const targetIds = Array.isArray(run.target_ids) ? (run.target_ids as string[]) : []
  const batch = targetIds.slice(run.processed_count, run.processed_count + RUN_BATCH_SIZE)
  const steps = (Array.isArray(run.steps_snapshot) ? run.steps_snapshot : []) as unknown as SopStepInput[]
  const fields = fieldsFromSteps(steps)
  const taxonomy = await brandTaxonomy(brandId)

  const memberships = await prisma.brandInfluencer.findMany({
    where: { id: { in: batch }, brand_id: brandId },
    select: { id: true, influencer: { select: INFLUENCER_SELECT } },
  })
  const byId = new Map(memberships.map((m) => [m.id, m]))

  let completed = 0
  let failed = 0
  let needsReview = 0

  for (const biId of batch) {
    let rows: ProposedRow[]
    const membership = byId.get(biId)
    try {
      rows = membership
        ? await researchOne({ name: run.sop_name, steps }, fields, membership.influencer as InfluencerFields, taxonomy)
        : [failedRow("This influencer is no longer on this brand's list.")]
    } catch (err) {
      console.error(`[research-sop] run ${run.id}: influencer ${biId} failed:`, err)
      rows = [failedRow("Research failed for this influencer.")]
    }

    const data = rows.map((r) => ({
      ...r,
      run_id: run.id,
      brand_id: brandId,
      brand_influencer_id: biId,
    }))
    try {
      await writeMaybeUtf8mb4(data, (client) => client.researchSopRunResult.createMany({ data }))
    } catch (err) {
      console.error(`[research-sop] run ${run.id}: saving results for ${biId} failed:`, err)
      await prisma.researchSopRunResult.create({
        data: { ...failedRow("Results could not be saved."), run_id: run.id, brand_id: brandId, brand_influencer_id: biId },
      })
      rows = [failedRow("Results could not be saved.")]
    }

    if (rows.some((r) => r.status === "failed")) {
      failed++
    } else {
      completed++
      if (rows.some((r) => r.status === "needs_review" || r.status === "proposed")) needsReview++
      logActivity({
        brandId,
        userId,
        action: "research_sop.completed",
        entityType: "brand_influencer",
        entityId: biId,
        details: {
          sop_id: run.sop_id,
          sop_name: run.sop_name,
          sop_version: run.sop_version,
          run_id: run.id,
          fields,
          proposed: rows.filter((r) => r.status === "needs_review" || r.status === "proposed").map((r) => r.field),
        },
      }).catch(() => {})
    }
  }

  const processed = run.processed_count + batch.length
  const finished = processed >= targetIds.length
  await prisma.researchSopRun.update({
    where: { id: run.id },
    data: {
      processed_count: processed,
      completed_count: { increment: completed },
      failed_count: { increment: failed },
      needs_review_count: { increment: needsReview },
      locked_until: null,
      ...(finished ? { finished_at: new Date() } : {}),
    },
  })
  if (finished) await refreshRunStatus(run.id)
  return "processed"
}

/**
 * Settle a finished run's status from its results:
 *   failed        every influencer failed
 *   needs_review  some proposal still waits for a decision or an apply
 *   completed     nothing left to decide
 */
export async function refreshRunStatus(runId: string) {
  const run = await prisma.researchSopRun.findUnique({ where: { id: runId } })
  if (!run || run.processed_count < run.total_count) return

  const pending = await prisma.researchSopRunResult.findMany({
    where: { run_id: runId, status: { in: [...REVIEWABLE_RESULT_STATUSES, "approved"] } },
    select: { brand_influencer_id: true },
    distinct: ["brand_influencer_id"],
  })
  const status =
    run.total_count > 0 && run.failed_count >= run.total_count
      ? "failed"
      : pending.length > 0
        ? "needs_review"
        : "completed"
  await prisma.researchSopRun.update({
    where: { id: runId },
    data: { status, needs_review_count: pending.length },
  })
}

/* ── Review ────────────────────────────────────────────────────────────────── */

const DECIDABLE = [...REVIEWABLE_RESULT_STATUSES, "approved", "rejected"]

export async function decideResults(
  runId: string,
  brandId: string,
  userId: string,
  resultIds: string[],
  decision: "approve" | "reject"
): Promise<number> {
  const updated = await prisma.researchSopRunResult.updateMany({
    where: {
      id: { in: resultIds.slice(0, 500) },
      run_id: runId,
      brand_id: brandId,
      status: { in: DECIDABLE },
      // A proposal with nothing to write cannot be approved.
      ...(decision === "approve" ? { proposed_value: { not: null }, field: { not: null } } : {}),
    },
    data: {
      status: decision === "approve" ? "approved" : "rejected",
      reviewed_by: userId,
      reviewed_at: new Date(),
    },
  })
  await refreshRunStatus(runId)
  return updated.count
}

/* ── Apply ─────────────────────────────────────────────────────────────────── */

export interface ApplySummary {
  applied: number
  conflicts: number
  failed: number
  /** Exactly what was written, so the sheet can update its rows in place. */
  changes: { brand_influencer_id: string; field: ResearchField; value: string }[]
}

/**
 * Write approved results onto their Influencer records.
 *
 * Every value is re-validated and every membership re-checked against the
 * brand. A value that changed since research ran is NOT overwritten: the result
 * becomes "conflict" with the live value recorded, so it goes back to review.
 */
export async function applyApprovedResults(runId: string, brandId: string, userId: string): Promise<ApplySummary> {
  const run = await prisma.researchSopRun.findFirst({ where: { id: runId, brand_id: brandId } })
  if (!run) return { applied: 0, conflicts: 0, failed: 0, changes: [] }

  const approved = await prisma.researchSopRunResult.findMany({
    where: { run_id: runId, brand_id: brandId, status: "approved" },
  })
  const taxonomy = await brandTaxonomy(brandId)
  const summary: ApplySummary = { applied: 0, conflicts: 0, failed: 0, changes: [] }

  const byInfluencer = new Map<string, typeof approved>()
  for (const r of approved) {
    const list = byInfluencer.get(r.brand_influencer_id) ?? []
    list.push(r)
    byInfluencer.set(r.brand_influencer_id, list)
  }

  for (const [biId, results] of byInfluencer) {
    const membership = await prisma.brandInfluencer.findFirst({
      where: { id: biId, brand_id: brandId },
      select: { influencer: { select: INFLUENCER_SELECT } },
    })
    if (!membership) {
      await markResults(results.map((r) => r.id), { status: "failed", error: "This influencer is no longer on this brand's list." })
      summary.failed += results.length
      continue
    }
    const inf = membership.influencer

    const data: Record<string, string | number> = {}
    const changes: Record<string, { from: string; to: string }> = {}
    const toApply: string[] = []

    for (const r of results) {
      if (!isResearchField(r.field)) {
        await markResults([r.id], { status: "failed", error: "Unsupported field." })
        summary.failed++
        continue
      }
      const value = normalizeFieldValue(r.field, r.proposed_value, taxonomy)
      if (value === null) {
        await markResults([r.id], { status: "failed", error: "The proposed value is no longer valid." })
        summary.failed++
        continue
      }
      const live = currentValueString(r.field, (inf as InfluencerFields)[r.field])
      if (live !== (r.current_value ?? "")) {
        // Someone edited this field after research ran — back to review, with
        // the live value as the new baseline.
        await prisma.researchSopRunResult.update({
          where: { id: r.id },
          data: { status: "conflict", current_value: live, error: "This field changed after research ran. Review it again." },
        })
        summary.conflicts++
        continue
      }
      Object.assign(data, toInfluencerData(r.field, value))
      changes[r.field] = { from: live, to: value }
      toApply.push(r.id)
    }

    if (!toApply.length) continue

    try {
      await writeMaybeUtf8mb4(data, (client) => client.influencer.update({ where: { id: inf.id }, data }))
      await markResults(toApply, { status: "applied", applied_at: new Date(), error: null })
      summary.applied += toApply.length
      for (const [field, change] of Object.entries(changes)) {
        summary.changes.push({ brand_influencer_id: biId, field: field as ResearchField, value: change.to })
      }
      await logActivity({
        brandId,
        userId,
        action: "research_sop.applied",
        entityType: "brand_influencer",
        entityId: biId,
        details: {
          sop_id: run.sop_id,
          sop_name: run.sop_name,
          sop_version: run.sop_version,
          run_id: run.id,
          fields: Object.keys(changes),
          changes,
        },
      })
    } catch (err) {
      console.error(`[research-sop] apply for ${biId} failed:`, err)
      await markResults(toApply, { status: "failed", error: "Could not save this change." })
      summary.failed += toApply.length
    }
  }

  await refreshRunStatus(runId)
  return summary
}

async function markResults(ids: string[], data: Prisma.ResearchSopRunResultUpdateManyMutationInput) {
  if (!ids.length) return
  await prisma.researchSopRunResult.updateMany({ where: { id: { in: ids } }, data })
}

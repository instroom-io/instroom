// lib/research-sop/sops.ts
//
// Server-side validation for SOP writes. target_field is checked against the
// RESEARCH_FIELDS whitelist here — the client's dropdown is a convenience, not
// the guard.

import { z } from "zod"
import { RESEARCH_FIELDS } from "./fields"

export const MAX_SOP_STEPS = 30

const stepSchema = z.object({
  title: z.string().trim().min(1, "Every step needs a title").max(200),
  instructions: z.string().trim().max(5000).nullable().optional(),
  required: z.boolean().default(true),
  target_field: z.enum(RESEARCH_FIELDS).nullable().optional(),
  verification_required: z.boolean().default(false),
  notes: z.string().trim().max(2000).nullable().optional(),
})

export const sopInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  description: z.string().trim().max(5000).nullable().optional(),
  // Only influencers can be researched today; the column exists so a later
  // entity type does not need a migration.
  applies_to: z.literal("influencer").default("influencer"),
  steps: z.array(stepSchema).min(1, "Add at least one step").max(MAX_SOP_STEPS),
})

export type SopInput = z.infer<typeof sopInputSchema>

/** Step rows in the order given, positions 1..n. */
export function stepRows(steps: SopInput["steps"]) {
  return steps.map((s, i) => ({
    position: i + 1,
    title: s.title,
    instructions: s.instructions || null,
    required: s.required,
    target_field: s.target_field ?? null,
    verification_required: s.verification_required,
    notes: s.notes || null,
  }))
}

/** The first validation message, in plain words, for a 400 response. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid SOP"
}

export const SOP_SELECT = {
  id: true,
  name: true,
  description: true,
  applies_to: true,
  status: true,
  version: true,
  created_by: true,
  created_at: true,
  updated_at: true,
  steps: {
    orderBy: { position: "asc" as const },
    select: {
      id: true,
      position: true,
      title: true,
      instructions: true,
      required: true,
      target_field: true,
      verification_required: true,
      notes: true,
    },
  },
}

/** Attach creator names — User is referenced by id only (see schema note). */
export async function withCreatorNames<T extends { created_by: string | null }>(
  rows: T[],
  findUsers: (ids: string[]) => Promise<{ id: string; name: string | null; email: string | null }[]>
): Promise<(T & { created_by_name: string | null })[]> {
  const ids = Array.from(new Set(rows.map((r) => r.created_by).filter((v): v is string => !!v)))
  const users = ids.length ? await findUsers(ids) : []
  const names = new Map(users.map((u) => [u.id, u.name || u.email]))
  return rows.map((r) => ({ ...r, created_by_name: r.created_by ? names.get(r.created_by) ?? null : null }))
}

/** Columns shown in run history and at the top of a run's detail view. */
export const RUN_LIST_SELECT = {
  id: true,
  sop_id: true,
  sop_name: true,
  sop_version: true,
  target_mode: true,
  status: true,
  total_count: true,
  processed_count: true,
  completed_count: true,
  needs_review_count: true,
  failed_count: true,
  started_by: true,
  started_at: true,
  finished_at: true,
  created_at: true,
} as const

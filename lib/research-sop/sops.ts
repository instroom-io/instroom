// lib/research-sop/sops.ts
//
// Server-side validation for SOP writes. An SOP is a research playbook: its
// description is the Purpose and each step row is a document SECTION (heading +
// rich content). The legacy target_field, if ever sent, is still checked
// against the RESEARCH_FIELDS whitelist; the editor no longer sets it.

import { z } from "zod"
import { RESEARCH_FIELDS } from "./fields"

// Sections per SOP. Each stored "step" row is one document section.
export const MAX_SOP_STEPS = 60
// TEXT columns hold 65,535 bytes; at up to 4 bytes per utf8mb4 character this
// keeps a full section safely inside one.
const MAX_SECTION_CHARS = 15_000

const stepSchema = z.object({
  title: z.string().trim().min(1, "Every section needs a heading").max(200),
  instructions: z.string().trim().max(MAX_SECTION_CHARS, "A section is too long — split it into two").nullable().optional(),
  required: z.boolean().default(true),
  target_field: z.enum(RESEARCH_FIELDS).nullable().optional(),
  verification_required: z.boolean().default(false),
  notes: z.string().trim().max(2000).nullable().optional(),
})

export const sopInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  description: z.string().trim().max(MAX_SECTION_CHARS).nullable().optional(),
  // Only influencers can be researched today; the column exists so a later
  // entity type does not need a migration.
  applies_to: z.literal("influencer").default("influencer"),
  steps: z.array(stepSchema).min(1, "Add at least one section").max(MAX_SOP_STEPS),
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

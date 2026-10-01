// lib/research-sop/ai.ts
//
// Structured classification for SOP research, on the project's existing AI
// integration: Cohere's v2 chat API over plain fetch with COHERE_API_KEY, the
// same call app/api/chat/route.ts makes. No SDK is added.
//
// The model receives the SOP's own steps and instructions (data, not code), the
// influencer's known values and the public data gathered for them, and must
// answer in a fixed JSON shape. That answer is then validated against a strict
// schema — anything malformed is dropped, never parsed loosely. The model is
// asked for short factual evidence, not its reasoning.

import { z } from "zod"
import { RESEARCH_FIELDS, VALUE_TYPES, type ResearchField } from "./fields"
import type { ResearchData } from "./sources"

const COHERE_URL = "https://api.cohere.ai/v2/chat"
// Same model the existing chat integration uses; overridable without a deploy.
const MODEL = process.env.COHERE_RESEARCH_MODEL || "command-r"
const TIMEOUT_MS = 45_000

export interface SopStepInput {
  position: number
  title: string
  instructions: string | null
  required: boolean
  target_field: string | null
  verification_required: boolean
  notes: string | null
}

const aiResultSchema = z.object({
  field: z.enum(RESEARCH_FIELDS),
  value: z.union([z.string(), z.number()]).nullable(),
  confidence: z.number().min(0).max(1),
  source: z.string().max(100),
  value_type: z.enum(VALUE_TYPES),
  evidence: z.string().max(500),
})
const aiResponseSchema = z.object({ results: z.array(aiResultSchema).max(20) })

export type AiResult = z.infer<typeof aiResultSchema>

export function isAiConfigured(): boolean {
  return Boolean(process.env.COHERE_API_KEY)
}

// The JSON schema Cohere constrains its output to. Mirrors aiResultSchema.
const RESPONSE_JSON_SCHEMA = {
  type: "object",
  required: ["results"],
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        required: ["field", "value", "confidence", "source", "value_type", "evidence"],
        properties: {
          field: { type: "string", enum: [...RESEARCH_FIELDS] },
          // A plain string: "" means "not found" (mapped to null on our side).
          value: { type: "string" },
          confidence: { type: "number" },
          source: { type: "string" },
          value_type: { type: "string", enum: [...VALUE_TYPES] },
          evidence: { type: "string" },
        },
      },
    },
  },
}

const SYSTEM_PROMPT = [
  "You are a research assistant that fills influencer profile fields strictly from the data provided.",
  "Follow the SOP steps you are given, in order.",
  "Rules:",
  "- Use ONLY the provided data. Never use outside knowledge about the person and never guess.",
  "- If the data does not support a value, return an empty string \"\" as value, value_type \"uncertain\" and confidence 0.",
  "- value_type: \"explicit\" = stated verbatim in the data (e.g. the bio says \"Based in Manila\");",
  "  \"extracted\" = read directly from a structured field; \"inferred\" = concluded from indirect evidence",
  "  (e.g. captions or hashtags); \"uncertain\" = weak or conflicting evidence.",
  "- confidence is 0 to 1 and must be lower for inferred values than for explicit ones.",
  "- source names where the evidence came from: profile_bio, profile_location, profile_category, captions or hashtags.",
  "- evidence is one short factual quote or observation (max 200 characters). Do not explain your reasoning.",
  "- location is a country (or \"City, Country\" when the data states the city). niche is a short content category.",
  "- email only if an email address literally appears in the data.",
  "- Return exactly one result per requested field.",
].join("\n")

/**
 * Ask the model for the requested fields. Returns only results that pass the
 * schema, for requested fields only; an empty array when nothing usable came
 * back. Throws only on transport / configuration failure, which the caller
 * records against that influencer.
 */
export async function classifyWithAi(input: {
  sopName: string
  steps: SopStepInput[]
  fields: ResearchField[]
  known: Partial<Record<ResearchField, string>>
  data: ResearchData
}): Promise<AiResult[]> {
  const apiKey = process.env.COHERE_API_KEY
  if (!apiKey) throw new Error("AI research is not configured")
  if (!input.fields.length) return []

  const userPayload = {
    sop: {
      name: input.sopName,
      steps: input.steps.map((s) => ({
        order: s.position,
        title: s.title,
        instructions: s.instructions,
        field: s.target_field,
        required: s.required,
        notes: s.notes,
      })),
    },
    requested_fields: input.fields,
    known_values: input.known,
    influencer: {
      platform: input.data.platform,
      handle: input.data.handle,
      name: input.data.fullName,
    },
    public_data: {
      profile_bio: input.data.bio?.value ?? null,
      profile_location: input.data.location?.value ?? null,
      profile_category: input.data.category?.value ?? null,
      captions: input.data.captions.map((c) => c.slice(0, 300)),
      hashtags: input.data.hashtags,
    },
  }

  const res = await fetch(COHERE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
      response_format: { type: "json_object", json_schema: RESPONSE_JSON_SCHEMA },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  if (!res.ok) {
    // Status only — the body can echo request details and is not shown to users.
    throw new Error(`AI request failed (HTTP ${res.status})`)
  }

  const json = await res.json().catch(() => null)
  const text = json?.message?.content?.find?.((c: { type?: string }) => c?.type === "text")?.text
  if (typeof text !== "string") return []

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    console.warn("[research-sop] AI returned non-JSON output; ignored")
    return []
  }

  const checked = aiResponseSchema.safeParse(parsed)
  if (!checked.success) {
    console.warn("[research-sop] AI output failed schema validation; ignored")
    return []
  }

  // One result per requested field; the first valid one wins.
  const seen = new Set<string>()
  return checked.data.results
    .filter((r) => {
      if (!input.fields.includes(r.field) || seen.has(r.field)) return false
      seen.add(r.field)
      return true
    })
    .map((r) => ({ ...r, value: typeof r.value === "string" && !r.value.trim() ? null : r.value }))
}

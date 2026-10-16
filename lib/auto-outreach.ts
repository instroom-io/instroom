import "server-only"
import { prisma } from "@/lib/prisma"

/** Per-brand, stored in IntegrationConnection. */
export const AUTO_OUTREACH_KEY = "auto_outreach"

export type OutreachSender = {
  userId: string
  accountId: string
  provider: "gmail" | "outlook"
  email: string | null
}

export type AutoOutreachConfig = {
  enabled: boolean
  templateId: string | null
  sender: OutreachSender | null
  /** Delay before the first email, so it can be cancelled. */
  cancelWindowMinutes: number
  intervalMinutes: number
  dailyCap: number
  /** Set on mailbox failure; cleared on resume. */
  paused: boolean
  pausedReason: string | null
}

export const DEFAULT_AUTO_OUTREACH: AutoOutreachConfig = {
  enabled: false,
  templateId: null,
  sender: null,
  cancelWindowMinutes: 5,
  intervalMinutes: 2,
  dailyCap: 50,
  paused: false,
  pausedReason: null,
}

export const CANCEL_WINDOW_RANGE = { min: 1, max: 60 }
export const INTERVAL_RANGE = { min: 1, max: 60 }
export const DAILY_CAP_RANGE = { min: 1, max: 500 }

export async function getAutoOutreachConfig(brandId: string): Promise<AutoOutreachConfig> {
  const row = await prisma.integrationConnection.findUnique({
    where: { brand_id_integration_key: { brand_id: brandId, integration_key: AUTO_OUTREACH_KEY } },
    select: { config: true },
  })
  const stored = (row?.config ?? {}) as Partial<AutoOutreachConfig>
  return { ...DEFAULT_AUTO_OUTREACH, ...stored }
}

export async function saveAutoOutreachConfig(brandId: string, config: AutoOutreachConfig) {
  const data = {
    connected: config.enabled,
    connected_as: config.sender?.email ?? null,
    config: config as unknown as object,
  }
  await prisma.integrationConnection.upsert({
    where: { brand_id_integration_key: { brand_id: brandId, integration_key: AUTO_OUTREACH_KEY } },
    create: { brand_id: brandId, integration_key: AUTO_OUTREACH_KEY, ...data },
    update: data,
  })
}

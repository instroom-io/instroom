import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { syncAllShopifyBilling } from "@/lib/shopify-billing"

// Daily Shopify plan sync (App Pricing has no billing webhooks). VPS crontab:
//   30 4 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$CRON_URL/api/cron/shopify-billing-sync" >> /root/shopify-billing-sync.log

export const dynamic = "force-dynamic"
export const maxDuration = 300

function isAuthorized(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  if (!expected || !provided || provided.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const results = await syncAllShopifyBilling()
  const counts = Object.values(results).reduce<Record<string, number>>((acc, r) => ({ ...acc, [r]: (acc[r] ?? 0) + 1 }), {})
  return NextResponse.json({ success: true, accounts: Object.keys(results).length, counts })
}

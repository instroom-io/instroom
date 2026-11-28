import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getBillingSource, shopifyUpgradeDestination } from "@/lib/shopify-billing"

// Shopify-billed accounts go to Shopify's plan page, never Lemon Squeezy.
export const dynamic = "force-dynamic"

export default async function PricingLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions)
  if (session?.user?.id) {
    const source = await getBillingSource(session.user.id)
    if (source.provider === "shopify") redirect(shopifyUpgradeDestination(source))
  }
  return <>{children}</>
}

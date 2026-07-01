import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user's subscription
    const subscription = await prisma.userSubscription.findUnique({
      where: { user_id: session.user.id },
      include: { plan: true },
    })

    if (!subscription) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 404 }
      )
    }

    if (subscription.status !== "active") {
      return NextResponse.json(
        { error: "Subscription is not active" },
        { status: 400 }
      )
    }

    // Count current brands owned by user
    const brandCount = await prisma.brand.count({
      where: { owner_id: session.user.id },
    })

    // Handle unlimited (Agency plan) vs limited plans
    const isUnlimited = subscription.plan.max_brands === null
    const includedBrands = subscription.plan.included_brands
    const extraBrands = subscription.extra_brands
    const pricePerBrandNum = subscription.plan.price_per_extra_brand ? parseFloat(subscription.plan.price_per_extra_brand.toString()) : 0
    
    if (isUnlimited) {
      // Agency plan: unlimited, but check if exceeding included brands for upsell
      const exceededIncluded = brandCount >= includedBrands
      const canBuyMore = exceededIncluded && pricePerBrandNum > 0
      
      return NextResponse.json({
        allowed: true,
        canBuyMore,
        current: brandCount,
        max: null,
        maxTotalBrands: null,
        maxBrandsAvailable: 999999,
        currentExtraBrands: extraBrands,
        pricePerBrand: pricePerBrandNum,
        message: canBuyMore
          ? `You've exceeded your ${includedBrands} included brands. Would you like to purchase extra brands?`
          : undefined,
      })
    }

    // Limited plans
    const maxBrands = subscription.plan.max_brands!
    const totalAvailable = includedBrands + extraBrands
    const maxBrandsAvailable = maxBrands - totalAvailable
    const allowed = brandCount < totalAvailable
    const canBuyMore = !allowed && maxBrandsAvailable > 0 && pricePerBrandNum > 0

    return NextResponse.json({
      allowed,
      canBuyMore,
      current: brandCount,
      max: totalAvailable,
      maxTotalBrands: maxBrands,
      maxBrandsAvailable,
      currentExtraBrands: extraBrands,
      pricePerBrand: pricePerBrandNum,
      message: allowed
        ? undefined
        : canBuyMore
          ? "You've reached your brand limit. Would you like to purchase extra brands?"
          : "You've reached your brand limit. Unable to purchase more brands for your plan.",
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to check brand limit" },
      { status: 500 }
    )
  }
}

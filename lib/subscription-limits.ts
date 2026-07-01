import { prisma } from "./prisma"

/**
 * Check if user can add a new brand based on their subscription plan
 */
export async function canAddBrand(userId: string): Promise<{
  allowed: boolean
  current: number
  max: number | null
  message?: string
}> {
  try {
    // Count existing brands
    const brandCount = await prisma.brand.count({
      where: { owner_id: userId },
    })

    const subscription = await prisma.userSubscription.findUnique({
      where: { user_id: userId },
      include: {
        plan: true,
      },
    })

    // Freemium: allow 1 workspace without subscription
    if (!subscription || subscription.status !== "active") {
      return {
        allowed: brandCount < 1,
        current: brandCount,
        max: 1,
        message:
          brandCount >= 1
            ? "Free plan allows 1 workspace only. Subscribe to add more workspaces."
            : undefined,
      }
    }

    // Calculate max brands for limited plans (Solo: 1, Team: 3)
    const maxBrands = (subscription.plan.max_brands ?? 0) + subscription.extra_brands

    return {
      allowed: brandCount < maxBrands,
      current: brandCount,
      max: maxBrands,
      message:
        brandCount >= maxBrands
          ? subscription.plan.name === "solo"
            ? "Solo plan only includes 1 workspace. Upgrade to Team plan to add more."
            : `You've reached your workspace limit (${maxBrands}). Upgrade your plan or purchase extra workspaces.`
          : undefined,
    }
  } catch (error) {
    return {
      allowed: false,
      current: 0,
      max: 0,
      message: "Error checking brand limits",
    }
  }
}

/**
 * Check if user can add a new collaborator to a brand
 */
export async function canAddCollaborator(
  userId: string,
  brandId: string
): Promise<{
  allowed: boolean
  current: number
  max: number | null
  message?: string
}> {
  try {
    // Verify user owns the brand
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
    })

    if (!brand || brand.owner_id !== userId) {
      return {
        allowed: false,
        current: 0,
        max: 0,
        message: "Workspace not found or you don't have permission",
      }
    }

    // Unlimited collaborators for all users (free or paid)
    return {
      allowed: true,
      current: 0,
      max: null,
    }
  } catch (error) {
    return {
      allowed: false,
      current: 0,
      max: 0,
      message: "Error checking collaborator limits",
    }
  }
}

/**
 * Check if user can add a new influencer to their brand
 * Trial users can add up to 100 influencers
 * Paid users get limits from their plan
 * Free users cannot add influencers at all
 */
export async function canAddInfluencer(
  userId: string,
  brandId: string
): Promise<{
  allowed: boolean
  current: number
  max: number | null
  message?: string
  subscriptionStatus?: string
}> {
  try {
    // Verify user owns the brand
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
    })

    if (!brand || brand.owner_id !== userId) {
      return {
        allowed: false,
        current: 0,
        max: 0,
        message: "Brand not found or you don't have permission",
      }
    }

    const subscription = await prisma.userSubscription.findUnique({
      where: { user_id: userId },
      include: { plan: true },
    })

    // Free users (no active subscription) cannot add influencers at all
    if (!subscription || (subscription.status !== "active" && subscription.status !== "trialing")) {
      return {
        allowed: false,
        current: 0,
        max: 0,
        message: "Upgrade to a paid plan to add influencers. You can add team members to your workspace for free.",
      }
    }

    // Count existing influencers for this brand
    const influencerCount = await prisma.brandInfluencer.count({
      where: { brand_id: brandId },
    })

    // Trial users: 100 influencer limit
    if (subscription.status === "trialing") {
      const TRIAL_LIMIT = 3
      return {
        allowed: influencerCount < TRIAL_LIMIT,
        current: influencerCount,
        max: TRIAL_LIMIT,
        subscriptionStatus: "trialing",
        message:
          influencerCount >= TRIAL_LIMIT
            ? `You've reached your trial limit (${TRIAL_LIMIT} influencers). Upgrade to a paid plan to add more.`
            : undefined,
      }
    }

    // Paid users: use plan limits (Solo: 100, Team: 500)
    const maxInfluencers = subscription.plan.max_influencers ?? 0

    return {
      allowed: influencerCount < maxInfluencers,
      current: influencerCount,
      max: maxInfluencers,
      subscriptionStatus: "active",
      message:
        influencerCount >= maxInfluencers
          ? `You've reached your influencer limit (${maxInfluencers}). Upgrade your plan to add more.`
          : undefined,
    }
  } catch (error) {
    return {
      allowed: false,
      current: 0,
      max: 0,
      message: "Error checking influencer limits",
    }
  }
}

/**
 * Check if user can create a new active campaign
 */
export async function canCreateCampaign(
  userId: string,
  brandId: string
): Promise<{
  allowed: boolean
  current: number
  max: number | null
  message?: string
}> {
  try {
    // Verify user owns the brand
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
    })

    if (!brand || brand.owner_id !== userId) {
      return {
        allowed: false,
        current: 0,
        max: 0,
        message: "Workspace not found or you don't have permission",
      }
    }

    const subscription = await prisma.userSubscription.findUnique({
      where: { user_id: userId },
      include: { plan: true },
    })

    if (!subscription || subscription.status !== "active") {
      return {
        allowed: false,
        current: 0,
        max: 0,
        message: "No active subscription found",
      }
    }

    const maxCampaigns = subscription.plan.max_campaigns ?? 0

    // Count TOTAL active campaigns across ALL workspaces for this user
    const activeCampaignCount = await prisma.campaign.count({
      where: {
        brand: {
          owner_id: userId,
        },
        status: "active"
      },
    })

    return {
      allowed: activeCampaignCount < maxCampaigns,
      current: activeCampaignCount,
      max: maxCampaigns,
      message:
        activeCampaignCount >= maxCampaigns
          ? `You've reached your active campaign limit (${maxCampaigns}). Complete or archive existing campaigns to create new ones.`
          : undefined,
    }
  } catch (error) {
    return {
      allowed: false,
      current: 0,
      max: 0,
      message: "Error checking campaign limits",
    }
  }
}

/**
 * Check if user has API access based on their subscription plan
 */
export async function hasAPIAccess(userId: string): Promise<{
  allowed: boolean
  message?: string
}> {
  try {
    const subscription = await prisma.userSubscription.findUnique({
      where: { user_id: userId },
      include: { plan: true },
    })

    if (!subscription || subscription.status !== "active") {
      return {
        allowed: false,
        message: "No active subscription found",
      }
    }

    return {
      allowed: subscription.plan.can_use_api === true,
      message: subscription.plan.can_use_api 
        ? undefined 
        : "API access is not included in your plan. Upgrade to Team plan to use the API.",
    }
  } catch (error) {
    return {
      allowed: false,
      message: "Error checking API access",
    }
  }
}

/**
 * Check if user has custom branding access
 */
export async function hasCustomBranding(userId: string): Promise<{
  allowed: boolean
  message?: string
}> {
  try {
    const subscription = await prisma.userSubscription.findUnique({
      where: { user_id: userId },
      include: { plan: true },
    })

    if (!subscription) {
      return {
        allowed: false,
        message: "No subscription found",
      }
    }

    // Trial users cannot customize branding
    if (subscription.status === "trialing") {
      return {
        allowed: false,
        message: "Custom branding is available on paid plans only. Upgrade to Solo or Team to customize your branding.",
      }
    }

    // Only active subscriptions can use branding
    if (subscription.status !== "active") {
      return {
        allowed: false,
        message: "No active subscription found",
      }
    }

    // Solo and Team plans have custom branding access
    const allowedPlans = ["solo", "team"]
    const planName = subscription.plan.name.toLowerCase()
    const allowed = allowedPlans.includes(planName)

    return {
      allowed,
      message: allowed 
        ? undefined 
        : "Custom branding is not included in your plan. Please contact support for advanced features.",
    }
  } catch (error) {
    console.error("Error checking custom branding access:", error)
    return {
      allowed: false,
      message: "Error checking custom branding access",
    }
  }
}

/**
 * Get subscription plan details for a user
 */
export async function getSubscriptionDetails(userId: string) {
  return await prisma.userSubscription.findUnique({
    where: { user_id: userId },
    include: {
      plan: true,
    },
  })
}

/**
 * Check if a user has an active subscription
 * Must have status 'active' or 'trialing' AND not be past the current_period_end AND ended_at must be null/future
 */
export async function userHasActiveSubscription(userId: string): Promise<boolean> {
  try {
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        user_id: userId,
        status: { in: ["active", "trialing"] },
      },
    })
    
    if (!subscription) {
      return false
    }
    
    const now = new Date()
    
    // Check if subscription period has ended
    if (subscription.current_period_end && subscription.current_period_end < now) {
      return false
    }
    
    // Check if subscription was explicitly ended
    if (subscription.ended_at && subscription.ended_at < now) {
      return false
    }
    
    return true
  } catch (error) {
    return false
  }
}

/**
 * Sync brand active status with owner's subscription status
 * Call this when subscription status changes or on login
 */
export async function syncBrandActivityWithSubscription(userId: string): Promise<void> {
  try {
    const hasActiveSubscription = await userHasActiveSubscription(userId)
    
    // Update all brands owned by this user
    await prisma.brand.updateMany({
      where: { owner_id: userId },
      data: { is_active: hasActiveSubscription }
    })
  } catch (error) {
    // Silently fail - don't block operations
  }
}

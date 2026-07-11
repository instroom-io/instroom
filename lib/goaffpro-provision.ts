import { prisma } from "@/lib/prisma"
import { getGoAffProAffiliate, getGoAffProStoreWebsite } from "@/lib/goaffpro"
import { getGoAffProConnection } from "@/lib/goaffpro-connection"

const GOAFFPRO_BASE_URL = "https://api.goaffpro.com/v1/"

async function goAffProRequest(
  accessToken: string,
  path: string,
  body: Record<string, unknown>,
  method: "POST" | "PATCH" | "PUT" = "POST"
) {
  const res = await fetch(new URL(path.replace(/^\//, ""), GOAFFPRO_BASE_URL).toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-goaffpro-access-token": accessToken,
    },
    body: JSON.stringify(body),
  })

  const json = await res.json().catch(() => null)

  if (!res.ok) {
    console.error("[GoAffPro] request failed", {
      path,
      status: res.status,
      response: json,
      payload: body,
    })
    const error = new Error(json?.error || `GoAffPro API error ${res.status}`) as Error & { status?: number }
    error.status = res.status
    throw error
  }

  return json as any
}

export async function provisionGoAffProAffiliate(params: {
  brandId: string
  brandInfluencerId: string
}) {
  const { brandId, brandInfluencerId } = params

  const connection = await getGoAffProConnection(brandId)

  if (!connection) {
    return { success: false, skipped: true as const, reason: "GoAffPro is not connected" }
  }

  const brandInfluencer = await prisma.brandInfluencer.findUnique({
    where: { id: brandInfluencerId },
    include: { influencer: true, attribution: true },
  })

  if (!brandInfluencer) {
    return { success: false, skipped: false as const, reason: "Brand influencer not found" }
  }

  if (brandInfluencer.attribution?.affiliate_id) {
    return {
      success: true,
      alreadyProvisioned: true,
      affiliateId: brandInfluencer.attribution.affiliate_id,
      refCode: brandInfluencer.attribution.ref_code,
      coupon: brandInfluencer.attribution.coupon,
      referralLink: brandInfluencer.attribution.affiliate_link,
    }
  }

  const influencer = brandInfluencer.influencer
  const email = influencer.email || `${influencer.handle.replace(/^@/, "")}@instroom.local`
  const name = influencer.full_name || influencer.handle.replace(/^@/, "")
  const { accessToken } = connection

  let createdAffiliate: any
  try {
    createdAffiliate = await goAffProRequest(accessToken, "/admin/affiliates", {
      email,
      name,
      first_name: name.split(" ")[0] || name,
      last_name: name.split(" ").slice(1).join(" ") || "",
      status: "approved",
    })
  } catch (error: any) {
    if (error?.status === 404) {
      return {
        success: false,
        skipped: true as const,
        reason: "GoAffPro affiliate endpoint returned 404",
      }
    }
    throw error
  }

  const affiliateId = String(createdAffiliate?.id || createdAffiliate?.affiliate_id || "")

  let refCode: string | null = null
  let coupon: string | null = null
  let referralLink: string | null = null

  if (affiliateId) {
    try {
      const details = await getGoAffProAffiliate(accessToken, affiliateId)
      refCode = details?.ref_code ?? null
      coupon = details?.coupons?.[0]?.code ?? null

      if (refCode) {
        const website = await getGoAffProStoreWebsite(accessToken)
        if (website) {
          referralLink = `https://${website.replace(/^https?:\/\//, "")}/?ref=${encodeURIComponent(refCode)}`
        }
      }
    } catch (detailsError) {
      console.error("[GoAffPro] failed to fetch affiliate details —", affiliateId, detailsError)
    }
  } else {
    console.error("[GoAffPro] no affiliateId extracted from create response", JSON.stringify(createdAffiliate))
  }

  await prisma.attribution.upsert({
    where: { brand_influencer_id: brandInfluencerId },
    update: {
      affiliate_id: affiliateId || null,
      ref_code: refCode,
      coupon: coupon,
      affiliate_link: referralLink,
    },
    create: {
      brand_id: brandId,
      brand_influencer_id: brandInfluencerId,
      affiliate_id: affiliateId || null,
      ref_code: refCode,
      coupon: coupon,
      affiliate_link: referralLink,
    },
  })

  return {
    success: true,
    affiliateId,
    refCode,
    coupon,
    referralLink,
  }
}

export async function assignGoAffProCoupon(params: {
  brandId: string
  affiliateId: string
  coupon: string
}) {
  const { brandId, affiliateId, coupon } = params

  const connection = await getGoAffProConnection(brandId)
  if (!connection) {
    return { success: false, reason: "GoAffPro is not connected" }
  }

  try {
    await goAffProRequest(
      connection.accessToken,
      `/admin/affiliates/${affiliateId}/coupons`,
      { coupon },
      "POST"
    )
    return { success: true }
  } catch (error: any) {
    return { success: false, reason: error?.message || "GoAffPro coupon assignment failed" }
  }
}

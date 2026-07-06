const GOAFFPRO_BASE_URL = "https://api.goaffpro.com/v1/"

export type GoAffProAffiliate = {
  id: string
  name?: string | null
  email?: string | null
  ref_code?: string | null
  ref_codes?: string[] | null
  coupon?: string | null
  coupons?: { code: string; discount_type: string; discount_value: number }[] | null
  status?: string | null
}

export type GoAffProTrafficEntry = {
  id: number
  affiliate_id?: string | number | null
  landing_page?: string | null
  referring_page?: string | null
  ip_address?: string | null
  user_agent?: string | null
  created_at?: string | null
}

export type GoAffProOrderEntry = {
  id: number | string
  total: number
  subtotal: number
  affiliate_id: number | string
  commission: number
  status: "approved" | "rejected" | string
  data?: unknown
  created: string
}

type GoAffProCollection<T> = {
  data?: T[]
  affiliates?: T[]
  traffic?: T[]
  orders?: T[]
  [key: string]: unknown
}

async function goAffProFetch<T>(
  accessToken: string,
  path: string,
  query?: Record<string, string | number | undefined>
): Promise<T> {
  if (!accessToken) {
    throw new Error("GoAffPro access token is not configured")
  }

  const url = new URL(path.replace(/^\//, ""), GOAFFPRO_BASE_URL)

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value))
      }
    }
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-goaffpro-access-token": accessToken,
    },
    cache: "no-store",
  })

  const json = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(json?.error || `GoAffPro API error ${res.status}`)
  }

  return json as T
}

export async function getGoAffProStoreInfo(accessToken: string) {
  const json = await goAffProFetch<{ config?: { website?: string; store_name?: string } }>(
    accessToken,
    "/admin/store/config",
    { keys: "website,store_name" }
  )
  return {
    website: json.config?.website ?? null,
    storeName: json.config?.store_name ?? null,
  }
}

export async function getGoAffProStoreWebsite(accessToken: string) {
  const info = await getGoAffProStoreInfo(accessToken)
  return info.website
}

export async function getGoAffProAffiliate(accessToken: string, affiliateId: string | number) {
  const json = await goAffProFetch<GoAffProCollection<GoAffProAffiliate>>(
    accessToken,
    "/admin/affiliates",
    {
      id: affiliateId,
      fields: "id,name,email,ref_code,ref_codes,coupon,coupons,status",
    }
  )
  return json.affiliates?.[0] ?? null
}

export async function listGoAffProAffiliates(accessToken: string) {
  const json = await goAffProFetch<GoAffProCollection<GoAffProAffiliate>>(
    accessToken,
    "/admin/affiliates",
    {
      fields: "id,name,email,ref_code,coupon,referral_link,status",
      limit: 1000,
    }
  )

  return json.affiliates ?? json.data ?? []
}

export async function listGoAffProTraffic(accessToken: string, days = 7) {
  const allTraffic: GoAffProTrafficEntry[] = []
  const createdAtMin = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const limit = 1000
  const maxPages = 10
  let sinceId: string | undefined

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const json = await goAffProFetch<GoAffProCollection<GoAffProTrafficEntry>>(
      accessToken,
      "/admin/traffic",
      {
        fields: "id,affiliate_id,landing_page,referring_page,ip_address,user_agent,created_at",
        created_at_min: createdAtMin,
        limit,
        ...(sinceId ? { since_id: sinceId } : {}),
      }
    )

    const pageTraffic = json.traffic ?? json.data ?? []

    if (pageTraffic.length === 0) {
      break
    }

    allTraffic.push(...pageTraffic)

    const lastTraffic = pageTraffic[pageTraffic.length - 1]
    const nextSinceId = lastTraffic?.id ? String(lastTraffic.id) : undefined

    if (!nextSinceId || nextSinceId === sinceId || pageTraffic.length < limit) {
      break
    }

    sinceId = nextSinceId
  }

  return allTraffic
}

export async function listGoAffProOrders(
  accessToken: string,
  opts?: { sinceCreatedAt?: Date | null; affiliateId?: string }
) {
  const allOrders: GoAffProOrderEntry[] = []
  const limit = 1000
  const maxPages = 20
  let sinceId: string | undefined
  const createdAtMin = opts?.sinceCreatedAt ? opts.sinceCreatedAt.toISOString() : undefined

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const json = await goAffProFetch<GoAffProCollection<GoAffProOrderEntry>>(
      accessToken,
      "/admin/orders",
      {
        fields: "id,total,subtotal,affiliate_id,commission,status,created",
        limit,
        ...(opts?.affiliateId ? { affiliate_id: opts.affiliateId } : {}),
        ...(createdAtMin ? { created_at_min: createdAtMin } : {}),
        ...(sinceId ? { since_id: sinceId } : {}),
      }
    )

    const pageOrders = json.orders ?? json.data ?? []

    if (pageOrders.length === 0) {
      break
    }

    allOrders.push(...pageOrders)

    const lastOrder = pageOrders[pageOrders.length - 1]
    const nextSinceId = lastOrder?.id ? String(lastOrder.id) : undefined

    if (!nextSinceId || nextSinceId === sinceId || pageOrders.length < limit) {
      break
    }

    sinceId = nextSinceId
  }

  return allOrders
}

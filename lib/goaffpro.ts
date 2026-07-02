const GOAFFPRO_BASE_URL = "https://api.goaffpro.com/v1/"

export type GoAffProAffiliate = {
  id: string
  name?: string | null
  email?: string | null
  ref_code?: string | null
  coupon?: string | null
  referral_link?: string | null
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

type GoAffProCollection<T> = {
  data?: T[]
  affiliates?: T[]
  traffic?: T[]
  orders?: T[]
  [key: string]: unknown
}

export function getGoAffProAccessToken() {
  return process.env.GOAFFPRO_ACCESS_TOKEN ?? process.env.X_GOAFFPRO_ACCESS_TOKEN ?? null
}

async function goAffProFetch<T>(
  path: string,
  query?: Record<string, string | number | undefined>
): Promise<T> {
  const accessToken = getGoAffProAccessToken()

  if (!accessToken) {
    throw new Error("GoAffPro access token is not configured")
  }

  const url = new URL(path, GOAFFPRO_BASE_URL)

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

export async function listGoAffProAffiliates() {
  const json = await goAffProFetch<GoAffProCollection<GoAffProAffiliate>>("/admin/affiliates", {
    fields: "id,name,email,ref_code,coupon,referral_link,status",
    limit: 1000,
  })

  return json.affiliates ?? json.data ?? []
}

export async function listGoAffProTraffic(days = 7) {
  const allTraffic: GoAffProTrafficEntry[] = []
  const createdAtMin = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const limit = 1000
  const maxPages = 10
  let sinceId: string | undefined

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const json = await goAffProFetch<GoAffProCollection<GoAffProTrafficEntry>>("/admin/traffic", {
      fields: "id,affiliate_id,landing_page,referring_page,ip_address,user_agent,created_at",
      created_at_min: createdAtMin,
      limit,
      ...(sinceId ? { since_id: sinceId } : {}),
    })

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

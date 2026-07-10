export interface InfluencerRecord {
  id: string
  handle: string
  platform: string
  full_name: string | null
  email: string | null
  gender: string | null
  niche: string | null
  location: string | null
  bio: string | null
  profile_image_url: string | null
  social_link: string | null
  follower_count: number
  engagement_rate: number
  avg_likes: number
  avg_comments: number
  avg_views: number
  created_at: string
  updated_at: string
}

export interface BrandPartnerRecord {
  id: string
  brand_id: string
  influencer_id: string
  brand_influencer_id: string
  on_retainer: boolean
  retainer_fee: number
  default_commission: number
  tier_override: string | null
  product_cost: number
  fees_paid: number
  commission_paid: number
  created_at: string
  updated_at: string
}

export interface BrandInfluencerRecord {
  id: string
  brand_id: string
  influencer_id: string
  campaign_id: string | null
  contact_status: string
  outreach_method: string | null
  stage: number
  order_status: string | null
  product_details: string | null
  shipped_at: string | null
  delivered_at: string | null
  content_posted: boolean
  posted_at: string | null
  post_url: string | null
  post_caption: string | null
  likes_count: number
  comments_count: number
  engagement_count: number
  agreed_rate: number | null
  currency: string | null
  deliverables: string | null
  deadline: string | null
  notes: string | null
  internal_rating: number | null
  approval_status: string | null
  approval_notes: string | null
  affiliate_id: string | null
  ref_code: string | null
  coupon: string | null
  spark_ads: string | null
  affiliate_link: string | null
  clicks: number
  sales_count: number
  gmv: number
  created_at: string
  updated_at: string
  influencer: InfluencerRecord
  campaign?: { id: string; name: string; status: string } | null
  partner?: BrandPartnerRecord | null
}

export interface CampaignRecord {
  id: string
  brand_id: string
  name: string
  description: string | null
  status: string
  start_date: string | null   // ← added
  end_date: string | null     // ← added
  budget: number | null       // ← added
  type: string | null         // ← added
  created_at: string
  updated_at: string
  influencers: BrandInfluencerRecord[]
  _stats?: {
    partner_count: number
    posts_total: number
    posts_done: number
    total_views: number
    total_rev: number
  }
}

export interface OutreachLogRecord {
  id: string
  brand_influencer_id: string
  outreach_type: string
  subject: string | null
  message: string | null
  response_received: boolean
  response_date: string | null
  response_text: string | null
  created_at: string
}

export interface ContentPostRecord {
  id: string
  brand_influencer_id: string
  platform: string
  post_url: string
  caption: string | null
  posted_date: string
  likes: number
  comments: number
  shares: number
  engagement_rate: number
  saved_count: number
  created_at: string
}

export interface BrandTierSettingsRecord {
  brand_id: string
  bronze_max: number
  silver_max: number
  updated_at: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error || `API error ${res.status}`)
  }
  return json.data as T
}

// ─── Partners API ────────────────────────────────────────────────────────────

export const partnersApi = {
  /** List all brand-influencer links for a brand */
  list: (
    brandId: string,
    filters?: {
      search?: string
      stage?: number
      contact_status?: string
      campaign_id?: string
      platform?: string
      niche?: string
    }
  ) => {
    const params = new URLSearchParams()
    if (filters?.search) params.set("search", filters.search)
    if (filters?.stage) params.set("stage", String(filters.stage))
    if (filters?.contact_status) params.set("contact_status", filters.contact_status)
    if (filters?.campaign_id) params.set("campaign_id", filters.campaign_id)
    if (filters?.platform) params.set("platform", filters.platform)
    if (filters?.niche) params.set("niche", filters.niche)
    const qs = params.toString()
    return apiFetch<BrandInfluencerRecord[]>(
      `/api/brands/${brandId}/partners${qs ? `?${qs}` : ""}`
    )
  },

  get: (brandId: string, partnerId: string) =>
    apiFetch<BrandInfluencerRecord>(`/api/brands/${brandId}/partners/${partnerId}`),

  add: (
    brandId: string,
    data: Partial<InfluencerRecord> & {
      influencer_id?: string
      campaign_id?: string
      notes?: string
      agreed_rate?: number
      stage?: number
    }
  ) =>
    apiFetch<BrandInfluencerRecord>(`/api/brands/${brandId}/partners`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** Partial update of a brand-influencer record (CRM/outreach fields) */
  update: (brandId: string, partnerId: string, data: Partial<BrandInfluencerRecord>) =>
    apiFetch<BrandInfluencerRecord>(`/api/brands/${brandId}/partners/${partnerId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  updateFinancials: (
    brandId: string,
    partnerId: string,
    data: Partial<
      Pick<
        BrandPartnerRecord,
        | "on_retainer"
        | "retainer_fee"
        | "default_commission"
        | "tier_override"
        | "product_cost"
        | "fees_paid"
        | "commission_paid"
      > &
        Pick<BrandInfluencerRecord, "clicks" | "sales_count" | "gmv">
    >
  ) =>
    apiFetch<BrandInfluencerRecord>(
      `/api/brands/${brandId}/partners/${partnerId}/financials`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      }
    ),

  /** Remove a brand-influencer link (does NOT delete the global influencer) */
  remove: (brandId: string, partnerId: string) =>
    apiFetch<{ success: boolean }>(`/api/brands/${brandId}/partners/${partnerId}`, {
      method: "DELETE",
    }),

  /** Log an outreach attempt */
  logOutreach: (
    brandId: string,
    partnerId: string,
    data: {
      outreach_type: string
      subject?: string
      message?: string
      response_received?: boolean
      response_text?: string
      bump_status?: boolean
    }
  ) =>
    apiFetch<OutreachLogRecord>(`/api/brands/${brandId}/partners/${partnerId}/outreach`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** Get outreach history */
  getOutreach: (brandId: string, partnerId: string) =>
    apiFetch<OutreachLogRecord[]>(
      `/api/brands/${brandId}/partners/${partnerId}/outreach`
    ),

  /** Log a content post */
  logContent: (
    brandId: string,
    partnerId: string,
    data: {
      platform: string
      post_url: string
      caption?: string
      posted_date: string
      likes?: number
      comments?: number
      shares?: number
      engagement_rate?: number
      saved_count?: number
    }
  ) =>
    apiFetch<ContentPostRecord>(`/api/brands/${brandId}/partners/${partnerId}/content`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** Get content posts */
  getContent: (brandId: string, partnerId: string) =>
    apiFetch<ContentPostRecord[]>(
      `/api/brands/${brandId}/partners/${partnerId}/content`
    ),
}

// ─── Campaigns API ───────────────────────────────────────────────────────────

export const campaignsApi = {
  list: (brandId: string) =>
    apiFetch<CampaignRecord[]>(`/api/brands/${brandId}/campaigns`),

  get: (brandId: string, campaignId: string) =>
    apiFetch<CampaignRecord>(`/api/brands/${brandId}/campaigns/${campaignId}`),

  create: (
    brandId: string,
    data: {
      name: string
      description?: string | null
      status?: string
      start_date?: string | null
      end_date?: string | null
      budget?: number | null
      type?: string | null
      influencer_ids?: string[]
    }
  ) =>
    apiFetch<CampaignRecord>(`/api/brands/${brandId}/campaigns`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (
    brandId: string,
    campaignId: string,
    data: {
      name?: string
      description?: string | null
      status?: string
      start_date?: string | null
      end_date?: string | null
      budget?: number | null
      type?: string | null
      add_influencer_ids?: string[]
      remove_influencer_ids?: string[]
    }
  ) =>
    apiFetch<CampaignRecord>(`/api/brands/${brandId}/campaigns/${campaignId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  archive: (brandId: string, campaignId: string) =>
    apiFetch<{ success: boolean }>(`/api/brands/${brandId}/campaigns/${campaignId}`, {
      method: "DELETE",
    }),
}

// ─── Global Influencer Search ─────────────────────────────────────────────────

export const influencersApi = {
  search: (params: {
    search?: string
    platform?: string
    niche?: string
    limit?: number
    exclude_brand_id?: string
  }) => {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.platform) qs.set("platform", params.platform)
    if (params.niche) qs.set("niche", params.niche)
    if (params.limit) qs.set("limit", String(params.limit))
    if (params.exclude_brand_id) qs.set("exclude_brand_id", params.exclude_brand_id)
    return apiFetch<InfluencerRecord[]>(`/api/influencers?${qs.toString()}`)
  },

  create: (data: Partial<InfluencerRecord>) =>
    apiFetch<InfluencerRecord>("/api/influencers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
}

// ─── Brand Tier Settings API ──────────────────────────────────────────────────

export const tierSettingsApi = {
  /** Get tier thresholds for a brand. Returns sensible defaults if none saved yet. */
  get: (brandId: string) =>
    apiFetch<BrandTierSettingsRecord>(`/api/brands/${brandId}/tier-settings`),

  /** Save (upsert) tier thresholds for a brand */
  save: (brandId: string, settings: { bronzeMax: number; silverMax: number }) =>
    apiFetch<BrandTierSettingsRecord>(`/api/brands/${brandId}/tier-settings`, {
      method: "PUT",
      body: JSON.stringify({
        bronze_max: settings.bronzeMax,
        silver_max: settings.silverMax,
      }),
    }),
}

// ─── Pipeline Stats ───────────────────────────────────────────────────────────

export const pipelineApi = {
  stats: (brandId: string) =>
    apiFetch<{
      total: number
      by_stage: Record<string, number>
      by_status: Record<string, number>
      by_platform: Record<string, number>
      recent: BrandInfluencerRecord[]
      performance: {
        total_likes: number
        total_comments: number
        total_engagements: number
        content_posted_count: number
        avg_agreed_rate: number
        avg_internal_rating: number
      }
    }>(`/api/brands/${brandId}/pipeline`),
}
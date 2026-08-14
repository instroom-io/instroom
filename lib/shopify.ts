// Shopify Admin REST API client — both directions (read orders/products,
// write draft orders, read discount codes). Mirrors lib/goaffpro.ts's
// conventions: plain fetch, thrown Error on failure, provider envelope
// normalized away inside each function.

const API_VERSION = "2024-01"

function shopifyBaseUrl(shopDomain: string) {
  const domain = shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "")
  return `https://${domain}/admin/api/${API_VERSION}/`
}

async function shopifyFetch<T>(
  shopDomain: string,
  accessToken: string,
  path: string,
  opts?: {
    method?: "GET" | "POST" | "PUT"
    query?: Record<string, string | number | undefined>
    body?: unknown
  }
): Promise<{ data: T; linkHeader: string | null }> {
  if (!accessToken) {
    throw new Error("Shopify access token is not configured")
  }

  const url = new URL(path.replace(/^\//, ""), shopifyBaseUrl(shopDomain))
  if (opts?.query) {
    for (const [key, value] of Object.entries(opts.query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value))
      }
    }
  }

  const res = await fetch(url.toString(), {
    method: opts?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    ...(opts?.body ? { body: JSON.stringify(opts.body) } : {}),
    cache: "no-store",
  })

  const json = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(json?.errors ? JSON.stringify(json.errors) : `Shopify API error ${res.status}`)
  }

  return { data: json as T, linkHeader: res.headers.get("link") }
}

function parseNextPageInfo(linkHeader: string | null): string | null {
  if (!linkHeader) return null
  const match = linkHeader.split(",").find((part) => part.includes('rel="next"'))
  if (!match) return null
  const urlMatch = match.match(/<([^>]+)>/)
  if (!urlMatch) return null
  const nextUrl = new URL(urlMatch[1])
  return nextUrl.searchParams.get("page_info")
}

export type ShopifyFulfillment = {
  status?: string | null
  shipment_status?: string | null
  tracking_company?: string | null
  tracking_number?: string | null
}

export type ShopifyOrderEntry = {
  id: number | string
  name?: string
  order_number?: number
  total_price?: string
  total_discounts?: string
  financial_status?: string | null
  fulfillment_status?: string | null
  cancelled_at?: string | null
  created_at?: string
  discount_codes?: { code: string; amount?: string }[]
  fulfillments?: ShopifyFulfillment[]
  line_items?: { price: string; quantity: number }[]
}

export type ShopifyVariant = {
  id: number | string
  title: string
  price: string
  sku?: string | null
}

export type ShopifyProduct = {
  id: number | string
  title: string
  image?: { src: string } | null
  variants: ShopifyVariant[]
}

export async function getShopifyShopInfo(shopDomain: string, accessToken: string) {
  const { data } = await shopifyFetch<{ shop: { name: string; myshopify_domain: string } }>(
    shopDomain,
    accessToken,
    "/shop.json"
  )
  return { storeName: data.shop?.name ?? null }
}

export async function listShopifyOrders(
  shopDomain: string,
  accessToken: string,
  opts?: { updatedAtMin?: Date | null }
): Promise<ShopifyOrderEntry[]> {
  const allOrders: ShopifyOrderEntry[] = []
  const maxPages = 20
  const limit = 250
  let pageInfo: string | undefined
  const updatedAtMin = opts?.updatedAtMin ? opts.updatedAtMin.toISOString() : undefined

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const { data, linkHeader } = await shopifyFetch<{ orders: ShopifyOrderEntry[] }>(
      shopDomain,
      accessToken,
      "/orders.json",
      {
        query: {
          status: "any",
          limit,
          ...(pageInfo ? { page_info: pageInfo } : {}),
          ...(!pageInfo && updatedAtMin ? { updated_at_min: updatedAtMin } : {}),
        },
      }
    )

    const pageOrders = data.orders ?? []
    if (pageOrders.length === 0) break

    allOrders.push(...pageOrders)

    const nextPageInfo = parseNextPageInfo(linkHeader)
    if (!nextPageInfo) break
    pageInfo = nextPageInfo
  }

  return allOrders
}

export async function listShopifyProducts(
  shopDomain: string,
  accessToken: string
): Promise<ShopifyProduct[]> {
  const allProducts: ShopifyProduct[] = []
  const maxPages = 20
  const limit = 250
  let pageInfo: string | undefined

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const { data, linkHeader } = await shopifyFetch<{ products: ShopifyProduct[] }>(
      shopDomain,
      accessToken,
      "/products.json",
      {
        query: {
          fields: "id,title,image,variants",
          limit,
          ...(pageInfo ? { page_info: pageInfo } : {}),
        },
      }
    )

    const pageProducts = data.products ?? []
    if (pageProducts.length === 0) break

    allProducts.push(...pageProducts)

    const nextPageInfo = parseNextPageInfo(linkHeader)
    if (!nextPageInfo) break
    pageInfo = nextPageInfo
  }

  return allProducts
}

export type ShopifyShippingAddress = {
  first_name?: string
  last_name?: string
  address1: string
  address2?: string
  city: string
  province?: string
  zip: string
  country: string
  phone?: string
}

export type ShopifyAppliedDiscount = {
  value_type: "percentage" | "fixed_amount"
  value: string
  title: string
}

export async function createShopifyDraftOrder(
  shopDomain: string,
  accessToken: string,
  params: {
    variantId: string | number
    quantity: number
    shippingAddress: ShopifyShippingAddress
    note?: string
    tags?: string
    priceOverride?: string
    appliedDiscount?: ShopifyAppliedDiscount
  }
) {
  const lineItem: Record<string, unknown> = {
    variant_id: params.variantId,
    quantity: params.quantity,
  }
  if (params.priceOverride !== undefined) {
    lineItem.price = params.priceOverride
  }

  const { data } = await shopifyFetch<{ draft_order: { id: number | string } }>(
    shopDomain,
    accessToken,
    "/draft_orders.json",
    {
      method: "POST",
      body: {
        draft_order: {
          line_items: [lineItem],
          shipping_address: params.shippingAddress,
          note: params.note,
          tags: params.tags,
          use_customer_default_address: false,
          ...(params.appliedDiscount ? { applied_discount: params.appliedDiscount } : {}),
        },
      },
    }
  )

  return data.draft_order
}

export async function completeShopifyDraftOrder(
  shopDomain: string,
  accessToken: string,
  draftOrderId: string | number
) {
  const { data } = await shopifyFetch<{ draft_order: { id: number | string; order_id: number | string | null } }>(
    shopDomain,
    accessToken,
    `/draft_orders/${draftOrderId}/complete.json`,
    { method: "PUT", query: { payment_pending: "true" } }
  )

  return data.draft_order
}

// Registers a webhook subscription right after OAuth install, so the brand
// never has to manually paste a webhook URL into a Shopify app config (that
// concept doesn't exist for OAuth-installed apps — subscriptions are created
// via this API call instead). Best-effort: logs and swallows failures rather
// than blocking the connection, since the on-demand sync route and the
// dormant cron are both already-independent backstops if this doesn't take.
export async function createShopifyWebhook(
  shopDomain: string,
  accessToken: string,
  topic: string,
  address: string
) {
  try {
    await shopifyFetch(shopDomain, accessToken, "/webhooks.json", {
      method: "POST",
      body: { webhook: { topic, address, format: "json" } },
    })
  } catch (error) {
    console.error(`[Shopify] failed to register webhook "${topic}" for ${shopDomain}`, error)
  }
}

export async function getShopifyOrder(shopDomain: string, accessToken: string, orderId: string | number) {
  const { data } = await shopifyFetch<{ order: ShopifyOrderEntry & { admin_graphql_api_id?: string } }>(
    shopDomain,
    accessToken,
    `/orders/${orderId}.json`
  )
  return data.order
}

// Looks up a discount code's real configured value via the two-step
// lookup → price rule endpoints, so the manual discount applied to a draft
// order matches what the code actually does (10%, 15%, fixed amount, etc.)
// instead of guessing.
export async function getShopifyDiscountByCode(
  shopDomain: string,
  accessToken: string,
  code: string
): Promise<{ code: string; valueType: "percentage" | "fixed_amount"; value: string } | null> {
  let priceRuleId: string | number
  try {
    const { data } = await shopifyFetch<{ discount_code: { price_rule_id: string | number; code: string } }>(
      shopDomain,
      accessToken,
      "/discount_codes/lookup.json",
      { query: { code } }
    )
    priceRuleId = data.discount_code.price_rule_id
  } catch {
    return null
  }

  const { data } = await shopifyFetch<{
    price_rule: { value_type: "percentage" | "fixed_amount"; value: string }
  }>(shopDomain, accessToken, `/price_rules/${priceRuleId}.json`)

  return {
    code,
    valueType: data.price_rule.value_type,
    // Shopify stores the value as negative (e.g. "-10.0" for 10% off);
    // applied_discount on a draft order expects a positive amount-to-remove.
    value: String(Math.abs(parseFloat(data.price_rule.value))),
  }
}

// Shopify Admin GraphQL API client — both directions (read orders/products,
// write draft orders, read discount codes). REST Admin API is legacy and
// unusable for a public app going through Shopify's App Store review, so
// every call here goes through a single GraphQL endpoint instead. Mirrors
// lib/goaffpro.ts's conventions: plain fetch, thrown Error on failure,
// provider envelope normalized away inside each function — the exported
// function signatures and returned shapes are unchanged from the old REST
// client so nothing downstream (lib/shopify-orders.ts, lib/shopify-create-order.ts,
// lib/post-tracker-status.ts, the products/shopify-order routes) needs to change.

const API_VERSION = "2026-07"

function shopifyGraphQLUrl(shopDomain: string) {
  const domain = shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "")
  return `https://${domain}/admin/api/${API_VERSION}/graphql.json`
}

type GraphQLUserError = { field?: string[] | null; message: string }

async function shopifyGraphQL<T>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  if (!accessToken) {
    throw new Error("Shopify access token is not configured")
  }

  const res = await fetch(shopifyGraphQLUrl(shopDomain), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  })

  const json = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(json?.errors ? JSON.stringify(json.errors) : `Shopify API error ${res.status}`)
  }
  // Top-level GraphQL errors (bad query, access-scope denial, etc.) are
  // distinct from a mutation's `userErrors` — those still return HTTP 200
  // and are handled per-mutation via throwOnUserErrors below.
  if (json?.errors?.length) {
    throw new Error(JSON.stringify(json.errors))
  }

  return json.data as T
}

function throwOnUserErrors(userErrors: GraphQLUserError[] | null | undefined) {
  if (userErrors && userErrors.length > 0) {
    throw new Error(userErrors.map((e) => e.message).join("; "))
  }
}

// GraphQL enums for the specific values this file cares about (SUCCESS,
// DELIVERED, PAID, etc.) are upper-snake-case strings that are IDENTICAL to
// REST's own lowercase convention once lowercased — verified live against
// Shopify's schema (FulfillmentStatus, FulfillmentEventStatus,
// OrderDisplayFinancialStatus all confirmed to lowercase into exactly the
// strings lib/post-tracker-status.ts's deriveShopifyTargetStatus and
// lib/shopify-orders.ts's rank guard already depend on).
function lowerOrNull(value: string | null | undefined): string | null {
  return value ? value.toLowerCase() : null
}

// Shopify's GraphQL MailingAddressInput requires a strict ISO CountryCode
// enum value — unlike REST, there is no free-text country field at all.
// The existing shipping-address form collects free text (placeholder hints
// "US" but doesn't enforce it, and real submitted data has included full
// names like "Philippines"), so normalize common full names to their ISO
// code and pass anything already 2 letters through as-is. Add entries here
// as unrecognized country names come up in practice.
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  "united kingdom": "GB",
  uk: "GB",
  "great britain": "GB",
  canada: "CA",
  australia: "AU",
  philippines: "PH",
  singapore: "SG",
  malaysia: "MY",
  indonesia: "ID",
  thailand: "TH",
  vietnam: "VN",
  india: "IN",
  japan: "JP",
  "south korea": "KR",
  china: "CN",
  germany: "DE",
  france: "FR",
  spain: "ES",
  italy: "IT",
  netherlands: "NL",
  belgium: "BE",
  "new zealand": "NZ",
  mexico: "MX",
  brazil: "BR",
  ireland: "IE",
  switzerland: "CH",
  sweden: "SE",
  norway: "NO",
  denmark: "DK",
  finland: "FI",
  portugal: "PT",
  "united arab emirates": "AE",
  uae: "AE",
  "saudi arabia": "SA",
  "south africa": "ZA",
  "hong kong": "HK",
  taiwan: "TW",
}

function resolveCountryCode(input: string): string {
  const trimmed = input.trim()
  if (/^[a-zA-Z]{2}$/.test(trimmed)) return trimmed.toUpperCase()
  const code = COUNTRY_NAME_TO_CODE[trimmed.toLowerCase()]
  if (!code) {
    throw new Error(
      `Unrecognized country "${input}" — expected a 2-letter country code (e.g. "US") or a supported country name`
    )
  }
  return code
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

// Shared field selection for both listShopifyOrders and getShopifyOrder so
// the two stay in lockstep — same shape in, same shape out.
const ORDER_FIELDS = `
  legacyResourceId
  name
  createdAt
  cancelledAt
  displayFinancialStatus
  displayFulfillmentStatus
  currentTotalPriceSet { shopMoney { amount } }
  currentTotalDiscountsSet { shopMoney { amount } }
  discountCodes
  lineItems(first: 50) {
    nodes {
      quantity
      discountedUnitPriceSet { shopMoney { amount } }
    }
  }
  fulfillments(first: 10) {
    status
    events(first: 5, sortKey: HAPPENED_AT, reverse: true) {
      nodes { status }
    }
  }
`

type GraphQLOrderNode = {
  legacyResourceId: string
  name: string
  createdAt: string
  cancelledAt: string | null
  displayFinancialStatus: string | null
  displayFulfillmentStatus: string | null
  currentTotalPriceSet: { shopMoney: { amount: string } } | null
  currentTotalDiscountsSet: { shopMoney: { amount: string } } | null
  discountCodes: string[] | null
  lineItems: { nodes: { quantity: number; discountedUnitPriceSet: { shopMoney: { amount: string } } | null }[] } | null
  fulfillments: { status: string; events: { nodes: { status: string }[] } }[] | null
}

function mapGraphQLOrder(node: GraphQLOrderNode): ShopifyOrderEntry {
  return {
    id: node.legacyResourceId,
    name: node.name,
    total_price: node.currentTotalPriceSet?.shopMoney?.amount,
    total_discounts: node.currentTotalDiscountsSet?.shopMoney?.amount,
    financial_status: lowerOrNull(node.displayFinancialStatus),
    fulfillment_status: lowerOrNull(node.displayFulfillmentStatus),
    cancelled_at: node.cancelledAt,
    created_at: node.createdAt,
    discount_codes: (node.discountCodes ?? []).map((code) => ({ code })),
    fulfillments: (node.fulfillments ?? []).map((f) => ({
      status: lowerOrNull(f.status),
      // "Last fulfillment, last event" — most-recent event first (reverse:
      // true) so index 0 is the current shipment state, matching the REST
      // shipment_status field's single-current-value semantic.
      shipment_status: lowerOrNull(f.events?.nodes?.[0]?.status ?? null),
    })),
    line_items: (node.lineItems?.nodes ?? []).map((li) => ({
      price: li.discountedUnitPriceSet?.shopMoney?.amount ?? "0",
      quantity: li.quantity,
    })),
  }
}

export async function getShopifyShopInfo(shopDomain: string, accessToken: string) {
  const { shop } = await shopifyGraphQL<{ shop: { name: string } }>(
    shopDomain,
    accessToken,
    `{ shop { name } }`
  )
  return { storeName: shop?.name ?? null }
}

async function getShopCurrencyCode(shopDomain: string, accessToken: string): Promise<string> {
  const { shop } = await shopifyGraphQL<{ shop: { currencyCode: string } }>(
    shopDomain,
    accessToken,
    `{ shop { currencyCode } }`
  )
  return shop.currencyCode
}

export async function listShopifyOrders(
  shopDomain: string,
  accessToken: string,
  opts?: { updatedAtMin?: Date | null }
): Promise<ShopifyOrderEntry[]> {
  const allOrders: ShopifyOrderEntry[] = []
  const maxPages = 20
  let cursor: string | null = null
  const searchQuery = opts?.updatedAtMin ? `updated_at:>='${opts.updatedAtMin.toISOString()}'` : undefined

  const query = `
    query ListOrders($cursor: String, $searchQuery: String) {
      orders(first: 250, after: $cursor, query: $searchQuery, sortKey: UPDATED_AT) {
        pageInfo { hasNextPage endCursor }
        nodes { ${ORDER_FIELDS} }
      }
    }
  `

  type OrdersResponse = {
    orders: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: GraphQLOrderNode[] }
  }

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const data: OrdersResponse = await shopifyGraphQL<OrdersResponse>(shopDomain, accessToken, query, {
      cursor,
      searchQuery,
    })

    const pageOrders = data.orders.nodes ?? []
    if (pageOrders.length === 0) break

    allOrders.push(...pageOrders.map(mapGraphQLOrder))

    if (!data.orders.pageInfo.hasNextPage) break
    cursor = data.orders.pageInfo.endCursor
  }

  return allOrders
}

export async function listShopifyProducts(shopDomain: string, accessToken: string): Promise<ShopifyProduct[]> {
  const allProducts: ShopifyProduct[] = []
  const maxPages = 20
  let cursor: string | null = null

  const query = `
    query ListProducts($cursor: String) {
      products(first: 250, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          legacyResourceId
          title
          featuredImage { url }
          variants(first: 100) {
            nodes { legacyResourceId title price sku }
          }
        }
      }
    }
  `

  type GraphQLProductNode = {
    legacyResourceId: string
    title: string
    featuredImage: { url: string } | null
    variants: { nodes: { legacyResourceId: string; title: string; price: string; sku: string | null }[] }
  }

  type ProductsResponse = {
    products: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: GraphQLProductNode[] }
  }

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const data: ProductsResponse = await shopifyGraphQL<ProductsResponse>(shopDomain, accessToken, query, {
      cursor,
    })

    const pageProducts = data.products.nodes ?? []
    if (pageProducts.length === 0) break

    allProducts.push(
      ...pageProducts.map((p: GraphQLProductNode) => ({
        id: p.legacyResourceId,
        title: p.title,
        image: p.featuredImage ? { src: p.featuredImage.url } : null,
        variants: (p.variants?.nodes ?? []).map((v: GraphQLProductNode["variants"]["nodes"][number]) => ({
          id: v.legacyResourceId,
          title: v.title,
          price: v.price,
          sku: v.sku ?? null,
        })),
      }))
    )

    if (!data.products.pageInfo.hasNextPage) break
    cursor = data.products.pageInfo.endCursor
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
    variantId: `gid://shopify/ProductVariant/${params.variantId}`,
    quantity: params.quantity,
  }
  if (params.priceOverride !== undefined) {
    // MoneyInput requires an explicit currency — draft orders don't carry
    // one of their own until completed, so ask the shop what it uses.
    const currencyCode = await getShopCurrencyCode(shopDomain, accessToken)
    lineItem.priceOverride = { amount: params.priceOverride, currencyCode }
  }

  const address = params.shippingAddress
  const shippingAddressInput: Record<string, unknown> = {
    firstName: address.first_name,
    lastName: address.last_name,
    address1: address.address1,
    address2: address.address2,
    city: address.city,
    provinceCode: address.province || undefined,
    zip: address.zip,
    countryCode: resolveCountryCode(address.country),
    phone: address.phone,
  }

  const input: Record<string, unknown> = {
    lineItems: [lineItem],
    shippingAddress: shippingAddressInput,
    useCustomerDefaultAddress: false,
  }
  if (params.note !== undefined) input.note = params.note
  if (params.tags !== undefined) input.tags = [params.tags]
  if (params.appliedDiscount) {
    input.appliedDiscount = {
      title: params.appliedDiscount.title,
      value: Number(params.appliedDiscount.value),
      valueType: params.appliedDiscount.value_type === "percentage" ? "PERCENTAGE" : "FIXED_AMOUNT",
    }
  }

  const query = `
    mutation DraftOrderCreate($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder { legacyResourceId }
        userErrors { field message }
      }
    }
  `
  const data = await shopifyGraphQL<{
    draftOrderCreate: { draftOrder: { legacyResourceId: string } | null; userErrors: GraphQLUserError[] }
  }>(shopDomain, accessToken, query, { input })

  throwOnUserErrors(data.draftOrderCreate.userErrors)
  return { id: data.draftOrderCreate.draftOrder!.legacyResourceId }
}

export async function completeShopifyDraftOrder(
  shopDomain: string,
  accessToken: string,
  draftOrderId: string | number
) {
  // paymentPending is deprecated ("Create a draft with payment terms rather
  // than marking the draft as pending") but still functional as of this API
  // version — the recommended replacement requires either a pre-existing
  // payment-terms template on the shop or a manually constructed payment
  // schedule, real complexity for what these gifted/comped orders need:
  // simply not showing up as real revenue. Kept deliberately; re-test this
  // if a future API version bump removes the argument outright.
  const query = `
    mutation DraftOrderComplete($id: ID!, $paymentPending: Boolean) {
      draftOrderComplete(id: $id, paymentPending: $paymentPending) {
        draftOrder {
          legacyResourceId
          order { legacyResourceId }
        }
        userErrors { field message }
      }
    }
  `
  const data = await shopifyGraphQL<{
    draftOrderComplete: {
      draftOrder: { legacyResourceId: string; order: { legacyResourceId: string } | null } | null
      userErrors: GraphQLUserError[]
    }
  }>(shopDomain, accessToken, query, { id: `gid://shopify/DraftOrder/${draftOrderId}`, paymentPending: true })

  throwOnUserErrors(data.draftOrderComplete.userErrors)
  const draftOrder = data.draftOrderComplete.draftOrder!
  return { id: draftOrder.legacyResourceId, order_id: draftOrder.order?.legacyResourceId ?? null }
}

const WEBHOOK_TOPIC_MAP: Record<string, string> = {
  "orders/create": "ORDERS_CREATE",
  "orders/updated": "ORDERS_UPDATED",
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
  const graphqlTopic = WEBHOOK_TOPIC_MAP[topic]
  if (!graphqlTopic) {
    console.error(`[Shopify] unknown webhook topic "${topic}"`)
    return
  }

  try {
    const query = `
      mutation WebhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
          webhookSubscription { id }
          userErrors { field message }
        }
      }
    `
    const data = await shopifyGraphQL<{
      webhookSubscriptionCreate: { webhookSubscription: { id: string } | null; userErrors: GraphQLUserError[] }
    }>(shopDomain, accessToken, query, {
      topic: graphqlTopic,
      webhookSubscription: { uri: address, format: "JSON" },
    })

    // A 200 response with populated userErrors (e.g. "address already used
    // for this topic") is not an HTTP failure and wouldn't hit the catch
    // below — treat it the same way, log and swallow.
    if (data.webhookSubscriptionCreate.userErrors?.length) {
      console.error(
        `[Shopify] failed to register webhook "${topic}" for ${shopDomain}`,
        data.webhookSubscriptionCreate.userErrors
      )
    }
  } catch (error) {
    console.error(`[Shopify] failed to register webhook "${topic}" for ${shopDomain}`, error)
  }
}

export async function getShopifyOrder(shopDomain: string, accessToken: string, orderId: string | number) {
  const query = `
    query GetOrder($id: ID!) {
      order(id: $id) { ${ORDER_FIELDS} }
    }
  `
  const data = await shopifyGraphQL<{ order: GraphQLOrderNode | null }>(shopDomain, accessToken, query, {
    id: `gid://shopify/Order/${orderId}`,
  })
  if (!data.order) {
    throw new Error(`Shopify order ${orderId} not found`)
  }
  return { ...mapGraphQLOrder(data.order), admin_graphql_api_id: `gid://shopify/Order/${orderId}` }
}

// Looks up a discount code's real configured value via the GraphQL Admin
// API's direct code lookup, so the manual discount applied to a draft order
// matches what the code actually does (10%, 15%, fixed amount, etc.)
// instead of guessing. Requires the `read_discounts` scope (replaces the
// legacy `read_price_rules` scope the old REST lookup used).
export async function getShopifyDiscountByCode(
  shopDomain: string,
  accessToken: string,
  code: string
): Promise<{ code: string; valueType: "percentage" | "fixed_amount"; value: string } | null> {
  const query = `
    query GetDiscount($code: String!) {
      codeDiscountNodeByCode(code: $code) {
        codeDiscount {
          __typename
          ... on DiscountCodeBasic {
            codes(first: 1) { nodes { code } }
            customerGets {
              value {
                __typename
                ... on DiscountPercentage { percentage }
                ... on DiscountAmount { amount { amount } }
              }
            }
          }
        }
      }
    }
  `
  type DiscountResponse = {
    codeDiscountNodeByCode: {
      codeDiscount: {
        __typename: string
        codes?: { nodes: { code: string }[] }
        customerGets?: {
          // Only DiscountPercentage/DiscountAmount are queried via inline
          // fragments above — any other discount type (BXGY, etc.) comes
          // back with just __typename and no extra fields, so both are
          // optional here rather than a discriminated union (a union with
          // an unmatched third variant defeats __typename narrowing).
          value: { __typename: string; percentage?: number; amount?: { amount: string } }
        }
      } | null
    } | null
  }
  const data = await shopifyGraphQL<DiscountResponse>(shopDomain, accessToken, query, { code })

  const discount = data.codeDiscountNodeByCode?.codeDiscount
  if (!discount || discount.__typename !== "DiscountCodeBasic" || !discount.customerGets) {
    return null
  }

  const value = discount.customerGets.value
  const actualCode = discount.codes?.nodes?.[0]?.code ?? code

  if (value.__typename === "DiscountPercentage" && value.percentage !== undefined) {
    // The Discounts API returns a fraction (0.15 for 15%), unlike REST's old
    // price_rule.value which was a whole-number percentage string ("15.0",
    // negative-signed) — confirmed live against a real 15%-off test code.
    // Scale back to whole-number-percent so this function's return shape
    // (and everything downstream reading it) doesn't need to change.
    return { code: actualCode, valueType: "percentage", value: String(value.percentage * 100) }
  }
  if (value.__typename === "DiscountAmount" && value.amount !== undefined) {
    return { code: actualCode, valueType: "fixed_amount", value: value.amount.amount }
  }
  // BXGY / other discount types aren't a single percentage-or-fixed-amount
  // value the draft-order applied-discount flow can represent — treat as
  // "not usable here" rather than guessing.
  return null
}

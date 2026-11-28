// Cookie that returns a merchant from the Shopify app to the link page after
// signup, onboarding or brand creation. Expires with the ticket (30 min).

export const SHOPIFY_LINK_PATH = "/dashboard/settings/integrations/shopify-link"
export const SHOPIFY_LINK_COOKIE = "instroom_shopify_link"
export const SHOPIFY_LINK_MAX_AGE = 30 * 60

/** Only our link page, never an arbitrary redirect. */
export function isShopifyLinkTarget(value: string | null | undefined): value is string {
  return !!value && (value === SHOPIFY_LINK_PATH || value.startsWith(`${SHOPIFY_LINK_PATH}?`))
}

export function rememberShopifyLink(target: string) {
  if (typeof document === "undefined" || !isShopifyLinkTarget(target)) return
  const secure = location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${SHOPIFY_LINK_COOKIE}=${encodeURIComponent(target)}; Max-Age=${SHOPIFY_LINK_MAX_AGE}; Path=/; SameSite=Lax${secure}`
}

export function pendingShopifyLink(): string | null {
  if (typeof document === "undefined") return null
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`${SHOPIFY_LINK_COOKIE}=`))
  if (!raw) return null
  try {
    const value = decodeURIComponent(raw.slice(SHOPIFY_LINK_COOKIE.length + 1))
    return isShopifyLinkTarget(value) ? value : null
  } catch {
    return null
  }
}

export function forgetShopifyLink() {
  if (typeof document === "undefined") return
  document.cookie = `${SHOPIFY_LINK_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`
}

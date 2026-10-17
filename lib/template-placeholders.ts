export const TEMPLATE_PLACEHOLDERS = [
  { token: "{{first_name}}", label: "First name", example: "Sarah" },
  { token: "{{name}}", label: "Full name", example: "Sarah Johnson" },
  { token: "{{handle}}", label: "Handle", example: "sarahj" },
  { token: "{{platform}}", label: "Platform", example: "Instagram" },
  { token: "{{brand}}", label: "Brand name", example: "Your brand" },
] as const

export type TemplateValues = {
  name?: string | null
  handle?: string | null
  platform?: string | null
  brand?: string | null
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "X",
}

/** A missing name reads "there". */
export function fillTemplate(text: string, values: TemplateValues): string {
  const name = values.name?.trim() || ""
  const platform = values.platform?.trim().toLowerCase() || ""
  const map: Record<string, string> = {
    first_name: name.split(/\s+/)[0] || "there",
    name: name || "there",
    handle: values.handle?.trim() || "",
    platform: PLATFORM_LABELS[platform] ?? values.platform ?? "",
    brand: values.brand?.trim() || "",
  }
  return text.replace(/\{\{\s*(first_name|name|handle|platform|brand)\s*\}\}/gi, (_, key: string) => map[key.toLowerCase()])
}

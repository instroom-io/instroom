export type BrandCapability = "approveInfluencers" | "manageCampaigns" | "manageInfluencers"

export const ROLE_CAPABILITIES: Record<string, BrandCapability[]> = {
  manager: ["approveInfluencers", "manageCampaigns", "manageInfluencers"],
  // Researchers can search for and add influencers, and fill in details —
  // just not approve/decline them, manage campaigns, or export data.
  researcher: ["manageInfluencers"],
  viewer: [],
}

// Legacy/unrecognized roles (e.g. the retired "collaborator" default) inherit
// manager-level access rather than losing capabilities they already had.
export const FALLBACK_CAPABILITIES = ROLE_CAPABILITIES.manager

export function roleHasCapability(role: string | null | undefined, capability: BrandCapability): boolean {
  if (role === "owner") return true
  if (!role) return false
  const capabilities = ROLE_CAPABILITIES[role] ?? FALLBACK_CAPABILITIES
  return capabilities.includes(capability)
}

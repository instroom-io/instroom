import { prisma } from "@/lib/prisma"

const MESSAGE_PAGE_SIZE = 50

// Shared by the channels route (which inlines the first channel's messages
// into its response to save a client round trip) and the messages route.
export async function getChannelMessages(brandId: string, channelId: string) {
  const messages = await prisma.communityMessage.findMany({
    where: { channel_id: channelId, brand_id: brandId },
    orderBy: { created_at: "desc" },
    take: MESSAGE_PAGE_SIZE,
  })

  const userIds = [...new Set(messages.map((m) => m.user_id))]
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, image: true, email: true },
      })
    : []
  const userMap = new Map(users.map((u) => [u.id, u]))

  return messages
    .map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.created_at,
      user: userMap.get(m.user_id) ?? { id: m.user_id, name: "Unknown", image: null, email: null },
    }))
    .reverse() // oldest first for a normal chat reading order
}

export async function checkBrandAccess(brandId: string, userId: string) {
  return prisma.brand.findFirst({
    where: {
      id: brandId,
      OR: [
        { owner_id: userId },
        { members: { some: { user_id: userId } } },
      ],
    },
    select: { id: true },
  })
}

const DEFAULT_CHANNELS = [
  { name: "General", description: "General discussion for the whole community", is_default: true },
  { name: "Introductions", description: "Say hello and introduce yourself", is_default: false },
]

// Every brand should always have at least the default channels — create them
// lazily on first access instead of a seed script, so this works for brands
// created before the community feature existed too.
export async function ensureDefaultChannels(brandId: string) {
  const existing = await prisma.communityChannel.findFirst({ where: { brand_id: brandId } })
  if (existing) return

  await prisma.communityChannel.createMany({
    data: DEFAULT_CHANNELS.map((c) => ({ ...c, brand_id: brandId })),
  })
}

// lib/research-sop/db.ts
//
// This host forces utf8mb3 on new connections, so a write containing a 4-byte
// character (emoji — common in bios, captions and pasted SOP text) fails with
// MySQL 3988 unless it runs inside withUtf8mb4. Same test the influencer PUT
// route uses: only pay for the pinned session when the payload needs it.

import { prisma, withUtf8mb4 } from "@/lib/prisma"

const FOUR_BYTE_CHAR = /[\u{10000}-\u{10FFFF}]/u

export type WriteClient = typeof prisma | Parameters<Parameters<typeof withUtf8mb4>[0]>[0]

export async function writeMaybeUtf8mb4<T>(payload: unknown, fn: (client: WriteClient) => Promise<T>): Promise<T> {
  return FOUR_BYTE_CHAR.test(JSON.stringify(payload ?? null)) ? withUtf8mb4((tx) => fn(tx)) : fn(prisma)
}

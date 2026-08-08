import crypto from "crypto"
import { prisma } from "@/lib/prisma"

// Generates a one-time password-set/reset token: the raw value is returned
// for embedding in an emailed URL, while only its SHA-256 hash is persisted —
// mirroring the forgot-password flow this was extracted from.
export async function createPasswordSetToken(email: string, ttlMs = 60 * 60 * 1000): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex")
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex")

  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  })

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: hashedToken,
      expires: new Date(Date.now() + ttlMs),
    },
  })

  return rawToken
}

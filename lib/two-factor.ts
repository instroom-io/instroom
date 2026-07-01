import { authenticator } from "otplib"
import QRCode from "qrcode"
import bcrypt from "bcryptjs"
import crypto from "crypto"

const ISSUER = "instroom"

export function generateTwoFactorSecret(email: string) {
  const secret = authenticator.generateSecret()
  const otpauthUrl = authenticator.keyuri(email, ISSUER, secret)
  return { secret, otpauthUrl }
}

export async function generateQrCodeDataUrl(otpauthUrl: string) {
  return QRCode.toDataURL(otpauthUrl)
}

export function verifyTwoFactorCode(token: string, secret: string) {
  return authenticator.verify({ token, secret })
}

export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () =>
    crypto.randomBytes(5).toString("hex").toUpperCase()
  )
}

export async function hashBackupCodes(codes: string[]) {
  return Promise.all(codes.map((c) => bcrypt.hash(c, 10)))
}

export async function verifyAndConsumeBackupCode(
  code: string,
  hashedCodes: string[]
): Promise<{ valid: boolean; remaining: string[] }> {
  for (const hashed of hashedCodes) {
    if (await bcrypt.compare(code, hashed)) {
      return { valid: true, remaining: hashedCodes.filter((h) => h !== hashed) }
    }
  }
  return { valid: false, remaining: hashedCodes }
}
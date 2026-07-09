import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"

function getKey() {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error("ENCRYPTION_KEY is not configured")
  }
  return Buffer.from(key, "hex")
}

export function encrypt(text: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString("base64")
}

export function decrypt(payload: string) {
  const raw = Buffer.from(payload, "base64")
  const iv = raw.subarray(0, 12)
  const authTag = raw.subarray(12, 28)
  const encrypted = raw.subarray(28)
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")
}

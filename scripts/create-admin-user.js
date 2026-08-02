// One-off bootstrap script for the mock Admin Dashboard account (MVP only —
// see the note on this in the Admin Dashboard feature). Idempotent: safe to
// run more than once — re-running always resets the password to a fresh
// random value (or ADMIN_PASSWORD if you set that env var), so the original
// hardcoded "admin@instroom.io" password can never be silently reintroduced.
//
// Usage:
//   node scripts/create-admin-user.js                 → random password, printed once
//   ADMIN_PASSWORD=yourpass node scripts/create-admin-user.js   → your own password

const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")
const crypto = require("crypto")

const prisma = new PrismaClient()

const ADMIN_EMAIL = "admin@instroom.io"
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || crypto.randomBytes(18).toString("base64url")

async function main() {
  const password_hash = await bcrypt.hash(ADMIN_PASSWORD, 10)

  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { platform_role: "admin", is_active: true, password_hash },
    create: {
      email: ADMIN_EMAIL,
      name: "Instroom Admin",
      password_hash,
      platform_role: "admin",
      is_active: true,
    },
  })

  console.log(`Admin user ready: ${user.email} (id: ${user.id}, platform_role: ${user.platform_role})`)
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`New password (save this now — it will not be shown again): ${ADMIN_PASSWORD}`)
  }
}

main()
  .catch((err) => {
    console.error("Failed to create admin user:", err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

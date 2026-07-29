// One-off bootstrap script for the mock Admin Dashboard account (MVP only —
// see the note on this in the Admin Dashboard feature). Idempotent: safe to
// run more than once.
//
// Usage:  node scripts/create-admin-user.js

const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")

const prisma = new PrismaClient()

const ADMIN_EMAIL = "admin@instroom.io"
const ADMIN_PASSWORD = "admin@instroom.io"

async function main() {
  const password_hash = await bcrypt.hash(ADMIN_PASSWORD, 10)

  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { platform_role: "admin", is_active: true },
    create: {
      email: ADMIN_EMAIL,
      name: "Instroom Admin",
      password_hash,
      platform_role: "admin",
      is_active: true,
    },
  })

  console.log(`Admin user ready: ${user.email} (id: ${user.id}, platform_role: ${user.platform_role})`)
}

main()
  .catch((err) => {
    console.error("Failed to create admin user:", err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

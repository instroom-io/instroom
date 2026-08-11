import { NextResponse } from "next/server"
import { getActivePlans } from "@/prisma/plans"

// Lets /pricing/payment pull the exact same live plan data /pricing shows,
// instead of keeping its own copy that can drift out of sync.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  const plans = await getActivePlans()
  const plan = plans.find((p) => p.name === name)

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 })
  }

  return NextResponse.json({ plan })
}

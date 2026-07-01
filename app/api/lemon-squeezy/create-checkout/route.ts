import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"
import { createLemonSqueezyCheckout } from "@/lib/lemon-squeezy-utils"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { amount, quantity, variantId, storeId } = await req.json()
    
    // Validate required fields
    if (!variantId || !storeId) {
      return NextResponse.json(
        { error: "Missing variantId or storeId" },
        { status: 400 }
      )
    }

    if (!quantity || quantity < 1 || !Number.isInteger(quantity)) {
      return NextResponse.json(
        { error: "Invalid quantity" },
        { status: 400 }
      )
    }

    const amountNum = typeof amount === "string" ? parseFloat(amount) : amount

    if (!amountNum || amountNum < 0.01) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      )
    }

    console.log(`Creating Lemon Squeezy checkout for ${quantity} workspace(s) - Total: $${amountNum}`)

    const customData = {
      userId: session.user.id,
      quantity,
      pricePerBrand: amountNum / quantity,
      totalCost: amountNum,
    }

    const checkout = await createLemonSqueezyCheckout(
      storeId,
      variantId,
      quantity,
      customData
    )

    console.log("Lemon Squeezy checkout created successfully:", checkout.data.id)

    return NextResponse.json({
      id: checkout.data.id,
      url: checkout.data.attributes.url,
    })
  } catch (error) {
    console.error("Error creating Lemon Squeezy checkout:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create checkout" },
      { status: 500 }
    )
  }
}

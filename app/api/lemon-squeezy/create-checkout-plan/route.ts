import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { variantId, planKey, cycle } = await req.json()

    if (!variantId || !planKey || !cycle) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const storeId = process.env.LEMON_SQUEEZY_STORE_ID
    if (!storeId) {
      return NextResponse.json(
        { error: "Store ID not configured" },
        { status: 500 }
      )
    }

    // Create checkout on Lemon Squeezy
    const baseUrl = process.env.NEXTAUTH_URL || "https://localhost:3000"
    const successUrl = `${baseUrl}/subscription-success`
    
    const checkoutData = {
      data: {
        type: "checkouts",
        attributes: {
          product_options: {
            redirect_url: successUrl,
          },
          checkout_data: {
            custom: {
              userId: session.user.id,
              email: session.user.email,
              planKey,
              cycle,
            },
          },
        },
        relationships: {
          store: {
            data: {
              type: "stores",
              id: storeId,
            },
          },
          variant: {
            data: {
              type: "variants",
              id: variantId,
            },
          },
        },
      },
    }

    const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.LEMON_SQUEEZY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(checkoutData),
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json({ error: "Failed to create checkout" }, { status: 400 })
    }

    const checkout = await response.json()

    return NextResponse.json({
      id: checkout.data.id,
      url: checkout.data.attributes.url,
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 })
  }
}

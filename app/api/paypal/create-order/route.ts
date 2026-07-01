import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"

const PAYPAL_API_URL = process.env.PAYPAL_MODE === "live" 
  ? "https://api-m.paypal.com" 
  : "https://api-m.sandbox.paypal.com"

async function getPayPalAccessToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64")

  const response = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  })

  if (!response.ok) {
    const error = await response.text()
    console.error("PayPal OAuth error:", response.status, error)
    throw new Error(`Failed to get PayPal access token: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.access_token
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { amount, description } = await req.json()
    const amountNum = typeof amount === "string" ? parseFloat(amount) : amount

    if (!amountNum || amountNum < 0.01) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      )
    }

    const accessToken = await getPayPalAccessToken()

    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: amountNum.toFixed(2),
          },
          description: description || "Purchase extra seats",
        },
      ],
    }

    const response = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error("PayPal API error response:", response.status, error)
      return NextResponse.json(
        { error: error.message || "Failed to create payment order" },
        { status: 400 }
      )
    }

    const order = await response.json()
    return NextResponse.json(order)
  } catch (error) {
    console.error("Error creating PayPal order:", error)
    return NextResponse.json(
      { error: "Failed to create payment order" },
      { status: 500 }
    )
  }
}

// Lemon Squeezy API utilities

export interface LemonSqueezyCheckoutData {
  data: {
    id: string
    attributes: {
      checkout_data: null | any
      created_at: string
      expires_at: string
      name: string
      test_mode: boolean
      url: string
      updated_at: string
    }
  }
}

export interface LemonSqueezyOrder {
  data: {
    id: string
    attributes: {
      identifier: string
      order_number: number
      user_name: string
      user_email: string
      currency: string
      currency_rate: string
      subtotal: number
      discount_total: number
      tax: number
      total: number
      total_formatted: string
      status: string
      status_formatted: string
      refunded: boolean
      refunded_at: string | null
      created_at: string
      updated_at: string
    }
  }
}

function validateLemonSqueezyEnvironment() {
  if (!process.env.LEMON_SQUEEZY_API_KEY) {
    throw new Error("Missing LEMON_SQUEEZY_API_KEY environment variable")
  }
}

export async function createLemonSqueezyCheckout(
  storeId: string,
  variantId: string,
  quantity: number,
  customData: {
    userId: string
    quantity: number
    pricePerBrand: number
    totalCost: number
  }
): Promise<LemonSqueezyCheckoutData> {
  validateLemonSqueezyEnvironment()

  const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LEMON_SQUEEZY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            custom: customData,
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
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    console.error("Lemon Squeezy API error:", error)
    throw new Error(`Failed to create checkout: ${JSON.stringify(error)}`)
  }

  return await response.json()
}

export async function verifyLemonSqueezyOrder(orderId: string): Promise<LemonSqueezyOrder> {
  validateLemonSqueezyEnvironment()

  const response = await fetch(`https://api.lemonsqueezy.com/v1/orders/${orderId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${process.env.LEMON_SQUEEZY_API_KEY}`,
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    throw new Error("Failed to verify Lemon Squeezy order")
  }

  return await response.json()
}

export async function getLemonSqueezyCheckout(checkoutId: string): Promise<LemonSqueezyCheckoutData> {
  validateLemonSqueezyEnvironment()

  const response = await fetch(`https://api.lemonsqueezy.com/v1/checkouts/${checkoutId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${process.env.LEMON_SQUEEZY_API_KEY}`,
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    throw new Error("Failed to get Lemon Squeezy checkout")
  }

  return await response.json()
}

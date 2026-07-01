// PayPal API utilities with environment validation and safe data handling

const PAYPAL_API_URL = process.env.PAYPAL_MODE === "live" 
  ? "https://api-m.paypal.com" 
  : "https://api-m.sandbox.paypal.com"

export interface PayPalPaymentData {
  status: string
  purchase_units: Array<{
    amount: {
      value: string
    }
  }>
}

function validatePayPalEnvironment() {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    throw new Error("Missing PayPal environment variables (PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET)")
  }
}

export async function getPayPalAccessToken(): Promise<string> {
  validatePayPalEnvironment()

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
    throw new Error(`Failed to get PayPal access token: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.access_token
}

export async function verifyPayPalPayment(transactionId: string): Promise<PayPalPaymentData> {
  if (!transactionId || typeof transactionId !== "string" || transactionId.length === 0) {
    throw new Error("Invalid PayPal order ID provided")
  }

  const accessToken = await getPayPalAccessToken()

  const response = await fetch(
    `${PAYPAL_API_URL}/v2/checkout/orders/${transactionId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error("Failed to verify PayPal payment")
  }

  const data = await response.json()
  
  // Validate response structure
  if (!data.status || !data.purchase_units || !Array.isArray(data.purchase_units) || data.purchase_units.length === 0) {
    throw new Error("Invalid PayPal response structure")
  }

  if (!data.purchase_units[0].amount || !data.purchase_units[0].amount.value) {
    throw new Error("Missing payment amount in PayPal response")
  }

  return data
}

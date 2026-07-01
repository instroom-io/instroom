import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getPayPalAccessToken, verifyPayPalPayment } from "@/lib/paypal-utils"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { quantity, paypalOrderId } = await req.json()

    if (!quantity || quantity < 1 || !Number.isInteger(quantity)) {
      return NextResponse.json(
        { error: "Invalid quantity" },
        { status: 400 }
      )
    }

    const subscription = await prisma.userSubscription.findUnique({
      where: { user_id: session.user.id },
      include: { plan: true },
    })

    if (!subscription) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      )
    }

    if (subscription.status !== "active") {
      return NextResponse.json(
        { error: "Subscription is not active" },
        { status: 400 }
      )
    }

    // Handle unlimited (Agency plan) vs limited plans
    const isUnlimited = subscription.plan.max_seats === null
    const maxSeats = isUnlimited ? null : (subscription.plan.max_seats ?? subscription.plan.included_seats)
    const totalSeatsAfter = subscription.extra_seats + quantity

    // Check if purchase exceeds plan limits (skip check for unlimited Agency plan)
    if (!isUnlimited && totalSeatsAfter > maxSeats!) {
      return NextResponse.json(
        {
          error: `Cannot purchase ${quantity} extra seats. Maximum allowed is ${maxSeats! - subscription.extra_seats} more seats.`,
          maxAllowed: maxSeats! - subscription.extra_seats,
        },
        { status: 400 }
      )
    }

    const pricePerSeat = subscription.plan.price_per_extra_seat
    const pricePerSeatNum = pricePerSeat ? parseFloat(pricePerSeat.toString()) : 0
    
    if (!pricePerSeat || pricePerSeatNum <= 0) {
      return NextResponse.json(
        { error: "Extra seats not available for this plan" },
        { status: 400 }
      )
    }

    const totalCost = pricePerSeatNum * quantity

    if (paypalOrderId) {
      try {
        const paypalData = await verifyPayPalPayment(paypalOrderId)

        if (paypalData.status !== "APPROVED" && paypalData.status !== "COMPLETED") {
          return NextResponse.json(
            { error: "Payment not approved" },
            { status: 400 }
          )
        }

        const paidAmount = parseFloat(paypalData.purchase_units[0].amount.value)
        if (Math.abs(paidAmount - totalCost) > 0.01) {
          return NextResponse.json(
            { error: "Payment amount mismatch" },
            { status: 400 }
          )
        }

        // Payment verified, update subscription
        const updatedSubscription = await prisma.userSubscription.update({
          where: { id: subscription.id },
          data: {
            extra_seats: {
              increment: quantity,
            },
          },
          include: { plan: true },
        })

        // Log successful payment
        await prisma.paymentHistory.create({
          data: {
            user_id: session.user.id,
            subscription_id: subscription.id,
            amount: totalCost,
            status: "completed",
            description: `Purchase of ${quantity} extra seat(s)`,
            stripe_payment_id: paypalOrderId,
          },
        })

        return NextResponse.json({
          success: true,
          message: `Successfully purchased ${quantity} extra seat(s)`,
          totalCost,
          extraSeats: updatedSubscription.extra_seats,
          maxSeats,
          totalAvailable: updatedSubscription.extra_seats + subscription.plan.included_seats,
        })
      } catch (paypalError) {
        console.error("PayPal verification error:", paypalError)
        return NextResponse.json(
          { error: "Failed to verify payment with PayPal" },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({
      success: false,
      requiresPayment: true,
      paymentDetails: {
        quantity,
        pricePerSeat: pricePerSeatNum,
        totalCost,
        maxSeats,
        maxAllowed: maxSeats !== null ? (maxSeats - subscription.extra_seats) : null,
      },
      message: "Please complete payment to confirm",
    })
  } catch (error) {
    console.error("Purchase error:", error)
    return NextResponse.json(
      { error: "Failed to process purchase" },
      { status: 500 }
    )
  }
}


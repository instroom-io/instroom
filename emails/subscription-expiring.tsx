import { Button, Heading, Section, Text } from "react-email"
import * as React from "react"
import { EmailLayout, colors, btn, bodyText } from "./layout"

interface SubscriptionExpiringEmailProps {
  name: string
  planName: string
  daysLeft: number
  expiresOn: string
  renewUrl: string
}

export default function SubscriptionExpiringEmail({
  name = "there",
  planName = "Solo",
  daysLeft = 7,
  expiresOn = "",
  renewUrl = "#",
}: SubscriptionExpiringEmailProps) {
  return (
    <EmailLayout preview={`Your Instroom trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"} — pick a plan to keep access.`}>
      <div style={{ marginBottom: "16px" }}>
        <span style={badge}>⏳ Trial ending soon</span>
      </div>

      <Heading style={heading}>Your access ends in {daysLeft} day{daysLeft === 1 ? "" : "s"}, {name}.</Heading>

      <Text style={bodyText}>
        Your {planName} trial expires on <strong>{expiresOn}</strong>. To keep
        using Instroom without interruption, pick a monthly or yearly plan
        before then — your workspace, campaigns, and data will stay exactly
        as you left them.
      </Text>

      <Text style={bodyText}>
        If you don't renew, your account moves to read-only once the trial
        ends until you choose a plan.
      </Text>

      <Section style={{ textAlign: "center", margin: "28px 0 8px" }}>
        <Button href={renewUrl} style={btn}>
          Choose a plan →
        </Button>
      </Section>

      <Text style={safetyNote}>
        Questions about pricing? Just reply to this email — a real person
        will get back to you.
      </Text>
    </EmailLayout>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const badge: React.CSSProperties = {
  backgroundColor: colors.warning,
  border: `1px solid ${colors.warningText}`,
  borderRadius: "20px",
  color: colors.warningText,
  display: "inline-block",
  fontSize: "12px",
  fontWeight: "600",
  padding: "4px 12px",
}

const heading = {
  color: colors.ink,
  fontSize: "24px",
  fontWeight: "700",
  lineHeight: "1.3",
  margin: "0 0 16px 0",
}

const safetyNote = {
  color: colors.muted,
  fontSize: "13px",
  lineHeight: "1.6",
  margin: "8px 0 0",
}

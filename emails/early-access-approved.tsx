import { Button, Heading, Section, Text } from "react-email"
import * as React from "react"
import { EmailLayout, colors, btn, bodyText, sectionLabel } from "./layout"

interface EarlyAccessApprovedEmailProps {
  name: string
  signupUrl: string
}

export default function EarlyAccessApprovedEmail({
  name = "there",
  signupUrl = "#",
}: EarlyAccessApprovedEmailProps) {
  return (
    <EmailLayout preview="You're approved for Instroom early access — here's how to get started.">
      <div style={{ marginBottom: "16px" }}>
        <span style={badge}>✓ Early Access Approved</span>
      </div>

      <Heading style={heading}>You're in, {name}.</Heading>

      <Text style={bodyText}>
        Good news — your Instroom workspace is ready. You're one of the first
        to get access during our private beta, and we'd love for you to start
        running your first campaign.
      </Text>

      <Section style={stepsBox}>
        <Text style={sectionLabel}>Getting started</Text>
        <Text style={stepItem}>
          <strong>1.</strong> Click the button below to create your account
          with this email address.
        </Text>
        <Text style={stepItem}>
          <strong>2.</strong> You'll get 30 days of full platform access — no
          credit card required.
        </Text>
        <Text style={stepItem}>
          <strong>3.</strong> Set up your first workspace and start tracking
          creators, campaigns, and outreach in one place.
        </Text>
      </Section>

      <Section style={{ textAlign: "center", margin: "28px 0 8px" }}>
        <Button href={signupUrl} style={btn}>
          Create your account →
        </Button>
      </Section>

      <Text style={safetyNote}>
        Questions before you get started? Just reply to this email — a real
        person will get back to you.
      </Text>
    </EmailLayout>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const badge: React.CSSProperties = {
  backgroundColor: colors.brandLight,
  border: `1px solid ${colors.brand}`,
  borderRadius: "20px",
  color: colors.brandDark,
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

const stepsBox = {
  backgroundColor: colors.subtle,
  borderRadius: "10px",
  margin: "20px 0",
  padding: "20px",
}

const stepItem = {
  color: colors.ink,
  fontSize: "13px",
  lineHeight: "1.6",
  margin: "0 0 8px 0",
}

const safetyNote = {
  color: colors.muted,
  fontSize: "13px",
  lineHeight: "1.6",
  margin: "8px 0 0",
}

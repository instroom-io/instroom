import { Button, Heading, Section, Text, Link } from "react-email"
import * as React from "react"
import { EmailLayout, colors, btn, bodyText, sectionLabel } from "./layout"

const APP_URL = process.env.NEXTAUTH_URL ?? "https://instroom.app"

interface WelcomeEmailProps {
  name: string
}

export default function WelcomeEmail({ name = "there" }: WelcomeEmailProps) {
  return (
    <EmailLayout preview={`Welcome to Instroom, ${name}! Your account is ready.`}>
      <Heading style={heading}>Welcome aboard, {name}.</Heading>

      <Text style={bodyText}>
        Your Instroom account is live. You now have everything you need to
        manage influencer partnerships, track campaigns, and move deals from
        outreach to posted — all in one place.
      </Text>

      {/* Plan cards */}
      <Section style={plansWrapper}>
        <Text style={sectionLabel}>Choose your plan to get started</Text>

        <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderSpacing: "0" }}>
          <tbody>
            <tr>
              <td style={planCard}>
                <Text style={planName}>Solo</Text>
                <Text style={planDesc}>
                  Perfect for individual creators and small workspaces
                </Text>
              </td>
              <td style={{ width: "16px" }} />
              <td style={{ ...planCard, borderColor: colors.brand }}>
                <Text style={{ ...planName, color: colors.brand }}>Team</Text>
                <Text style={planDesc}>
                  Collaborate with your team across brands and campaigns
                </Text>
              </td>
            </tr>
          </tbody>
        </table>

        <Section style={{ textAlign: "center", marginTop: "20px" }}>
          <Button href={`${APP_URL}/pricing`} style={btn}>
            Choose your plan →
          </Button>
        </Section>
      </Section>

      {/* Feature list */}
      <Text style={sectionLabel}>What's waiting for you</Text>
      {[
        "Manage influencer partnerships end-to-end",
        "Track campaign performance with live analytics",
        "Organize your pipeline from outreach to post",
        "Scale your influencer marketing efforts",
      ].map((feature) => (
        <Text key={feature} style={featureItem}>
          <span style={{ color: colors.brand, marginRight: "8px" }}>✦</span>
          {feature}
        </Text>
      ))}

      <Text style={helpText}>
        Questions? Reply to this email or visit our{" "}
        <Link href={`${APP_URL}/support`} style={inlineLink}>
          help center
        </Link>
        .
      </Text>
    </EmailLayout>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const heading = {
  color:      colors.ink,
  fontSize:   "24px",
  fontWeight: "700",
  lineHeight: "1.3",
  margin:     "0 0 16px 0",
}

const plansWrapper = {
  backgroundColor: colors.subtle,
  borderRadius:    "10px",
  padding:         "20px",
  margin:          "24px 0",
}

const planCard: React.CSSProperties = {
  backgroundColor: colors.white,
  border:          `1px solid ${colors.border}`,
  borderRadius:    "8px",
  padding:         "14px 16px",
  verticalAlign:   "top",
  width:           "50%",
}

const planName = {
  color:      colors.ink,
  fontSize:   "14px",
  fontWeight: "700",
  margin:     "0 0 4px 0",
}

const planDesc = {
  color:      colors.muted,
  fontSize:   "12px",
  lineHeight: "1.5",
  margin:     "0",
}

const featureItem = {
  color:      colors.ink,
  fontSize:   "14px",
  lineHeight: "1.6",
  margin:     "0 0 8px 0",
}

const helpText = {
  color:      colors.muted,
  fontSize:   "13px",
  lineHeight: "1.6",
  margin:     "24px 0 0 0",
}

const inlineLink = {
  color:          colors.brand,
  textDecoration: "underline",
}
import { Button, Heading, Section, Text } from "react-email"
import * as React from "react"
import { EmailLayout, colors, btn, bodyText } from "./layout"

export type NotifType = "influencer_reply" | "stage_change" | "deal_agreed"

interface NotificationEmailProps {
  name:       string
  type:       NotifType
  title:      string
  message:    string
  actionUrl?: string
}

const typeConfig: Record<NotifType, { icon: string; label: string; bg: string; color: string }> = {
  influencer_reply: {
    icon:  "💬",
    label: "New reply",
    bg:    colors.brandLight,
    color: colors.brandDark,
  },
  stage_change: {
    icon:  "🔄",
    label: "Stage updated",
    bg:    "#EFF6FF",
    color: "#1D4ED8",
  },
  deal_agreed: {
    icon:  "🎉",
    label: "Deal confirmed",
    bg:    "#ECFDF5",
    color: "#059669",
  },
}

export default function NotificationEmail({
  name      = "there",
  type      = "stage_change",
  title     = "Pipeline update",
  message   = "",
  actionUrl,
}: NotificationEmailProps) {
  const config = typeConfig[type]

  return (
    <EmailLayout preview={title}>
      {/* Event type badge */}
      <div style={{ marginBottom: "20px" }}>
        <span
          style={{
            backgroundColor: config.bg,
            borderRadius:    "20px",
            color:           config.color,
            display:         "inline-block",
            fontSize:        "12px",
            fontWeight:      "600",
            padding:         "4px 12px",
          }}
        >
          {config.icon} {config.label}
        </span>
      </div>

      <Heading style={heading}>{title}</Heading>

      <Text style={bodyText}>Hi {name},</Text>
      <Text style={bodyText}>{message}</Text>

      {actionUrl && (
        <Section style={{ textAlign: "center", margin: "28px 0 0" }}>
          <Button href={actionUrl} style={btn}>
            View in Instroom →
          </Button>
        </Section>
      )}
    </EmailLayout>
  )
}

const heading = {
  color:      colors.ink,
  fontSize:   "22px",
  fontWeight: "700",
  lineHeight: "1.3",
  margin:     "0 0 16px 0",
}
import { Button, Heading, Section, Text } from "react-email"
import * as React from "react"
import { EmailLayout, colors, btn, bodyText, sectionLabel } from "./layout"

interface BrandInvitationEmailProps {
  brandName:      string
  inviterName:    string
  invitationLink: string
  role:           string
}

const roleConfigs: Record<string, { label: string; can: string[]; cannot: string[] }> = {
  manager: {
    label: "Manager",
    can: [
      "Approve influencers",
      "Manage outreach campaigns",
      "Oversee all operational tasks",
      "View workspace analytics",
    ],
    cannot: [
      "Manage workspace settings (Admin only)",
      "Invite or remove members",
      "Transfer Admin role",
    ],
  },
  researcher: {
    label: "Researcher",
    can: [
      "Search for influencers",
      "Add influencers to lists",
      "Fill in details and notes",
      "Submit influencers for approval",
    ],
    cannot: [
      "Approve influencers",
      "Manage outreach",
      "Export data",
      "Manage workspace settings",
    ],
  },
  viewer: {
    label: "Viewer",
    can: [
      "View campaigns",
      "View reports",
      "View workspace analytics",
      "Access read-only information",
    ],
    cannot: [
      "Create or edit campaigns",
      "Approve influencers",
      "Manage any workspace features",
    ],
  },
  collaborator: {
    label: "Collaborator",
    can: [
      "Collaborate on projects",
      "Manage influencer relationships",
      "Track campaign performance",
      "Access workspace resources",
    ],
    cannot: ["Manage workspace settings", "Invite members"],
  },
}

export default function BrandInvitationEmail({
  brandName      = "Your Brand",
  inviterName    = "Someone",
  invitationLink = "#",
  role           = "collaborator",
}: BrandInvitationEmailProps) {
  const config = roleConfigs[role] ?? roleConfigs.collaborator

  return (
    <EmailLayout
      preview={`${inviterName} invited you to join ${brandName} on Instroom as ${config.label}.`}
    >
      {/* Role badge */}
      <div style={{ marginBottom: "16px" }}>
        <span style={roleBadge}>{config.label}</span>
      </div>

      <Heading style={heading}>You're invited to {brandName}</Heading>

      <Text style={bodyText}>
        <strong>{inviterName}</strong> has added you as a{" "}
        <strong>{config.label}</strong> to the{" "}
        <strong>{brandName}</strong> workspace on Instroom. You'll have full
        access to create and manage campaigns and track influencer posts.
      </Text>

      {/* Capabilities box */}
      <Section style={capBox}>
        <Text style={sectionLabel}>As a {config.label}, you can</Text>
        {config.can.map((item) => (
          <Text key={item} style={capItem}>
            <span style={checkMark}>✓</span> {item}
          </Text>
        ))}

        {config.cannot.length > 0 && (
          <>
            <div style={divider} />
            <Text style={{ ...sectionLabel, marginTop: "12px" }}>
              Not available in this role
            </Text>
            {config.cannot.map((item) => (
              <Text key={item} style={capItemMuted}>
                <span style={xMark}>✕</span> {item}
              </Text>
            ))}
          </>
        )}
      </Section>

      {/* CTA */}
      <Section style={{ textAlign: "center", margin: "28px 0 8px" }}>
        <Button href={invitationLink} style={btn}>
          Accept invitation →
        </Button>
        <Text style={expiryNote}>This link expires in 7 days.</Text>
      </Section>

      <Text style={safetyNote}>
        If you weren't expecting this invitation, you can safely ignore this email.
      </Text>
    </EmailLayout>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const roleBadge: React.CSSProperties = {
  backgroundColor: colors.brandLight,
  border:          `1px solid ${colors.brand}`,
  borderRadius:    "20px",
  color:           colors.brandDark,
  display:         "inline-block",
  fontSize:        "12px",
  fontWeight:      "600",
  padding:         "4px 12px",
}

const heading = {
  color:      colors.ink,
  fontSize:   "24px",
  fontWeight: "700",
  lineHeight: "1.3",
  margin:     "0 0 16px 0",
}

const capBox = {
  backgroundColor: colors.subtle,
  borderRadius:    "10px",
  margin:          "20px 0",
  padding:         "20px",
}

const capItem = {
  color:      colors.ink,
  fontSize:   "13px",
  lineHeight: "1.6",
  margin:     "0 0 6px 0",
}

const capItemMuted = {
  color:      colors.muted,
  fontSize:   "13px",
  lineHeight: "1.6",
  margin:     "0 0 6px 0",
}

const checkMark: React.CSSProperties = {
  color:       colors.brand,
  fontWeight:  "700",
  marginRight: "8px",
}

const xMark: React.CSSProperties = {
  color:       colors.muted,
  marginRight: "8px",
}

const divider = {
  borderTop: `1px solid ${colors.border}`,
  margin:    "12px 0",
}

const expiryNote = {
  color:     colors.muted,
  fontSize:  "12px",
  margin:    "10px 0 0",
  textAlign: "center" as const,
}

const safetyNote = {
  color:      colors.muted,
  fontSize:   "13px",
  lineHeight: "1.6",
  margin:     "8px 0 0",
}
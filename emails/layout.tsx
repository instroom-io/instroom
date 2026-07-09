import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Hr,
  Link,
} from "react-email"
import * as React from "react"

const APP_URL = process.env.NEXTAUTH_URL ?? "https://instroom.io"
const LOGO_URL = `${APP_URL}/images/INSTROOM%20LOGO%201.png`

interface EmailLayoutProps {
  preview: string
  children: React.ReactNode
}

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Top accent bar */}
          <Section style={accentBar} />

          {/* Logo + wordmark */}
          <Section style={logoSection}>
            <Img
              src={LOGO_URL}
              width={64}
              alt="Instroom"
              style={logoImg}
            />
            <Text style={logoWordmark}>INSTROOM</Text>
          </Section>

          {/* Main content */}
          <Section style={contentSection}>{children}</Section>

          {/* Footer */}
          <Hr style={footerDivider} />
          <Section style={footerSection}>
            <Text style={footerText}>
              © 2026 Instroom · Simplify your Influencer Marketing Workflow
            </Text>
            <Text style={footerText}>
              <Link
                href={`${APP_URL}/dashboard/settings/notifications`}
                style={footerLink}
              >
                Manage notifications
              </Link>
              {" · "}
              <Link href={APP_URL} style={footerLink}>
                Open Instroom
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// ── Shared design tokens ──────────────────────────────────────────────────────

export const colors = {
  brand:       "#1FAE5B",
  brandDark:   "#0F6B3E",
  brandLight:  "#F0FDF6",
  ink:         "#111827",
  muted:       "#6B7280",
  subtle:      "#F9FAFB",
  border:      "#E5E7EB",
  white:       "#FFFFFF",
  warning:     "#FEF3C7",
  warningText: "#92400E",
}

export const btn = {
  backgroundColor: "#1FAE5B",
  borderRadius:    "8px",
  color:           "#FFFFFF",
  display:         "inline-block",
  fontSize:        "14px",
  fontWeight:      "600",
  padding:         "12px 28px",
  textDecoration:  "none",
  letterSpacing:   "0.01em",
} as const

export const bodyText = {
  color:      "#111827",
  fontSize:   "15px",
  lineHeight: "1.7",
  margin:     "0 0 16px 0",
} as const

export const sectionLabel = {
  color:         "#6B7280",
  fontSize:      "11px",
  fontWeight:    "600" as const,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  margin:        "0 0 10px 0",
}

// ── Layout styles ─────────────────────────────────────────────────────────────

const body = {
  backgroundColor: "#F3F4F6",
  fontFamily:      "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  margin:          "0",
  padding:         "32px 0",
}

const container = {
  backgroundColor: "#FFFFFF",
  borderRadius:    "12px",
  maxWidth:        "560px",
  margin:          "0 auto",
  overflow:        "hidden" as const,
}

const accentBar = {
  backgroundColor: "#1FAE5B",
  height:          "4px",
  width:           "100%",
}

const logoSection = {
  padding: "28px 40px 16px",
}

const logoImg = {
  borderRadius:  "8px",
  display:       "inline-block",
  verticalAlign: "middle",
  width:         "64px",
  height:        "auto",
}

const logoWordmark = {
  color:         "#0F6B3E",
  display:       "inline-block",
  fontSize:      "13px",
  fontWeight:    "800",
  letterSpacing: "0.14em",
  margin:        "0 0 0 10px",
  verticalAlign: "middle",
}

const contentSection = {
  padding: "8px 40px 36px",
}

const footerDivider = {
  borderColor: "#E5E7EB",
  margin:      "0 40px",
}

const footerSection = {
  padding: "20px 40px 28px",
}

const footerText = {
  color:     "#6B7280",
  fontSize:  "12px",
  margin:    "0 0 4px 0",
  textAlign: "center" as const,
}

const footerLink = {
  color:          "#6B7280",
  textDecoration: "underline",
}
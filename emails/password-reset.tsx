import { Button, Heading, Section, Text } from "react-email"
import * as React from "react"
import { EmailLayout, colors, btn, bodyText } from "./layout"

interface PasswordResetEmailProps {
  name:     string
  resetUrl: string
}

export default function PasswordResetEmail({
  name     = "there",
  resetUrl = "#",
}: PasswordResetEmailProps) {
  return (
    <EmailLayout preview="Reset your Instroom password — link expires in 1 hour.">
      <Heading style={heading}>Reset your password</Heading>

      <Text style={bodyText}>Hi {name},</Text>
      <Text style={bodyText}>
        We received a request to reset your Instroom password. Click the button
        below to choose a new one.
      </Text>

      <Section style={{ textAlign: "center", margin: "28px 0" }}>
        <Button href={resetUrl} style={btn}>
          Reset password
        </Button>
      </Section>

      <Text style={urlLabel}>Or copy this link into your browser:</Text>
      <Text style={urlBox}>{resetUrl}</Text>

      <Section style={warningBox}>
        <Text style={warningText}>
          <strong>⏰ This link expires in 1 hour.</strong> If it expires, submit
          a new password reset request from the login page.
        </Text>
      </Section>

      <Text style={safetyNote}>
        If you didn't request a password reset, you can safely ignore this
        email — your account remains secure.
      </Text>
    </EmailLayout>
  )
}

const heading = {
  color:      colors.ink,
  fontSize:   "24px",
  fontWeight: "700",
  lineHeight: "1.3",
  margin:     "0 0 20px 0",
}

const urlLabel = {
  color:      colors.muted,
  fontSize:   "12px",
  margin:     "0 0 6px 0",
}

const urlBox = {
  backgroundColor: colors.subtle,
  borderRadius:    "6px",
  color:           colors.muted,
  fontFamily:      "monospace",
  fontSize:        "12px",
  lineHeight:      "1.5",
  margin:          "0 0 24px 0",
  padding:         "10px 14px",
  wordBreak:       "break-all" as const,
}

const warningBox = {
  backgroundColor: colors.warning,
  borderRadius:    "8px",
  padding:         "14px 16px",
  margin:          "0 0 20px 0",
}

const warningText = {
  color:      colors.warningText,
  fontSize:   "13px",
  lineHeight: "1.6",
  margin:     "0",
}

const safetyNote = {
  color:      colors.muted,
  fontSize:   "13px",
  lineHeight: "1.6",
  margin:     "0",
}
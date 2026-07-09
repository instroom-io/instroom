import { Heading, Section, Text } from "react-email"
import * as React from "react"
import { EmailLayout, colors, bodyText } from "./layout"

interface OTPEmailProps {
  name: string
  otp:  string
}

export default function OTPEmail({ name = "there", otp = "000000" }: OTPEmailProps) {
  const digits = otp.split("")

  return (
    <EmailLayout preview={`${otp} is your Instroom verification code.`}>
      <Heading style={heading}>Verify your email</Heading>

      <Text style={bodyText}>Hi {name},</Text>
      <Text style={bodyText}>
        Welcome to Instroom! Enter the code below to verify your email address
        and complete your signup.
      </Text>

      {/* OTP display */}
      <Section style={otpWrapper}>
        <Text style={otpLabel}>Your verification code</Text>

        {/* Digit boxes rendered as inline-block spans inside a centered div */}
        <div style={{ textAlign: "center", margin: "0 0 16px 0" }}>
          {digits.map((digit, i) => (
            <span key={i} style={digitBox}>
              {digit}
            </span>
          ))}
        </div>

        <Text style={expiryText}>Expires in 10 minutes</Text>
      </Section>

      <Section style={warningBox}>
        <Text style={warningText}>
          <strong>⚠️ Keep this code confidential.</strong> Never share it with
          anyone. Instroom staff will never ask for it.
        </Text>
      </Section>

      <Text style={safetyNote}>
        Didn't sign up for Instroom? You can safely ignore this email.
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

const otpWrapper = {
  backgroundColor: colors.brandLight,
  border:          `2px solid ${colors.brand}`,
  borderRadius:    "12px",
  margin:          "24px 0",
  padding:         "24px",
  textAlign:       "center" as const,
}

const otpLabel = {
  color:         colors.brandDark,
  fontSize:      "11px",
  fontWeight:    "600",
  letterSpacing: "0.08em",
  margin:        "0 0 16px 0",
  textTransform: "uppercase" as const,
}

const digitBox: React.CSSProperties = {
  backgroundColor: colors.white,
  border:          `1px solid ${colors.border}`,
  borderRadius:    "6px",
  color:           colors.brand,
  display:         "inline-block",
  fontFamily:      "monospace",
  fontSize:        "20px",
  fontWeight:      "700",
  lineHeight:      "1",
  margin:          "0 3px",
  padding:         "10px 8px",
  minWidth:        "26px",
  textAlign:       "center",
}

const expiryText = {
  color:      colors.muted,
  fontSize:   "12px",
  margin:     "0",
}

const warningBox = {
  backgroundColor: "#FEF3C7",
  borderRadius:    "8px",
  padding:         "14px 16px",
  margin:          "0 0 20px 0",
}

const warningText = {
  color:      "#92400E",
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
import "server-only"
import nodemailer from "nodemailer"
import { render } from "react-email"
import WelcomeEmail from "@/emails/welcome"
import PasswordResetEmail from "@/emails/password-reset"
import OTPEmail from "@/emails/otp"
import BrandInvitationEmail from "@/emails/brand-invitation"
import NotificationEmail, { type NotifType } from "@/emails/notification"

// ── Nodemailer transporter ────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASSWORD,
  },
})

const FROM = `Instroom <${process.env.GMAIL_USER}>`

// ── Generic send helper ───────────────────────────────────────────────────────

async function sendEmail({
  to,
  subject,
  html,
}: {
  to:      string
  subject: string
  html:    string
}): Promise<boolean> {
  try {
    await transporter.sendMail({ from: FROM, to, subject, html })
    return true
  } catch (err) {
    console.error("Email send failed:", err instanceof Error ? err.message : err)
    return false
  }
}

// ── Public email functions ────────────────────────────────────────────────────

export async function sendWelcomeEmail(
  email: string,
  name:  string,
): Promise<boolean> {
  const html = await render(WelcomeEmail({ name }))
  return sendEmail({ to: email, subject: "Welcome to Instroom!", html })
}

export async function sendPasswordResetEmail(
  email:    string,
  name:     string,
  resetUrl: string,
): Promise<boolean> {
  const html = await render(PasswordResetEmail({ name, resetUrl }))
  return sendEmail({ to: email, subject: "Reset your Instroom password", html })
}

export async function sendOTPEmail(
  email: string,
  name:  string,
  otp:   string,
): Promise<boolean> {
  const html = await render(OTPEmail({ name, otp }))
  return sendEmail({
    to:      email,
    subject: `${otp} — your Instroom verification code`,
    html,
  })
}

export async function sendBrandInvitationEmail(
  email:          string,
  brandName:      string,
  inviterName:    string,
  invitationLink: string,
  role:           string = "collaborator",
): Promise<boolean> {
  const html = await render(
    BrandInvitationEmail({ brandName, inviterName, invitationLink, role }),
  )
  return sendEmail({
    to:      email,
    subject: `You're invited to join ${brandName} on Instroom`,
    html,
  })
}

export async function sendNotificationEmail({
  to,
  name,
  type,
  title,
  message,
  actionUrl,
}: {
  to:        string
  name:      string
  type:      NotifType
  title:     string
  message:   string
  actionUrl?: string
}): Promise<boolean> {
  const html = await render(
    NotificationEmail({ name, type, title, message, actionUrl }),
  )
  return sendEmail({ to, subject: title, html })
}

// ── Future: swap to Resend ────────────────────────────────────────────────────
// When you have a verified domain, replace sendEmail() with:
//
// import { Resend } from "resend"
// const resend = new Resend(process.env.RESEND_API_KEY)
// const FROM = `Instroom <notifications@yourdomain.com>`
//
// async function sendEmail({ to, subject, html }) {
//   const { error } = await resend.emails.send({ from: FROM, to, subject, html })
//   if (error) { console.error("Resend error:", error); return false }
//   return true
// }
//
// Everything else (templates, function signatures) stays exactly the same.
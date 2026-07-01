import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import { redirect } from "next/navigation"
import { prisma } from "./prisma"
import { sendWelcomeEmail } from "./email"
import { syncBrandActivityWithSubscription } from "./subscription-limits"
import { verifyTwoFactorCode, verifyAndConsumeBackupCode } from "./two-factor"
import bcrypt from "bcryptjs"

const INACTIVITY_TIMEOUT = 30 * 60 // 30 minutes in seconds

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email?: string | null
      name?: string | null
      image?: string | null
    }
    accessToken?: string
    error?: string
    expiresAt?: number // ms timestamp — client uses this to auto-logout
  }
}

const nextAuthConfig = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          // Basic scopes only at login — no Gmail access requested here.
          // Gmail scopes are requested later, inside the Inbox, via the
          // "Connect Gmail" button which calls signIn("google", { prompt: "consent", scope: "...gmail..." })
          // This keeps the login/signup flow clean and non-scary for users.
          scope: "openid email profile",
          access_type: "offline",
        },
      },
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
        twoFactorCode: { label: "2FA Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          })

          if (!user?.password_hash) {
            // User exists but was created with Google signup (no password hash)
            if (user) {
              const error = new Error("GoogleSignupOnly")
              error.message = "This account was created with Google. Please sign in using your Google account."
              throw error
            }
            return null
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password_hash
          )

          if (!isPasswordValid) {
            return null
          }

          // ── Two-factor authentication check ──────────────────────────────
          if (user.two_factor_enabled) {
            if (!credentials.twoFactorCode) {
              const error = new Error("TwoFactorRequired")
              error.message = "TwoFactorRequired"
              throw error
            }

            const isValidTotp = user.two_factor_secret
              ? verifyTwoFactorCode(credentials.twoFactorCode, user.two_factor_secret)
              : false

            if (!isValidTotp) {
              // Fall back to checking backup codes
              const backupCodes = (user.two_factor_backup_codes as string[]) || []
              const { valid, remaining } = await verifyAndConsumeBackupCode(
                credentials.twoFactorCode,
                backupCodes
              )

              if (!valid) {
                const error = new Error("InvalidTwoFactorCode")
                error.message = "InvalidTwoFactorCode"
                throw error
              }

              // Consume the used backup code so it can't be reused
              await prisma.user.update({
                where: { id: user.id },
                data: { two_factor_backup_codes: remaining },
              })
            }
          }
          // ──────────────────────────────────────────────────────────────────

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          }
        } catch (error) {
          // Re-throw custom auth method / 2FA errors so the client can branch on them
          if (
            error instanceof Error &&
            ["GoogleSignupOnly", "TwoFactorRequired", "InvalidTwoFactorCode"].includes(error.message)
          ) {
            throw error
          }
          return null
        }
      },
    }),
  ],
  pages: { 
    signIn: "/login",
    error: "/auth/error",
  },
  callbacks: {
    async signIn({ user, account, profile }: any) {
      if (account?.provider === "google" && profile?.email) {
        const avatarUrl = profile.image || profile.picture || null
        
        try {
          let dbUser = await prisma.user.findUnique({
            where: { email: profile.email },
          })
          
          const isNewUser = !dbUser
          
          // Check if user exists with email/password signup
          // If user has password_hash, they signed up with email/password only
          if (dbUser && dbUser.password_hash) {
            // User registered with email/password, cannot login with Google
            // Redirect directly to login with message, bypassing error page
            redirect('/login?authError=use-email-password')
          }
          
          if (!dbUser) {
            dbUser = await prisma.user.create({
              data: {
                email: profile.email,
                name: profile.name || profile.email.split("@")[0],
                image: avatarUrl, 
                platform_role: "user",
                is_active: true,
              },
            })
            
            try {
              await sendWelcomeEmail(dbUser.email, dbUser.name || "User")
            } catch (emailError) {
              // Silently continue on email error
            }
          } else {
            dbUser = await prisma.user.update({
              where: { email: profile.email },
              data: {
                name: profile.name || dbUser.name,
                image: avatarUrl || dbUser.image,
              },
            })
          }
          
          if (dbUser) {
            user.id = dbUser.id
            user.email = dbUser.email
            user.name = dbUser.name
            user.image = dbUser.image
            user.isNewUser = isNewUser
            
            if (isNewUser) {
              const onboarding = await prisma.onboarding.findUnique({
                where: { user_id: dbUser.id },
              })
              
              if (!onboarding) {
                await prisma.onboarding.create({
                  data: { 
                    user_id: dbUser.id,
                    operator_type: "",
                  },
                })
              }
            }
            
            try {
              await prisma.account.upsert({
                where: {
                  provider_providerAccountId: {
                    provider: account.provider,
                    providerAccountId: account.providerAccountId,
                  },
                },
                create: {
                  userId: dbUser.id,
                  type: account.type || "oauth",
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  access_token: account.access_token || null,
                  refresh_token: account.refresh_token || null,
                  expires_at: account.expires_at || null,
                  token_type: account.token_type || null,
                  scope: account.scope || null,
                  id_token: account.id_token || null,
                },
                update: {
                  access_token: account.access_token || null,
                  refresh_token: account.refresh_token || null,
                  expires_at: account.expires_at || null,
                  token_type: account.token_type || null,
                  scope: account.scope || null,
                  id_token: account.id_token || null,
                },
              })
            } catch (accountError) {
              // Silently continue on account error
            }
          }
        } catch (error) {
          return false
        }
      }
      return true
    },
    
    jwt({ token, user, account }: any) {
      // On first sign-in, populate token and set initial activity timestamp
      if (user) {
        token.id = user.id
        token.email = user.email
        if (user.isNewUser !== undefined) {
          token.isNewUser = user.isNewUser
        }
        token.lastActivity = Math.floor(Date.now() / 1000)
        token.exp = Math.floor(Date.now() / 1000) + INACTIVITY_TIMEOUT
      }

      // Store Google tokens whenever they come in — covers both initial login
      // and the Gmail re-consent flow triggered from the Inbox.
      if (account?.provider === "google") {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 3600 * 1000
      }

      // ── Inactivity check ──────────────────────────────────────────────────
      // On every session check, compare now vs lastActivity.
      // If idle > 30 min → invalidate. Otherwise → slide the window forward.
      const now = Math.floor(Date.now() / 1000)
      const lastActivity = (token.lastActivity as number) || now
      const idleSeconds = now - lastActivity

      if (idleSeconds > INACTIVITY_TIMEOUT) {
        // Mark token as expired due to inactivity — client will sign out
        return { ...token, error: "InactivityTimeout" }
      }

      // Still active — slide expiry window forward (true inactivity timer)
      token.lastActivity = now
      token.exp = now + INACTIVITY_TIMEOUT

      return token
    },
    
    async session({ session, token }: any) {
      // If token was invalidated due to inactivity, signal the client to log out
      if (token.error === "InactivityTimeout") {
        session.error = "InactivityTimeout"
        return session
      }

      if (session?.user) {
        session.user.id = token.id as string
        if (token.name) session.user.name = token.name as string
        if (token.isNewUser !== undefined) {
          session.user.isNewUser = token.isNewUser
        }
        await syncBrandActivityWithSubscription(session.user.id)
      }

      // Expose expiry time to client (ms) so InactivityProvider can countdown
      session.expiresAt = (token.exp as number) * 1000

      // Expose Gmail access token to server-side API routes
      if (token.accessToken) {
        session.accessToken = token.accessToken
      }
      if (token.error) {
        session.error = token.error
      }

      return session
    },
    
    redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      if (url.includes("/onboarding") || url.includes("/signup")) {
        return url
      }
      if (url.startsWith("/")) return `${baseUrl}${url}`
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },
}

const handler = NextAuth(nextAuthConfig)

export { handler as GET, handler as POST }
export const authOptions = nextAuthConfig
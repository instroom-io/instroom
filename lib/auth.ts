import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import { prisma } from "./prisma"
import { sendWelcomeEmail } from "./email"
import { syncBrandActivityWithSubscription } from "./subscription-limits"
import { verifyTwoFactorCode, verifyAndConsumeBackupCode } from "./two-factor"
import bcrypt from "bcryptjs"

/**
 * Absolute session lifetime: 7 days from the moment of sign-in.
 *
 * ABSOLUTE, not rolling. NextAuth's own `maxAge` re-stamps `exp` every time the
 * session is refreshed, which would let an active user stay signed in forever.
 * The jwt callback below pins `exp` to `loginAt + SEVEN_DAYS` on every pass, so
 * the deadline is fixed at login and activity cannot push it out.
 *
 * Pinning `exp` is also what makes expiry enforceable rather than advisory: it
 * is the JWT's own expiry claim, so `getToken()` and `getServerSession()` reject
 * the cookie themselves once the deadline passes. An expired session is
 * unusable server-side even if the client ignores it.
 *
 * This replaced a 30-minute inactivity timeout. That timer contradicted the
 * requirement that a session survive closing and reopening the browser, so it
 * is gone — deliberately, and at the cost of an unattended machine staying
 * signed in for up to a week.
 */
const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60

/**
 * The session cookie's name, defined ONCE and exported.
 *
 * It has to be shared because two different pieces of code need to agree on it,
 * and they were each deriving it from a different variable:
 *
 *   this file           writes the cookie, keyed on NODE_ENV
 *   next-auth/jwt's
 *   getToken()          reads it, keyed on whether NEXTAUTH_URL starts with
 *                       "https://" (falling back to !!process.env.VERCEL)
 *
 * Those two conditions are not the same condition. A production deployment
 * whose NEXTAUTH_URL is http:// — a value copied from a local .env, say — writes
 * "__Secure-next-auth.session-token" and then looks for
 * "next-auth.session-token". getToken finds nothing, reports no session, and
 * proxy.ts redirects a perfectly signed-in user to /login. It shows up as
 * "opening a new tab logs me out", because a new tab is a full document load
 * and therefore the first thing the proxy actually gates.
 *
 * Exported so proxy.ts can pass it to getToken explicitly and the two can no
 * longer drift. The VALUE is unchanged, so existing sessions keep working.
 */
export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token"


declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email?: string | null
      name?: string | null
      image?: string | null
      platform_role?: string
    }
    accessToken?: string
    error?: string
    /** Absolute expiry as an ms timestamp, for the client-side countdown. */
    expiresAt?: number
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
          // Always show Google's account chooser.
          //
          // Without this, Google silently reuses whichever account the browser
          // currently has active. Someone already signed in as A who switches
          // their browser to B and clicks "Sign in with Google" would be
          // re-authenticated as B with no visible confirmation — or bounced
          // straight back in as A, with no way to reach B at all. Making the
          // choice explicit is what turns account switching into a deliberate
          // act, and it pairs with the token reset in the jwt callback.
          prompt: "select_account",
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
            platform_role: user.platform_role,
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
  secret: process.env.NEXTAUTH_SECRET,
  // Both must agree. `session.maxAge` sets the cookie lifetime, `jwt.maxAge`
  // the token's default lifetime; leaving either at the 30-day default would
  // mean a cookie that outlives its token or the reverse.
  session: { strategy: "jwt" as const, maxAge: SEVEN_DAYS_SECONDS },
  jwt: { maxAge: SEVEN_DAYS_SECONDS },
  cookies: {
    sessionToken: {
      // Names match NextAuth's own defaults so existing sessions keep working.
      name: SESSION_COOKIE_NAME,
      options: {
        // Not readable from JavaScript — the session token is never exposed to
        // XSS, and nothing about the session is mirrored into localStorage.
        httpOnly: true,
        // "lax" rather than "strict": the OAuth callback is a cross-site
        // top-level navigation back from accounts.google.com, and "strict"
        // would withhold the cookie on that hop and break the login round trip.
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
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
            // Registered with email/password — Google sign-in is not allowed.
            //
            // This used to call next/navigation's redirect(), which works by
            // THROWING a NEXT_REDIRECT error. Thrown inside this try block, it
            // was caught by the catch below and turned into `return false`, so
            // the user got a generic "access denied" and never saw the reason.
            // Returning the URL is NextAuth's own signalling for this and
            // leaves the try block cleanly.
            return "/login?authError=use-email-password"
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
            user.platform_role = dbUser.platform_role
            
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
          console.error("[auth] Google signIn callback failed:", error)
          return false
        }
      }

      // Brand-activity sync, moved off the session callback.
      //
      // Sign-in is the point where entitlement can actually have changed since
      // last time; a session read is not. Best-effort and never fatal — a
      // failure here must not be the reason someone can't log in.
      if (user?.id) {
        try {
          await syncBrandActivityWithSubscription(user.id)
        } catch (syncError) {
          console.error("[auth] brand activity sync failed:", syncError)
        }
      }

      return true
    },
    
    jwt({ token, user, account }: any) {
      const now = Math.floor(Date.now() / 1000)

      // ── A sign-in just happened ───────────────────────────────────────────
      // Build a NEW token instead of merging into the old one.
      //
      // This is what makes account switching correct. Signing in as B while a
      // token for A exists used to merge B's id and email over A's, leaving
      // A's platform_role, isNewUser and Google accessToken behind — a session
      // that was partly A and partly B, with A's privileges. Discarding the old
      // token guarantees exactly one identity per browser session and that
      // every field belongs to the account that just authenticated.
      if (user) {
        const fresh: Record<string, unknown> = {
          sub: user.id,
          id: user.id,
          email: user.email,
          name: user.name ?? token.name,
          picture: user.image ?? token.picture,
          // The absolute deadline is anchored here and nowhere else.
          loginAt: now,
          exp: now + SEVEN_DAYS_SECONDS,
        }
        if (user.isNewUser !== undefined) fresh.isNewUser = user.isNewUser
        if (user.platform_role !== undefined) fresh.platform_role = user.platform_role

        if (account?.provider === "google") {
          fresh.accessToken = account.access_token
          fresh.refreshToken = account.refresh_token
          fresh.accessTokenExpires = account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 3600 * 1000
        }
        return fresh
      }

      // ── Re-consent without a new sign-in ──────────────────────────────────
      // The Gmail flow returns here with an account but no user. Same identity,
      // broader scopes — update the Google tokens only, and do not re-anchor
      // loginAt, or re-consenting would silently extend the 7 days.
      if (account?.provider === "google") {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 3600 * 1000
      }

      // ── Absolute expiry, re-pinned on every pass ──────────────────────────
      // NextAuth would otherwise re-stamp exp to now + maxAge each refresh,
      // turning the 7 days into a rolling window that an active user never
      // reaches. Tokens minted before loginAt existed get it backfilled from
      // their current exp so they age out on their original schedule rather
      // than being force-expired the moment this ships.
      if (typeof token.loginAt !== "number") {
        token.loginAt = typeof token.exp === "number" ? token.exp - SEVEN_DAYS_SECONDS : now
      }
      token.exp = (token.loginAt as number) + SEVEN_DAYS_SECONDS

      // Past the deadline the JWT layer rejects the cookie on its own, so
      // getToken()/getServerSession() return null and the middleware redirects.
      // The flag is only so the UI can say *why* rather than bouncing silently.
      if (now >= (token.exp as number)) {
        return { ...token, error: "SessionExpired" }
      }

      return token
    },
    
    session({ session, token }: any) {
      // Expired: hand back an identity-free session carrying only the reason,
      // so nothing downstream can mistake it for a usable one.
      if (token.error === "SessionExpired") {
        session.error = "SessionExpired"
        session.user = undefined
        session.expiresAt = (token.exp as number) * 1000
        return session
      }

      if (session?.user) {
        session.user.id = token.id as string
        if (token.name) session.user.name = token.name as string
        if (token.isNewUser !== undefined) {
          session.user.isNewUser = token.isNewUser
        }
        if (token.platform_role !== undefined) {
          session.user.platform_role = token.platform_role as string
        }
      }

      // This callback runs on EVERY session read — every useSession mount,
      // every getServerSession in every API route, every middleware-adjacent
      // check. It used to `await syncBrandActivityWithSubscription(...)` here,
      // putting a write-capable database round trip on all of them and making
      // the callback async for no other reason. That sync now runs once per
      // sign-in, in the signIn callback, which is when its inputs actually
      // change.
      session.expiresAt = (token.exp as number) * 1000

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
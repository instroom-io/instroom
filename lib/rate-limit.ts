// Simple in-memory rate limiter
interface RateLimitStore {
  [key: string]: {
    attempts: number
    firstAttempt: number
    blockedUntil?: number
  }
}

const store: RateLimitStore = {}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now()
  Object.keys(store).forEach((key) => {
    const entry = store[key]
    // Remove if older than 30 minutes
    if (now - entry.firstAttempt > 30 * 60 * 1000) {
      delete store[key]
    }
  })
}, 5 * 60 * 1000) // Clean every 5 minutes

export interface RateLimitResult {
  success: boolean
  remainingAttempts: number
  retryAfter?: number // seconds
  blocked: boolean
}

/**
 * Rate limit login attempts by IP
 * - Max 10 attempts per 15 minutes
 * - After 5 failed attempts: 5 second delay
 * - After 8 failed attempts: 30 second delay
 * - After 10 failed attempts: blocked for 15 minutes
 */
export function checkLoginRateLimit(ip: string): RateLimitResult {
  const now = Date.now()
  const key = `login:${ip}`
  const MAX_ATTEMPTS = 10
  const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
  const BLOCK_DURATION_MS = 15 * 60 * 1000 // 15 minutes

  // Check if currently blocked
  if (store[key]?.blockedUntil && store[key].blockedUntil! > now) {
    const remainingSeconds = Math.ceil((store[key].blockedUntil! - now) / 1000)
    return {
      success: false,
      remainingAttempts: 0,
      retryAfter: remainingSeconds,
      blocked: true,
    }
  }

  // Clean up old entries within this window
  if (store[key] && now - store[key].firstAttempt > WINDOW_MS) {
    delete store[key]
  }

  // Initialize or update attempt
  if (!store[key]) {
    store[key] = {
      attempts: 1,
      firstAttempt: now,
    }
  } else {
    store[key].attempts++
  }

  const attempts = store[key].attempts
  const remainingAttempts = MAX_ATTEMPTS - attempts

  // Block after max attempts
  if (attempts >= MAX_ATTEMPTS) {
    store[key].blockedUntil = now + BLOCK_DURATION_MS
    return {
      success: false,
      remainingAttempts: 0,
      retryAfter: 900, // 15 minutes
      blocked: true,
    }
  }

  return {
    success: remainingAttempts > 0,
    remainingAttempts,
    blocked: false,
  }
}

/**
 * Reset rate limit for successful login
 */
export function resetLoginRateLimit(ip: string): void {
  const key = `login:${ip}`
  delete store[key]
}

/**
 * Get client IP from request
 */
export function getClientIp(req: any): string {
  const forwarded = req.headers.get("x-forwarded-for")
  const ip = forwarded ? forwarded.split(";")[0] : req.ip || req.socket?.remoteAddress || "unknown"
  return ip.toString()
}

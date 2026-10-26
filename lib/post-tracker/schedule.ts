// ─── Daily schedule for Automatic Post Detection ─────────────────────────────
// Each brand picks a local time per platform (Instagram, TikTok) and a
// timezone. An external cron calls /api/cron/post-detection every ~15 minutes;
// on each call a platform is DUE when:
//
//   • its chosen time has passed today, in the brand's timezone, and
//   • it has not already had its scheduled run today.
//
// So the run happens on the first cron tick at or after the chosen time, and a
// missed tick simply catches up on the next one the same day. Shared by the
// server (monitor.ts) and the card (time/timezone pickers), so no server-only.

export const DEFAULT_IG_TIME = "18:00"
export const DEFAULT_TIKTOK_TIME = "21:00"
export const DEFAULT_TIMEZONE = "Asia/Manila"

/** Timezones offered in the card; any valid IANA zone is accepted by the API. */
export const SCHEDULE_TIMEZONES = [
  "Asia/Manila",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/Amsterdam",
  "Europe/Berlin",
  "Europe/London",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "UTC",
] as const

/** "HH:MM", 24-hour. */
export function isValidScheduleTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

export function isValidTimezone(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value })
    return true
  } catch {
    return false
  }
}

/** Today's date ("YYYY-MM-DD") and time ("HH:MM") in a timezone. */
export function localNow(timezone: string, now: Date = new Date()): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

/** Should this platform's scheduled run happen on this cron tick? */
export function isScheduleDue(
  scheduleTime: string,
  lastScheduledDate: string | null,
  timezone: string,
  now: Date = new Date()
): boolean {
  const { date, time } = localNow(timezone, now)
  const at = isValidScheduleTime(scheduleTime) ? scheduleTime : DEFAULT_IG_TIME
  return time >= at && lastScheduledDate !== date
}

/** "18:00" → "6:00 PM", for labels. */
export function formatScheduleTime(value: string): string {
  if (!isValidScheduleTime(value)) return value
  const [h, m] = value.split(":").map(Number)
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`
}

/** Half-hour steps for the time pickers. */
export const SCHEDULE_TIME_OPTIONS: string[] = Array.from({ length: 48 }, (_, i) =>
  `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`
)

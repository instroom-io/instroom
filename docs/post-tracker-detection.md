# Post Tracker — Automatic Post Detection (Instagram tagged posts + TikTok keyword)

Work log and design notes, 2026-10-21. Ported from the team's working n8n workflow
("Everyday 6pm" → EnsembleData tagged-posts → match against the Confirmed List →
post details → write link/date → Drive archive → daily email).

## How it works now

One "Check now" press (or, later, the daily cron) runs `runMonitoringPass`
(`lib/post-tracker/monitor.ts`), which for each brand with an active add-on calls
`runTaggedPass` (`lib/post-tracker/tagged.ts`):

1. **Brand account** — the username typed in the card (`PostTrackerAddon.instagram_username`)
   is resolved once to the numeric id via `/instagram/user/info` and cached in
   `instagram_user_id`. Changing the username clears the cache.
2. **Newest 8 tagged posts** — `/instagram/user/tagged-posts?user_id=…&chunk_size=8`
   (`fetchTaggedPosts` in `lib/ensembledata.ts`). The feed carries author + type but
   **no publish date** (`taken_at_timestamp` is null there).
3. **Match authors** to the brand's Instagram influencers whose card is
   **Delivered, or Posted and not Completed** (`isTrackedForDetection`, `lib/post-tracker/apply.ts`).
   Non-matching authors cost nothing more.
4. **Skip posts already recorded** (`DetectedPost` for that influencer + URL).
5. **Post details** for matches only — `/instagram/post/details` (`fetchInstagramPostDetails`):
   publish date, likes/comments/views, media type (video / carousel / image) and media URLs.
6. **Date window** — published on/after the ship date; with no ship date, the last 30 days
   (`detectionWindowStart`, `lib/post-tracker-status.ts`).
7. **Record** — `DetectedPost` (`source = "tagged"`, `media_type`), media copied to Cloudinary
   (`lib/post-tracker/media.ts`, needs `CLOUDINARY_*`), then `recordPostOnInfluencer`:
   - Delivered card → Post URL + metrics set, first deliverable filled, card moves to **Posted**
     (both `stage` fields and `product_details.closedStatus`).
   - Posted card → next empty deliverable filled ("x/N deliverables").
   - Marking **Completed** stays a human step. A typed link is never overwritten; the write is
     conditional on `updated_at`.

Verified on staging with brand account `awesomemaps`: `itinerarybylil` and
`itssamanthahaley` moved Delivered → Posted with deliverable, date, likes and comments filled.

## Decisions (2026-10-21)

- **Instagram tagged posts only.** Caption hashtag/mention matching (each influencer's own feed,
  `pollInfluencer`) is disabled by `CAPTION_DETECTION_ENABLED = false` in `monitor.ts` — kept, not
  deleted. The card's hashtag/mention inputs are hidden. TikTok got its own keyword pass on
  2026-10-22 (below).
- Media archive: **Cloudinary**, not Google Drive.
- Daily digest email recipients: **brand owner + members** (not built yet).
- Schedule: superseded on 2026-10-22 by per-platform daily times + an InterServer cron (below).

## Bugs found and fixed

- **Detected cards stayed in Delivered.** Old detection set `stage = 8` but not
  `product_details.closedStatus`, which the board reads first (`deriveClosedStatus`).
- **Cutoff used `delivered_at`.** That is usually when someone dragged the card, so it fell after
  real posts (an 18 Oct post was skipped because the card moved on 21 Oct). Now ship date only.
- **Timeouts burned quota.** Tagged-posts is slow; it now gets 60 s and 1 retry (details: 30 s,
  1 retry). Connection failures (`UND_ERR_CONNECT_TIMEOUT` etc.) retry with backoff and are **not**
  charged to the daily quota, since the provider never received them.
- The card claimed "background checks every 5 minutes" via a `lib/post-tracker/scheduler.ts` that
  does not exist — text corrected.

## Schema (migration `20261021_post_tracker_tagged_detection`)

- `PostTrackerAddon`: `instagram_username`, `instagram_user_id`, `tagged_last_synced_at`, `tagged_last_error`.
- `DetectedPost`: `source` (default `caption`), `media_type`, `media` (JSON `[{url,type}]`).
- Applied to `instroom_staging` with `prisma db execute` + `prisma migrate resolve --applied`.
  `migrate` commands fail with the `?charset=…&pool_timeout=…` URL params — run them with a plain URL.

## Environment notes

- Staging DB records migrations `20261001_add_research_sops` and `20261002_research_sop_brand_scope`
  that are **not in this code copy** — get the team's latest code before building more.
- The first `npm install` was truncated (corrupt SWC/Tailwind/LightningCSS binaries, 19 packages
  missing files). Fixed with a clean `npm ci`; full `tsc` is now 0 errors.
- EnsembleData daily testing quota: 20 API requests / 20 imports per brand (`lib/post-tracker/quota.ts`).

## 2026-10-22

### TikTok detection (`lib/post-tracker/tiktok.ts`, `runTikTokKeywordPass`)
Ported from the n8n TikTok workflow. The brand sets a **TikTok keyword** on the card
(`PostTrackerAddon.tiktok_keyword`, stored lowercase with any `#`/`@` stripped).
1. **Keyword search** — `/tt/keyword/full-search` (7 days, by date, exact match; 1 unit, ~25 s).
2. **Own-feed check** — TikTok's keyword index lags 1–2 days, so each tracked TikTok influencer's
   own feed (`/tt/user/posts`) is also read and filtered by `mentionsKeyword`.
3. Matches import through the shared `importVideo` (source `keyword` / `keyword-feed`), archive the
   video to Cloudinary (`archiveTikTokVideo`), then `syncDetectedPostsToCard`.
Migration `20261022_post_tracker_tiktok_keyword`.

### Multiple posts → deliverables (`lib/post-tracker/apply.ts`)
`recordPostOnInfluencer` fills the next empty deliverable slot, or **appends a new deliverable**
(up to 10) when an influencer posts more than their slots. Each deliverable carries its own
`postDate`, `likes`, `comments`, `views`; the card-level metrics are **totals** across
deliverables (`deliverableTotals` / `sumDeliverableMetric` in `lib/deliverables.ts`). The edit modal
shows per-deliverable Posted At / Likes / Comments / Views. Applies to Instagram and TikTok, and
to Posted cards as well as Delivered.

### Brand-wide toggle + daily schedule
- "Monitoring enabled for this brand" is now brand-level (`detection_enabled`, migration
  `20261022_post_tracker_brand_toggle`), not per influencer.
- Each platform has its own daily time (`ig_schedule_time` default 18:00, `tiktok_schedule_time`
  default 21:00) and a `schedule_timezone` (default Asia/Manila) — `lib/post-tracker/schedule.ts`,
  migration `20261022_post_tracker_daily_schedule`.
- Trigger: an **InterServer DirectAdmin cron every 15 min** calls `/api/cron/post-detection` with
  `Authorization: Bearer CRON_SECRET`; the route runs `runMonitoringPass({ scheduled: true })`, which
  only runs a platform when `isScheduleDue` and records the run date so it fires once a day.
  Verified authenticating on staging (staging still runs the old code until this is pushed).
- Testing quota raised via `POST_TRACKER_DAILY_API_LIMIT` / `POST_TRACKER_DAILY_POST_LIMIT` (100 locally).

## Next

1. Push to staging (needs a teammate with access to the deploying GitHub account; merge into the
   team's latest code, which has the research-SOP migrations). Add `ENSEMBLEDATA_TOKEN` in Vercel.
2. Daily digest email (`emails/post-digest.tsx`) to brand owner + members.
3. Cloudinary keys in `.env` (media archive + influencer avatars).

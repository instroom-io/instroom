-- Daily schedule for Automatic Post Detection, chosen per brand.
--
-- Each platform (Instagram tagged posts, TikTok keyword) runs once a day at the
-- brand's chosen local time. An external cron (InterServer DirectAdmin) calls
-- /api/cron/post-detection every ~15 minutes; a platform runs when its time has
-- passed today in schedule_timezone and its *_last_scheduled_date is not today
-- (lib/post-tracker/schedule.ts). "Check now" is unaffected.
--
-- Defaults mirror the n8n flows this replaces: Instagram 18:00, TikTok 21:00,
-- Asia/Manila. Dates are stored as the brand-local YYYY-MM-DD the run counted for.

ALTER TABLE `PostTrackerAddon`
  ADD COLUMN `ig_schedule_time` VARCHAR(5) NOT NULL DEFAULT '18:00',
  ADD COLUMN `tiktok_schedule_time` VARCHAR(5) NOT NULL DEFAULT '21:00',
  ADD COLUMN `schedule_timezone` VARCHAR(64) NOT NULL DEFAULT 'Asia/Manila',
  ADD COLUMN `ig_last_scheduled_date` VARCHAR(10) NULL,
  ADD COLUMN `tiktok_last_scheduled_date` VARCHAR(10) NULL;

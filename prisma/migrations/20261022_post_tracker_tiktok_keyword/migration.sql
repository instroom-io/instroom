-- TikTok keyword detection.
--
-- TikTok has no equivalent of Instagram's tagged-posts feed, so TikTok videos
-- are found by searching EnsembleData's keyword index for the brand's keyword
-- (usually its name) and matching each video's author to the brand's own
-- influencers (lib/post-tracker/tiktok.ts). One search per brand per run; the
-- results already carry views/likes/comments and the publish time, so no
-- per-video details call is needed.
--
-- Additive and nullable — brands without a keyword are simply not searched.

ALTER TABLE `PostTrackerAddon`
  ADD COLUMN `tiktok_keyword` VARCHAR(100) NULL,
  ADD COLUMN `keyword_last_synced_at` DATETIME(3) NULL,
  ADD COLUMN `keyword_last_error` TEXT NULL;

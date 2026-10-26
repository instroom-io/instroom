-- Instagram tagged-posts detection.
--
-- Detection used to find Instagram posts only by polling each influencer's own
-- feed and matching a hashtag/mention in the caption. A post that tags the brand
-- (photo tag or collab) without writing the brand in the caption was missed, and
-- every influencer cost its own provider call.
--
-- The brand's Instagram account is now stored on the add-on row, and one call to
-- the brand's tagged-posts feed finds every influencer post that tags it
-- (lib/post-tracker/tagged.ts). DetectedPost records which route found a post
-- and the Cloudinary copies of its media.
--
-- Additive and nullable (source defaults to 'caption', which is how every
-- existing row was found), so nothing already stored changes meaning.

ALTER TABLE `PostTrackerAddon`
  ADD COLUMN `instagram_username` VARCHAR(64) NULL,
  ADD COLUMN `instagram_user_id` VARCHAR(30) NULL,
  ADD COLUMN `tagged_last_synced_at` DATETIME(3) NULL,
  ADD COLUMN `tagged_last_error` TEXT NULL;

ALTER TABLE `DetectedPost`
  ADD COLUMN `source` VARCHAR(20) NOT NULL DEFAULT 'caption',
  ADD COLUMN `media_type` VARCHAR(20) NULL,
  ADD COLUMN `media` JSON NULL;

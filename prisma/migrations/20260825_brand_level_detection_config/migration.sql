-- Automatic Post Detection is a paid brand-level add-on, so the hashtags and
-- mentions it matches on belong to the brand, not to each influencer.
--
-- Before this, every influencer carried its own copy in PostDetectionSetting,
-- which meant the same brand campaign tag had to be typed again for each one and
-- could silently drift between them. These two columns hold it once, on the row
-- that already represents the add-on for the brand.
--
-- Additive and nullable: existing PostDetectionSetting values stay in place and
-- the monitor falls back to them, so brands configured before this keep working
-- with no data migration.

ALTER TABLE `PostTrackerAddon`
  ADD COLUMN `detection_hashtags` VARCHAR(255) NULL,
  ADD COLUMN `detection_mentions` VARCHAR(255) NULL;

-- Post views for the Post Tracker's "Views" field (replaces the Engagement
-- input on the Post tab).
--
-- Filled automatically when a post link is saved or a post is detected
-- (EnsembleData returns likes, comments and views per post), and editable by
-- hand. Analytics counts it for rows with no detected-post view data — before
-- this, views existed only on DetectedPost, so a manually linked post
-- contributed no views at all.
--
-- Purely additive with a 0 default, matching likes_count / comments_count.
-- Nothing needs backfilling.

ALTER TABLE `BrandInfluencer` ADD COLUMN `views_count` INTEGER NOT NULL DEFAULT 0;

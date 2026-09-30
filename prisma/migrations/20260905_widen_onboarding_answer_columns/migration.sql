-- Widen Onboarding's answer columns to fit the options the UI actually offers.
--
-- Every option in components/onboarding-form.tsx starts with an emoji, and 3
-- of the 4 answer columns were sized well under what a real selection needs:
--
--   operator_type    varchar(20), longest real option is 31 chars
--     ("🏬 An agency — multiple clients")
--   business_type    varchar(20), longest real option is 28 chars
--     ("🎨 Services / personal brand")
--   campaign_goal    varchar(20), longest real option is 27 chars
--     ("💪 Build an ambassador army")
--
-- Verified directly against this database: POSTing any of those exact strings
-- through /api/onboarding silently truncated them at the column limit — 9 of
-- the 21 option strings across these three columns overflow, so this was not
-- an edge case, it was most real selections. influencer_count is untouched;
-- its longest option ("👤 1 – 10" etc.) is well inside its existing 30.
--
-- Widened to 60 — comfortably above the current longest (31) so adding a
-- slightly longer option later doesn't immediately reintroduce this bug,
-- matching the headroom influencer_count's own column already had.

ALTER TABLE `Onboarding` MODIFY COLUMN `operator_type` VARCHAR(60) NULL;
ALTER TABLE `Onboarding` MODIFY COLUMN `business_type` VARCHAR(60) NULL;
ALTER TABLE `Onboarding` MODIFY COLUMN `campaign_goal` VARCHAR(60) NULL;

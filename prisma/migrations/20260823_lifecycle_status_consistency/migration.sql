-- Lifecycle data repair: rows whose stage / contact_status disagree with the
-- vocabulary every current write path uses.
--
-- The stage vocabulary is owned by:
--   app/api/brand/[brandId]/pipeline/[brandInfluencerId]  (stages 1-5)
--   lib/post-tracker-status.ts                            (stages 5-8)
-- Rows below predate that alignment (they were written by the legacy
-- /api/brands/... PATCH, whose mapping is corrected in this change), so the same
-- influencer read as one stage in the Pipeline and another in the Post Tracker,
-- and Analytics counted one of them as contacted when it never was.
--
-- Every statement is a repair TO the value the current code would write, and to
-- the stage the UI already displays (Post Tracker renders
-- product_details.closedStatus, which is left untouched), so no visible column
-- and no analytics figure derived from a legitimate value changes.

-- 1. Post Tracker rows sitting at the entry stage while their saved column says
--    they are further along. Align stage + contact_status with
--    mapClosedToPipelineFields(): Posted = stage 8, Delivered = stage 7.
UPDATE `BrandInfluencer`
  SET `contact_status` = 'for_order_creation', `stage` = 8
  WHERE `stage` = 5
    AND `contact_status` <> 'for_order_creation'
    AND `content_posted` = 1
    AND `product_details` LIKE '%"closedStatus":"Posted"%';

UPDATE `BrandInfluencer`
  SET `contact_status` = 'for_order_creation', `stage` = 7
  WHERE `stage` = 5
    AND `contact_status` <> 'for_order_creation'
    AND `content_posted` = 0
    AND `product_details` LIKE '%"closedStatus":"Delivered"%';

-- 2. Any remaining stage >= 5 row: stage 5+ IS the Post Tracker, and every
--    writer pairs it with contact_status 'for_order_creation'.
UPDATE `BrandInfluencer`
  SET `contact_status` = 'for_order_creation'
  WHERE `stage` >= 5 AND `contact_status` <> 'for_order_creation';

-- 3. 'prospect' is not in the app's contact_status vocabulary
--    (VALID_CONTACT_STATUSES in the influencer PUT route). It derives to "For
--    Outreach" like 'not_contacted' does, but Analytics' wasContacted() does not
--    recognise it, so the row was counted as an outreach that never happened.
UPDATE `BrandInfluencer`
  SET `contact_status` = 'not_contacted'
  WHERE `contact_status` = 'prospect';

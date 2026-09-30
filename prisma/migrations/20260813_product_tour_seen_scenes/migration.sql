-- Replaces the single product_tour_completed_at flag with a per-scene
-- tracking column: each page's contextual tour is now independent, so one
-- scene being seen must never mark the others seen. Purely additive/renaming
-- in effect — no other code reads product_tour_completed_at outside this
-- feature, added in the previous migration and not yet relied upon elsewhere.

ALTER TABLE `User`
  DROP COLUMN `product_tour_completed_at`,
  ADD COLUMN `product_tour_seen_scenes` JSON NULL;

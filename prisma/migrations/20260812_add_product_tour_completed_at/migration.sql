-- Tracks whether a user has finished (or skipped) the dashboard product
-- tour, so it never auto-starts again after the first visit. Purely
-- additive, mirrors the Onboarding.completed_at pattern.

ALTER TABLE `User` ADD COLUMN `product_tour_completed_at` DATETIME(3) NULL;

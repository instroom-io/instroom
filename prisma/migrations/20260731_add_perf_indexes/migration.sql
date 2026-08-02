-- Add composite indexes on BrandInfluencer found missing by a performance
-- audit of Manage Influencers, Pipeline, Post Tracker, and Brand Partners.
-- Purely additive — no columns/data touched.

CREATE INDEX `BrandInfluencer_brand_id_created_at_idx` ON `BrandInfluencer` (`brand_id`, `created_at`);
CREATE INDEX `BrandInfluencer_brand_id_approval_status_idx` ON `BrandInfluencer` (`brand_id`, `approval_status`);
CREATE INDEX `BrandInfluencer_brand_id_content_posted_idx` ON `BrandInfluencer` (`brand_id`, `content_posted`);
CREATE INDEX `BrandInfluencer_brand_id_updated_at_idx` ON `BrandInfluencer` (`brand_id`, `updated_at`);

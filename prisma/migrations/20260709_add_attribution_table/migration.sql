-- Extracts affiliate/GoAffPro performance data (previously duplicated on both
-- BrandInfluencer and BrandPartner) into one dedicated Attribution table, and
-- adds a spark_ads column for ad-code tracking.

CREATE TABLE `Attribution` (
  `id` VARCHAR(30) NOT NULL,
  `brand_id` VARCHAR(30) NOT NULL,
  `brand_influencer_id` VARCHAR(30) NOT NULL,
  `affiliate_id` VARCHAR(100) NULL,
  `ref_code` VARCHAR(100) NULL,
  `coupon` VARCHAR(100) NULL,
  `spark_ads` VARCHAR(100) NULL,
  `affiliate_link` TEXT NULL,
  `clicks` INT NOT NULL DEFAULT 0,
  `sales_count` INT NOT NULL DEFAULT 0,
  `gmv` DECIMAL(65,30) NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `Attribution_brand_influencer_id_key`(`brand_influencer_id`),
  INDEX `Attribution_brand_id_affiliate_id_idx`(`brand_id`, `affiliate_id`),
  INDEX `Attribution_brand_id_idx`(`brand_id`),

  CONSTRAINT `Attribution_brand_id_fkey` FOREIGN KEY (`brand_id`) REFERENCES `Brand`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Attribution_brand_influencer_id_fkey` FOREIGN KEY (`brand_influencer_id`) REFERENCES `BrandInfluencer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Backfill from both existing duplicate sources, preferring BrandInfluencer's
-- value and falling back to BrandPartner's (they were kept in sync by dual
-- writes, GREATEST/COALESCE here just guard against any drift). Only rows
-- that actually have non-default affiliate data get a row.
INSERT INTO `Attribution` (`id`, `brand_id`, `brand_influencer_id`, `affiliate_id`, `ref_code`, `coupon`, `affiliate_link`, `clicks`, `sales_count`, `gmv`, `created_at`, `updated_at`)
SELECT
  CONCAT('attr_', SUBSTRING(REPLACE(UUID(), '-', ''), 1, 24)),
  bi.`brand_id`,
  bi.`id`,
  COALESCE(bi.`affiliate_id`, bp.`goaffpro_affiliate_id`),
  COALESCE(bi.`ref_code`, bp.`goaffpro_ref_code`),
  COALESCE(bi.`coupon`, bp.`goaffpro_coupon`),
  COALESCE(bi.`affiliate_link`, bp.`goaffpro_link`),
  GREATEST(COALESCE(bi.`clicks`, 0), COALESCE(bp.`clicks`, 0)),
  GREATEST(COALESCE(bi.`sales_count`, 0), COALESCE(bp.`sales_count`, 0)),
  GREATEST(COALESCE(bi.`gmv`, 0), COALESCE(bp.`gmv`, 0)),
  NOW(3),
  NOW(3)
FROM `BrandInfluencer` bi
LEFT JOIN `BrandPartner` bp ON bp.`brand_influencer_id` = bi.`id`
WHERE bi.`affiliate_id` IS NOT NULL OR bi.`ref_code` IS NOT NULL OR bi.`coupon` IS NOT NULL OR bi.`affiliate_link` IS NOT NULL
   OR bi.`clicks` != 0 OR bi.`sales_count` != 0 OR bi.`gmv` != 0
   OR bp.`goaffpro_affiliate_id` IS NOT NULL OR bp.`clicks` != 0 OR bp.`sales_count` != 0 OR bp.`gmv` != 0;

-- Drop the now-migrated columns from BrandInfluencer
ALTER TABLE `BrandInfluencer` DROP INDEX `BrandInfluencer_affiliate_id_idx`;
ALTER TABLE `BrandInfluencer`
  DROP COLUMN `affiliate_id`,
  DROP COLUMN `ref_code`,
  DROP COLUMN `coupon`,
  DROP COLUMN `affiliate_link`,
  DROP COLUMN `clicks`,
  DROP COLUMN `sales_count`,
  DROP COLUMN `gmv`;

-- Drop the now-migrated columns from BrandPartner
ALTER TABLE `BrandPartner` DROP INDEX `BrandPartner_goaffpro_affiliate_id_idx`;
ALTER TABLE `BrandPartner`
  DROP COLUMN `goaffpro_affiliate_id`,
  DROP COLUMN `goaffpro_ref_code`,
  DROP COLUMN `goaffpro_coupon`,
  DROP COLUMN `goaffpro_link`,
  DROP COLUMN `clicks`,
  DROP COLUMN `sales_count`,
  DROP COLUMN `gmv`;

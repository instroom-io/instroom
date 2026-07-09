-- Add generic affiliate/performance fields to BrandInfluencer so GoAffPro data
-- can be stored without depending on the provider name in the app layer.

ALTER TABLE `BrandInfluencer`
  ADD COLUMN `affiliate_id` VARCHAR(100) NULL,
  ADD COLUMN `ref_code` VARCHAR(100) NULL,
  ADD COLUMN `coupon` VARCHAR(100) NULL,
  ADD COLUMN `affiliate_link` TEXT NULL,
  ADD COLUMN `clicks` INT NOT NULL DEFAULT 0,
  ADD COLUMN `sales_count` INT NOT NULL DEFAULT 0,
  ADD COLUMN `gmv` DECIMAL(65,30) NOT NULL DEFAULT 0;

CREATE INDEX `BrandInfluencer_affiliate_id_idx` ON `BrandInfluencer`(`affiliate_id`);
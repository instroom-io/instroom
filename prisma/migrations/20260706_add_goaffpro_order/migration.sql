-- Stores individual GoAffPro orders so sales_count/gmv on BrandInfluencer and
-- BrandPartner can be recomputed as an aggregate (never incremented), making
-- repeated syncs/polling idempotent instead of double-counting.

CREATE TABLE `GoAffProOrder` (
  `id` VARCHAR(30) NOT NULL,
  `brand_id` VARCHAR(30) NOT NULL,
  `goaffpro_order_id` VARCHAR(100) NOT NULL,
  `affiliate_id` VARCHAR(100) NOT NULL,
  `brand_influencer_id` VARCHAR(30) NULL,
  `total` DECIMAL(65,30) NOT NULL DEFAULT 0,
  `subtotal` DECIMAL(65,30) NOT NULL DEFAULT 0,
  `commission` DECIMAL(65,30) NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL,
  `goaffpro_created_at` DATETIME(3) NULL,
  `raw` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

CREATE UNIQUE INDEX `GoAffProOrder_brand_id_goaffpro_order_id_key` ON `GoAffProOrder`(`brand_id`, `goaffpro_order_id`);
CREATE INDEX `GoAffProOrder_brand_id_affiliate_id_idx` ON `GoAffProOrder`(`brand_id`, `affiliate_id`);
CREATE INDEX `GoAffProOrder_brand_influencer_id_idx` ON `GoAffProOrder`(`brand_influencer_id`);
CREATE INDEX `GoAffProOrder_status_idx` ON `GoAffProOrder`(`status`);

ALTER TABLE `GoAffProOrder` ADD CONSTRAINT `GoAffProOrder_brand_influencer_id_fkey`
  FOREIGN KEY (`brand_influencer_id`) REFERENCES `BrandInfluencer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

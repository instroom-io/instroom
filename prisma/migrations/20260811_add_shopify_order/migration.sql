-- Stores individual Shopify orders (both created by Instroom via the push
-- flow and discovered via webhook/on-demand sync) so Post Tracker's kanban
-- can be auto-advanced idempotently — same shape as GoAffProOrder.

CREATE TABLE `ShopifyOrder` (
  `id` VARCHAR(30) NOT NULL,
  `brand_id` VARCHAR(30) NOT NULL,
  `shopify_order_id` VARCHAR(100) NOT NULL,
  `brand_influencer_id` VARCHAR(30) NULL,
  `discount_code` VARCHAR(100) NULL,
  `source` VARCHAR(20) NOT NULL DEFAULT 'synced',
  `financial_status` VARCHAR(30) NULL,
  `fulfillment_status` VARCHAR(30) NULL,
  `shipment_status` VARCHAR(30) NULL,
  `raw` JSON NOT NULL,
  `shopify_created_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

CREATE UNIQUE INDEX `ShopifyOrder_brand_id_shopify_order_id_key` ON `ShopifyOrder`(`brand_id`, `shopify_order_id`);
CREATE INDEX `ShopifyOrder_brand_id_discount_code_idx` ON `ShopifyOrder`(`brand_id`, `discount_code`);
CREATE INDEX `ShopifyOrder_brand_influencer_id_idx` ON `ShopifyOrder`(`brand_influencer_id`);

ALTER TABLE `ShopifyOrder` ADD CONSTRAINT `ShopifyOrder_brand_influencer_id_fkey`
  FOREIGN KEY (`brand_influencer_id`) REFERENCES `BrandInfluencer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

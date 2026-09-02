-- Logs Shopify's three mandatory GDPR compliance webhooks
-- (customers/data_request, customers/redact, shop/redact) so someone can act
-- on the request within its legal deadline. No FK to Brand — shop/redact
-- fires while a store's connection is being torn down, and a request can
-- arrive for a shop that's since disconnected, so brand_id is a plain
-- nullable scalar rather than a relation.

CREATE TABLE `ShopifyComplianceRequest` (
  `id` VARCHAR(30) NOT NULL,
  `brand_id` VARCHAR(30) NULL,
  `shop_domain` VARCHAR(255) NOT NULL,
  `request_type` VARCHAR(30) NOT NULL,
  `shopify_customer_id` VARCHAR(100) NULL,
  `order_ids` JSON NULL,
  `payload` JSON NOT NULL,
  `resolved_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

CREATE INDEX `ShopifyComplianceRequest_brand_id_idx` ON `ShopifyComplianceRequest`(`brand_id`);
CREATE INDEX `ShopifyComplianceRequest_resolved_at_idx` ON `ShopifyComplianceRequest`(`resolved_at`);

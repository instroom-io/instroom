-- Shopify App Pricing: accounts that arrive from the Shopify app are billed by
-- Shopify, everyone else by Lemon Squeezy. `billing_provider` records which
-- (null until the account first pays or arrives from Shopify); the shopify_*
-- columns identify the store whose Shopify plan the account follows.
--
-- Additive: new nullable columns and one index only.
--
-- shopify_shop_domain is VARCHAR(191), not 255: UserSubscription is a MyISAM
-- table (1000-byte index key limit) and 255 utf8mb4 chars is 1020 bytes.
-- *.myshopify.com domains are far shorter.

ALTER TABLE `UserSubscription`
  ADD COLUMN `billing_provider` VARCHAR(20) NULL,
  ADD COLUMN `shopify_shop_domain` VARCHAR(191) NULL,
  ADD COLUMN `shopify_shop_gid` VARCHAR(100) NULL,
  ADD COLUMN `shopify_synced_at` DATETIME(3) NULL;

CREATE INDEX `UserSubscription_shopify_shop_domain_idx` ON `UserSubscription`(`shopify_shop_domain`);

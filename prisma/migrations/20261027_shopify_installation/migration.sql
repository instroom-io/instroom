-- Stores that installed the Shopify app from Shopify (App Store / install
-- link) but aren't linked to an Instroom brand yet. `config` holds the
-- encrypted expiring access/refresh tokens; linking moves them to the brand's
-- IntegrationConnection and deletes the row.
--
-- Additive: a new table only.

CREATE TABLE `ShopifyInstallation` (
  `shop_domain` VARCHAR(255) NOT NULL,
  `config` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`shop_domain`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

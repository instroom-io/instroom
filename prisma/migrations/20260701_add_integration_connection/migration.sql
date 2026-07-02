-- Create the brand-scoped integration toggle/config table

CREATE TABLE `IntegrationConnection` (
  `id` VARCHAR(30) NOT NULL,
  `brand_id` VARCHAR(30) NOT NULL,
  `integration_key` VARCHAR(50) NOT NULL,
  `connected` BOOLEAN NOT NULL DEFAULT FALSE,
  `connected_as` VARCHAR(255) NULL,
  `config` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `IntegrationConnection_brand_id_integration_key_key` (`brand_id`, `integration_key`),
  KEY `IntegrationConnection_brand_id_idx` (`brand_id`),
  KEY `IntegrationConnection_integration_key_idx` (`integration_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

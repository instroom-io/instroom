-- Create table for the native email signature feature, appended to outgoing
-- Gmail/Outlook mail from the Instroom inbox.

CREATE TABLE `Signature` (
  `id` VARCHAR(30) NOT NULL,
  `user_id` VARCHAR(30) NOT NULL,
  `is_enabled` BOOLEAN NOT NULL DEFAULT TRUE,
  `full_name` VARCHAR(150) NULL,
  `title` VARCHAR(150) NULL,
  `company` VARCHAR(150) NULL,
  `phone` VARCHAR(50) NULL,
  `email` VARCHAR(150) NULL,
  `website` VARCHAR(255) NULL,
  `social_links` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `Signature_user_id_key` (`user_id`),
  KEY `Signature_user_id_idx` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

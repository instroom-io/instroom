-- Create the brand-scoped community channel and message tables

CREATE TABLE `CommunityChannel` (
  `id` VARCHAR(30) NOT NULL,
  `brand_id` VARCHAR(30) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) NULL,
  `is_default` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  KEY `CommunityChannel_brand_id_idx` (`brand_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `CommunityMessage` (
  `id` VARCHAR(30) NOT NULL,
  `channel_id` VARCHAR(30) NOT NULL,
  `brand_id` VARCHAR(30) NOT NULL,
  `user_id` VARCHAR(30) NOT NULL,
  `body` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  KEY `CommunityMessage_channel_id_idx` (`channel_id`),
  KEY `CommunityMessage_brand_id_idx` (`brand_id`),
  KEY `CommunityMessage_user_id_idx` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

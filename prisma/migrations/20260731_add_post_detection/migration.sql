-- Create tables for per-influencer automatic post detection (hashtag/mention
-- monitoring), moved into the Post Tracker Influencer Profile.

CREATE TABLE `PostDetectionSetting` (
  `id` VARCHAR(30) NOT NULL,
  `brand_influencer_id` VARCHAR(30) NOT NULL,
  `brand_id` VARCHAR(30) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT FALSE,
  `hashtags` VARCHAR(255) NULL,
  `mentions` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `PostDetectionSetting_brand_influencer_id_key` (`brand_influencer_id`),
  KEY `PostDetectionSetting_brand_id_idx` (`brand_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `DetectedPost` (
  `id` VARCHAR(30) NOT NULL,
  `brand_influencer_id` VARCHAR(30) NOT NULL,
  `brand_id` VARCHAR(30) NOT NULL,
  `platform` VARCHAR(50) NOT NULL,
  `post_url` VARCHAR(500) NOT NULL,
  `matched_hashtag` VARCHAR(100) NULL,
  `matched_mention` VARCHAR(100) NULL,
  `detected_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  KEY `DetectedPost_brand_influencer_id_idx` (`brand_influencer_id`),
  KEY `DetectedPost_brand_id_idx` (`brand_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Adds platform-level moderation fields to Influencer (managed only from the
-- Admin Dashboard) and a new AdminAuditLog table for platform-wide admin
-- action logging. Purely additive — no existing columns touched or dropped.

ALTER TABLE `Influencer`
  ADD COLUMN `verification_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN `is_suspended` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `Influencer_verification_status_idx` ON `Influencer`(`verification_status`);

CREATE TABLE `AdminAuditLog` (
  `id` VARCHAR(30) NOT NULL,
  `admin_email` VARCHAR(255) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `target_type` VARCHAR(50) NOT NULL,
  `target_id` VARCHAR(30) NULL,
  `target_label` VARCHAR(255) NULL,
  `details` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `AdminAuditLog_created_at_idx`(`created_at`),
  INDEX `AdminAuditLog_target_type_target_id_idx`(`target_type`, `target_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

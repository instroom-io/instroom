-- Multi-tenant Discord: one connected guild per brand.
-- Idempotent: IF NOT EXISTS everywhere so re-running is a no-op in any
-- environment, and a partially-applied run can be repeated safely.

CREATE TABLE IF NOT EXISTS `BrandDiscordConnection` (
  `id`                   VARCHAR(30)  NOT NULL,
  `brand_id`             VARCHAR(30)  NOT NULL,
  `guild_id`             VARCHAR(30)  NOT NULL,
  `guild_name`           VARCHAR(120) NOT NULL,
  `guild_icon`           VARCHAR(255) NULL,
  `invite_code`          VARCHAR(50)  NULL,
  `status`               VARCHAR(20)  NOT NULL DEFAULT 'connected',
  `status_error`         TEXT         NULL,
  `connected_at`         DATETIME(3)  NULL,
  `last_checked`         DATETIME(3)  NULL,
  `connected_by_user_id` VARCHAR(30)  NULL,
  `created_at`           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`           DATETIME(3)  NOT NULL,

  UNIQUE INDEX `BrandDiscordConnection_brand_id_key` (`brand_id`),
  -- Stops a second workspace claiming a guild another brand already connected.
  UNIQUE INDEX `BrandDiscordConnection_guild_id_key` (`guild_id`),
  INDEX `BrandDiscordConnection_status_idx` (`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Discord account linkage, used to compute per-user channel visibility.
-- Added to User rather than a side table: it is a 1:1 attribute of the account
-- and every permission check reads it, so a join per request buys nothing.
--
-- MySQL has no `ADD COLUMN IF NOT EXISTS` (that is MariaDB), so idempotency
-- comes from an information_schema guard + prepared statement.

SET @c := (SELECT COUNT(*) FROM information_schema.columns
           WHERE table_schema = DATABASE() AND table_name = 'User' AND column_name = 'discord_user_id');
SET @s := IF(@c = 0, 'ALTER TABLE `User` ADD COLUMN `discord_user_id` VARCHAR(30) NULL', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM information_schema.columns
           WHERE table_schema = DATABASE() AND table_name = 'User' AND column_name = 'discord_username');
SET @s := IF(@c = 0, 'ALTER TABLE `User` ADD COLUMN `discord_username` VARCHAR(64) NULL', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM information_schema.columns
           WHERE table_schema = DATABASE() AND table_name = 'User' AND column_name = 'discord_linked_at');
SET @s := IF(@c = 0, 'ALTER TABLE `User` ADD COLUMN `discord_linked_at` DATETIME(3) NULL', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM information_schema.statistics
           WHERE table_schema = DATABASE() AND table_name = 'User' AND index_name = 'User_discord_user_id_idx');
SET @s := IF(@c = 0, 'CREATE INDEX `User_discord_user_id_idx` ON `User`(`discord_user_id`)', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

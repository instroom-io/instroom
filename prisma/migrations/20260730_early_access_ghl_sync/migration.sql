-- Adds GoHighLevel sync bookkeeping + an optional link to an existing User
-- account on EarlyAccessSignup. Purely additive — no existing columns
-- touched or dropped.

ALTER TABLE `EarlyAccessSignup`
  ADD COLUMN `phone` VARCHAR(30) NULL,
  ADD COLUMN `user_id` VARCHAR(30) NULL,
  ADD COLUMN `ghl_contact_id` VARCHAR(60) NULL,
  ADD COLUMN `ghl_sync_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN `ghl_synced_at` DATETIME(3) NULL,
  ADD COLUMN `ghl_sync_error` TEXT NULL;

CREATE INDEX `EarlyAccessSignup_user_id_idx` ON `EarlyAccessSignup`(`user_id`);
CREATE INDEX `EarlyAccessSignup_ghl_sync_status_idx` ON `EarlyAccessSignup`(`ghl_sync_status`);

-- NOTE: no FK constraint on user_id → User(id) — `User` is a MyISAM table,
-- which doesn't support foreign keys. user_id is a plain, app-level-only
-- reference, same pattern as Brand.owner_id elsewhere in this schema.

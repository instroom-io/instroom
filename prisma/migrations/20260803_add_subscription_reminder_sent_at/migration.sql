-- Tracks whether the expiration reminder email has already been sent for a
-- subscription, so the cron job doesn't email the same user twice.
-- Purely additive.

ALTER TABLE `UserSubscription` ADD COLUMN `reminder_sent_at` DATETIME(3) NULL;

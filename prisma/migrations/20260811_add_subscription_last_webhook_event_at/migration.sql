-- Tracks the timestamp of the Lemon Squeezy event actually applied to this
-- row, so a delayed/retried webhook can never overwrite newer data with
-- stale data (out-of-order delivery is normal for webhooks, not an error).
-- Purely additive.

ALTER TABLE `UserSubscription` ADD COLUMN `last_webhook_event_at` DATETIME(3) NULL;

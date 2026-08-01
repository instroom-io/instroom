-- Composite index for the Community chat message-page query
-- (WHERE channel_id = ? AND brand_id = ? ORDER BY created_at DESC LIMIT 50).
-- Purely additive.

CREATE INDEX `CommunityMessage_channel_id_created_at_idx` ON `CommunityMessage` (`channel_id`, `created_at`);

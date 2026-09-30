-- Tracks when an Account row was last deliberately connected/reconnected via
-- OAuth (set only by api/gmail/callback, never by the silent background
-- token refresh in lib/gmail.ts's refreshGmailToken). "Most recently
-- connected account wins" now orders by this instead of the row's own id,
-- since reconnecting a previously-used Google account updates its existing
-- row in place rather than creating a new one — the id never reflects that.

ALTER TABLE `Account` ADD COLUMN `last_selected_at` DATETIME(3) NULL;

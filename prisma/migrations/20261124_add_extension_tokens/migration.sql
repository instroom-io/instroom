-- Chrome extension credentials, one row per connected browser.
--
-- Only the sha256 of each token is stored (`token_hash`); the raw token is
-- handed to the extension once on /extension/connect and never kept.
--
-- NO real foreign key on user_id, for the same reason as CommunityPollVote
-- (see 20260905_add_community_poll_votes): `User` is a MyISAM table on this
-- database and InnoDB refuses an FK onto it. lib/extension-auth.ts re-reads the
-- user on every request and rejects a token whose user is gone or inactive, so
-- a missing cascade cannot leave a working token behind.
--
-- Additive: a new table only.

CREATE TABLE `ExtensionToken` (
  `id` VARCHAR(30) NOT NULL,
  `user_id` VARCHAR(30) NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL,
  `label` VARCHAR(100) NULL,
  `last_used_at` DATETIME(3) NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `revoked_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE KEY `ExtensionToken_token_hash_key` (`token_hash`),
  KEY `ExtensionToken_user_id_idx` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

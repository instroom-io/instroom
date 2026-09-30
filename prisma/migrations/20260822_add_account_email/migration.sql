-- Stores the connected Google account's own email address on the Account
-- row, captured at OAuth connect time. Lets the inbox recognize a thread
-- whose other party is actually the user's own connected mailbox (e.g. a
-- self-sent test/verification email) instead of treating it as an unknown
-- external influencer. Purely additive, nullable.

ALTER TABLE `Account` ADD COLUMN `email` VARCHAR(255) NULL;

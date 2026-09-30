-- Adds an optional photo/logo and a single accent color to the email
-- signature, both nullable so existing signatures render unchanged.

ALTER TABLE `Signature`
  ADD COLUMN `photo_url` VARCHAR(500) NULL,
  ADD COLUMN `accent_color` VARCHAR(7) NULL;

-- Lets a user opt into using their actual Gmail signature (pulled via the
-- Gmail API) instead of the field-built one. The fetched HTML is cached here
-- so sending never depends on a live Gmail call.

ALTER TABLE `Signature`
  ADD COLUMN `use_gmail_signature` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN `gmail_signature_html` TEXT NULL;

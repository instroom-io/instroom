-- Adds Settings → Profile fields: display preferences (timezone, currency,
-- date format) and job title. Purely additive, all nullable.

ALTER TABLE `User`
  ADD COLUMN `job_title` VARCHAR(150) NULL,
  ADD COLUMN `timezone` VARCHAR(64) NULL,
  ADD COLUMN `currency_display` VARCHAR(10) NULL,
  ADD COLUMN `date_format` VARCHAR(20) NULL;

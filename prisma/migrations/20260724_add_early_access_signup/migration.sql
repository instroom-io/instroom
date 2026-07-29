-- Create the early-access / beta waitlist capture table

CREATE TABLE `EarlyAccessSignup` (
  `id` VARCHAR(30) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `name` VARCHAR(100) NULL,
  `role` VARCHAR(50) NULL,
  `invited_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE KEY `EarlyAccessSignup_email_key` (`email`),
  KEY `EarlyAccessSignup_email_idx` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

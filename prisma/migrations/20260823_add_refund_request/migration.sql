-- Adds the RefundRequest table for the in-app "Request a refund" flow.
-- This is a request/review record only — approving a row here does NOT call
-- Lemon Squeezy; the actual refund is still issued manually in their
-- dashboard, exactly as before. Purely additive.

CREATE TABLE `RefundRequest` (
  `id`                  VARCHAR(30) NOT NULL,
  `user_id`             VARCHAR(30) NOT NULL,
  `payment_history_id`  VARCHAR(30) NOT NULL,
  `amount`              DECIMAL(65, 30) NOT NULL,
  `currency`            VARCHAR(10) NOT NULL DEFAULT 'USD',
  `plan_name`           VARCHAR(50) NULL,
  `reason`              TEXT NOT NULL,
  `status`              VARCHAR(20) NOT NULL DEFAULT 'pending',
  `admin_notes`         TEXT NULL,
  `decided_by`          VARCHAR(255) NULL,
  `decided_at`          DATETIME(3) NULL,
  `created_at`          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`          DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `RefundRequest_user_id_idx`(`user_id`),
  INDEX `RefundRequest_status_idx`(`status`),
  INDEX `RefundRequest_payment_history_id_idx`(`payment_history_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

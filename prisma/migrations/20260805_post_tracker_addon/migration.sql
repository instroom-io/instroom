-- Post Tracker Add-on: Automatic Post Detection (EnsembleData)
--
-- Hand-written rather than generated: `prisma migrate diff` against a local DB
-- that trails schema.prisma also emitted unrelated destructive DROP COLUMNs for
-- the GoAffPro affiliate fields. This file contains ONLY the add-on changes and
-- is additive — no column or table is dropped, so it is safe to run on
-- production without data loss.

-- ── DetectedPost: richer post metadata + dedupe guard ────────────────────────
ALTER TABLE `DetectedPost`
    ADD COLUMN `external_id`   VARCHAR(191) NULL,
    ADD COLUMN `author`        VARCHAR(191) NULL,
    ADD COLUMN `caption`       TEXT NULL,
    ADD COLUMN `published_at`  DATETIME(3) NULL,
    ADD COLUMN `hashtags`      TEXT NULL,
    ADD COLUMN `mentions`      TEXT NULL,
    ADD COLUMN `like_count`    INTEGER NULL,
    ADD COLUMN `comment_count` INTEGER NULL,
    ADD COLUMN `view_count`    INTEGER NULL,
    ADD COLUMN `share_count`   INTEGER NULL;

-- Dedupe: the same post must never be imported twice for one influencer.
-- If this fails, pre-existing duplicates exist; de-duplicate first with:
--   DELETE d1 FROM DetectedPost d1 JOIN DetectedPost d2
--     ON d1.brand_influencer_id = d2.brand_influencer_id
--    AND d1.post_url = d2.post_url AND d1.id > d2.id;
CREATE UNIQUE INDEX `DetectedPost_brand_influencer_id_post_url_key`
    ON `DetectedPost`(`brand_influencer_id`, `post_url`);

CREATE INDEX `DetectedPost_brand_id_detected_at_idx`
    ON `DetectedPost`(`brand_id`, `detected_at`);

-- ── PostDetectionSetting: platform selection + sync bookkeeping ──────────────
ALTER TABLE `PostDetectionSetting`
    ADD COLUMN `platforms`      VARCHAR(100) NULL,
    ADD COLUMN `last_synced_at` DATETIME(3) NULL,
    ADD COLUMN `last_error`     TEXT NULL;

CREATE INDEX `PostDetectionSetting_enabled_last_synced_at_idx`
    ON `PostDetectionSetting`(`enabled`, `last_synced_at`);

-- ── PostTrackerAddon: per-workspace paid entitlement ────────────────────────
CREATE TABLE `PostTrackerAddon` (
    `id`                   VARCHAR(30) NOT NULL,
    `brand_id`             VARCHAR(30) NOT NULL,
    `status`               VARCHAR(20) NOT NULL DEFAULT 'inactive',
    `activated_at`         DATETIME(3) NULL,
    `expires_at`           DATETIME(3) NULL,
    `payment_provider`     VARCHAR(20) NULL,
    `payment_reference`    VARCHAR(191) NULL,
    `amount`               DECIMAL(65, 30) NULL,
    `currency`             VARCHAR(10) NOT NULL DEFAULT 'USD',
    `activated_by_user_id` VARCHAR(30) NULL,
    `created_at`           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at`           DATETIME(3) NOT NULL,

    UNIQUE INDEX `PostTrackerAddon_brand_id_key`(`brand_id`),
    INDEX `PostTrackerAddon_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── PostTrackerUsage: per-brand, per-day testing quota counters ──────────────
CREATE TABLE `PostTrackerUsage` (
    `id`             VARCHAR(30) NOT NULL,
    `brand_id`       VARCHAR(30) NOT NULL,
    `usage_date`     DATE NOT NULL,
    `api_requests`   INTEGER NOT NULL DEFAULT 0,
    `posts_imported` INTEGER NOT NULL DEFAULT 0,
    `created_at`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at`     DATETIME(3) NOT NULL,

    UNIQUE INDEX `PostTrackerUsage_brand_id_usage_date_key`(`brand_id`, `usage_date`),
    INDEX `PostTrackerUsage_brand_id_idx`(`brand_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── MonitoringRun: one row per monitoring pass, for debugging ────────────────
CREATE TABLE `MonitoringRun` (
    `id`                  VARCHAR(30) NOT NULL,
    `brand_id`            VARCHAR(30) NOT NULL,
    `brand_influencer_id` VARCHAR(30) NULL,
    `status`              VARCHAR(20) NOT NULL DEFAULT 'running',
    `api_calls`           INTEGER NOT NULL DEFAULT 0,
    `posts_found`         INTEGER NOT NULL DEFAULT 0,
    `posts_imported`      INTEGER NOT NULL DEFAULT 0,
    `error`               TEXT NULL,
    `started_at`          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finished_at`         DATETIME(3) NULL,

    INDEX `MonitoringRun_brand_id_started_at_idx`(`brand_id`, `started_at`),
    INDEX `MonitoringRun_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── MonitoringLock: advisory lock so passes never overlap ────────────────────
CREATE TABLE `MonitoringLock` (
    `key`        VARCHAR(50) NOT NULL,
    `locked_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,
    `holder`     VARCHAR(100) NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

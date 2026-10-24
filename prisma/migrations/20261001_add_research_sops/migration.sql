-- Research SOPs: brand-defined research procedures and the runs that execute
-- them (Settings → Workspace → SOPs, and "Run SOP" on the Influencer List).
--
-- Purely additive: four new tables, nothing existing is altered.
--
-- Runs only PROPOSE values. ResearchSopRunResult rows are never written back to
-- Influencer until a user approves and applies them, so creating these tables
-- changes no existing behaviour.
--
-- Foreign keys exist only BETWEEN the new tables. brand_id, created_by,
-- started_by and brand_influencer_id reference Brand / User / BrandInfluencer,
-- which are MyISAM on this database; InnoDB refuses an FK to a non-InnoDB table
-- (error 1824 — see the 20260905_add_community_poll_votes migration). Those are
-- indexed app-level references, and every route scopes by brand_id.

CREATE TABLE `ResearchSop` (
  `id` VARCHAR(30) NOT NULL,
  `brand_id` VARCHAR(30) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `applies_to` VARCHAR(30) NOT NULL DEFAULT 'influencer',
  `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
  `version` INT NOT NULL DEFAULT 1,
  `created_by` VARCHAR(30) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  KEY `ResearchSop_brand_id_status_idx` (`brand_id`, `status`),
  KEY `ResearchSop_brand_id_updated_at_idx` (`brand_id`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ResearchSopStep` (
  `id` VARCHAR(30) NOT NULL,
  `sop_id` VARCHAR(30) NOT NULL,
  `position` INT NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `instructions` TEXT NULL,
  `required` BOOLEAN NOT NULL DEFAULT true,
  `target_field` VARCHAR(50) NULL,
  `verification_required` BOOLEAN NOT NULL DEFAULT false,
  `notes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  KEY `ResearchSopStep_sop_id_position_idx` (`sop_id`, `position`),
  CONSTRAINT `ResearchSopStep_sop_id_fkey`
    FOREIGN KEY (`sop_id`) REFERENCES `ResearchSop`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ResearchSopRun` (
  `id` VARCHAR(30) NOT NULL,
  `brand_id` VARCHAR(30) NOT NULL,
  `sop_id` VARCHAR(30) NOT NULL,
  `sop_name` VARCHAR(150) NOT NULL,
  `sop_version` INT NOT NULL,
  `steps_snapshot` JSON NOT NULL,
  `target_mode` VARCHAR(20) NOT NULL,
  `target_ids` JSON NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'queued',
  `total_count` INT NOT NULL DEFAULT 0,
  `processed_count` INT NOT NULL DEFAULT 0,
  `completed_count` INT NOT NULL DEFAULT 0,
  `needs_review_count` INT NOT NULL DEFAULT 0,
  `failed_count` INT NOT NULL DEFAULT 0,
  `locked_until` DATETIME(3) NULL,
  `error` VARCHAR(500) NULL,
  `started_by` VARCHAR(30) NULL,
  `started_at` DATETIME(3) NULL,
  `finished_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  KEY `ResearchSopRun_brand_id_created_at_idx` (`brand_id`, `created_at`),
  KEY `ResearchSopRun_sop_id_idx` (`sop_id`),
  KEY `ResearchSopRun_status_idx` (`status`),
  CONSTRAINT `ResearchSopRun_sop_id_fkey`
    FOREIGN KEY (`sop_id`) REFERENCES `ResearchSop`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ResearchSopRunResult` (
  `id` VARCHAR(30) NOT NULL,
  `run_id` VARCHAR(30) NOT NULL,
  `brand_id` VARCHAR(30) NOT NULL,
  `brand_influencer_id` VARCHAR(30) NOT NULL,
  `field` VARCHAR(50) NULL,
  `current_value` TEXT NULL,
  `proposed_value` TEXT NULL,
  `source` VARCHAR(100) NULL,
  `confidence` DECIMAL(4, 3) NULL,
  `value_type` VARCHAR(20) NULL,
  `status` VARCHAR(20) NOT NULL,
  `evidence` TEXT NULL,
  `error` VARCHAR(500) NULL,
  `reviewed_by` VARCHAR(30) NULL,
  `reviewed_at` DATETIME(3) NULL,
  `applied_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  KEY `ResearchSopRunResult_run_id_status_idx` (`run_id`, `status`),
  KEY `ResearchSopRunResult_brand_id_brand_influencer_id_idx` (`brand_id`, `brand_influencer_id`),
  CONSTRAINT `ResearchSopRunResult_run_id_fkey`
    FOREIGN KEY (`run_id`) REFERENCES `ResearchSopRun`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

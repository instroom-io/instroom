-- Fix database-level collation mismatch
-- Change database default collation from utf8mb3_general_ci to utf8mb4_unicode_ci

ALTER DATABASE instroom_staging CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

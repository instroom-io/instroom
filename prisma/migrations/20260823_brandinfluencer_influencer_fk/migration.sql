-- BrandInfluencer.influencer is a REQUIRED relation in schema.prisma, but the
-- live table was created without the matching foreign key, so nothing stopped an
-- Influencer from being deleted while its BrandInfluencer rows stayed behind.
-- Prisma then failed every read that included the relation with
-- "Field influencer is required to return data, got null" — which took down
-- /api/analytics for the whole brand.
--
-- Two steps: remove the rows that can no longer resolve, then add the constraint
-- the schema already declares (onDelete: Cascade) so the state cannot recur.

-- 1. Orphaned membership rows. They point at an Influencer that no longer
--    exists, so they can never be rendered or edited.
DELETE bi FROM `BrandInfluencer` bi
  LEFT JOIN `Influencer` i ON i.`id` = bi.`influencer_id`
  WHERE i.`id` IS NULL;

-- 2. The constraint the schema already declares. NOTE: `BrandInfluencer` and
--    `Influencer` are MyISAM tables, and MySQL accepts FOREIGN KEY on MyISAM and
--    then silently ignores it — so this statement succeeds without creating an
--    enforced constraint. It is kept because it becomes real the moment those
--    tables are converted to InnoDB; until then the cascade is performed in
--    application code (see app/api/influencers/[id]/route.ts DELETE).
ALTER TABLE `BrandInfluencer`
  ADD CONSTRAINT `BrandInfluencer_influencer_id_fkey`
  FOREIGN KEY (`influencer_id`) REFERENCES `Influencer`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

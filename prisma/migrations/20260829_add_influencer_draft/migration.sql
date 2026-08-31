-- Draft influencer rows.
--
-- A blank row added in the Influencer List is persisted immediately so it
-- survives a refresh. It is not an influencer yet, so it is flagged and
-- excluded from every count and every other view (plan limits, analytics,
-- Pipeline, approvals, admin metrics, exports, existing-influencer picker).
--
-- Purely additive: one column with a default, and one index. No existing row
-- changes meaning — `is_draft` is 0 for everything already stored, which is
-- exactly what those rows are.
--
-- `Influencer_handle_platform_key` is deliberately NOT touched. Real
-- influencers still dedupe on (handle, platform); a draft is stored with a
-- generated unique handle instead (see lib/influencer-draft.ts), so drafts can
-- neither collide with each other nor with a real handle, and promoting a
-- draft to a real influencer is an UPDATE of the same row.

ALTER TABLE `Influencer` ADD COLUMN `is_draft` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `Influencer_is_draft_idx` ON `Influencer` (`is_draft`);

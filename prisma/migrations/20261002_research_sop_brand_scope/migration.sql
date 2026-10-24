-- Research SOPs are strictly brand-scoped: every SOP belongs to exactly one
-- Brand and there is no global SOP.
--
-- brand_id is already NOT NULL, but an empty string would still satisfy that.
-- This CHECK makes an unscoped ("global") SOP impossible at the database level.
--
-- A FOREIGN KEY to Brand(id) is not possible: `Brand` is MyISAM on this
-- database and InnoDB cannot reference a non-InnoDB table (error 1824 — see
-- 20260905_add_community_poll_votes). That the brand exists, is active and
-- that the user belongs to it is enforced by every SOP route
-- (lib/research-sop/auth.ts requireSopAccess), and every SOP query is filtered
-- by the route's brand_id.
--
-- Additive and data-safe: no existing row has a blank brand_id.

ALTER TABLE `ResearchSop`
  ADD CONSTRAINT `ResearchSop_brand_id_not_blank` CHECK (TRIM(`brand_id`) <> '');

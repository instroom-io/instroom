-- Brand-wide on/off switch for Automatic Post Detection.
--
-- The card's toggle used to save PostDetectionSetting.enabled for the ONE
-- influencer being viewed, but detection never read it: every run covered all
-- of the brand's tracked influencers whenever the add-on was active. So the
-- toggle looked per-influencer and did nothing.
--
-- The switch now lives on the brand's add-on row and runMonitoringPass and the
-- "Check now" route honour it. Default TRUE keeps today's behaviour (detection
-- on for every brand with an active add-on). PostDetectionSetting.enabled is no
-- longer read or written.

ALTER TABLE `PostTrackerAddon`
  ADD COLUMN `detection_enabled` BOOLEAN NOT NULL DEFAULT TRUE;

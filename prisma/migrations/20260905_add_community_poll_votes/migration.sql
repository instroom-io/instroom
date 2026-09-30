-- Community poll votes.
--
-- Discord's own poll vote is tracked per DISCORD ACCOUNT, and the bot is the
-- only Discord account this app holds (the same constraint already accepted
-- for messages, reactions and pins). Two different Instroom users voting
-- through the bot would collapse into one vote in Discord's own tally, which
-- cannot support "results update correctly for all users" for more than one
-- voter. This table is the real vote store the Community UI reads and writes;
-- the poll's question/options/expiry are never duplicated here — those still
-- come from Discord's own message.poll object on every read.
--
-- NO real foreign key on user_id, even though schema.prisma declares the
-- relation: `User` is a MyISAM table on this database (confirmed directly
-- against information_schema — ENGINE=MyISAM), and MySQL's InnoDB foreign-key
-- mechanism refuses to reference a non-InnoDB table outright (error 1824,
-- "Failed to open the referenced table"), unlike the MyISAM-to-MyISAM case
-- elsewhere in this schema where a FOREIGN KEY clause is silently accepted and
-- then just as silently never enforced (see the 20260823_brandinfluencer_
-- influencer_fk migration's own note on that). Prisma's onDelete: Cascade in
-- the schema is therefore enforced in APPLICATION code, not the database —
-- see lib/discord/polls.ts, and a user-delete path elsewhere in the app would
-- need the same treatment if one is ever added for this table. This is
-- consistent with how every other relation touching a MyISAM table in this
-- database already behaves; it does not introduce a new gap.
--
-- CommunityPollVote itself is still InnoDB — that engine choice does not
-- require the table it's declared for to be InnoDB too, only a table it
-- REFERENCES via an actual FK, which this no longer does.

CREATE TABLE `CommunityPollVote` (
  `id` VARCHAR(30) NOT NULL,
  `message_id` VARCHAR(30) NOT NULL,
  `brand_id` VARCHAR(30) NOT NULL,
  `user_id` VARCHAR(30) NOT NULL,
  `answer_id` INT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE KEY `CommunityPollVote_message_id_user_id_answer_id_key` (`message_id`, `user_id`, `answer_id`),
  KEY `CommunityPollVote_message_id_idx` (`message_id`),
  KEY `CommunityPollVote_brand_id_idx` (`brand_id`),
  KEY `CommunityPollVote_user_id_idx` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

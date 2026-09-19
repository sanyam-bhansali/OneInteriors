-- Where the walkthrough remembers what somebody has done.
--
-- On StudioMember rather than Studio: a second person joining an established
-- studio has learned none of this, and showing them a finished walkthrough
-- because a colleague completed it two months ago is how software earns a
-- reputation for being impenetrable.
--
-- Nullable with no default: null means "never seen anything", which is the
-- correct starting state and needs no backfill.

ALTER TABLE "studio_members" ADD COLUMN "guideState" JSONB;

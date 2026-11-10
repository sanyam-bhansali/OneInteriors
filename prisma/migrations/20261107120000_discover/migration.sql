-- Discover (owner, 7 Nov 2026): the Pinterest-style feed of real rooms.
--
-- Expand only: two nullable or defaulted columns, no data changed.
-- briefs.discoverSaves: the pin ids a customer saved, synced from the device
-- so the expert sees them before the call.
-- portfolio_projects.imageTags: per image, the materials our team tagged and
-- whether they checked it; only checked images appear in the feed.

ALTER TABLE "briefs" ADD COLUMN "discoverSaves" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "portfolio_projects" ADD COLUMN "imageTags" JSONB;

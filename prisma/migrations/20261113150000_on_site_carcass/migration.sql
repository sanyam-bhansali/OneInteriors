-- On-site carcass (owner, 13 Nov 2026: "which projects can we take manual?").
-- Expand only: one new column with a default, no existing row changes meaning.
--
-- True when the carcass is built on site and only the shutters come from the
-- factory, to ease the factory's load. Set on the project page by the owner,
-- the design head or the PM on the project. Studio-only.
ALTER TABLE "home_projects" ADD COLUMN "onSiteCarcass" BOOLEAN NOT NULL DEFAULT false;

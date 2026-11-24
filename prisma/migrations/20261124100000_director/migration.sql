-- Director (owner, 24 Nov 2026): an owner whose home puts projects first, with leads and quotations read only.
ALTER TABLE "studio_members" ADD COLUMN "director" BOOLEAN NOT NULL DEFAULT false;

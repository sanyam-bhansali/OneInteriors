-- The AxLeads look for the studio Leads tab (owner, 12 Oct 2026;
-- docs/studio-os/LEADS-SCALE-BUILT.md "AxLeads look").
--
-- * `studio_clients.tags`: free tags on a lead (at most 20, compared without
--   case — studio-sales/tag-rules.ts), with a GIN index for the tag filter.
-- * (studioId, updatedAt): the "Last active" sort.
--
-- Expand-only: one column with a default, two indexes. Not applied to any
-- database yet.

-- AlterTable
ALTER TABLE "studio_clients" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "studio_clients_studioId_updatedAt_idx" ON "studio_clients"("studioId", "updatedAt");

-- CreateIndex
CREATE INDEX "studio_clients_tags_idx" ON "studio_clients" USING GIN ("tags");

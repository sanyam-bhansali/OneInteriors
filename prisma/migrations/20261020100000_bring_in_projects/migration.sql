-- "Add an existing project" (owner, 20 Oct 2026; docs/studio-os/BRING-IN-PROJECTS.md):
-- running projects brought onto One Interiors with their quotation, the steps
-- already done, the payments already received and the team. Expand only:
-- columns on existing tables, which already have row-level security; no new table.

-- A step done before the project joined: ticked with no photo, labelled so.
-- (ALTER TYPE ... ADD VALUE is not used in the same migration as the value.)
ALTER TYPE "ChecklistDoneSource" ADD VALUE IF NOT EXISTS 'BEFORE_JOINING';

-- A payment received before the project joined: reads as 'earlier' (counts as paid).
ALTER TABLE "home_project_payments" ADD COLUMN "beforeJoining" BOOLEAN NOT NULL DEFAULT false;

-- When the project was brought in, and the old quotation app's number.
ALTER TABLE "home_projects" ADD COLUMN "broughtInAt" TIMESTAMP(3);
ALTER TABLE "home_projects" ADD COLUMN "broughtInFrom" TEXT;

-- Where an imported quotation came from, once per studio.
ALTER TABLE "studio_quotes" ADD COLUMN "importedFrom" TEXT;
ALTER TABLE "studio_quotes" ADD COLUMN "importedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "studio_quotes_studioId_importedFrom_key" ON "studio_quotes"("studioId", "importedFrom");

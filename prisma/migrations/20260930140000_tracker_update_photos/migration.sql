-- Site photos on project updates, and updates posted by the studio itself
-- (queue item 22). Columns on an existing table: RLS unchanged.
ALTER TABLE "home_project_updates" ADD COLUMN     "byStudio" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "photoPaths" TEXT[] DEFAULT ARRAY[]::TEXT[];

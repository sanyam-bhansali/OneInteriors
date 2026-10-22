-- The AxLeads import (owner, 21 Oct 2026; docs/studio-os/AXLEADS-IMPORT.md):
-- a studio's leads, their history and its team moved over from AxLeads by
-- scripts/import-axleads.ts. Expand only: columns on existing tables, which
-- already have row-level security; no new table.

-- The old system's events that have no kind of their own here, and the
-- "Imported from AxLeads" line. (ALTER TYPE ... ADD VALUE is not used in the
-- same migration as the value.)
ALTER TYPE "ClientEventKind" ADD VALUE IF NOT EXISTS 'IMPORTED';

-- Where an imported lead came from and its id there, once per studio, so a
-- second run of the import skips what the first one wrote.
ALTER TABLE "studio_clients" ADD COLUMN "importedFrom" TEXT;
ALTER TABLE "studio_clients" ADD COLUMN "externalId" TEXT;
CREATE UNIQUE INDEX "studio_clients_studioId_importedFrom_externalId_key" ON "studio_clients"("studioId", "importedFrom", "externalId");

-- The same for each history line ("axleads:<id>").
ALTER TABLE "studio_client_events" ADD COLUMN "externalId" TEXT;
CREATE UNIQUE INDEX "studio_client_events_studioId_externalId_key" ON "studio_client_events"("studioId", "externalId");

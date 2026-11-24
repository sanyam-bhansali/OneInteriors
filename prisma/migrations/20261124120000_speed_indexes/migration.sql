-- Speed (owner, 24 Nov 2026): indexes for the quotation lookups and the leads board columns.
CREATE INDEX IF NOT EXISTS "studio_quotes_basedOnId_idx" ON "studio_quotes"("basedOnId");
CREATE INDEX IF NOT EXISTS "studio_quotes_studioId_updatedAt_idx" ON "studio_quotes"("studioId", "updatedAt");
CREATE INDEX IF NOT EXISTS "studio_clients_studioId_stageId_createdAt_idx" ON "studio_clients"("studioId", "stageId", "createdAt");

-- The quotation builder opens only once a studio has confirmed the rates we
-- filled from its quotations (owner, 10 Oct 2026). Column on an existing
-- table: RLS unchanged.
-- AlterTable
ALTER TABLE "studios" ADD COLUMN "ratesConfirmedAt" TIMESTAMP(3);

-- A studio that has already written a quotation keeps its builder: it has
-- been working with its own rates, and shutting it out now would take away a
-- tool it was using. Everyone else waits for their rates to be filled.
UPDATE "studios" s
SET "ratesConfirmedAt" = NOW()
WHERE EXISTS (SELECT 1 FROM "studio_quotes" q WHERE q."studioId" = s."id");

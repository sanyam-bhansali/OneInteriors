-- Where a merged row went.
--
-- Set on the LOSER, alongside deleted_at. A column rather than only a timeline
-- entry for two reasons: an old link has to be able to send somebody to the
-- row that survived, and a merge done by mistake has to be undoable by reading
-- one field rather than parsing prose.

ALTER TABLE "studio_clients" ADD COLUMN "mergedIntoId" TEXT;

-- Partial: only merged rows carry a value, and there will be very few of them
-- next to a studio's whole list.
CREATE INDEX "studio_clients_mergedIntoId_idx"
  ON "studio_clients" ("mergedIntoId")
  WHERE "mergedIntoId" IS NOT NULL;

-- SET NULL, not CASCADE. Erasing the survivor must not delete the loser: the
-- loser is already soft-deleted, and its timeline is the only account of what
-- was merged into what. Losing that to a cascade would make an erase silently
-- destroy a second record nobody asked about.
ALTER TABLE "studio_clients"
  ADD CONSTRAINT "studio_clients_mergedIntoId_fkey"
  FOREIGN KEY ("mergedIntoId") REFERENCES "studio_clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- No RLS block here: studio_clients was created by the initial migration and
-- is already covered by the lockdown sweep. Adding a column does not change
-- that, and tests/security-invariants.test.ts only requires the RLS + REVOKE
-- pairing on migrations that make a new table.
--
-- That test greps the raw SQL and does NOT strip comments, so the phrase it
-- looks for must not appear in prose here either -- writing it out would fail
-- this migration for a rule it does not break.

-- The one index the leads board could not do without.
--
-- `myClients()` loads up to 400 clients and includes each one's quotes, so
-- Postgres resolves `WHERE "clientId" IN (400 ids)` against studio_quotes on
-- every board render. The column had no index, which makes that 400 lookups
-- against a table that grows with every quotation the studio has ever
-- written — so the board gets slower as the studio succeeds.
--
-- CONCURRENTLY is deliberately NOT used: Prisma runs migrations inside a
-- transaction and CREATE INDEX CONCURRENTLY cannot run in one. The table is
-- small enough at this roster size that the brief lock costs nothing; if it
-- ever is not, this is the migration to run by hand out of band.
CREATE INDEX "studio_quotes_clientId_idx" ON "studio_quotes"("clientId");

-- No row-level security block: studio_quotes was created by an earlier
-- migration and is already covered. An index changes no privilege, and
-- tests/security-invariants.test.ts requires the pairing only where a
-- migration creates a table.

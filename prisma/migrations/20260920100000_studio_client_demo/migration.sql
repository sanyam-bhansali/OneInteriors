-- The sample lead.
--
-- The table is "studio_clients", not "StudioClient". Every model in this
-- schema carries an @@map to snake_case, so the Prisma model name is never
-- the table name -- writing SQL from the model name is how the first version
-- of this migration failed with 42P01 against production. Columns are NOT
-- mapped and stay camelCase, which is why "isDemo" is correct here while
-- "StudioClient" was not.
--
-- One boolean on an existing table, so there is no new table to lock down --
-- studio_clients already carries RLS from the lockdown migration and every
-- policy on it applies to this column unchanged.
--
-- Defaulting false means every existing row is real, which is the only safe
-- direction: a row wrongly marked demo would drop out of the studio's own
-- counts and out of their morning screen without deleting anything, and that
-- is the kind of missing number nobody reports because it looks like a quiet
-- week.
ALTER TABLE "studio_clients" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- Every count filters on it, so give the filter an index rather than making
-- each one a sequential scan. Partial, because the demo rows are a handful
-- and the predicate we actually run is "not demo".
CREATE INDEX "studio_clients_studioId_live_idx"
  ON "studio_clients" ("studioId")
  WHERE "deletedAt" IS NULL AND "isDemo" = false;

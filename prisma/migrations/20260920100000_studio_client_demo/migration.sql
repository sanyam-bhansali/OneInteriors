-- The sample lead.
--
-- One boolean on an existing table, so there is no new table to lock down --
-- StudioClient already carries RLS from the lockdown migration and every
-- policy on it applies to this column unchanged.
--
-- Defaulting false means every existing row is real, which is the only safe
-- direction: a row wrongly marked demo would drop out of the studio's own
-- counts and out of their morning screen without deleting anything, and that
-- is the kind of missing number nobody reports because it looks like a quiet
-- week.
ALTER TABLE "StudioClient" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- Every count filters on it, so give the filter an index rather than making
-- each one a sequential scan. Partial, because the demo rows are a handful
-- and the predicate we actually run is "not demo".
CREATE INDEX "StudioClient_studioId_live_idx"
  ON "StudioClient" ("studioId")
  WHERE "deletedAt" IS NULL AND "isDemo" = false;

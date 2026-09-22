-- A studio's own rates, derived from its own quotations.
--
-- ## What this replaces
--
-- `src/data/filed-rates.ts` says in its own header that the per-studio
-- variation in it is a placeholder: every listed studio is supposed to file
-- around a hundred of its quotations, which `ingest.ts` turns into that
-- studio's rates. `ingestQuotations()` has been written and tested since;
-- there has simply been nowhere to put what it produces. This is that place.
--
-- The placeholder file stays as the fallback for a studio that has not filed
-- yet, so nothing changes for a studio with no rows here.

CREATE TABLE "studio_filed_rates" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,

    -- Which archive this rate was derived from. Kept so a rate can always be
    -- traced back to the documents behind it -- when a studio disputes a
    -- number a year from now, this is how we find the evidence.
    "archiveId" TEXT,

    -- A catalogue item code. Text rather than a foreign key because the
    -- catalogue lives in code (`catalogue.ts`), not in a table: it is the one
    -- thing that is identical for every studio, and a row here for a code we
    -- have since retired must stay readable rather than break a join.
    "code" TEXT NOT NULL,

    -- Per sqft of face for AREA items, per unit for UNIT, per sqft carpet, or
    -- per bath. Paise, like every other money column.
    "ratePaise" BIGINT NOT NULL,

    -- How many of the studio's quotations this one rate came from.
    --
    -- Per rate, not per archive, and that distinction is the point: a studio
    -- can file forty quotations of which only three mention a mandir. The
    -- kitchen rate is then solid and the mandir rate is one designer's mood,
    -- and without this column they look identical on the screen ops approves
    -- them from.
    "fromQuotations" INTEGER NOT NULL,

    -- The studio's own words for the material on this line.
    --
    -- The canonical line is the same for every studio, so this is the only
    -- place two studios can visibly differ on something other than price. It
    -- is also what the expert reads back to a customer.
    "spec" TEXT,

    -- PENDING until a person has looked. Nothing here reaches a customer on
    -- the strength of a model having read a PDF.
    "state" TEXT NOT NULL DEFAULT 'PENDING',

    -- Why a rate was rejected, in words ops writes for the studio.
    "note" TEXT,

    "derivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "studio_filed_rates_pkey" PRIMARY KEY ("id")
);

-- One live rate per item per studio. Partial, so superseded and rejected rows
-- stay for the audit trail without colliding with the one in force.
CREATE UNIQUE INDEX "studio_filed_rates_live"
  ON "studio_filed_rates" ("studioId", "code")
  WHERE "state" = 'LIVE';

CREATE INDEX "studio_filed_rates_studioId_state_idx"
  ON "studio_filed_rates" ("studioId", "state");

CREATE INDEX "studio_filed_rates_archiveId_idx" ON "studio_filed_rates" ("archiveId");

ALTER TABLE "studio_filed_rates"
  ADD CONSTRAINT "studio_filed_rates_studioId_fkey"
  FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SET NULL, not CASCADE. Deleting an archive must not silently delete the
-- rates a customer is being quoted at; it should leave them standing and
-- traceable to nothing, which is visible, rather than removing them, which is
-- not.
ALTER TABLE "studio_filed_rates"
  ADD CONSTRAINT "studio_filed_rates_archiveId_fkey"
  FOREIGN KEY ("archiveId") REFERENCES "quotation_archives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "studio_filed_rates"
  ADD CONSTRAINT "studio_filed_rates_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── The archive's own analysis state ───────────────────────────────

-- Where automatic reading has got to, separate from `state`.
--
-- `ArchiveState` describes what OPS has done: received, reading, filed,
-- rejected. This describes what the MACHINE has done, and they move
-- independently -- an archive can be read automatically and still be waiting
-- on a person, which is the normal case and the one the two-column split
-- exists to represent.
ALTER TABLE "quotation_archives" ADD COLUMN "analysisState" TEXT NOT NULL DEFAULT 'NOT_STARTED';

-- What went wrong, for ops rather than for the studio. Extraction fails in
-- ways worth reading: a scanned fax, a password-protected workbook, a file
-- that turned out to be a floor plan.
ALTER TABLE "quotation_archives" ADD COLUMN "analysisError" TEXT;

ALTER TABLE "quotation_archives" ADD COLUMN "analysedAt" TIMESTAMP(3);

-- ── Lockdown ───────────────────────────────────────────────────────
--
-- Both halves, and the second is the one that gets forgotten: Supabase grants
-- every new table to anon and authenticated automatically, so enabling
-- row-level security alone leaves a table protected by policies nobody wrote.
--
-- These rows are a studio's commercial pricing. No policy at all, by
-- intention: nothing reaches this table except through the server, which
-- connects as the owner and bypasses it.
ALTER TABLE "studio_filed_rates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_filed_rates" FORCE ROW LEVEL SECURITY;

REVOKE ALL ON "studio_filed_rates" FROM anon, authenticated;

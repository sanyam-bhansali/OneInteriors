-- ═══════════════════════════════════════════════════════════════
-- The studio's own pipeline, and its own fields.
--
-- Before this migration a client's stage was an enum of six values
-- that WE chose. A studio whose real process is
--
--   New → Calling 1 → Calling 2 → Effective lead →
--   Floor plan pending → Quotation pending → Quotation shared
--
-- had nowhere to put any of it, and the software quietly asked them
-- to work our way. That is the difference between a tool a studio
-- adopts and a tool a studio tolerates until something else arrives.
--
-- So the stage list becomes a table the studio owns. What we keep is
-- `kind` — four meanings that survive renaming, because Projects,
-- the dashboard and the vendor ledger all need to know whether a job
-- is in play, signed, finished or gone, and none of them can be
-- allowed to depend on a string somebody might edit on a Tuesday.
--
-- Same argument for fields. Carpet area, society, possession month,
-- BHK: every studio wants a slightly different handful and not one of
-- them is worth a schema migration. Definitions in `studio_fields`,
-- values in a jsonb column keyed by a machine-stable `key` — so
-- renaming a label never orphans what was captured under it.
-- ═══════════════════════════════════════════════════════════════

CREATE TYPE "StageKind" AS ENUM ('OPEN', 'WON', 'DONE', 'LOST');
CREATE TYPE "FieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'SELECT');

CREATE TABLE "studio_stages" (
    "id"        TEXT NOT NULL,
    "studioId"  TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "kind"      "StageKind" NOT NULL DEFAULT 'OPEN',
    "colour"    TEXT NOT NULL DEFAULT 'slate',
    "sortOrder" INTEGER NOT NULL,
    "isIntake"  BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_stages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "studio_stages_studioId_name_key" ON "studio_stages"("studioId", "name");
CREATE INDEX "studio_stages_studioId_sortOrder_idx" ON "studio_stages"("studioId", "sortOrder");

ALTER TABLE "studio_stages" ADD CONSTRAINT "studio_stages_studioId_fkey"
    FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "studio_fields" (
    "id"        TEXT NOT NULL,
    "studioId"  TEXT NOT NULL,
    "key"       TEXT NOT NULL,
    "label"     TEXT NOT NULL,
    "type"      "FieldType" NOT NULL DEFAULT 'TEXT',
    "options"   TEXT[] DEFAULT ARRAY[]::TEXT[],
    "groupBy"   BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_fields_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "studio_fields_studioId_key_key" ON "studio_fields"("studioId", "key");
CREATE INDEX "studio_fields_studioId_sortOrder_idx" ON "studio_fields"("studioId", "sortOrder");

ALTER TABLE "studio_fields" ADD CONSTRAINT "studio_fields_studioId_fkey"
    FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────
-- Seed every existing studio with the six stages that used to be the
-- enum, under the same names the interface already showed. Nobody
-- opens this on Monday to find their board rearranged; they open it
-- to find that the columns can now be edited.
--
-- `myStages()` does the same thing lazily for studios approved after
-- today, the same way `myProducts()` seeds the starter catalogue.
-- ─────────────────────────────────────────────────────────────────
INSERT INTO "studio_stages" ("id", "studioId", "name", "kind", "colour", "sortOrder", "isIntake")
SELECT
    'stg_' || substr(md5(s."id" || d.name), 1, 20),
    s."id",
    d.name,
    d.kind::"StageKind",
    d.colour,
    d.sort,
    d.intake
FROM "studios" s
CROSS JOIN (VALUES
    ('Enquiry',      'OPEN', 'blue',   10, true),
    ('Quoted',       'OPEN', 'amber',  20, false),
    ('Booked',       'WON',  'violet', 30, false),
    ('On site',      'WON',  'teal',   40, false),
    ('Handed over',  'DONE', 'green',  50, false),
    ('Lost',         'LOST', 'rose',   60, false)
) AS d(name, kind, colour, sort, intake);

-- ─────────────────────────────────────────────────────────────────
-- Move clients onto it. Nullable, backfilled by the old enum's name,
-- then made required — so this is correct whether the table is empty
-- (it is, today) or holds a year of somebody's work.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE "studio_clients" ADD COLUMN "stageId" TEXT;

UPDATE "studio_clients" c
SET "stageId" = st."id"
FROM "studio_stages" st
WHERE st."studioId" = c."studioId"
  AND st."name" = CASE c."stage"::text
        WHEN 'ENQUIRY'     THEN 'Enquiry'
        WHEN 'QUOTED'      THEN 'Quoted'
        WHEN 'BOOKED'      THEN 'Booked'
        WHEN 'IN_PROGRESS' THEN 'On site'
        WHEN 'HANDED_OVER' THEN 'Handed over'
        WHEN 'LOST'        THEN 'Lost'
      END;

ALTER TABLE "studio_clients" ALTER COLUMN "stageId" SET NOT NULL;

-- Restrict, not Cascade: deleting a stage that still holds clients
-- would drop them off the board without a word. Settings makes you
-- move them first.
ALTER TABLE "studio_clients" ADD CONSTRAINT "studio_clients_stageId_fkey"
    FOREIGN KEY ("stageId") REFERENCES "studio_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "studio_clients_studioId_stage_nextActionOn_idx";
ALTER TABLE "studio_clients" DROP COLUMN "stage";
DROP TYPE "ClientStage";

CREATE INDEX "studio_clients_studioId_stageId_nextActionOn_idx"
    ON "studio_clients"("studioId", "stageId", "nextActionOn");

ALTER TABLE "studio_clients" ADD COLUMN "fields" JSONB NOT NULL DEFAULT '{}';

-- ─────────────────────────────────────────────────────────────────
-- RLS lockdown. Supabase's PostgREST exposes every table in `public`
-- to the anon and authenticated roles by default and Prisma-created
-- tables get no policies, so without this block both tables are
-- world readable AND writable over HTTP. Run this in EVERY migration
-- that adds a table. Prisma connects as `postgres`, which holds
-- rolbypassrls, so it is unaffected.
--
-- `studio_stages` looks harmless and is not: a studio's pipeline is
-- a description of how it sells, and the stage names on this list
-- ("Floor plan pending", "Quotation shared") say more about a rival's
-- process than anything on their website does.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE "studio_stages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_stages" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_stages" FROM anon, authenticated;

ALTER TABLE "studio_fields" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_fields" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_fields" FROM anon, authenticated;

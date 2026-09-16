-- The prep pack.
--
-- What a customer does with their rooms between booking the expert call and
-- taking it. One row per room they touched; no row means they did not touch it,
-- which is information too.
--
-- We store the INPUTS to a board (`shuffle`, `chosenOption`) and never the
-- generated board itself. The proposal is a pure function of these plus the
-- brief's liked styles — see src/modules/prepare/moodboard.ts — so storing the
-- output would mean two sources of truth that drift the first time the style
-- vocabulary changes.
--
-- RLS: `prep_rooms` is a NEW table, so it needs the lockdown block below. The
-- 20260907180000_enable_rls_lockdown migration only covered tables that existed
-- when it ran, and its ALTER DEFAULT PRIVILEGES does not enable RLS on future
-- tables — it only stops privileges being granted. Without this block the table
-- is readable and writable over PostgREST by anon.

-- CreateTable
CREATE TABLE "prep_rooms" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "roomKey" TEXT NOT NULL,
    "shuffle" INTEGER NOT NULL DEFAULT 0,
    "chosenOption" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prep_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prep_rooms_briefId_idx" ON "prep_rooms"("briefId");

-- CreateIndex
-- One row per room per brief. This is the constraint that makes the save action
-- a single upsert rather than a read-then-write, which matters because the page
-- saves on every keystroke pause and two in flight at once would otherwise race
-- into duplicate rooms.
CREATE UNIQUE INDEX "prep_rooms_briefId_roomKey_key" ON "prep_rooms"("briefId", "roomKey");

-- AddForeignKey
ALTER TABLE "prep_rooms" ADD CONSTRAINT "prep_rooms_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "briefs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────
-- RLS lockdown. Supabase's PostgREST exposes every table in `public`
-- to the anon and authenticated roles by default; Prisma-created
-- tables get no policies, so without this block the table is world
-- readable AND writable over HTTP. Run this in EVERY migration that
-- adds a table. Prisma connects as `postgres`, which has
-- rolbypassrls, so it is unaffected.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE "prep_rooms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prep_rooms" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "prep_rooms" FROM anon, authenticated;

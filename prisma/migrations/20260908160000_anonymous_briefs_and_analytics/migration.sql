-- AlterTable
ALTER TABLE "briefs" ADD COLUMN     "anonKey" TEXT,
ADD COLUMN     "claimedAt" TIMESTAMP(3),
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "anonKey" TEXT,
    "userId" TEXT,
    "briefId" TEXT,
    "props" JSONB,
    "source" TEXT,
    "campaign" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_events_name_createdAt_idx" ON "analytics_events"("name", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_anonKey_idx" ON "analytics_events"("anonKey");

-- CreateIndex
CREATE INDEX "analytics_events_briefId_idx" ON "analytics_events"("briefId");

-- CreateIndex
CREATE UNIQUE INDEX "briefs_anonKey_key" ON "briefs"("anonKey");

-- CreateIndex
CREATE INDEX "briefs_anonKey_idx" ON "briefs"("anonKey");


-- ─────────────────────────────────────────────────────────────────
-- RLS lockdown. Supabase's PostgREST exposes every table in `public`
-- to the anon and authenticated roles by default; Prisma-created
-- tables get no policies, so without this block the table is world
-- readable AND writable over HTTP. Run this in EVERY migration that
-- adds a table. Prisma connects as `postgres`, which has
-- rolbypassrls, so it is unaffected.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE "analytics_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "analytics_events" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "analytics_events" FROM anon, authenticated;

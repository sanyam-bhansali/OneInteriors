-- Floor plan → first quotation (owner, 12 Oct 2026;
-- docs/studio-os/FLOORPLAN-QUOTE-BUILT.md). Expand only: three new tables,
-- nothing existing is changed.
--
-- * `studio_plan_readings`: one Claude read per floor-plan file per studio,
--   keyed by the sha256 of the file's bytes, so the same file is never read
--   twice; also the per-studio daily cap's count.
-- * `studio_plan_jobs`: the latest read-and-build run for a lead file, so the
--   lead page can say what happened ("Built 2026-014", "Read failed").
-- * `studio_quote_plans`: which lead file a quotation's rooms come from.
--
-- Plain id columns, no foreign keys (the tables carry no personal data and
-- are only reached through studio-scoped queries). RLS on, no policies:
-- reached only through Prisma on the server, like every studio table.

-- CreateTable
CREATE TABLE "studio_plan_readings" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READING',
    "reason" TEXT,
    "reading" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_plan_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_plan_jobs" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "quoteId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "studio_plan_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_quote_plans" (
    "quoteId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_quote_plans_pkey" PRIMARY KEY ("quoteId")
);

-- CreateIndex
CREATE INDEX "studio_plan_readings_studioId_lastAttemptAt_idx" ON "studio_plan_readings"("studioId", "lastAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "studio_plan_readings_studioId_contentHash_key" ON "studio_plan_readings"("studioId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "studio_plan_jobs_fileId_key" ON "studio_plan_jobs"("fileId");

-- CreateIndex
CREATE INDEX "studio_plan_jobs_studioId_clientId_idx" ON "studio_plan_jobs"("studioId", "clientId");

-- CreateIndex
CREATE INDEX "studio_quote_plans_studioId_idx" ON "studio_quote_plans"("studioId");


-- Row level security: closed to the anon and authenticated roles.
ALTER TABLE "studio_plan_readings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_plan_readings" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_plan_readings" FROM anon, authenticated;
ALTER TABLE "studio_plan_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_plan_jobs" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_plan_jobs" FROM anon, authenticated;
ALTER TABLE "studio_quote_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_quote_plans" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_quote_plans" FROM anon, authenticated;

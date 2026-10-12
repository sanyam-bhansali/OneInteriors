-- Leads at scale (owner, 12 Oct 2026; docs/studio-os/LEADS-SCALE-BUILT.md).
--
-- Hauspire has 26,000 leads and adds 700-800 a day. The list view, the board,
-- the dashboard and the calendar now count and page in SQL; these indexes are
-- the paths they read:
--
-- * newest / oldest / date added      (studioId, createdAt)
-- * follow-up date, due and missed    (studioId, nextActionOn)
--                                     (studioId, assignedToId, nextActionOn)
-- * last contacted, gone quiet        (studioId, lastContactedAt)
-- * phone lookup and import dedupe    (studioId, phone)
-- * name sort                         (studioId, name)
-- * bookings in a date range          (studioId, bookedAt)
-- * the stage foreign key             (stageId)
--
-- Already there and reused: (studioId, deletedAt), (studioId, assignedToId,
-- deletedAt), (studioId, stageId, nextActionOn), (studioId, meetingAt).
-- No pg_trgm: no migration enables extensions, so search stays a scan of one
-- studio's rows (bounded by studioId).
--
-- * `studio_tasks`: to-dos on the studio calendar, given to one person,
--   optionally about a lead.
--
-- Expand-only: indexes and one new table. Nothing dropped, renamed or
-- backfilled. Not applied to any database yet.

-- CreateIndex
CREATE INDEX "studio_clients_studioId_createdAt_idx" ON "studio_clients"("studioId", "createdAt");

-- CreateIndex
CREATE INDEX "studio_clients_studioId_nextActionOn_idx" ON "studio_clients"("studioId", "nextActionOn");

-- CreateIndex
CREATE INDEX "studio_clients_studioId_lastContactedAt_idx" ON "studio_clients"("studioId", "lastContactedAt");

-- CreateIndex
CREATE INDEX "studio_clients_studioId_phone_idx" ON "studio_clients"("studioId", "phone");

-- CreateIndex
CREATE INDEX "studio_clients_studioId_name_idx" ON "studio_clients"("studioId", "name");

-- CreateIndex
CREATE INDEX "studio_clients_studioId_assignedToId_nextActionOn_idx" ON "studio_clients"("studioId", "assignedToId", "nextActionOn");

-- CreateIndex
CREATE INDEX "studio_clients_studioId_bookedAt_idx" ON "studio_clients"("studioId", "bookedAt");

-- CreateIndex
CREATE INDEX "studio_clients_stageId_idx" ON "studio_clients"("stageId");

-- CreateTable
CREATE TABLE "studio_tasks" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "leadId" TEXT,
    "assignedToId" TEXT,
    "doneAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "studio_tasks_studioId_dueAt_idx" ON "studio_tasks"("studioId", "dueAt");

-- CreateIndex
CREATE INDEX "studio_tasks_studioId_assignedToId_dueAt_idx" ON "studio_tasks"("studioId", "assignedToId", "dueAt");

-- CreateIndex
CREATE INDEX "studio_tasks_leadId_dueAt_idx" ON "studio_tasks"("leadId", "dueAt");

-- CreateIndex
CREATE INDEX "studio_tasks_createdById_idx" ON "studio_tasks"("createdById");

-- AddForeignKey
ALTER TABLE "studio_tasks" ADD CONSTRAINT "studio_tasks_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_tasks" ADD CONSTRAINT "studio_tasks_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "studio_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_tasks" ADD CONSTRAINT "studio_tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "studio_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_tasks" ADD CONSTRAINT "studio_tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "studio_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS (HANDOVER: every migration that adds a table carries it). Prisma
-- connects as a role that bypasses RLS; PostgREST's anon/authenticated get
-- nothing.
ALTER TABLE "studio_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_tasks" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_tasks" FROM anon, authenticated;

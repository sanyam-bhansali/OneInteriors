-- Regular busy times (owner and the design team, 27 Oct 2026): weekly spans a
-- person is not free, shown when someone picks a meeting time with them.
--
-- Expand only: one new table. RLS on, no policies: reached only through
-- Prisma on the server, like every studio table.

-- CreateTable
CREATE TABLE "studio_busy_blocks" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMin" INTEGER NOT NULL,
    "minutes" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_busy_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "studio_busy_blocks_memberId_idx" ON "studio_busy_blocks"("memberId");
CREATE INDEX "studio_busy_blocks_studioId_idx" ON "studio_busy_blocks"("studioId");

-- AddForeignKey
ALTER TABLE "studio_busy_blocks" ADD CONSTRAINT "studio_busy_blocks_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "studio_busy_blocks" ADD CONSTRAINT "studio_busy_blocks_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "studio_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row level security: closed to the anon and authenticated roles.
ALTER TABLE "studio_busy_blocks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_busy_blocks" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_busy_blocks" FROM anon, authenticated;

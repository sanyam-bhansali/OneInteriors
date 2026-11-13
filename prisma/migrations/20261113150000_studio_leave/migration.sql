-- Team leave (owner, 13 Nov 2026: "a calendar-based leave approval system,
-- where people put their planned or unplanned leaves, based on approval").
-- Expand only: one new table, nothing existing changed. Holidays use the
-- existing studio_holidays table.
CREATE TABLE "studio_leaves" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "fromDay" DATE NOT NULL,
    "toDay" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ASKED',
    "askedById" TEXT NOT NULL,
    "askedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "shiftedDays" INTEGER,
    "shiftedProjects" INTEGER,

    CONSTRAINT "studio_leaves_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "studio_leaves_studioId_fromDay_idx" ON "studio_leaves"("studioId", "fromDay");
CREATE INDEX "studio_leaves_memberId_fromDay_idx" ON "studio_leaves"("memberId", "fromDay");

ALTER TABLE "studio_leaves" ADD CONSTRAINT "studio_leaves_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "studio_leaves" ADD CONSTRAINT "studio_leaves_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "studio_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Supabase: the table is the server's only.
ALTER TABLE "studio_leaves" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_leaves" FROM anon, authenticated;

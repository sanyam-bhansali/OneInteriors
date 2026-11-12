-- Project on hold (owner, 12 Nov 2026): a designer asks, the design head or the
-- owner approves; taking it off moves the plan by the days it was on hold.
-- Expand only: one new table, nothing existing changed.
CREATE TABLE "home_project_holds" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ASKED',
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "askedById" TEXT NOT NULL,
    "askedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "startedOn" DATE,
    "endedOn" DATE,
    "endedById" TEXT,
    "shiftedDays" INTEGER,

    CONSTRAINT "home_project_holds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "home_project_holds_projectId_askedAt_idx" ON "home_project_holds"("projectId", "askedAt");

ALTER TABLE "home_project_holds" ADD CONSTRAINT "home_project_holds_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Supabase: the table is the server's only (as every home_* table).
ALTER TABLE "home_project_holds" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "home_project_holds" FROM anon, authenticated;

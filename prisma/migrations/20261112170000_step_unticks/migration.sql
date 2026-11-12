-- Unticking a design step (owner, 12 Nov 2026): who unticked it and why, and
-- what the tick was, kept for the history. Expand only: one new table.
CREATE TABLE "home_step_unticks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "tickedAt" TIMESTAMP(3) NOT NULL,
    "tickedById" TEXT,
    "doneNote" TEXT,
    "doneDocumentId" TEXT,
    "donePhotoId" TEXT,
    "undoneDays" INTEGER NOT NULL DEFAULT 0,
    "byId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "home_step_unticks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "home_step_unticks_projectId_at_idx" ON "home_step_unticks"("projectId", "at");

CREATE INDEX "home_step_unticks_stepId_idx" ON "home_step_unticks"("stepId");

ALTER TABLE "home_step_unticks" ADD CONSTRAINT "home_step_unticks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "home_step_unticks" ADD CONSTRAINT "home_step_unticks_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "home_checklist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Supabase: the server's only, as every home_* table.
ALTER TABLE "home_step_unticks" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "home_step_unticks" FROM anon, authenticated;

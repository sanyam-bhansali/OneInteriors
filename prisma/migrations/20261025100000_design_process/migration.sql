-- The design process (owner and Hauspire's design team, 24 Oct 2026;
-- docs/studio-os/DESIGN-PROCESS-PLAN.md §1–§2).
--
-- Expand only: one enum value, three columns on steps, one new table, two
-- columns on step delays, one on studio members. Nothing dropped, nothing
-- backfilled, nothing rewritten: existing projects keep their steps until a
-- studio moves them to the new steps (Settings, Design).
--
-- "ProjectPhase" PRE_EXECUTION: design done (working drawings final), the
-- execution team owns the project, the designer supports.
-- home_checklist_items."effortMin": the step's effort for this home, in
-- minutes; its share of design progress is effort over the total.
-- home_checklist_items."approvalKind": on a client's approval step, what
-- approves it in the app (LAYOUT_2D | RENDER_3D | WORKING | DESIGN_FINAL).
-- home_step_tasks: small to-dos inside a step.
-- home_step_delays."checkedAt" / "checkedById": somebody checked the reason.
-- studio_members."designHead": a designer who sees every designer's work.
--
-- RLS on the new table, no policies: reached only through Prisma on the
-- server, like every studio table.

-- AlterEnum
ALTER TYPE "ProjectPhase" ADD VALUE IF NOT EXISTS 'PRE_EXECUTION' BEFORE 'EXECUTION';

-- AlterTable
ALTER TABLE "home_checklist_items" ADD COLUMN "effortMin" INTEGER;
ALTER TABLE "home_checklist_items" ADD COLUMN "approvalKind" TEXT;

-- AlterTable
ALTER TABLE "home_step_delays" ADD COLUMN "checkedAt" TIMESTAMP(3);
ALTER TABLE "home_step_delays" ADD COLUMN "checkedById" TEXT;

-- AlterTable
ALTER TABLE "studio_members" ADD COLUMN "designHead" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "home_step_tasks" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "doneAt" TIMESTAMP(3),
    "doneById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "home_step_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "home_step_tasks_stepId_sortOrder_idx" ON "home_step_tasks"("stepId", "sortOrder");

-- AddForeignKey
ALTER TABLE "home_step_tasks" ADD CONSTRAINT "home_step_tasks_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "home_checklist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row level security: closed to the anon and authenticated roles.
ALTER TABLE "home_step_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_step_tasks" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_step_tasks" FROM anon, authenticated;

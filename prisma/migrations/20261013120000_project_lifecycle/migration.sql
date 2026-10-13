-- The project lifecycle (owner, 13 Oct 2026; docs/studio-os/PROJECT-LIFECYCLE.md).
-- Expand only: one enum, columns with defaults, two new tables, and a
-- backfill of the new columns from each project's state. Nothing dropped.
--
-- HomeProject.phase: DESIGN -> EXECUTION (design sign-off) -> CLOSURE (the
-- provisional handover step ticked) -> SNAGS (the closure fixed the final
-- payment) -> WARRANTY (the client signed off the handover) -> CLOSED.
-- Studio.warrantyMonths (default 12). HomeSnag.warranty for snags the
-- client raises during the warranty.
--
-- home_project_closures and home_project_closure_lines hold the project
-- closure, append-only (every save is a new version; the final version fixes
-- the final payment). RLS on, no policies: reached only through Prisma on the
-- server, like every studio table.

-- CreateEnum
CREATE TYPE "ProjectPhase" AS ENUM ('DESIGN', 'EXECUTION', 'CLOSURE', 'SNAGS', 'WARRANTY', 'CLOSED');

-- AlterTable
ALTER TABLE "home_projects" ADD COLUMN     "closedOutAt" TIMESTAMP(3),
ADD COLUMN     "handoverSignedAt" TIMESTAMP(3),
ADD COLUMN     "handoverSignedById" TEXT,
ADD COLUMN     "phase" "ProjectPhase" NOT NULL DEFAULT 'DESIGN',
ADD COLUMN     "phaseAt" TIMESTAMP(3),
ADD COLUMN     "provisionalHandoverAt" TIMESTAMP(3),
ADD COLUMN     "warrantyEndsOn" DATE;

-- AlterTable
ALTER TABLE "home_snags" ADD COLUMN     "warranty" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "studios" ADD COLUMN     "warrantyMonths" INTEGER NOT NULL DEFAULT 12;

-- CreateTable
CREATE TABLE "home_project_closures" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "contractPaise" BIGINT NOT NULL,
    "changesPaise" BIGINT NOT NULL DEFAULT 0,
    "extrasPaise" BIGINT NOT NULL DEFAULT 0,
    "deductionsPaise" BIGINT NOT NULL DEFAULT 0,
    "gstBps" INTEGER NOT NULL DEFAULT 0,
    "gstPaise" BIGINT NOT NULL DEFAULT 0,
    "totalPaise" BIGINT NOT NULL,
    "paidPaise" BIGINT NOT NULL,
    "finalDuePaise" BIGINT NOT NULL,
    "note" TEXT,
    "final" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "home_project_closures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_project_closure_lines" (
    "id" TEXT NOT NULL,
    "closureId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "qtyMilli" INTEGER,
    "ratePaise" BIGINT,
    "amountPaise" BIGINT NOT NULL,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "home_project_closure_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "home_project_closures_projectId_final_idx" ON "home_project_closures"("projectId", "final");

-- CreateIndex
CREATE UNIQUE INDEX "home_project_closures_projectId_version_key" ON "home_project_closures"("projectId", "version");

-- CreateIndex
CREATE INDEX "home_project_closure_lines_closureId_idx" ON "home_project_closure_lines"("closureId");

-- AddForeignKey
ALTER TABLE "home_project_closures" ADD CONSTRAINT "home_project_closures_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_project_closure_lines" ADD CONSTRAINT "home_project_closure_lines_closureId_fkey" FOREIGN KEY ("closureId") REFERENCES "home_project_closures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row level security: closed to the anon and authenticated roles.
ALTER TABLE "home_project_closures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_project_closures" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_project_closures" FROM anon, authenticated;

ALTER TABLE "home_project_closure_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_project_closure_lines" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_project_closure_lines" FROM anon, authenticated;

-- Backfill 1: the last execution step is now "Provisional handover"
-- (project/step-template.ts). Same step, same weight: only the name of
-- Hauspire's untouched "Handover" step in the Handover group changes, so
-- every project's weights still sum to 100%. A step a studio renamed keeps
-- its name (lifecycle-rules.ts then reads the stage's last step).
UPDATE "home_checklist_items" AS i
SET "label" = 'Provisional handover', "updatedAt" = CURRENT_TIMESTAMP
FROM "home_project_stages" AS s
WHERE i."stageId" = s."id"
  AND s."kind" = 'HANDOVER'
  AND i."label" = 'Handover'
  AND i."room" = 'Handover';

-- Backfill 2: the phase of every existing project, from its state.
-- EXECUTION: design signed off (closed), the DESIGN stage done, any other
-- stage's step ticked, or (an older tracker with no plan) any stage marked done.
UPDATE "home_projects" AS p
SET "phase" = 'EXECUTION', "phaseAt" = CURRENT_TIMESTAMP
WHERE p."designClosedAt" IS NOT NULL
   OR EXISTS (SELECT 1 FROM "home_project_stages" s WHERE s."projectId" = p."id" AND s."kind" = 'DESIGN' AND s."actualEnd" IS NOT NULL)
   OR EXISTS (
        SELECT 1 FROM "home_checklist_items" i
        JOIN "home_project_stages" s ON s."id" = i."stageId"
        WHERE s."projectId" = p."id" AND s."kind" <> 'DESIGN' AND i."doneAt" IS NOT NULL)
   OR (NOT EXISTS (SELECT 1 FROM "home_project_stages" s WHERE s."projectId" = p."id") AND cardinality(p."doneStages") > 0);

-- CLOSURE: the provisional handover step ticked (its day is the handover's),
-- else the Handover stage done; an older tracker with HANDOVER marked done.
UPDATE "home_projects" AS p
SET "phase" = 'CLOSURE',
    "phaseAt" = CURRENT_TIMESTAMP,
    "provisionalHandoverAt" = COALESCE(
      (SELECT max(i."doneAt") FROM "home_checklist_items" i
         JOIN "home_project_stages" s ON s."id" = i."stageId"
        WHERE s."projectId" = p."id" AND s."kind" = 'HANDOVER' AND i."label" = 'Provisional handover' AND i."doneAt" IS NOT NULL),
      (SELECT max(s."actualEnd") FROM "home_project_stages" s WHERE s."projectId" = p."id" AND s."kind" = 'HANDOVER'),
      CURRENT_TIMESTAMP)
WHERE EXISTS (
        SELECT 1 FROM "home_checklist_items" i
        JOIN "home_project_stages" s ON s."id" = i."stageId"
        WHERE s."projectId" = p."id" AND s."kind" = 'HANDOVER' AND i."label" = 'Provisional handover' AND i."doneAt" IS NOT NULL)
   OR EXISTS (SELECT 1 FROM "home_project_stages" s WHERE s."projectId" = p."id" AND s."kind" = 'HANDOVER' AND s."actualEnd" IS NOT NULL)
   OR (NOT EXISTS (SELECT 1 FROM "home_project_stages" s WHERE s."projectId" = p."id") AND 'HANDOVER' = ANY(p."doneStages"));

-- Studio OS Phase 2: Design, from booking to design final (owner, 12 Oct 2026;
-- docs/studio-os/PHASE-2-DESIGN.md, built as docs/studio-os/PHASE-2-BUILT.md).
--
-- * `StudioRole` gains DESIGNER.
-- * `studios.designTemplate`: the studio's design steps (Settings, Design steps).
-- * `home_projects`: the designer, the mood board shared, the design final and
--   when design closed, with a frozen summary of what changed for the client.
-- * `home_checklist_items`: a design step's responsible role, document
--   required, payment gate, days after the previous step, the team's note and
--   the file it was ticked with.
-- * `home_documents`: a drawing's design kind and room.
-- * New: `home_site_visits`, `home_measurements`, `home_design_reviews`
--   (append-only), `home_step_delays` (append-only).
--
-- Expand-only: an enum value, three enums, nullable or defaulted columns, four
-- new tables, indexes and foreign keys. Nothing is dropped, renamed or
-- backfilled. Not applied to production by this change.

-- AlterEnum
ALTER TYPE "StudioRole" ADD VALUE 'DESIGNER';

-- CreateEnum
CREATE TYPE "SiteVisitStatus" AS ENUM ('BOOKED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DesignVerdict" AS ENUM ('APPROVED', 'CHANGES');

-- CreateEnum
CREATE TYPE "DelaySide" AS ENUM ('CLIENT', 'STUDIO');

-- AlterTable
ALTER TABLE "studios" ADD COLUMN "designTemplate" JSONB;

-- AlterTable
ALTER TABLE "home_projects" ADD COLUMN "designerId" TEXT,
ADD COLUMN "moodBoardSharedAt" TIMESTAMP(3),
ADD COLUMN "moodBoardNote" TEXT,
ADD COLUMN "designFinalQuoteId" TEXT,
ADD COLUMN "designClosedAt" TIMESTAMP(3),
ADD COLUMN "designChanges" JSONB;

-- AlterTable
ALTER TABLE "home_checklist_items" ADD COLUMN "responsible" TEXT,
ADD COLUMN "needsDocument" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "gatePayment" INTEGER,
ADD COLUMN "gapDays" INTEGER,
ADD COLUMN "doneNote" TEXT,
ADD COLUMN "doneDocumentId" TEXT;

-- AlterTable
ALTER TABLE "home_documents" ADD COLUMN "designKind" TEXT,
ADD COLUMN "room" TEXT;

-- CreateTable
CREATE TABLE "home_site_visits" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" "SiteVisitStatus" NOT NULL DEFAULT 'BOOKED',
    "note" TEXT,
    "byId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_site_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_measurements" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "lengthMm" INTEGER,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_design_reviews" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "verdict" "DesignVerdict" NOT NULL,
    "comment" TEXT,
    "byUserId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "home_design_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_step_delays" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "side" "DelaySide" NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "byId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "home_step_delays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "home_site_visits_projectId_at_idx" ON "home_site_visits"("projectId", "at");

-- CreateIndex
CREATE INDEX "home_measurements_projectId_sortOrder_idx" ON "home_measurements"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "home_design_reviews_projectId_at_idx" ON "home_design_reviews"("projectId", "at");

-- CreateIndex
CREATE INDEX "home_design_reviews_documentId_idx" ON "home_design_reviews"("documentId");

-- CreateIndex
CREATE INDEX "home_step_delays_projectId_at_idx" ON "home_step_delays"("projectId", "at");

-- CreateIndex
CREATE INDEX "home_step_delays_stepId_idx" ON "home_step_delays"("stepId");

-- AddForeignKey
ALTER TABLE "home_projects" ADD CONSTRAINT "home_projects_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "studio_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_site_visits" ADD CONSTRAINT "home_site_visits_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_measurements" ADD CONSTRAINT "home_measurements_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_design_reviews" ADD CONSTRAINT "home_design_reviews_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_design_reviews" ADD CONSTRAINT "home_design_reviews_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "home_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_step_delays" ADD CONSTRAINT "home_step_delays_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_step_delays" ADD CONSTRAINT "home_step_delays_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "home_checklist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Lock the new tables down like every other: no access for the Supabase anon
-- and authenticated roles (Prisma connects as the owner).
ALTER TABLE "home_site_visits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_site_visits" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_site_visits" FROM anon, authenticated;

ALTER TABLE "home_measurements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_measurements" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_measurements" FROM anon, authenticated;

ALTER TABLE "home_design_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_design_reviews" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_design_reviews" FROM anon, authenticated;

ALTER TABLE "home_step_delays" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_step_delays" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_step_delays" FROM anon, authenticated;

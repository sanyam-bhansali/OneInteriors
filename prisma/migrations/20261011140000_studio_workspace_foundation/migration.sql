-- Studio workspace, Phase 1 foundation (docs/studio-workspace/PHASE-1-PLAN.md,
-- docs/studio-workspace/PHASE-1-FOUNDATION.md).
--
-- Roles and team on `studio_members`; which PM or supervisor is on which
-- customer project; the plan built from the signed quote (stages, checklist,
-- materials); documents that can be kept back from the customer and
-- versioned; and the studio's internal notes on a project.
--
-- Expand-only: new enums, new tables, new columns that are nullable or carry
-- a default. Nothing is dropped or renamed; `isOwner` stays and code keeps
-- writing it until a later contract migration. Safe to `db:deploy`.
--
-- Two backfills, both so nothing changes for anyone on the day it ships:
-- * every existing member keeps what they could do: owners become OWNER,
--   everyone else PM (today a non-owner can do everything except be the
--   owner, and PM is the nearest role; the owner can narrow it later).
-- * every existing document was visible to the customer, so `sharedAt` is
--   its `createdAt`; only documents uploaded as drafts from now on are held.

-- CreateEnum
CREATE TYPE "StudioRole" AS ENUM ('OWNER', 'PM', 'SUPERVISOR', 'ACCOUNTS');

-- CreateEnum
CREATE TYPE "StudioMemberStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ProjectStageKind" AS ENUM ('DESIGN', 'CIVIL', 'CARPENTRY', 'FINISH', 'HANDOVER');

-- CreateEnum
CREATE TYPE "ChecklistDoneSource" AS ENUM ('TICK', 'VOICE');

-- AlterTable
ALTER TABLE "studio_members" ADD COLUMN "role" "StudioRole" NOT NULL DEFAULT 'OWNER';
ALTER TABLE "studio_members" ADD COLUMN "status" "StudioMemberStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "studio_members" ADD COLUMN "invitedById" TEXT;
ALTER TABLE "studio_members" ADD COLUMN "invitedAt" TIMESTAMP(3);
ALTER TABLE "studio_members" ADD COLUMN "lastSeenAt" TIMESTAMP(3);

-- Backfill: the role follows the old flag.
UPDATE "studio_members" SET "role" = CASE WHEN "isOwner" THEN 'OWNER'::"StudioRole" ELSE 'PM'::"StudioRole" END;

-- AlterTable
ALTER TABLE "home_projects" ADD COLUMN "teamNotes" TEXT;

-- AlterTable
ALTER TABLE "home_documents" ADD COLUMN "sharedAt" TIMESTAMP(3);
ALTER TABLE "home_documents" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "home_documents" ADD COLUMN "supersedesId" TEXT;

-- Backfill: everything already uploaded was already in the customer's Locker.
UPDATE "home_documents" SET "sharedAt" = "createdAt" WHERE "sharedAt" IS NULL;

-- CreateTable
CREATE TABLE "studio_project_members" (
    "id" TEXT NOT NULL,
    "homeProjectId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_project_stages" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "ProjectStageKind" NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "plannedStart" TIMESTAMP(3) NOT NULL,
    "plannedEnd" TIMESTAMP(3) NOT NULL,
    "actualEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_project_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_checklist_items" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "quoteLineId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "doneAt" TIMESTAMP(3),
    "doneById" TEXT,
    "doneSource" "ChecklistDoneSource",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_materials" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "spec" TEXT,
    "quoteLineId" TEXT,
    "productCode" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_materials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: one on every foreign key. The unique pair leads with
-- homeProjectId, so it is that key's index too.
CREATE UNIQUE INDEX "studio_project_members_homeProjectId_memberId_key" ON "studio_project_members"("homeProjectId", "memberId");
CREATE INDEX "studio_project_members_memberId_idx" ON "studio_project_members"("memberId");
CREATE INDEX "home_project_stages_projectId_sortOrder_idx" ON "home_project_stages"("projectId", "sortOrder");
CREATE INDEX "home_checklist_items_stageId_sortOrder_idx" ON "home_checklist_items"("stageId", "sortOrder");
CREATE INDEX "home_materials_projectId_sortOrder_idx" ON "home_materials"("projectId", "sortOrder");
CREATE INDEX "studio_members_invitedById_idx" ON "studio_members"("invitedById");
CREATE INDEX "home_documents_supersedesId_idx" ON "home_documents"("supersedesId");

-- AddForeignKey
ALTER TABLE "studio_members" ADD CONSTRAINT "studio_members_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "studio_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "studio_project_members" ADD CONSTRAINT "studio_project_members_homeProjectId_fkey" FOREIGN KEY ("homeProjectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "studio_project_members" ADD CONSTRAINT "studio_project_members_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "studio_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "home_project_stages" ADD CONSTRAINT "home_project_stages_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "home_checklist_items" ADD CONSTRAINT "home_checklist_items_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "home_project_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "home_materials" ADD CONSTRAINT "home_materials_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "home_documents" ADD CONSTRAINT "home_documents_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "home_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-level security, as on every table: reached only through the server.
ALTER TABLE "studio_project_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_project_members" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_project_members" FROM anon, authenticated;

ALTER TABLE "home_project_stages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_project_stages" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_project_stages" FROM anon, authenticated;

ALTER TABLE "home_checklist_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_checklist_items" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_checklist_items" FROM anon, authenticated;

ALTER TABLE "home_materials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_materials" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_materials" FROM anon, authenticated;

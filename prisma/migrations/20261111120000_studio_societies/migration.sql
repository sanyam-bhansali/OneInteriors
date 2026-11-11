-- Societies (owner, 11 Nov 2026; Max plan): societies, their wings and notes,
-- and a society + wing link on each lead.
--
-- Expand only: three new tables, two new enums, two nullable columns on
-- studio_clients. No data is changed or removed.

-- CreateEnum
CREATE TYPE "SocietyPriority" AS ENUM ('P1', 'P2', 'P3');

-- CreateEnum
CREATE TYPE "SocietyHeat" AS ENUM ('HOT', 'WARM', 'COLD');

-- AlterTable
ALTER TABLE "studio_clients" ADD COLUMN     "societyId" TEXT,
ADD COLUMN     "wingId" TEXT;

-- CreateTable
CREATE TABLE "studio_societies" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "locality" TEXT,
    "builder" TEXT,
    "assignedToId" TEXT,
    "priorityOverride" "SocietyPriority",
    "priorityReason" TEXT,
    "heatOverride" "SocietyHeat",
    "heatReason" TEXT,
    "heatOverrideAt" TIMESTAMP(3),
    "sourceSheet" TEXT,
    "sourceImportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_societies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_society_wings" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "flats" INTEGER,
    "possessionOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_society_wings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_society_notes" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_society_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "studio_societies_studioId_assignedToId_idx" ON "studio_societies"("studioId", "assignedToId");

-- CreateIndex
CREATE UNIQUE INDEX "studio_societies_studioId_key_key" ON "studio_societies"("studioId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "studio_society_wings_societyId_name_key" ON "studio_society_wings"("societyId", "name");

-- CreateIndex
CREATE INDEX "studio_society_notes_societyId_createdAt_idx" ON "studio_society_notes"("societyId", "createdAt");

-- CreateIndex
CREATE INDEX "studio_clients_societyId_idx" ON "studio_clients"("societyId");

-- CreateIndex
CREATE INDEX "studio_clients_wingId_idx" ON "studio_clients"("wingId");

-- AddForeignKey
ALTER TABLE "studio_clients" ADD CONSTRAINT "studio_clients_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "studio_societies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_clients" ADD CONSTRAINT "studio_clients_wingId_fkey" FOREIGN KEY ("wingId") REFERENCES "studio_society_wings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_societies" ADD CONSTRAINT "studio_societies_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_societies" ADD CONSTRAINT "studio_societies_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "studio_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_society_wings" ADD CONSTRAINT "studio_society_wings_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "studio_societies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_society_notes" ADD CONSTRAINT "studio_society_notes_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "studio_societies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_society_notes" ADD CONSTRAINT "studio_society_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "studio_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Locked down like every other table: the app reads them through Prisma
-- as the table owner, never through the Supabase API.
ALTER TABLE "studio_societies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_societies" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_societies" FROM anon, authenticated;
ALTER TABLE "studio_society_wings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_society_wings" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_society_wings" FROM anon, authenticated;
ALTER TABLE "studio_society_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_society_notes" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_society_notes" FROM anon, authenticated;

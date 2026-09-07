-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'REVIEWING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- AlterTable
ALTER TABLE "studios" ADD COLUMN     "instagram" TEXT,
ADD COLUMN     "onboardingSteps" JSONB,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "studio_applications" (
    "id" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "tradeName" TEXT NOT NULL,
    "legalName" TEXT,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "website" TEXT,
    "instagram" TEXT,
    "city" TEXT NOT NULL DEFAULT 'pune',
    "localities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "gstin" TEXT,
    "yearsActive" INTEGER,
    "teamSize" INTEGER,
    "minProjectPaise" BIGINT,
    "maxProjectPaise" BIGINT,
    "about" TEXT,
    "howHeard" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "studioId" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "studio_applications_studioId_key" ON "studio_applications"("studioId");

-- CreateIndex
CREATE INDEX "studio_applications_status_createdAt_idx" ON "studio_applications"("status", "createdAt");

-- CreateIndex
CREATE INDEX "studio_applications_email_idx" ON "studio_applications"("email");


-- ─────────────────────────────────────────────────────────────────
-- RLS lockdown. Supabase's PostgREST exposes every table in `public`
-- to the anon and authenticated roles by default; Prisma-created
-- tables get no policies, so without this block the table is world
-- readable AND writable over HTTP. Run this in EVERY migration that
-- adds a table. Prisma connects as `postgres`, which has
-- rolbypassrls, so it is unaffected.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE "studio_applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_applications" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_applications" FROM anon, authenticated;

-- Studio OS Phase 1: Sales, from lead to booked (owner, 12 Oct 2026;
-- docs/studio-os/PHASE-1-SALES.md, built as docs/studio-os/PHASE-1-BUILT.md).
--
-- * `StudioRole` gains SALES: a salesperson who sees only their own leads.
-- * `ClientSource` gains FACEBOOK; `studio_lead_sources` holds a studio's own
--   source names (a lead using one is OTHER with `leadSourceId` set).
-- * `ClientEventKind` gains EDITED, FILE, MEETING, SALES_FINAL, BOOKED,
--   REFUNDED for the lead timeline.
-- * `studio_clients`: budget, the next meeting, the studio's own source, and
--   the booking (the introduction the project hangs off, when, and the column
--   it was in so a refund can put it back).
-- * `studio_client_files`: a lead's floor plan and other files (private
--   `lead-files` bucket; the bucket is created in Supabase, not here).
-- * `studio_quote_revisions`: each send of a quotation, frozen and numbered;
--   `studio_quotes.salesFinalRevisionId` and the schedule agreed with it.
-- * `studios.paymentTemplate`: the studio's payment stages for its sales.
-- * `home_projects.cancelledAt` / `cancelReason`: a refunded booking.
--
-- Expand-only: enum values, nullable columns, three new tables, indexes and
-- foreign keys. Nothing is dropped, renamed or backfilled. Not applied to
-- production by this change.

-- AlterEnum
ALTER TYPE "StudioRole" ADD VALUE 'SALES';

-- AlterEnum
ALTER TYPE "ClientSource" ADD VALUE 'FACEBOOK';

-- AlterEnum
ALTER TYPE "ClientEventKind" ADD VALUE 'EDITED';
ALTER TYPE "ClientEventKind" ADD VALUE 'FILE';
ALTER TYPE "ClientEventKind" ADD VALUE 'MEETING';
ALTER TYPE "ClientEventKind" ADD VALUE 'SALES_FINAL';
ALTER TYPE "ClientEventKind" ADD VALUE 'BOOKED';
ALTER TYPE "ClientEventKind" ADD VALUE 'REFUNDED';

-- CreateEnum
CREATE TYPE "ClientFileKind" AS ENUM ('FLOOR_PLAN', 'OTHER');

-- AlterTable
ALTER TABLE "studios" ADD COLUMN     "paymentTemplate" JSONB;

-- AlterTable
ALTER TABLE "home_projects" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelReason" TEXT;

-- AlterTable
ALTER TABLE "studio_clients" ADD COLUMN     "budgetPaise" BIGINT,
ADD COLUMN     "meetingAt" TIMESTAMP(3),
ADD COLUMN     "meetingNote" TEXT,
ADD COLUMN     "leadSourceId" TEXT,
ADD COLUMN     "bookedIntroductionId" TEXT,
ADD COLUMN     "bookedAt" TIMESTAMP(3),
ADD COLUMN     "preBookingStageId" TEXT;

-- AlterTable
ALTER TABLE "studio_quotes" ADD COLUMN     "salesFinalRevisionId" TEXT,
ADD COLUMN     "salesFinalSchedule" JSONB,
ADD COLUMN     "salesFinalAt" TIMESTAMP(3),
ADD COLUMN     "salesFinalById" TEXT;

-- CreateTable
CREATE TABLE "studio_client_files" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kind" "ClientFileKind" NOT NULL DEFAULT 'OTHER',
    "storagePath" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "uploadedByName" TEXT,
    "reading" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_client_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_lead_sources" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_lead_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_quote_revisions" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "n" INTEGER NOT NULL,
    "lines" JSONB NOT NULL,
    "terms" JSONB NOT NULL,
    "totalPaise" BIGINT NOT NULL,
    "totals" JSONB NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentById" TEXT,
    "sentByName" TEXT,

    CONSTRAINT "studio_quote_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "studio_clients_bookedIntroductionId_key" ON "studio_clients"("bookedIntroductionId");

-- CreateIndex
CREATE INDEX "studio_clients_studioId_meetingAt_idx" ON "studio_clients"("studioId", "meetingAt");

-- CreateIndex
CREATE INDEX "studio_clients_deletedAt_idx" ON "studio_clients"("deletedAt");

-- CreateIndex
CREATE INDEX "studio_clients_leadSourceId_idx" ON "studio_clients"("leadSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "studio_quotes_salesFinalRevisionId_key" ON "studio_quotes"("salesFinalRevisionId");

-- CreateIndex
CREATE INDEX "studio_client_files_clientId_createdAt_idx" ON "studio_client_files"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "studio_client_files_studioId_createdAt_idx" ON "studio_client_files"("studioId", "createdAt");

-- CreateIndex
CREATE INDEX "studio_client_files_uploadedById_idx" ON "studio_client_files"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "studio_lead_sources_studioId_name_key" ON "studio_lead_sources"("studioId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "studio_quote_revisions_quoteId_n_key" ON "studio_quote_revisions"("quoteId", "n");

-- CreateIndex
CREATE INDEX "studio_quote_revisions_studioId_sentAt_idx" ON "studio_quote_revisions"("studioId", "sentAt");

-- CreateIndex
CREATE INDEX "studio_quote_revisions_sentById_idx" ON "studio_quote_revisions"("sentById");

-- AddForeignKey
ALTER TABLE "studio_clients" ADD CONSTRAINT "studio_clients_leadSourceId_fkey" FOREIGN KEY ("leadSourceId") REFERENCES "studio_lead_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_quotes" ADD CONSTRAINT "studio_quotes_salesFinalRevisionId_fkey" FOREIGN KEY ("salesFinalRevisionId") REFERENCES "studio_quote_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_client_files" ADD CONSTRAINT "studio_client_files_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_client_files" ADD CONSTRAINT "studio_client_files_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "studio_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_client_files" ADD CONSTRAINT "studio_client_files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "studio_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_lead_sources" ADD CONSTRAINT "studio_lead_sources_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_quote_revisions" ADD CONSTRAINT "studio_quote_revisions_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_quote_revisions" ADD CONSTRAINT "studio_quote_revisions_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "studio_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_quote_revisions" ADD CONSTRAINT "studio_quote_revisions_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "studio_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- RLS (HANDOVER: every migration that adds a table carries it). Prisma
-- connects as a role that bypasses RLS; PostgREST's anon/authenticated get
-- nothing.
ALTER TABLE "studio_client_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_client_files" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_client_files" FROM anon, authenticated;

ALTER TABLE "studio_lead_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_lead_sources" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_lead_sources" FROM anon, authenticated;

ALTER TABLE "studio_quote_revisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_quote_revisions" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_quote_revisions" FROM anon, authenticated;

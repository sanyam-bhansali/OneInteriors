-- Quotation requests (owner, 22 Oct 2026; docs/studio-os/QUOTE-REQUESTS.md).
-- When a salesperson adds a floor plan to a lead, or presses "Request
-- quotation", a request is made and handed out IN TURNS to the studio's
-- builders (sales permission quotes.build, or the studio's "Who builds
-- quotations" list), so nobody builds the same quotation twice.
--
-- Expand only: two enums, one new table, two new columns on studios.
-- Nothing dropped, nothing backfilled, nothing rewritten.
--
-- studios."quoteBuilderIds": the studio's explicit turn order. Empty (the
-- default for every studio) = everyone whose sales role has "Builds
-- quotations"; an owner is in the turns only when listed.
-- studios."quoteTurnLastId": the turn cursor, the builder the last request
-- went to in turn. Moved in the same transaction as the insert, under a row
-- lock on the studio (SELECT ... FOR UPDATE), so two requests at the same
-- instant go to two different people.
--
-- studio_quote_requests: at most one OPEN or IN_PROGRESS request per lead,
-- enforced by the partial unique index below (Prisma cannot express a
-- partial index, so it is here and noted on the model). A second floor plan
-- adds its file id to the same request.
--
-- RLS on, no policies: reached only through Prisma on the server, like every
-- studio table.

-- CreateEnum
CREATE TYPE "QuoteRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuoteRequestReason" AS ENUM ('FLOOR_PLAN', 'REQUESTED');

-- AlterTable
ALTER TABLE "studios" ADD COLUMN "quoteBuilderIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "studios" ADD COLUMN "quoteTurnLastId" TEXT;

-- CreateTable
CREATE TABLE "studio_quote_requests" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "requestedById" TEXT,
    "assignedToId" TEXT,
    "byTurn" BOOLEAN NOT NULL DEFAULT true,
    "status" "QuoteRequestStatus" NOT NULL DEFAULT 'OPEN',
    "reason" "QuoteRequestReason" NOT NULL,
    "quoteId" TEXT,
    "fileIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "cancelNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "doneAt" TIMESTAMP(3),

    CONSTRAINT "studio_quote_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "studio_quote_requests_studioId_assignedToId_status_idx" ON "studio_quote_requests"("studioId", "assignedToId", "status");

-- CreateIndex
CREATE INDEX "studio_quote_requests_studioId_status_createdAt_idx" ON "studio_quote_requests"("studioId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "studio_quote_requests_clientId_idx" ON "studio_quote_requests"("clientId");

-- CreateIndex
CREATE INDEX "studio_quote_requests_quoteId_idx" ON "studio_quote_requests"("quoteId");

-- One open request per lead (OPEN or IN_PROGRESS). Partial: Prisma cannot express it.
CREATE UNIQUE INDEX "studio_quote_requests_one_open_per_lead" ON "studio_quote_requests"("clientId") WHERE "status" IN ('OPEN', 'IN_PROGRESS');

-- AddForeignKey
ALTER TABLE "studio_quote_requests" ADD CONSTRAINT "studio_quote_requests_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_quote_requests" ADD CONSTRAINT "studio_quote_requests_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "studio_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_quote_requests" ADD CONSTRAINT "studio_quote_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "studio_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_quote_requests" ADD CONSTRAINT "studio_quote_requests_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "studio_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_quote_requests" ADD CONSTRAINT "studio_quote_requests_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "studio_quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Row level security: closed to the anon and authenticated roles.
ALTER TABLE "studio_quote_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_quote_requests" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_quote_requests" FROM anon, authenticated;

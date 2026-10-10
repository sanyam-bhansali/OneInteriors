-- Quotation reading moves to the owner's Claude app; its output is a
-- product-master draft that ops approves, and the studio confirms before the
-- quotation builder opens (owner, 10 Oct 2026).

-- AlterTable
ALTER TABLE "studios" ADD COLUMN "ratesFilledAt" TIMESTAMP(3),
ADD COLUMN "ratesConfirmedAt" TIMESTAMP(3);

-- A studio that has already written a quotation keeps its builder: it has
-- been working with its own rates, and shutting it out now would take away a
-- tool it was using.
UPDATE "studios" s
SET "ratesConfirmedAt" = NOW()
WHERE EXISTS (SELECT 1 FROM "studio_quotes" q WHERE q."studioId" = s."id");

-- AlterTable
ALTER TABLE "studio_products" ADD COLUMN "rules" JSONB;

-- CreateTable
CREATE TABLE "studio_product_drafts" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "archiveId" TEXT,
    "runId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" "StudioWorkCode" NOT NULL DEFAULT 'MODULAR',
    "unit" "QuoteUnit" NOT NULL DEFAULT 'AREA',
    "details" TEXT,
    "ratePaise" BIGINT NOT NULL,
    "rooms" TEXT[],
    "defaultWidthMm" INTEGER,
    "defaultHeightMm" INTEGER,
    "defaultQty" INTEGER,
    "inStandardBuild" BOOLEAN NOT NULL DEFAULT false,
    "rules" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "fromQuotations" INTEGER NOT NULL DEFAULT 0,
    "evidence" JSONB,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "studio_product_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "studio_product_drafts_studioId_state_idx" ON "studio_product_drafts"("studioId", "state");

-- AddForeignKey
ALTER TABLE "studio_product_drafts" ADD CONSTRAINT "studio_product_drafts_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_product_drafts" ADD CONSTRAINT "studio_product_drafts_archiveId_fkey" FOREIGN KEY ("archiveId") REFERENCES "quotation_archives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Same lock-down as every other table: the app reaches it through Prisma on
-- the server, never through the public API.
ALTER TABLE "studio_product_drafts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_product_drafts" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_product_drafts" FROM anon, authenticated;

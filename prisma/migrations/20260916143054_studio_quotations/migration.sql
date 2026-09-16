-- CreateEnum
CREATE TYPE "QuoteUnit" AS ENUM ('AREA', 'SQFT', 'RFT', 'UNIT');

-- CreateEnum
CREATE TYPE "StudioWorkCode" AS ENUM ('MODULAR', 'ONSITE');

-- CreateEnum
CREATE TYPE "StudioQuoteStage" AS ENUM ('SALES', 'DESIGN');

-- CreateEnum
CREATE TYPE "StudioQuoteStatus" AS ENUM ('DRAFT', 'ISSUED', 'ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "studio_branding" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "addressLine" TEXT,
    "city" TEXT NOT NULL DEFAULT 'Pune',
    "pincode" TEXT,
    "gstin" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "logoPath" TEXT,
    "accentHex" TEXT NOT NULL DEFAULT '#1F5C4D',
    "welcomeNote" TEXT,
    "terms" TEXT,
    "feeBps" INTEGER NOT NULL DEFAULT 700,
    "discountBps" INTEGER NOT NULL DEFAULT 0,
    "bookingAdvancePaise" BIGINT NOT NULL DEFAULT 2500000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_branding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_products" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" "StudioWorkCode" NOT NULL DEFAULT 'MODULAR',
    "unit" "QuoteUnit" NOT NULL DEFAULT 'AREA',
    "details" TEXT,
    "ratePaise" BIGINT NOT NULL,
    "rooms" TEXT[],
    "defaultWidthMm" INTEGER,
    "defaultHeightMm" INTEGER,
    "defaultQty" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_quotes" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "stage" "StudioQuoteStage" NOT NULL DEFAULT 'SALES',
    "status" "StudioQuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT,
    "clientEmail" TEXT,
    "society" TEXT,
    "locality" TEXT,
    "config" TEXT,
    "carpetSqft" INTEGER,
    "briefId" TEXT,
    "introductionId" TEXT,
    "feeBps" INTEGER NOT NULL,
    "discountBps" INTEGER NOT NULL,
    "onSpotPaise" BIGINT NOT NULL DEFAULT 0,
    "bookingAdvancePaise" BIGINT NOT NULL,
    "welcomeNote" TEXT,
    "terms" TEXT,
    "issuedOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_quote_lines" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "code" "StudioWorkCode" NOT NULL,
    "unit" "QuoteUnit" NOT NULL,
    "details" TEXT,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "qtyMilli" INTEGER,
    "ratePaise" BIGINT NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "studio_quote_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "studio_branding_studioId_key" ON "studio_branding"("studioId");

-- CreateIndex
CREATE INDEX "studio_products_studioId_sortOrder_idx" ON "studio_products"("studioId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "studio_products_studioId_name_key" ON "studio_products"("studioId", "name");

-- CreateIndex
CREATE INDEX "studio_quotes_studioId_status_updatedAt_idx" ON "studio_quotes"("studioId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "studio_quotes_studioId_number_key" ON "studio_quotes"("studioId", "number");

-- CreateIndex
CREATE INDEX "studio_quote_lines_quoteId_sortOrder_idx" ON "studio_quote_lines"("quoteId", "sortOrder");

-- AddForeignKey
ALTER TABLE "studio_branding" ADD CONSTRAINT "studio_branding_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_products" ADD CONSTRAINT "studio_products_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_quotes" ADD CONSTRAINT "studio_quotes_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_quote_lines" ADD CONSTRAINT "studio_quote_lines_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "studio_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────
-- RLS lockdown. Supabase's PostgREST exposes every table in `public`
-- to the anon and authenticated roles by default; Prisma-created
-- tables get no policies, so without this block the table is world
-- readable AND writable over HTTP. Run this in EVERY migration that
-- adds a table. Prisma connects as `postgres`, which has
-- rolbypassrls, so it is unaffected.
--
-- These four are the most sensitive tables added to this database so
-- far, and it is worth being explicit about why:
--
--   studio_products     is a studio's rate card in full — every product
--                       it sells and what it charges for it. A rival
--                       studio reading this table learns their entire
--                       pricing. `rate-card.ts` already refuses to
--                       publish even an AVERAGE of these numbers, on
--                       the grounds that with a roster this size a
--                       median is just telling each studio what the
--                       other charges. Leaving the raw table readable
--                       would make that refusal meaningless.
--
--   studio_quotes       carries a named client, their phone, their
--   studio_quote_lines  address and what they are about to spend —
--                       for projects that in most cases have nothing
--                       to do with us. We are a processor of this data,
--                       not its owner.
--
--   studio_branding     holds a GSTIN and a registered address.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE "studio_branding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_branding" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_branding" FROM anon, authenticated;

ALTER TABLE "studio_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_products" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_products" FROM anon, authenticated;

ALTER TABLE "studio_quotes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_quotes" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_quotes" FROM anon, authenticated;

ALTER TABLE "studio_quote_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_quote_lines" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_quote_lines" FROM anon, authenticated;

-- CreateEnum
CREATE TYPE "ClientSource" AS ENUM ('ONE_INTERIORS', 'REFERRAL', 'REPEAT_CLIENT', 'INSTAGRAM', 'WEBSITE', 'WALK_IN', 'ARCHITECT', 'OTHER');

-- CreateEnum
CREATE TYPE "ClientStage" AS ENUM ('ENQUIRY', 'QUOTED', 'BOOKED', 'IN_PROGRESS', 'HANDED_OVER', 'LOST');

-- CreateEnum
CREATE TYPE "LostReason" AS ENUM ('BUDGET', 'TIMELINE', 'WENT_ELSEWHERE', 'NO_RESPONSE', 'NOT_SERIOUS', 'POSTPONED', 'OTHER');

-- CreateEnum
CREATE TYPE "ProjectStage" AS ENUM ('DESIGN', 'EXECUTION', 'FINISHING', 'HANDOVER', 'CLOSED');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('BANK', 'UPI', 'CASH', 'CHEQUE');

-- AlterTable
ALTER TABLE "studio_quotes" ADD COLUMN     "clientId" TEXT;

-- CreateTable
CREATE TABLE "studio_clients" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "society" TEXT,
    "locality" TEXT,
    "city" TEXT NOT NULL DEFAULT 'Pune',
    "config" TEXT,
    "carpetSqft" INTEGER,
    "source" "ClientSource" NOT NULL DEFAULT 'OTHER',
    "sourceNote" TEXT,
    "stage" "ClientStage" NOT NULL DEFAULT 'ENQUIRY',
    "lostReason" "LostReason",
    "lostNote" TEXT,
    "nextAction" TEXT,
    "nextActionOn" TIMESTAMP(3),
    "briefId" TEXT,
    "introductionId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_projects" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "ProjectStage" NOT NULL DEFAULT 'DESIGN',
    "contractPaise" BIGINT,
    "quoteId" TEXT,
    "startedOn" TIMESTAMP(3),
    "targetDate" TIMESTAMP(3),
    "handedOverOn" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_vendors" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "phone" TEXT,
    "gstin" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_vendor_rates" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "unit" "QuoteUnit" NOT NULL DEFAULT 'SQFT',
    "ratePaise" BIGINT NOT NULL,

    CONSTRAINT "studio_vendor_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_work_orders" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "issuedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueOn" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_work_order_lines" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" "QuoteUnit" NOT NULL,
    "qtyMilli" INTEGER,
    "ratePaise" BIGINT NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "studio_work_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_vendor_payments" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "paidOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amountPaise" BIGINT NOT NULL,
    "mode" "PaymentMode" NOT NULL DEFAULT 'BANK',
    "reference" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_vendor_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "studio_clients_studioId_stage_nextActionOn_idx" ON "studio_clients"("studioId", "stage", "nextActionOn");

-- CreateIndex
CREATE UNIQUE INDEX "studio_clients_studioId_introductionId_key" ON "studio_clients"("studioId", "introductionId");

-- CreateIndex
CREATE INDEX "studio_projects_studioId_stage_idx" ON "studio_projects"("studioId", "stage");

-- CreateIndex
CREATE INDEX "studio_vendors_studioId_trade_idx" ON "studio_vendors"("studioId", "trade");

-- CreateIndex
CREATE UNIQUE INDEX "studio_vendors_studioId_name_key" ON "studio_vendors"("studioId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "studio_vendor_rates_vendorId_item_key" ON "studio_vendor_rates"("vendorId", "item");

-- CreateIndex
CREATE INDEX "studio_work_orders_studioId_projectId_idx" ON "studio_work_orders"("studioId", "projectId");

-- CreateIndex
CREATE INDEX "studio_work_orders_vendorId_idx" ON "studio_work_orders"("vendorId");

-- CreateIndex
CREATE INDEX "studio_work_order_lines_workOrderId_sortOrder_idx" ON "studio_work_order_lines"("workOrderId", "sortOrder");

-- CreateIndex
CREATE INDEX "studio_vendor_payments_workOrderId_paidOn_idx" ON "studio_vendor_payments"("workOrderId", "paidOn");

-- AddForeignKey
ALTER TABLE "studio_quotes" ADD CONSTRAINT "studio_quotes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "studio_clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_clients" ADD CONSTRAINT "studio_clients_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_projects" ADD CONSTRAINT "studio_projects_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_projects" ADD CONSTRAINT "studio_projects_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "studio_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_vendors" ADD CONSTRAINT "studio_vendors_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_vendor_rates" ADD CONSTRAINT "studio_vendor_rates_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "studio_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_work_orders" ADD CONSTRAINT "studio_work_orders_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_work_orders" ADD CONSTRAINT "studio_work_orders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "studio_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_work_orders" ADD CONSTRAINT "studio_work_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "studio_vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_work_order_lines" ADD CONSTRAINT "studio_work_order_lines_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "studio_work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_vendor_payments" ADD CONSTRAINT "studio_vendor_payments_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "studio_work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────
-- RLS lockdown. Supabase's PostgREST exposes every table in `public`
-- to the anon and authenticated roles by default; Prisma-created
-- tables get no policies, so without this block the table is world
-- readable AND writable over HTTP. Run this in EVERY migration that
-- adds a table. Prisma connects as `postgres`, which has
-- rolbypassrls, so it is unaffected.
--
-- These seven are the most sensitive set added to this database, and
-- two of them are worse than anything before:
--
--   studio_vendor_rates   is a studio's COST BASE — what each trade
--                         charges them, per item. Put that beside
--                         studio_products, which is what they charge
--                         a client, and a reader has their margin on
--                         every line of work they do. There is no
--                         circumstance in which one studio may read
--                         another's, and the marketplace's own rule
--                         against publishing even an AVERAGE of a
--                         rate card would be meaningless if the raw
--                         tables were reachable.
--
--   studio_vendor_payments is money that has left the business:
--                         amounts, dates, modes and UTR references.
--
--   studio_clients        carries named people, their phone numbers
--                         and their addresses, for projects that in
--                         most cases have nothing to do with us. We
--                         are a processor of this, not its owner, and
--                         a leak here is the studio's breach to
--                         explain to their client as well as ours.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE "studio_clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_clients" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_clients" FROM anon, authenticated;

ALTER TABLE "studio_projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_projects" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_projects" FROM anon, authenticated;

ALTER TABLE "studio_vendors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_vendors" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_vendors" FROM anon, authenticated;

ALTER TABLE "studio_vendor_rates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_vendor_rates" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_vendor_rates" FROM anon, authenticated;

ALTER TABLE "studio_work_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_work_orders" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_work_orders" FROM anon, authenticated;

ALTER TABLE "studio_work_order_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_work_order_lines" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_work_order_lines" FROM anon, authenticated;

ALTER TABLE "studio_vendor_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_vendor_payments" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_vendor_payments" FROM anon, authenticated;

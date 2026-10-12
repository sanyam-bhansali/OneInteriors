-- Studio OS Phase 3: Site crews (owner, 12 Oct 2026; docs/studio-os/PHASE-3-EXECUTION.md,
-- built as docs/studio-os/PHASE-3-BUILT.md). Hauspire's Vendor Ledger, ported.
--
-- * `studios.crewSettings`: trades, routing rules, rate templates, due days,
--   labour-margin target, advance limit, installation rate, execution payment locks.
-- * `studio_vendors`: a crew's kind (temporary / permanent), trades, contact,
--   PAN (unique per studio), Aadhaar LAST 4 ONLY, KYC scan paths (private
--   bucket crew-kyc), payee details, archived.
-- * `studio_vendor_rates`: crew unit (sq ft, running ft, point, number, lump
--   sum), trade, order; the rate may be blank (agree per job).
-- * New: `home_work_orders` (one per crew per project), `home_work_order_lines`
--   (frozen quote figures and rates), `home_crew_payments` (append-only;
--   corrections are new rows).
--
-- Expand-only: six enums, nullable or defaulted columns, one NOT NULL dropped
-- (a rate may now be blank), three new tables, indexes and foreign keys.
-- Nothing is dropped, renamed or backfilled. Not applied to production by
-- this change. The old studio_work_orders / studio_vendor_payments stay as
-- they are (read-only in the app).

-- CreateEnum
CREATE TYPE "CrewKind" AS ENUM ('TEMPORARY', 'PERMANENT');

-- CreateEnum
CREATE TYPE "CrewUnit" AS ENUM ('SQFT', 'RFT', 'POINT', 'NOS', 'LUMP');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('DRAFT', 'ISSUED', 'IN_PROGRESS', 'WORK_DONE', 'SETTLED');

-- CreateEnum
CREATE TYPE "CrewQtySource" AS ENUM ('QUOTE', 'ESTIMATE', 'SITE', 'MANUAL', 'INVOICE');

-- CreateEnum
CREATE TYPE "CarpentryMode" AS ENUM ('INSTALL', 'FULL');

-- CreateEnum
CREATE TYPE "CrewPaymentKind" AS ENUM ('PAYMENT', 'ADVANCE', 'CORRECTION');

-- AlterTable
ALTER TABLE "studios" ADD COLUMN     "crewSettings" JSONB;

-- AlterTable
ALTER TABLE "studio_vendors" ADD COLUMN     "aadhaarDocPath" TEXT,
ADD COLUMN     "aadhaarLast4" TEXT,
ADD COLUMN     "address" TEXT,
ADD COLUMN     "agreementDocPath" TEXT,
ADD COLUMN     "altPhone" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankIfsc" TEXT,
ADD COLUMN     "kind" "CrewKind" NOT NULL DEFAULT 'TEMPORARY',
ADD COLUMN     "kycCheckedAt" TIMESTAMP(3),
ADD COLUMN     "kycCheckedById" TEXT,
ADD COLUMN     "panDocPath" TEXT,
ADD COLUMN     "panNumber" TEXT,
ADD COLUMN     "trades" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "upiId" TEXT,
ADD COLUMN     "workingSince" TEXT;

-- AlterTable
ALTER TABLE "studio_vendor_rates" ADD COLUMN     "crewUnit" "CrewUnit",
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trade" TEXT,
ALTER COLUMN "ratePaise" DROP NOT NULL;

-- CreateTable
CREATE TABLE "home_work_orders" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "trades" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "dueOn" DATE,
    "sourceQuoteId" TEXT,
    "sourceKind" TEXT,
    "stepIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "workDoneAt" TIMESTAMP(3),
    "workDoneByName" TEXT,
    "settledAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_work_order_lines" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "quoteLineId" TEXT,
    "room" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "code" "StudioWorkCode",
    "details" TEXT,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "quotedAmountPaise" BIGINT,
    "trade" TEXT NOT NULL,
    "guessed" BOOLEAN NOT NULL DEFAULT false,
    "item" TEXT NOT NULL,
    "unit" "CrewUnit" NOT NULL,
    "ratePaise" BIGINT,
    "rateEdited" BOOLEAN NOT NULL DEFAULT false,
    "carpentry" "CarpentryMode",
    "qtyMilli" INTEGER,
    "measuredQtyMilli" INTEGER,
    "qtySource" "CrewQtySource" NOT NULL DEFAULT 'QUOTE',
    "agreedPaise" BIGINT,
    "isExtra" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_work_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_crew_payments" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "kind" "CrewPaymentKind" NOT NULL DEFAULT 'PAYMENT',
    "amountPaise" BIGINT NOT NULL,
    "mode" "PaymentMode" NOT NULL DEFAULT 'UPI',
    "reference" TEXT,
    "note" TEXT,
    "paidOn" DATE NOT NULL,
    "byId" TEXT,
    "byName" TEXT NOT NULL,
    "correctsId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "home_crew_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "home_work_orders_studioId_status_idx" ON "home_work_orders"("studioId", "status");

-- CreateIndex
CREATE INDEX "home_work_orders_vendorId_idx" ON "home_work_orders"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "home_work_orders_projectId_vendorId_key" ON "home_work_orders"("projectId", "vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "home_work_orders_projectId_number_key" ON "home_work_orders"("projectId", "number");

-- CreateIndex
CREATE INDEX "home_work_order_lines_workOrderId_sortOrder_idx" ON "home_work_order_lines"("workOrderId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "home_crew_payments_correctsId_key" ON "home_crew_payments"("correctsId");

-- CreateIndex
CREATE INDEX "home_crew_payments_workOrderId_paidOn_idx" ON "home_crew_payments"("workOrderId", "paidOn");

-- CreateIndex
CREATE INDEX "home_crew_payments_studioId_paidOn_idx" ON "home_crew_payments"("studioId", "paidOn");

-- CreateIndex
CREATE UNIQUE INDEX "studio_vendors_studioId_panNumber_key" ON "studio_vendors"("studioId", "panNumber");

-- AddForeignKey
ALTER TABLE "home_work_orders" ADD CONSTRAINT "home_work_orders_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_work_orders" ADD CONSTRAINT "home_work_orders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_work_orders" ADD CONSTRAINT "home_work_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "studio_vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_work_order_lines" ADD CONSTRAINT "home_work_order_lines_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "home_work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_crew_payments" ADD CONSTRAINT "home_crew_payments_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_crew_payments" ADD CONSTRAINT "home_crew_payments_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "home_work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Lock the new tables down like every other: no access for the Supabase anon
-- and authenticated roles (Prisma connects as the owner).
ALTER TABLE "home_work_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_work_orders" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_work_orders" FROM anon, authenticated;

ALTER TABLE "home_work_order_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_work_order_lines" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_work_order_lines" FROM anon, authenticated;

ALTER TABLE "home_crew_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_crew_payments" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_crew_payments" FROM anon, authenticated;

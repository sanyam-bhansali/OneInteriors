-- Change orders and client digital sign-off (owner, 15 Oct 2026).
-- Expand only: one enum, three nullable/defaulted columns on existing tables,
-- four new tables. Nothing dropped, nothing backfilled.
--
-- home_change_orders (+ lines, + events): extra work after design sign-off.
-- DRAFT -> SENT_TO_CLIENT -> APPROVED | DECLINED -> PAID -> RELEASED, or
-- CANCELLED by the studio before the client answers. Every move is a row in
-- home_change_order_events (append-only). Approving writes one
-- home_quote_changes row (changeOrderId set) on the final payment stage; the
-- money for it is a home_project_payments row with changeOrderId set.
-- home_project_closures.changeOrdersPaise: approved change orders on the
-- closure, apart from the closure's own extra lines.
--
-- home_quote_signoffs: the client's digital sign-off of one quotation
-- revision (sales final or design final): who, when, IP, user agent and a
-- SHA-256 of the revision's stored content. Filled once, never deleted.
--
-- RLS on, no policies: reached only through Prisma on the server, like every
-- studio table.


-- CreateEnum
CREATE TYPE "ChangeOrderStatus" AS ENUM ('DRAFT', 'SENT_TO_CLIENT', 'APPROVED', 'DECLINED', 'PAID', 'RELEASED', 'CANCELLED');

-- AlterTable
ALTER TABLE "home_project_closures" ADD COLUMN     "changeOrdersPaise" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "home_project_payments" ADD COLUMN     "changeOrderId" TEXT;

-- AlterTable
ALTER TABLE "home_quote_changes" ADD COLUMN     "changeOrderId" TEXT;

-- CreateTable
CREATE TABLE "home_change_orders" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT,
    "status" "ChangeOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "quoteId" TEXT,
    "discountBps" INTEGER NOT NULL DEFAULT 0,
    "gstBps" INTEGER NOT NULL DEFAULT 0,
    "workPaise" BIGINT NOT NULL DEFAULT 0,
    "discountPaise" BIGINT NOT NULL DEFAULT 0,
    "gstPaise" BIGINT NOT NULL DEFAULT 0,
    "totalPaise" BIGINT NOT NULL DEFAULT 0,
    "photoDocumentId" TEXT,
    "createdById" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "declineReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "releasedById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_change_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_change_order_lines" (
    "id" TEXT NOT NULL,
    "changeOrderId" TEXT NOT NULL,
    "productId" TEXT,
    "room" TEXT,
    "product" TEXT NOT NULL,
    "details" TEXT,
    "code" "StudioWorkCode" NOT NULL,
    "unit" "QuoteUnit" NOT NULL,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "qtyMilli" INTEGER,
    "ratePaise" BIGINT NOT NULL DEFAULT 0,
    "amountPaise" BIGINT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "home_change_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_change_order_events" (
    "id" TEXT NOT NULL,
    "changeOrderId" TEXT NOT NULL,
    "fromStatus" "ChangeOrderStatus",
    "toStatus" "ChangeOrderStatus" NOT NULL,
    "actorType" "ProjectActorType" NOT NULL,
    "actorId" TEXT,
    "text" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "home_change_order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_quote_signoffs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "revisionN" INTEGER NOT NULL,
    "totalPaise" BIGINT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "signedById" TEXT,
    "signerName" TEXT,
    "agreedText" TEXT,
    "signedHash" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "lockerDocumentId" TEXT,

    CONSTRAINT "home_quote_signoffs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "home_change_orders_projectId_status_idx" ON "home_change_orders"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "home_change_orders_projectId_number_key" ON "home_change_orders"("projectId", "number");

-- CreateIndex
CREATE INDEX "home_change_order_lines_changeOrderId_idx" ON "home_change_order_lines"("changeOrderId");

-- CreateIndex
CREATE INDEX "home_change_order_events_changeOrderId_at_idx" ON "home_change_order_events"("changeOrderId", "at");

-- CreateIndex
CREATE INDEX "home_quote_signoffs_projectId_requestedAt_idx" ON "home_quote_signoffs"("projectId", "requestedAt");

-- CreateIndex
CREATE INDEX "home_quote_signoffs_revisionId_idx" ON "home_quote_signoffs"("revisionId");

-- CreateIndex
CREATE INDEX "home_project_payments_changeOrderId_idx" ON "home_project_payments"("changeOrderId");

-- CreateIndex
CREATE INDEX "home_quote_changes_changeOrderId_idx" ON "home_quote_changes"("changeOrderId");

-- AddForeignKey
ALTER TABLE "home_change_orders" ADD CONSTRAINT "home_change_orders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_change_order_lines" ADD CONSTRAINT "home_change_order_lines_changeOrderId_fkey" FOREIGN KEY ("changeOrderId") REFERENCES "home_change_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_change_order_events" ADD CONSTRAINT "home_change_order_events_changeOrderId_fkey" FOREIGN KEY ("changeOrderId") REFERENCES "home_change_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_quote_signoffs" ADD CONSTRAINT "home_quote_signoffs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_quote_signoffs" ADD CONSTRAINT "home_quote_signoffs_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "studio_quote_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_project_payments" ADD CONSTRAINT "home_project_payments_changeOrderId_fkey" FOREIGN KEY ("changeOrderId") REFERENCES "home_change_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_quote_changes" ADD CONSTRAINT "home_quote_changes_changeOrderId_fkey" FOREIGN KEY ("changeOrderId") REFERENCES "home_change_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Row level security: closed to the anon and authenticated roles.
ALTER TABLE "home_change_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_change_orders" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_change_orders" FROM anon, authenticated;

ALTER TABLE "home_change_order_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_change_order_lines" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_change_order_lines" FROM anon, authenticated;

ALTER TABLE "home_change_order_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_change_order_events" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_change_order_events" FROM anon, authenticated;

ALTER TABLE "home_quote_signoffs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_quote_signoffs" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_quote_signoffs" FROM anon, authenticated;

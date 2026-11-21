-- Invoices per payment stage and the statement (owner, 21 Nov 2026;
-- modules/project/invoice-rules.ts). Expand only: new nullable columns on
-- studio_branding, and one new table for the invoice numbers.

ALTER TABLE "studio_branding" ADD COLUMN "signatoryName" TEXT;
ALTER TABLE "studio_branding" ADD COLUMN "signatoryDesignation" TEXT;
ALTER TABLE "studio_branding" ADD COLUMN "signaturePath" TEXT;
ALTER TABLE "studio_branding" ADD COLUMN "stampPath" TEXT;
ALTER TABLE "studio_branding" ADD COLUMN "invoicePrefix" TEXT;
ALTER TABLE "studio_branding" ADD COLUMN "sacCode" TEXT;
ALTER TABLE "studio_branding" ADD COLUMN "bankAccountName" TEXT;
ALTER TABLE "studio_branding" ADD COLUMN "bankAccountNumber" TEXT;
ALTER TABLE "studio_branding" ADD COLUMN "bankIfsc" TEXT;
ALTER TABLE "studio_branding" ADD COLUMN "bankName" TEXT;

-- CreateTable
CREATE TABLE "studio_invoices" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stageIndex" INTEGER NOT NULL,
    "number" TEXT NOT NULL,
    "fyStart" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "studio_invoices_projectId_stageIndex_key" ON "studio_invoices"("projectId", "stageIndex");

-- CreateIndex
CREATE UNIQUE INDEX "studio_invoices_studioId_fyStart_seq_key" ON "studio_invoices"("studioId", "fyStart", "seq");

-- AddForeignKey
ALTER TABLE "studio_invoices" ADD CONSTRAINT "studio_invoices_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_invoices" ADD CONSTRAINT "studio_invoices_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row level security: closed to the anon and authenticated roles (the app reaches it through the server only).
ALTER TABLE "studio_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_invoices" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_invoices" FROM anon, authenticated;

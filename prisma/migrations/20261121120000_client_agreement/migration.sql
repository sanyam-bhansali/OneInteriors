-- The client agreement (owner, 21 Nov 2026; docs/studio-os/CLIENT-AGREEMENT.md):
-- the studio's template, filled per client and e-signed at design closure.
-- Additive only.

ALTER TABLE "studio_branding" ADD COLUMN "clientAgreement" TEXT;
ALTER TABLE "studio_branding" ADD COLUMN "agreementSignatory" TEXT;
ALTER TABLE "studio_branding" ADD COLUMN "agreementSignatoryRole" TEXT;

-- CreateEnum
CREATE TYPE "ClientAgreementStatus" AS ENUM ('SENT', 'SIGNED', 'CANCELLED');

-- CreateTable
CREATE TABLE "client_agreements" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "quoteId" TEXT,
    "status" "ClientAgreementStatus" NOT NULL DEFAULT 'SENT',
    "fields" JSONB NOT NULL,
    "text" TEXT NOT NULL,
    "pdfPath" TEXT,
    "signedPath" TEXT,
    "documentId" TEXT,
    "signedVia" TEXT,
    "provider" TEXT,
    "providerRequestId" TEXT,
    "signUrl" TEXT,
    "signerName" TEXT,
    "sentById" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_agreements_providerRequestId_key" ON "client_agreements"("providerRequestId");

-- CreateIndex
CREATE INDEX "client_agreements_projectId_status_idx" ON "client_agreements"("projectId", "status");

-- CreateIndex
CREATE INDEX "client_agreements_studioId_status_idx" ON "client_agreements"("studioId", "status");

-- AddForeignKey
ALTER TABLE "client_agreements" ADD CONSTRAINT "client_agreements_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_agreements" ADD CONSTRAINT "client_agreements_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row level security: closed to the anon and authenticated roles (the app reaches it through the server only).
ALTER TABLE "client_agreements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "client_agreements" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "client_agreements" FROM anon, authenticated;

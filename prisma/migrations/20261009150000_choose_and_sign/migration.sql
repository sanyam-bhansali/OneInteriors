-- v79 "Choose & sign": the customer signs the final quote in the app.
-- Additive and nullable: trackers ops started before this keep working.
ALTER TABLE "home_projects" ADD COLUMN "signedAt" TIMESTAMP(3);
ALTER TABLE "home_projects" ADD COLUMN "signedQuoteId" TEXT;
ALTER TABLE "home_projects" ADD COLUMN "contractPaise" BIGINT;
ALTER TABLE "home_projects" ADD COLUMN "paymentPhases" JSONB;
ALTER TABLE "home_projects" ADD COLUMN "paidPhases" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "home_projects_signedQuoteId_key" ON "home_projects"("signedQuoteId");

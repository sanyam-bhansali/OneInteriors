-- CreateTable
CREATE TABLE "waitlist_signups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "style" TEXT,
    "city" TEXT NOT NULL DEFAULT 'Pune',
    "via" TEXT,
    "source" TEXT NOT NULL DEFAULT 'waitlist-landing',
    "notifyConsent" BOOLEAN NOT NULL DEFAULT true,
    "policyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "waitlist_signups_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "waitlist_signups_phone_key" ON "waitlist_signups"("phone");
-- CreateIndex
CREATE UNIQUE INDEX "waitlist_signups_email_key" ON "waitlist_signups"("email");
-- CreateIndex
CREATE INDEX "waitlist_signups_createdAt_idx" ON "waitlist_signups"("createdAt");
-- CreateIndex
CREATE INDEX "waitlist_signups_via_idx" ON "waitlist_signups"("via");

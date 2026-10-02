-- The waitlist gate (owner, 30 Sep 2026): personal referral codes, who
-- referred whom, the optional "skip 20 places" answers, and the welcome
-- message record. Columns on an existing table: RLS unchanged.
-- AlterTable
ALTER TABLE "waitlist_signups" ADD COLUMN     "bhk" TEXT,
ADD COLUMN     "extrasAt" TIMESTAMP(3),
ADD COLUMN     "possession" TEXT,
ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referredByCode" TEXT,
ADD COLUMN     "society" TEXT,
ADD COLUMN     "welcomeChannel" TEXT,
ADD COLUMN     "welcomedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_signups_referralCode_key" ON "waitlist_signups"("referralCode");

-- CreateIndex
CREATE INDEX "waitlist_signups_referredByCode_idx" ON "waitlist_signups"("referredByCode");

-- CreateIndex
CREATE INDEX "waitlist_signups_society_idx" ON "waitlist_signups"("society");


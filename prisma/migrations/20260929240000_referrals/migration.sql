-- OneReferrals: a customer's personal code, and the code a brief arrived
-- through. Columns on existing tables: no RLS change.


-- AlterTable
ALTER TABLE "users" ADD COLUMN     "referralCode" TEXT;

-- AlterTable
ALTER TABLE "briefs" ADD COLUMN     "referredByCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_referralCode_key" ON "users"("referralCode");


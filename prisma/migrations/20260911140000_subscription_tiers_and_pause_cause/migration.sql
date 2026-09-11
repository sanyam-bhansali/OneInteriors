-- Reconcile the subscription tiers with the pricing actually in the plan, and
-- record WHY a studio is paused.
--
-- The old enum was LISTED / VERIFIED / SIGNATURE at ₹0 / ₹40k / ₹1L, which was
-- superseded by Essential / Premium / Luxury at ₹25k / ₹50k / ₹1L. Worse than
-- the wrong numbers, the old names collided with the VERIFICATION tiers — a
-- studio could be Verified (a badge, earned by checks) while sitting on the
-- Verified plan (a fee), and the two mean entirely different things. Two
-- vocabularies for two concepts, and nobody mixes them up on a call.
--
-- Existing rows are mapped by position, cheapest to dearest. There is no data
-- in this table yet; the CASE is there so the migration is still correct if
-- that stops being true before it runs somewhere else.

-- AlterEnum: SubscriptionTier
ALTER TYPE "SubscriptionTier" RENAME TO "SubscriptionTier_old";

CREATE TYPE "SubscriptionTier" AS ENUM ('ESSENTIAL', 'PREMIUM', 'LUXURY');

-- The default has to go before the type changes; Postgres will not cast it.
ALTER TABLE "subscriptions" ALTER COLUMN "tier" DROP DEFAULT;

ALTER TABLE "subscriptions"
  ALTER COLUMN "tier" TYPE "SubscriptionTier"
  USING (
    CASE "tier"::text
      WHEN 'LISTED'    THEN 'ESSENTIAL'
      WHEN 'VERIFIED'  THEN 'PREMIUM'
      WHEN 'SIGNATURE' THEN 'LUXURY'
      ELSE 'ESSENTIAL'
    END
  )::"SubscriptionTier";

ALTER TABLE "subscriptions" ALTER COLUMN "tier" SET DEFAULT 'ESSENTIAL';

DROP TYPE "SubscriptionTier_old";

-- CreateEnum: why a studio is out of rotation
CREATE TYPE "PauseCause" AS ENUM ('MANUAL', 'AT_CAPACITY', 'PAYMENT_DUE');

-- AlterTable
ALTER TABLE "studios" ADD COLUMN "pauseCause" "PauseCause";

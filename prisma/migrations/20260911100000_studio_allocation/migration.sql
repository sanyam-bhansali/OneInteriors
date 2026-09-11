-- Allocation controls for the ops console.
--
-- These fields govern how OFTEN a studio is shown, never WHERE it appears in a
-- customer's results. There is deliberately no priority, boost or rank column
-- here: order within a customer's matches is computed by the matching engine
-- from fit alone, and the cheapest way to keep that true is to give the
-- database no column that could express the opposite.
--
-- No RLS changes needed. `studios` already has RLS enabled and forced with all
-- privileges revoked from `anon` and `authenticated` by the
-- 20260907180000_enable_rls_lockdown migration; columns added later inherit it.

-- AlterTable
ALTER TABLE "studios" ADD COLUMN     "capacityPerMonth" INTEGER,
ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "pausedReason" TEXT;

-- CreateIndex
-- Every customer-facing query filters paused studios out, so this is on the hot
-- path for /match, /quotes and /studios.
CREATE INDEX "studios_pausedAt_idx" ON "studios"("pausedAt");

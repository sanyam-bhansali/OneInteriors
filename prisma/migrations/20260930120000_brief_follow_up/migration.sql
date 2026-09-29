-- The follow-up call to customers who finished the brief without booking the
-- expert call (ops/follow-ups). Columns on an existing table: RLS unchanged.
ALTER TABLE "briefs" ADD COLUMN     "followUpNote" TEXT,
ADD COLUMN     "followUpOutcome" TEXT,
ADD COLUMN     "followUpTries" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "followedUpAt" TIMESTAMP(3);

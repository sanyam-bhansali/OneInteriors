-- The Free plan (owner, 24 Nov 2026; modules/studio/software-plan.ts).
-- Adds the value only: no studio moves. SOLO stays and reads as Free with its
-- limits waived until the founding-studio script moves those studios.
ALTER TYPE "StudioSoftwarePlan" ADD VALUE IF NOT EXISTS 'FREE';

-- Free counts quotations first printed in a calendar month (reprints are
-- free). Nullable, set once; existing quotations stay null, so nothing
-- printed before today counts against anyone.
ALTER TABLE "studio_quotes" ADD COLUMN "firstPrintedAt" TIMESTAMP(3);
CREATE INDEX "studio_quotes_studioId_firstPrintedAt_idx" ON "studio_quotes"("studioId", "firstPrintedAt");

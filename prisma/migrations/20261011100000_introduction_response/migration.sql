-- The studio's answer to an introduction: accepted, or declined with a reason.
ALTER TABLE "introductions" ADD COLUMN "studioAcceptedAt" TIMESTAMP(3);
ALTER TABLE "introductions" ADD COLUMN "studioDeclinedAt" TIMESTAMP(3);
ALTER TABLE "introductions" ADD COLUMN "studioDeclineReason" TEXT;

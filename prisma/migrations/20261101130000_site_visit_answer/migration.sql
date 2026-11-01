-- The client answers a booked site visit in the app (owner, 1 Nov 2026;
-- customer app Phase 2): they will be there, or they ask for another day
-- with a reason the studio sees.
--
-- Expand only: one enum and three nullable columns. "home_site_visits" is
-- already under RLS.

-- CreateEnum
CREATE TYPE "SiteVisitAnswer" AS ENUM ('CONFIRMED', 'ASKED_TO_MOVE');

-- AlterTable
ALTER TABLE "home_site_visits" ADD COLUMN "clientAnswer" "SiteVisitAnswer",
ADD COLUMN "clientAnsweredAt" TIMESTAMP(3),
ADD COLUMN "clientReason" TEXT;

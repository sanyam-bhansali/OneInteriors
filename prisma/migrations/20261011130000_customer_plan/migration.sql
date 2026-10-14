-- The customer's plan (owner, 11 Oct 2026; docs/APP-API-JOURNEY.md).
--
-- Every project starts on BASIC. Choosing Assured at signing, or later from
-- the app, only stamps `assuredRequestedAt` until ops confirms the fee and
-- switches the plan. Expert calls used are derived from consultations, so
-- nothing else is stored.
--
-- Purely additive: a new enum, and on an existing table (which already
-- carries RLS) one column with a default and one nullable column. Existing
-- projects become BASIC, which is what they were sold. Safe to `db:deploy`.

-- CreateEnum
CREATE TYPE "CustomerPlan" AS ENUM ('BASIC', 'ASSURED');

-- AlterTable
ALTER TABLE "home_projects" ADD COLUMN "plan" "CustomerPlan" NOT NULL DEFAULT 'BASIC';
ALTER TABLE "home_projects" ADD COLUMN "assuredRequestedAt" TIMESTAMP(3);

-- The customer journey, kept.
--
-- Until this migration the richest signal in the product was discarded: the
-- generated quotes, which studios were put side by side and which lines the
-- customer cared about lived in sessionStorage and died with the tab. The
-- brief survived; what the brief led to did not.
--
-- These tables hold facts only — what we priced, what they compared, what
-- they starred, and who eventually won. No inference about why.

CREATE TYPE "RunSource" AS ENUM ('FLOOR_PLAN', 'CUSTOMER', 'STANDARD');
CREATE TYPE "OutcomeSource" AS ENUM ('OPS_RECORDED', 'STUDIO_CRM', 'CUSTOMER_REPORTED');

CREATE TABLE "first_quotes" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "modularPaise" BIGINT NOT NULL,
    "nonModularPaise" BIGINT NOT NULL,
    "modularDiscountPaise" BIGINT NOT NULL,
    "professionalFeePaise" BIGINT NOT NULL,
    "gstPaise" BIGINT NOT NULL,
    "totalPaise" BIGINT NOT NULL,
    "lowPaise" BIGINT NOT NULL,
    "highPaise" BIGINT NOT NULL,
    "variancePct" DOUBLE PRECISION NOT NULL,
    "kitchenRunMm" INTEGER,
    "runSource" "RunSource" NOT NULL,
    "notPriced" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ratesVersion" TEXT NOT NULL,
    "builtAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "first_quotes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "first_quote_lines" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "work" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "ratePaise" BIGINT NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "spec" TEXT NOT NULL,
    "standard" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "first_quote_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quote_decisions" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "comparedSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "starredCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "wonByStudioId" TEXT,
    "outcomeSource" "OutcomeSource",
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "quote_decisions_pkey" PRIMARY KEY ("id")
);

-- One quote per studio per brief. Regenerating updates in place rather than
-- adding a second row, so no later query has to ask which one they saw.
CREATE UNIQUE INDEX "first_quotes_briefId_studioId_key" ON "first_quotes"("briefId", "studioId");
CREATE INDEX "first_quotes_briefId_totalPaise_idx" ON "first_quotes"("briefId", "totalPaise");
CREATE INDEX "first_quotes_studioId_builtAt_idx" ON "first_quotes"("studioId", "builtAt");

CREATE UNIQUE INDEX "first_quote_lines_quoteId_code_key" ON "first_quote_lines"("quoteId", "code");
CREATE INDEX "first_quote_lines_code_idx" ON "first_quote_lines"("code");

CREATE UNIQUE INDEX "quote_decisions_briefId_key" ON "quote_decisions"("briefId");
CREATE INDEX "quote_decisions_wonByStudioId_idx" ON "quote_decisions"("wonByStudioId");

-- Cascade from the brief: a deleted brief takes its quotes with it, which is
-- what a DPDP erasure request means in practice.
ALTER TABLE "first_quotes" ADD CONSTRAINT "first_quotes_briefId_fkey"
  FOREIGN KEY ("briefId") REFERENCES "briefs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "first_quotes" ADD CONSTRAINT "first_quotes_studioId_fkey"
  FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "first_quote_lines" ADD CONSTRAINT "first_quote_lines_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "first_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quote_decisions" ADD CONSTRAINT "quote_decisions_briefId_fkey"
  FOREIGN KEY ("briefId") REFERENCES "briefs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SET NULL, not CASCADE: a studio leaving the roster must not delete the
-- record that a brief reached a decision. Losing the outcome would quietly
-- bias every rate ever calculated from this table.
ALTER TABLE "quote_decisions" ADD CONSTRAINT "quote_decisions_wonByStudioId_fkey"
  FOREIGN KEY ("wonByStudioId") REFERENCES "studios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- These hold somebody's home, their budget and what they nearly bought.
-- Reachable only through the server, never through a Supabase client key.
ALTER TABLE "first_quotes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "first_quotes" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "first_quotes" FROM anon, authenticated;

ALTER TABLE "first_quote_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "first_quote_lines" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "first_quote_lines" FROM anon, authenticated;

ALTER TABLE "quote_decisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quote_decisions" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "quote_decisions" FROM anon, authenticated;

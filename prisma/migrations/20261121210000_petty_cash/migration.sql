-- Petty cash for site supervisors, and what they spend it on (owner, 21 Nov 2026).
CREATE TABLE "studio_petty_cash" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "givenOn" DATE NOT NULL,
    "note" TEXT,
    "byId" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),
    CONSTRAINT "studio_petty_cash_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "studio_petty_cash_studioId_memberId_idx" ON "studio_petty_cash"("studioId", "memberId");
ALTER TABLE "studio_petty_cash" ADD CONSTRAINT "studio_petty_cash_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "studio_petty_expenses" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "memberName" TEXT NOT NULL,
    "homeProjectId" TEXT NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "spentOn" DATE NOT NULL,
    "note" TEXT NOT NULL,
    "billPath" TEXT NOT NULL,
    "billHash" TEXT NOT NULL,
    "readAmountPaise" BIGINT,
    "readDay" TEXT,
    "readVendor" TEXT,
    "readSummary" TEXT,
    "flags" JSONB NOT NULL DEFAULT '[]',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "rejected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "studio_petty_expenses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "studio_petty_expenses_studioId_createdAt_idx" ON "studio_petty_expenses"("studioId", "createdAt");
CREATE INDEX "studio_petty_expenses_studioId_billHash_idx" ON "studio_petty_expenses"("studioId", "billHash");
CREATE INDEX "studio_petty_expenses_homeProjectId_idx" ON "studio_petty_expenses"("homeProjectId");
CREATE INDEX "studio_petty_expenses_memberId_idx" ON "studio_petty_expenses"("memberId");
ALTER TABLE "studio_petty_expenses" ADD CONSTRAINT "studio_petty_expenses_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Locked down like every table: only the server (service role) reads and writes it.
ALTER TABLE "studio_petty_cash" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_petty_expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_petty_cash" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_petty_cash" FROM anon, authenticated;
ALTER TABLE "studio_petty_expenses" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_petty_expenses" FROM anon, authenticated;

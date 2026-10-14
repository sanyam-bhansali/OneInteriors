-- Proposed products (13 Oct 2026; Hauspire's "Propose a NEW product (not in
-- master)"). Expand only: one new table, nothing existing is changed.
--
-- A salesperson who needs a line the product master does not have proposes
-- it from the quotation builder; it waits here until the owner or a project
-- manager approves it (added to the product master) or rejects it.
--
-- Plain id columns, no foreign keys (like the floor-plan tables), reached
-- only through studio-scoped queries. RLS on, no policies: reached only
-- through Prisma on the server, like every studio table.

-- CreateTable
CREATE TABLE "studio_product_proposals" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" "StudioWorkCode" NOT NULL DEFAULT 'ONSITE',
    "unit" "QuoteUnit" NOT NULL DEFAULT 'UNIT',
    "ratePaise" BIGINT NOT NULL,
    "details" TEXT,
    "room" TEXT,
    "quoteId" TEXT,
    "proposedById" TEXT,
    "proposedBy" TEXT,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "studio_product_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "studio_product_proposals_studioId_state_idx" ON "studio_product_proposals"("studioId", "state");

-- Row level security: closed to the anon and authenticated roles.
ALTER TABLE "studio_product_proposals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_product_proposals" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_product_proposals" FROM anon, authenticated;

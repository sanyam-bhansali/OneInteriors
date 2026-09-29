-- The society floor-plan library: confirmed plan sizes per society and home
-- type, sizes only, deleted with the brief.


-- CreateTable
CREATE TABLE "society_plans" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "societyKey" TEXT NOT NULL,
    "bhk" INTEGER NOT NULL,
    "carpetAreaSqft" INTEGER,
    "bathrooms" INTEGER NOT NULL,
    "kitchenRunMm" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "society_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "society_plans_briefId_key" ON "society_plans"("briefId");

-- CreateIndex
CREATE INDEX "society_plans_societyKey_bhk_idx" ON "society_plans"("societyKey", "bhk");

-- AddForeignKey
ALTER TABLE "society_plans" ADD CONSTRAINT "society_plans_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "briefs"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row-level security: reached only through the server.
ALTER TABLE "society_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "society_plans" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "society_plans" FROM anon, authenticated;

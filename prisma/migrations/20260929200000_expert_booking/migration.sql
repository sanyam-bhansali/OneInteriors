-- Booked expert calls (plan §9): weekly hours and blocked days per expert, and
-- a rule that one expert cannot be booked twice at one time.


-- AlterTable
ALTER TABLE "consultations" ADD COLUMN     "bookedAt" TIMESTAMP(3),
ADD COLUMN     "durationMins" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "expert_hours" (
    "id" TEXT NOT NULL,
    "expertUserId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expert_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expert_blocks" (
    "id" TEXT NOT NULL,
    "expertUserId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expert_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expert_hours_expertUserId_idx" ON "expert_hours"("expertUserId");

-- CreateIndex
CREATE UNIQUE INDEX "expert_blocks_expertUserId_day_key" ON "expert_blocks"("expertUserId", "day");

-- AddForeignKey
ALTER TABLE "expert_hours" ADD CONSTRAINT "expert_hours_expertUserId_fkey" FOREIGN KEY ("expertUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_blocks" ADD CONSTRAINT "expert_blocks_expertUserId_fkey" FOREIGN KEY ("expertUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- No double booking. Partial, so a cancelled or completed call frees nothing
-- it should not and blocks nothing it should not: only live bookings compete.
-- Raw SQL because Prisma cannot express a partial index.
CREATE UNIQUE INDEX "consultations_expert_slot_live_key"
  ON "consultations"("expertUserId", "scheduledFor")
  WHERE "status" = 'scheduled' AND "expertUserId" IS NOT NULL AND "scheduledFor" IS NOT NULL;

-- Row-level security, matching the lockdown migration's posture: reached only
-- through the server, which connects as `postgres` and bypasses RLS.
ALTER TABLE "expert_hours" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expert_hours" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "expert_hours" FROM anon, authenticated;

ALTER TABLE "expert_blocks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expert_blocks" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "expert_blocks" FROM anon, authenticated;

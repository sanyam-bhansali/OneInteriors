-- The customer's check-in after a first meeting (plan §10), and the curated
-- discount recorded on each stored quote.


-- AlterTable
ALTER TABLE "first_quotes" ADD COLUMN     "curatedDiscountPaise" BIGINT NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "meeting_check_ins" (
    "id" TEXT NOT NULL,
    "introductionId" TEXT NOT NULL,
    "matched" TEXT NOT NULL,
    "communication" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meeting_check_ins_introductionId_key" ON "meeting_check_ins"("introductionId");

-- AddForeignKey
ALTER TABLE "meeting_check_ins" ADD CONSTRAINT "meeting_check_ins_introductionId_fkey" FOREIGN KEY ("introductionId") REFERENCES "introductions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row-level security: reached only through the server.
ALTER TABLE "meeting_check_ins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meeting_check_ins" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "meeting_check_ins" FROM anon, authenticated;

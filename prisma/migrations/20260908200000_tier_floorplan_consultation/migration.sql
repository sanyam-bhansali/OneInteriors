-- CreateEnum
CREATE TYPE "BudgetTier" AS ENUM ('ESSENTIAL', 'PREMIUM', 'LUXURY');

-- AlterTable
ALTER TABLE "briefs" ADD COLUMN     "floorPlanName" TEXT,
ADD COLUMN     "floorPlanPath" TEXT,
ADD COLUMN     "tier" "BudgetTier";

-- AlterTable
ALTER TABLE "consultations" ADD COLUMN     "askedAbout" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "preferredTimes" TEXT,
ADD COLUMN     "studioIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "scheduledFor" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'requested';


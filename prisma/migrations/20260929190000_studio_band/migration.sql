-- The studio's band as confirmed by ops (modules/studio/band.ts proposes it).
-- Columns on an existing table: no RLS change.

-- AlterTable
ALTER TABLE "studios" ADD COLUMN     "band" TEXT,
ADD COLUMN     "bandConfirmedAt" TIMESTAMP(3);

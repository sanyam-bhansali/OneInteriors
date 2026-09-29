-- Each studio's own payment schedule, printed on its quotes. See the
-- field note on Studio.paymentPhases. A column on an existing table: no RLS
-- change (studios is already locked down).

-- AlterTable
ALTER TABLE "studios" ADD COLUMN     "paymentPhases" JSONB;

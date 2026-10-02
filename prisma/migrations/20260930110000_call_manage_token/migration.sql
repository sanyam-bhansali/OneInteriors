-- The private link to move or cancel a booked expert call. Column on an
-- existing table: no RLS change.


-- AlterTable
ALTER TABLE "consultations" ADD COLUMN     "manageToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "consultations_manageToken_key" ON "consultations"("manageToken");


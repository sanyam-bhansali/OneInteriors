-- AlterTable
ALTER TABLE "consents" ADD COLUMN     "anonKey" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "consents_anonKey_idx" ON "consents"("anonKey");


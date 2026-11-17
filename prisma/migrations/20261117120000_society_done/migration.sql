-- Societies: mark a society done (owner, 17 Nov 2026).
ALTER TABLE "studio_societies" ADD COLUMN "doneAt" TIMESTAMP(3);
ALTER TABLE "studio_societies" ADD COLUMN "doneByName" TEXT;

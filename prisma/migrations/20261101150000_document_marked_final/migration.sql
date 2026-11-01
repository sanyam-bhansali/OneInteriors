-- "Mark as final" on a project document (walkthrough, 27 Oct 2026; owner's
-- pick, 1 Nov 2026): the designer marks which version is the final of its
-- type and room. The newest is never final by itself.
--
-- Expand only: two nullable columns. "home_documents" is already under RLS.

-- AlterTable
ALTER TABLE "home_documents" ADD COLUMN "markedFinalAt" TIMESTAMP(3),
ADD COLUMN "markedFinalById" TEXT;

-- "Ask for other options" on a decision (the owner's v1 screens, Redo;
-- owner, 1 Nov 2026; customer app Phase 2).
--
-- Expand only: two nullable columns. "home_decisions" is already under RLS.

-- AlterTable
ALTER TABLE "home_decisions" ADD COLUMN "redoAskedAt" TIMESTAMP(3),
ADD COLUMN "redoNote" TEXT;

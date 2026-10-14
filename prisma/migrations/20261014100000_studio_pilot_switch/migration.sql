-- The per-studio pilot switch and the owner's setup quiz (owner, 14 Oct 2026).
-- Columns on an existing table (RLS already on for "studios"); no new table.
-- Every studio starts without the full software; ops switches it on per
-- studio from the ops console (audited as studio.full_software).
ALTER TABLE "studios" ADD COLUMN "fullSoftware" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "studios" ADD COLUMN "setupQuiz" JSONB;

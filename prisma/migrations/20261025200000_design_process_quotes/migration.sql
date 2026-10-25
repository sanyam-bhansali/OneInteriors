-- The design process, phase 3 (owner and Hauspire's design team, 24 Oct 2026;
-- docs/studio-os/DESIGN-PROCESS-PLAN.md §2.4–2.5, §4.2–4.3).
--
-- Expand only: three columns on quotations, two on projects. Nothing
-- dropped, nothing backfilled.
--
-- studio_quotes."salesFinalNotes": sales' notes for the design team, required
-- to mark a new sales final (older ones stay without).
-- studio_quotes."salesFinalVoicePath": a voice note kept as audio, in the
-- private lead-files bucket.
-- studio_quotes."category" / home_projects."category": Essential, Premium or
-- Luxe (the BudgetTier enum; LUXURY reads "Luxe").
-- home_projects."priority": 1 to 5 stars, one value for the whole studio.

-- AlterTable
ALTER TABLE "studio_quotes" ADD COLUMN "salesFinalNotes" TEXT;
ALTER TABLE "studio_quotes" ADD COLUMN "salesFinalVoicePath" TEXT;
ALTER TABLE "studio_quotes" ADD COLUMN "category" "BudgetTier";

-- AlterTable
ALTER TABLE "home_projects" ADD COLUMN "priority" INTEGER;
ALTER TABLE "home_projects" ADD COLUMN "category" "BudgetTier";

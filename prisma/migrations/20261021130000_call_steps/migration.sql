-- Calling steps (owner, 21 Oct 2026): a column can be marked as one of the
-- cold-calling steps (Hauspire's Calling 1, Calling 2, Calling 3, Calling 4).
-- Logging a call that was not picked up then suggests the next step,
-- pre-ticked, applied with the call in one tap (studio-practice/
-- call-step-rules.ts). A suggestion only: nothing moves by itself.
--
-- Expand only: one column, default false. Existing open columns named
-- "Calling <n>" (any case, any spacing) are flagged, so a studio already on
-- the Hauspire pipeline gets the suggestions without touching Settings.

-- AlterTable
ALTER TABLE "studio_stages" ADD COLUMN "isCallStep" BOOLEAN NOT NULL DEFAULT false;

-- Backfill
UPDATE "studio_stages" SET "isCallStep" = true WHERE "kind" = 'OPEN' AND "name" ~* '^calling\s*\d+$';

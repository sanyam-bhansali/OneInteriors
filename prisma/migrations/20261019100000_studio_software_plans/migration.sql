-- Studio software plans (owner, 19 Oct 2026): Pro for every studio, Max for
-- the full Studio OS (Hauspire while it is tested). Replaces the yes/no pilot
-- switch: every studio that had it on becomes Max. `fullSoftware` stays, kept
-- equal to (softwarePlan = 'MAX') by the code, and is retired in a later release.
-- A column on `studios`, which already has row-level security.
CREATE TYPE "StudioSoftwarePlan" AS ENUM ('PRO', 'MAX');
ALTER TABLE "studios" ADD COLUMN "softwarePlan" "StudioSoftwarePlan" NOT NULL DEFAULT 'PRO';
UPDATE "studios" SET "softwarePlan" = 'MAX' WHERE "fullSoftware" = true;

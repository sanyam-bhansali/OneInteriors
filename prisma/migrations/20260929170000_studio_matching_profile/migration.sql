-- The studio matching profile, one JSON column read through
-- modules/studio/matching-profile.ts. A column on an existing table: no RLS
-- change (studios is already locked down).

-- AlterTable
ALTER TABLE "studios" ADD COLUMN     "matchingProfile" JSONB;

-- The brief records what its scope covers.
--
-- scopeRooms: for a single-room job or a renovation, which rooms.
-- excludedItems: catalogue codes unticked on the scope checklist — left out of
--   every studio's quote, so the comparison stays like for like.
--
-- Generated offline with `prisma migrate diff`. Purely additive: two array
-- columns with empty defaults on an existing table that already carries RLS.
-- Safe to `db:deploy`.

-- AlterTable
ALTER TABLE "briefs" ADD COLUMN "excludedItems" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "scopeRooms" TEXT[] DEFAULT ARRAY[]::TEXT[];

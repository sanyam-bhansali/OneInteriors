-- The composed board.
--
-- `items` holds element slugs from src/modules/prepare/catalogue.ts, in the
-- order the customer placed them. Slugs rather than foreign keys because the
-- catalogue is code, not a table: it is vocabulary that gets revised in pull
-- requests with the reasoning attached, and a materials list nobody can edit at
-- runtime is a feature here rather than a limitation.
--
-- Defaulted to an empty array, never null. A room with no board and a room
-- whose board is empty are the same thing to every reader of this column, and
-- giving that one representation removes a null check from every call site.
--
-- No RLS changes needed. `prep_rooms` already has RLS enabled and forced with
-- all privileges revoked from `anon` and `authenticated` by the
-- 20260912100000_prep_pack migration; columns added later inherit it.

-- AlterTable
ALTER TABLE "prep_rooms" ADD COLUMN     "items" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Q9 of the brief asks about possession instead of a move-in date.
--
-- Work starts from possession: a buyer waiting on handover has a date they
-- cannot move, and a studio cannot start before it. The status is the
-- answer — keys in hand, expecting them (with `possessionOn`, which already
-- exists), or not sure — and it is what the timeline and the match are built
-- around. `moveInBy` stays for briefs written before the change.
--
-- Generated offline with `prisma migrate diff` against the committed schema,
-- so it is what `migrate dev` would have written, without pointing the CLI at
-- the production database .env.local holds. Purely additive: a new enum and a
-- nullable column on an existing table, which already carries RLS from the
-- September lockdown sweep. Safe to `db:deploy`.

-- CreateEnum
CREATE TYPE "PossessionStatus" AS ENUM ('HAVE_KEYS', 'EXPECTED', 'NOT_SURE');

-- AlterTable
ALTER TABLE "briefs" ADD COLUMN "possessionStatus" "PossessionStatus";

-- The brief gains what Phase 1 of docs/CUSTOMER-JOURNEY-PLAN.md asks for.
--
-- contactName / contactPhone / contactEmail: written only by the contact step,
--   after the customer has agreed to the notice — never by the per-step quiz
--   sync. The number is unverified; it reaches them about this brief and is
--   not an identity (users.phone is, and stays unique).
-- society: the building, as typed. Free text; there is no list to pick from.
-- needs: HomeNeed strings (VASTU, POOJA_ROOM, …), like styleLikes.
-- language: EN | HI | MR, the language they want their studio to speak.
--
-- Generated offline with `prisma migrate diff` against the committed schema.
-- Purely additive — nullable columns on an existing table, which already
-- carries RLS from the September lockdown sweep. Safe to `db:deploy`.

-- AlterTable
ALTER TABLE "briefs" ADD COLUMN "contactEmail" TEXT,
ADD COLUMN "contactName" TEXT,
ADD COLUMN "contactPhone" TEXT,
ADD COLUMN "language" TEXT,
ADD COLUMN "needs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "society" TEXT;

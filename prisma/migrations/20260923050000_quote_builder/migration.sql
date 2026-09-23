-- The quotation builder: a standard specification, the two measurements
-- that drive it, and a copy of what the client was actually sent.
--
-- ## Why a flag on the product rather than a separate "standard build"
--
-- A studio's standard specification is not a second list. It is the subset
-- of their own catalogue they fit on nearly every job, and it changes when
-- their practice changes. Held as a flag, ticking a product is one action in
-- the place they already maintain rates; held as its own table, it is a
-- second list that drifts out of step with the first and nobody notices
-- until a quotation comes out missing the wardrobes.
ALTER TABLE "studio_products" ADD COLUMN "inStandardBuild" BOOLEAN NOT NULL DEFAULT false;

-- ## The kitchen run is one measurement, not three
--
-- Base cabinets, wall cabinets and the loft are all priced on the same run.
-- Typed three times it is wrong twice; typed once it is a fact about the
-- flat, which is what it is. Kept on the quotation so re-applying a
-- configuration after a change of mind does not ask for it again.
ALTER TABLE "studio_quotes" ADD COLUMN "kitchenRunMm" INTEGER;

-- Counted rather than derived from the BHK. A 2 BHK with three bathrooms is
-- ordinary here, and a vanity per bathroom is the whole reason to know.
ALTER TABLE "studio_quotes" ADD COLUMN "bathrooms" INTEGER;

-- ## The issued copy
--
-- Written once, when the quotation is first issued. Everything after that is
-- a revision, and "what changed since we sent it" needs something true to
-- compare against -- not a reconstruction from timestamps.
--
-- Deliberately not a revision history. The question a designer is asked in
-- front of a client is never "show me every version", it is "what moved
-- since the one they are holding", and one frozen copy answers that without
-- inviting anybody to maintain a second.
ALTER TABLE "studio_quotes" ADD COLUMN "issuedLines" JSONB;

-- No row-level security block here: both tables were created by earlier
-- migrations and are already covered. Adding columns does not change which
-- roles can reach a table, and tests/security-invariants.test.ts requires
-- the pairing only on migrations that create one.

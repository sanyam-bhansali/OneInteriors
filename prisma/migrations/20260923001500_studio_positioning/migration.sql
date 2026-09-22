-- How a studio positions itself, as opposed to what it charges.
--
-- Both are self-declared and neither is used to compute a tier. They sit
-- beside `minProjectPaise`/`maxProjectPaise`, which the studio already gives
-- on the profile step, and beside the rate card, which is a different kind of
-- fact: the rate card is what the quoting engine prices work with, and these
-- two are what a customer is told.

-- What the studio actually sells.
--
-- The most load-bearing of the two, and the reason it is worth a column
-- rather than a sentence in the description: a design-only practice should
-- not be quoted for execution, and today nothing can tell us it is one. The
-- matcher can act on this; it cannot act on prose.
--
-- Values are held in src/modules/studio/positioning.ts. Text and not an enum
-- for the same reason studio_documents.kind is: a new offering is a product
-- decision that should not wait on a migration shipping first.
ALTER TABLE "studios" ADD COLUMN "offering" TEXT;

-- Where the studio places itself in the market.
--
-- Nullable and deliberately NOT derived from the budget range, even though it
-- looks derivable. The two answer different questions -- the range is what
-- they will take on, this is how they want to be read -- and a studio whose
-- floor is low because it takes the occasional small job for a repeat client
-- is not thereby budget-friendly. Deriving it would put a claim in a
-- customer's hands that the studio never made.
ALTER TABLE "studios" ADD COLUMN "priceLevel" TEXT;

-- No RLS block: studios was created by the initial migration and is already
-- covered by the lockdown sweep. Adding a column does not change that, and
-- tests/security-invariants.test.ts only requires the pairing on migrations
-- that make a new table.
--
-- That test greps raw SQL without stripping comments, so the phrase it looks
-- for must not appear in prose here either.

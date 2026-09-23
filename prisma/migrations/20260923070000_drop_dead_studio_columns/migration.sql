-- Four columns on studios with no reader and no writer anywhere in src/.
--
-- Each was added for something that was then built differently or not at all:
--
--   cin, udyamNumber     -- company identifiers we verify against the public
--                           registries instead, through VerificationCheck
--   designFeePaise       -- superseded by StudioBranding.feeBps, which is
--                           basis points and per-quotation rather than one
--                           figure on the studio
--   performanceComputedAt -- a timestamp for a recomputation job that was
--                           never written
--
-- Verified zero references before dropping: no query selects them, no form
-- writes them, no test asserts on them. All four are recoverable from git and
-- from any backup taken before today.
--
-- Deliberately NOT dropped:
--
--   panLast4             -- written by the ops GSTIN screen. No reader yet,
--                           but it is a record of what was verified, and a
--                           verification artifact with no reader is waiting
--                           for a screen rather than dead.
--   the performance block -- completedProjects, avgVarianceDays,
--                           upheldDisputes, specComplianceRate,
--                           communicationRating, autonomyProfile. These have
--                           no writer either, but the matching score and the
--                           tier logic both READ them, so dropping them
--                           breaks two live features. The gap is recorded in
--                           the schema comment and in
--                           docs/DATA-ARCHITECTURE.md instead.
ALTER TABLE "studios" DROP COLUMN IF EXISTS "cin";
ALTER TABLE "studios" DROP COLUMN IF EXISTS "udyamNumber";
ALTER TABLE "studios" DROP COLUMN IF EXISTS "designFeePaise";
ALTER TABLE "studios" DROP COLUMN IF EXISTS "performanceComputedAt";

-- No row-level security block: studios was created by an earlier migration
-- and is already covered. Dropping a column changes no privilege, and
-- tests/security-invariants.test.ts requires the pairing only where a
-- migration creates a table.

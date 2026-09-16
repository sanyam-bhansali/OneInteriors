-- The other half of a rule that was only ever half-implemented.
--
-- Onboarding has always said a studio must give us "a GSTIN, or a note that you
-- do not have one" — that sentence is in the code comment and in the copy on
-- the registration step. Only the first half was representable. There was no
-- column, no field and no form control for the second, so the step tested a
-- value while claiming to test a decision.
--
-- The effect: a proprietorship below the GST threshold could complete every
-- other onboarding step and then sit forever on a permanently greyed-out
-- "Send for verification" button. Ops could not rescue them either — the only
-- action that writes a GSTIN was never rendered on the ops studio page.
--
-- A blank field and a declared absence are different facts. Now the schema can
-- tell them apart, and `gstinNote` carries what to verify instead.
--
-- No RLS changes needed. `studios` already has RLS enabled and forced with all
-- privileges revoked from `anon` and `authenticated` by the
-- 20260907180000_enable_rls_lockdown migration; columns added later inherit it.

-- AlterTable
ALTER TABLE "studios" ADD COLUMN     "gstinNotApplicable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gstinNote" TEXT;

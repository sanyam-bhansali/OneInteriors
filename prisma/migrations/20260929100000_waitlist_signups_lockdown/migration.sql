-- Lock down waitlist_signups.
--
-- 20260926000000_waitlist_signups created this table without the block every
-- other table-creating migration carries, and tests/security-invariants.test.ts
-- caught it — but only once somebody ran the suite, because CI had not run
-- since 7 September. The table holds names, phone numbers and email addresses.
--
-- A follow-up rather than an edit: that migration may already have been
-- applied to production, and a migration that has run anywhere is never
-- edited (CONTRIBUTING §5). Every statement here is safe to run whether or not
-- RLS was already on — enabling it twice is a no-op, and so is revoking a
-- grant that does not exist.

-- Row-level security, matching the lockdown migration's posture. No policies:
-- the table is reached only through the server, which connects as `postgres`
-- and bypasses RLS.
ALTER TABLE "waitlist_signups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "waitlist_signups" FORCE ROW LEVEL SECURITY;

-- The other half: Supabase's ALTER DEFAULT PRIVILEGES grants anon and
-- authenticated on any table created after the September lockdown sweep, so
-- the sweep does nothing for this one. RLS stops the rows being read; this
-- stops the grant existing.
REVOKE ALL ON "waitlist_signups" FROM anon, authenticated;

-- One request against a rate-limited thing.
--
-- Rows rather than a counter, because a counter per window is a FIXED window:
-- somebody spends the whole quota at 09:59:59 and the whole of the next one at
-- 10:00:01, which is double the rate at exactly the moment an automated caller
-- lands. lookup-limit.ts already refuses that trade in memory.

CREATE TABLE "rate_limit_hits" (
  "id"        TEXT NOT NULL,
  -- Namespaced by the caller: form:<id>, ip:<addr>, lookup:<addr>. Namespacing
  -- is the caller's job so two features cannot collide on a bare IP and
  -- silently share a quota.
  "bucket"    TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "rate_limit_hits_pkey" PRIMARY KEY ("id")
);

-- The only query this table serves: count and prune one bucket's recent rows.
CREATE INDEX "rate_limit_hits_bucket_createdAt_idx"
  ON "rate_limit_hits" ("bucket", "createdAt");

-- Row-level security, matching the lockdown migration's posture. This table
-- holds IP addresses, which are personal data under the DPDP Act, and it is
-- reachable only through the server.
ALTER TABLE "rate_limit_hits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rate_limit_hits" FORCE ROW LEVEL SECURITY;

-- The other half: Supabase's ALTER DEFAULT PRIVILEGES grants anon and
-- authenticated on any table created after the September lockdown sweep, so
-- the sweep does nothing for this one. RLS stops the rows being read; this
-- stops the grant existing.
REVOKE ALL ON "rate_limit_hits" FROM anon, authenticated;

-- One line of a lead's history.
--
-- Before this, a lead's entire past was one overwritable `notes` column and
-- `lastContactedAt` -- a single timestamp, which is not a log. Retyping the
-- notes box destroyed the studio's own record of its own work.

CREATE TYPE "ClientEventKind" AS ENUM (
  'CREATED',
  'STAGE_CHANGED',
  'CONTACTED',
  'ASSIGNED',
  'NOTE',
  'QUOTED',
  'LOST',
  'BINNED',
  'RESTORED',
  'WITHDRAWN'
);

CREATE TYPE "EventActor" AS ENUM ('MEMBER', 'SYSTEM');

CREATE TABLE "studio_client_events" (
  "id"        TEXT NOT NULL,
  "studioId"  TEXT NOT NULL,
  "clientId"  TEXT NOT NULL,
  "kind"      "ClientEventKind" NOT NULL,
  "actor"     "EventActor" NOT NULL DEFAULT 'MEMBER',
  "byId"      TEXT,
  -- The name AT THE TIME, alongside the id. Reading it through the relation
  -- would rewrite two years of history to "Unknown" the day somebody leaves
  -- the team; the id is for linking, this is for reading.
  "byName"    TEXT,
  "summary"   TEXT NOT NULL,
  "meta"      JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "studio_client_events_pkey" PRIMARY KEY ("id")
);

-- The timeline read: one client, newest first.
CREATE INDEX "studio_client_events_clientId_createdAt_idx"
  ON "studio_client_events" ("clientId", "createdAt");

-- "What has this studio been doing", and the per-kind activity read.
CREATE INDEX "studio_client_events_studioId_createdAt_idx"
  ON "studio_client_events" ("studioId", "createdAt");
CREATE INDEX "studio_client_events_studioId_kind_createdAt_idx"
  ON "studio_client_events" ("studioId", "kind", "createdAt");

ALTER TABLE "studio_client_events"
  ADD CONSTRAINT "studio_client_events_studioId_fkey"
  FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CASCADE, deliberately. Erasing a client from the bin takes its timeline
-- with it: keeping a detailed record of somebody after deleting them at their
-- own request is the opposite of what the delete was for.
ALTER TABLE "studio_client_events"
  ADD CONSTRAINT "studio_client_events_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "studio_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SET NULL, not CASCADE. Losing the fact that a stage change happened is
-- worse than losing who made it, and `byName` survives regardless.
ALTER TABLE "studio_client_events"
  ADD CONSTRAINT "studio_client_events_byId_fkey"
  FOREIGN KEY ("byId") REFERENCES "studio_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-level security, matching the lockdown migration's posture: the table is
-- reachable only through the server, which connects as the owner and bypasses
-- RLS. Enabling it with no permissive policy means a leaked anon or
-- authenticated key reads nothing from here -- and a lead timeline carries
-- customer names, what was discussed and what was quoted.
ALTER TABLE "studio_client_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_client_events" FORCE ROW LEVEL SECURITY;

-- The REVOKE is not belt-and-braces on top of RLS, it is the other half.
--
-- Supabase sets ALTER DEFAULT PRIVILEGES on the public schema, so a table
-- created after the lockdown migration arrives with anon and authenticated
-- already granted -- and that lockdown was a one-time sweep of the tables that
-- existed in September, so it does nothing for this one. RLS with no
-- permissive policy stops the rows being read; this stops the grant existing
-- in the first place, which is what a future migration adding a policy would
-- otherwise quietly open.
--
-- tests/security-invariants.test.ts enforces this.
REVOKE ALL ON "studio_client_events" FROM anon, authenticated;

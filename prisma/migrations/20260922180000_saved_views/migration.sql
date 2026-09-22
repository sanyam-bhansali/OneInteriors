-- A filter somebody saved and named.
--
-- Per MEMBER, not per studio: "my overdue kitchens in Baner" is a person's
-- working view, not a studio policy. Sharing them would mean one person's
-- tidy-up rearranges everybody else's morning.

CREATE TABLE "studio_saved_views" (
  "id"        TEXT NOT NULL,
  "studioId"  TEXT NOT NULL,
  "memberId"  TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  -- JSON, not columns. The filter shape belongs to the board and changes with
  -- it; a saved view referencing a filter that no longer exists has to degrade
  -- quietly rather than fail to load.
  "filters"   JSONB NOT NULL DEFAULT '{}',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "studio_saved_views_pkey" PRIMARY KEY ("id")
);

-- One name per person. A second "Overdue" is somebody meaning to edit the
-- first and getting two instead.
CREATE UNIQUE INDEX "studio_saved_views_memberId_name_key"
  ON "studio_saved_views" ("memberId", "name");

CREATE INDEX "studio_saved_views_memberId_createdAt_idx"
  ON "studio_saved_views" ("memberId", "createdAt");

ALTER TABLE "studio_saved_views"
  ADD CONSTRAINT "studio_saved_views_studioId_fkey"
  FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CASCADE on the member, unlike the timeline's SET NULL. A leaver's history is
-- a record of work that happened; a leaver's saved views are clutter nobody
-- left can explain.
ALTER TABLE "studio_saved_views"
  ADD CONSTRAINT "studio_saved_views_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "studio_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security, matching the lockdown migration's posture: reachable
-- only through the server, which connects as the owner and bypasses RLS.
-- Enabled with no permissive policy, so a leaked anon or authenticated key
-- reads nothing.
ALTER TABLE "studio_saved_views" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_saved_views" FORCE ROW LEVEL SECURITY;

-- The other half of the same rule. Supabase's ALTER DEFAULT PRIVILEGES grants
-- anon and authenticated on any table created after the September lockdown
-- sweep, so the sweep does nothing for this one. RLS stops the rows being
-- read; this stops the grant existing, which is what a future migration
-- adding a policy would otherwise quietly open.
REVOKE ALL ON "studio_saved_views" FROM anon, authenticated;

-- Lock down PostgREST access to every table.
--
-- WHY THIS EXISTS
--
-- Supabase auto-exposes every table in the `public` schema through PostgREST
-- at /rest/v1/. Tables created through the Supabase table editor get Row Level
-- Security enabled by default; tables created by a Prisma migration do NOT,
-- because Prisma just issues CREATE TABLE.
--
-- The consequence, verified against this project before this migration ran:
-- the PUBLISHABLE key -- which ships inside the browser bundle and is public by
-- design -- could read every table and write to them.
--
--     GET   /rest/v1/studios              -> 200, returned rows
--     PATCH /rest/v1/studios?slug=eq.x    -> 204, write permitted
--
-- That is every brief, every phone number, every verification record and the
-- whole studio roster, readable and editable by anyone who opens devtools.
--
-- THE FIX
--
-- Two layers, because one of them can be undone by accident:
--
--   1. Enable RLS on every table with NO policies. RLS on + no policy = deny
--      everything through PostgREST. Prisma is unaffected: it connects as the
--      `postgres` role, which bypasses RLS.
--
--   2. Revoke the schema and table grants from `anon` and `authenticated`
--      outright. We do not use PostgREST at all, so nothing should reach it
--      even if a policy is later added carelessly.
--
-- IF YOU EVER START USING supabase-js (Storage, Realtime, Supabase Auth), do
-- not "fix" the resulting permission errors by disabling RLS or re-granting
-- broadly. Write a narrow policy for the specific table and role that needs it.
-- See docs/DATABASE.md.

-- ── 1. RLS on, deny by default ──
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE '\_prisma%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- ── 2. Revoke the API roles' access entirely ──
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
REVOKE USAGE ON SCHEMA public FROM anon, authenticated;

-- Future tables created in this schema inherit the same denial.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

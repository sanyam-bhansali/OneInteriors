-- Each team member's own home (profile menu, 12 Oct 2026): app order, hidden
-- apps, the "Right now" strip and where they land after signing in.
-- Nullable, no default: nobody's home changes until they choose.
-- studio_members already has row-level security; a new column needs no policy.
ALTER TABLE "studio_members" ADD COLUMN "homePrefs" JSONB;

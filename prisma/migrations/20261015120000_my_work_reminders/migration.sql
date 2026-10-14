-- My work and reminders (owner, 15 Oct 2026). The snag window: how many days
-- the client may raise snags in the app once the handover (final) payment is
-- recorded after the project closure; Settings, Warranty. Default 30.
-- A column on an existing table (RLS already on for "studios"); no new table.
-- The "My work" lists and the reminders read existing tables only; each
-- reminder is sent once a day, checked against "notifications".
ALTER TABLE "studios" ADD COLUMN "snagWindowDays" INTEGER NOT NULL DEFAULT 30;

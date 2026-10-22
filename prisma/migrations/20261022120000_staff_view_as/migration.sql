-- Developer access, "Open as…" (owner, 22 Oct 2026; docs/studio-os/VIEW-AS.md):
-- an OPS or ADMIN session can look at one studio's software as one of its
-- members, read only, for two hours.
-- Expand only: four columns on the existing sessions table (already under RLS
-- with every privilege revoked from anon and authenticated, by
-- 20260907180000_enable_rls_lockdown). No new table, nothing dropped, nothing
-- backfilled; every existing session reads as "not viewing".
--
-- viewAsMemberId    the studio_members row being viewed (no foreign key: the
--                   view is re-resolved on every request and a member that is
--                   gone simply ends it).
-- viewAsUntil       when the view stops being honoured.
-- viewAsTicketHash  SHA-256 of the one-time, two-minute ticket that carries the
--                   view from the ops host to the studio host. Unique; cleared
--                   when redeemed, so a ticket works once.
-- viewAsOnly        the session was made by that ticket for the view alone, so
--                   Stop revokes it rather than only clearing the view.

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN "viewAsMemberId" TEXT;
ALTER TABLE "sessions" ADD COLUMN "viewAsUntil" TIMESTAMP(3);
ALTER TABLE "sessions" ADD COLUMN "viewAsTicketHash" TEXT;
ALTER TABLE "sessions" ADD COLUMN "viewAsOnly" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "sessions_viewAsTicketHash_key" ON "sessions"("viewAsTicketHash");

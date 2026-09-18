-- ═══════════════════════════════════════════════════════════════
-- Assignment, the bin, and last contact.
--
-- Three columns, and each one exists because a studio with a real
-- lead list cannot use this software without it.
--
--   assignedToId     Who is working a client. NULL is the pool —
--                    a real state, not a missing value. Two hundred
--                    imported rows all start there and the pool
--                    screen exists to empty it.
--
--   lastContactedAt  When somebody actually spoke to them. NOT
--                    updatedAt, which moves on any change including
--                    a bulk assign or an import. "Nobody has called
--                    this person in three weeks" is only true if it
--                    is counting calls.
--
--   deletedAt        Soft delete, thirty days, then erased. A lead
--                    list is somebody's work; a delete button that
--                    is instant and final is a delete button that
--                    gets used once and regretted.
--
-- ## The dangerous part of this migration
--
-- Adding `deletedAt` means every existing read of studio_clients is
-- now wrong until it filters on it. There are reads in clients.ts,
-- projects.ts, the studio layout's badge counts and the dashboard.
-- A deleted client reappearing on the board is worse than one that
-- never deleted, so the application change lands with this.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE "studio_clients" ADD COLUMN "assignedToId" TEXT;
ALTER TABLE "studio_clients" ADD COLUMN "lastContactedAt" TIMESTAMP(3);
ALTER TABLE "studio_clients" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- SET NULL, not CASCADE. Removing somebody from the studio returns
-- their clients to the pool; it must never delete the clients along
-- with the membership.
ALTER TABLE "studio_clients" ADD CONSTRAINT "studio_clients_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "studio_members"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "studio_clients_studioId_deletedAt_idx"
    ON "studio_clients"("studioId", "deletedAt");

CREATE INDEX "studio_clients_studioId_assignedToId_deletedAt_idx"
    ON "studio_clients"("studioId", "assignedToId", "deletedAt");

-- ─────────────────────────────────────────────────────────────────
-- No RLS block here: this migration adds no tables. studio_clients
-- already has RLS enabled and forced, and anon/authenticated were
-- revoked in 20260916163131_studio_practice. New COLUMNS inherit the
-- table's policy, so there is nothing further to lock down — which
-- is worth writing down, because the absence of the usual block at
-- the bottom of a migration should look deliberate rather than
-- forgotten.
-- ─────────────────────────────────────────────────────────────────

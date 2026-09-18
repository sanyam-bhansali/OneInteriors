-- ═══════════════════════════════════════════════════════════════
-- Three more verification checks.
--
--   RATE_CARD_FILED    Their own per-sq-ft prices, on record. This
--                      is what every first quote is priced from, so
--                      a studio without one cannot be quoted at all.
--   WARRANTY_TERMS     A written warranty with a duration on it —
--                      the only thing a customer holds after
--                      handover.
--   LABOUR_INSURANCE   A current certificate for the people who
--                      will be working inside somebody's home.
--
-- ## Why this is more than three enum values
--
-- All three are in TIER_CHECKS.VERIFIED, and tiers are computed
-- rather than assigned. So from the moment this lands, an ACTIVE
-- studio without these three recorded computes as LISTED rather
-- than VERIFIED, and its profile says which check is outstanding.
--
-- That is the intended behaviour, not a side effect: the landing
-- page tells every visitor that fifteen checks are mandatory and
-- that one failed check means not listed. A badge that survived
-- three unperformed checks would make that sentence false.
--
-- The fixtures in src/data/studios.ts already carry all three, so
-- nothing in development moves. Any real studio row does need ops
-- to record them — see docs/WHAT-I-NEED-FROM-YOU.md.
--
-- ## The Postgres detail
--
-- ALTER TYPE ... ADD VALUE cannot be used in the same transaction
-- that adds it (PG 12+ relaxed the rest). This migration only adds
-- values and never writes one, so it is safe inside the transaction
-- Prisma wraps around it.
-- ═══════════════════════════════════════════════════════════════

ALTER TYPE "CheckType" ADD VALUE IF NOT EXISTS 'RATE_CARD_FILED';
ALTER TYPE "CheckType" ADD VALUE IF NOT EXISTS 'WARRANTY_TERMS';
ALTER TYPE "CheckType" ADD VALUE IF NOT EXISTS 'LABOUR_INSURANCE';

-- ─────────────────────────────────────────────────────────────────
-- No RLS block: this migration adds no tables. verification_checks
-- already has RLS enabled and forced, and anon/authenticated were
-- revoked when it was created. An enum is not a grantable object,
-- so there is nothing further to lock down — worth writing down,
-- because the absence of the usual block should look deliberate
-- rather than forgotten.
-- ─────────────────────────────────────────────────────────────────

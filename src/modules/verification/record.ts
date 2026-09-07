import 'server-only';

/**
 * The ops write path.
 *
 * Every mutation here obeys three rules, and they are the reason the badge on a
 * public profile means anything:
 *
 *  1. **Nothing sets a tier.** There is no function for it. Tier is recomputed
 *     from the checks after every write and persisted only as a cache, so the
 *     stored column can never disagree with the evidence for long — and
 *     `tierDrift` catches it if it does.
 *
 *  2. **Every change writes an AuditLog row**, with the actor, the before and
 *     the after. A studio asking "who marked our GST filings as failed, and
 *     when" must be answerable from data, not memory. This is also the appeal
 *     mechanism the /verification page promises.
 *
 *  3. **The mutation and its audit row commit together.** Both are inside one
 *     transaction, so an audit trail with holes in it is not possible.
 *
 * Authorisation is checked HERE, not in the UI. Server actions are directly
 * invocable — a hidden button is not an access control.
 */

import { prisma } from '@/lib/prisma';
import { requireRole, type AuthUser } from '@/modules/auth/session';
import { assessTier } from './tiers';
import { validateGstin } from './gstin';
import type { CheckResult, CheckType, StudioStatus } from '@/modules/studio/types';
import { Prisma } from '@prisma/client';

export type RecordResult = { ok: true } | { ok: false; error: string };

/** Shape of the audit payload — kept small and readable in the table. */
type Snapshot = Record<string, unknown>;

async function writeAudit(
  tx: Prisma.TransactionClient,
  actor: AuthUser,
  action: string,
  entityType: string,
  entityId: string,
  before: Snapshot | null,
  after: Snapshot | null,
) {
  await tx.auditLog.create({
    data: {
      actorId: actor.id,
      action,
      entityType,
      entityId,
      before: before === null ? Prisma.JsonNull : (before as Prisma.InputJsonValue),
      after: after === null ? Prisma.JsonNull : (after as Prisma.InputJsonValue),
    },
  });
}

/**
 * Recompute and persist the tier from whatever the checks now say.
 *
 * Called after every write that could change it. The stored value is a cache
 * for querying and drift detection — the repositories still recompute on read,
 * so a stale cache can never mislead a customer.
 */
async function refreshTier(tx: Prisma.TransactionClient, studioId: string): Promise<string> {
  const studio = await tx.studio.findUniqueOrThrow({
    where: { id: studioId },
    include: { verifications: true },
  });

  const computed = assessTier({
    status: studio.status,
    completedProjects: studio.completedProjects,
    avgVarianceDays: studio.avgVarianceDays,
    upheldDisputes: studio.upheldDisputes,
    checks: studio.verifications.map((v) => ({
      type: v.type as CheckType,
      result: v.result as CheckResult,
      source: v.source,
      checkedAt: v.checkedAt ? v.checkedAt.toISOString() : null,
      detail: v.notes,
    })),
  }).tier;

  if (computed !== studio.tier) {
    await tx.studio.update({ where: { id: studioId }, data: { tier: computed } });
  }
  return computed;
}

// ── Recording a check ──────────────────────────────────────────

export interface RecordCheckInput {
  studioId: string;
  type: CheckType;
  result: CheckResult;
  /** Where it was verified — "GST portal", "Site visit", "IDfy". Shown publicly. */
  source: string;
  /** Free text shown under the check on the public profile. */
  notes?: string | null;
}

export async function recordCheck(input: RecordCheckInput): Promise<RecordResult> {
  const actor = await requireRole('OPS');

  const source = input.source.trim();
  if (!source) {
    // The public profile renders "source · date". A check with no source is
    // exactly the undated badge /verification says we do not do.
    return { ok: false, error: 'A source is required — the profile publishes it.' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.verificationCheck.findUnique({
        where: { studioId_type: { studioId: input.studioId, type: input.type } },
      });

      const before = existing
        ? { result: existing.result, source: existing.source, checkedAt: existing.checkedAt, notes: existing.notes }
        : null;

      // PENDING has no meaningful "checked" date — it has not been checked.
      const checkedAt = input.result === 'PENDING' ? null : new Date();

      const after = {
        result: input.result,
        source,
        checkedAt,
        notes: input.notes?.trim() || null,
      };

      await tx.verificationCheck.upsert({
        where: { studioId_type: { studioId: input.studioId, type: input.type } },
        create: { studioId: input.studioId, type: input.type, ...after, checkedById: actor.id },
        update: { ...after, checkedById: actor.id },
      });

      const tier = await refreshTier(tx, input.studioId);

      await writeAudit(
        tx,
        actor,
        'verification.record',
        'VerificationCheck',
        `${input.studioId}:${input.type}`,
        before,
        { ...after, resultingTier: tier },
      );
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not record the check.' };
  }
}

// ── Studio status ──────────────────────────────────────────────

/**
 * Suspension and removal are the levers, NOT the tier.
 *
 * The /verification page tells studios a suspension is investigated and
 * appealable, so a reason is mandatory — "who suspended us and why" has to be
 * answerable, and an appeal decided by someone else needs something to read.
 */
export async function setStudioStatus(
  studioId: string,
  status: StudioStatus,
  reason: string,
): Promise<RecordResult> {
  const actor = await requireRole('OPS');

  const trimmed = reason.trim();
  if (trimmed.length < 10) {
    return { ok: false, error: 'Give a reason — a studio can appeal this, and the appeal needs it.' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.studio.findUniqueOrThrow({
        where: { id: studioId },
        select: { status: true, tier: true, tradeName: true },
      });

      await tx.studio.update({ where: { id: studioId }, data: { status } });
      const tier = await refreshTier(tx, studioId);

      await writeAudit(
        tx,
        actor,
        `studio.status.${status.toLowerCase()}`,
        'Studio',
        studioId,
        { status: before.status, tier: before.tier },
        { status, tier, reason: trimmed },
      );
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not change the status.' };
  }
}

// ── GSTIN ──────────────────────────────────────────────────────

/**
 * Set a studio's GSTIN, validating the checksum first.
 *
 * Refusing a malformed number here saves a paid lookup later and, more
 * importantly, keeps an invented registration off a public profile.
 */
export async function setGstin(studioId: string, raw: string): Promise<RecordResult> {
  const actor = await requireRole('OPS');

  const result = validateGstin(raw);
  if (!result.valid) return { ok: false, error: result.reason };

  try {
    const clash = await prisma.studio.findFirst({
      where: { gstin: result.gstin, NOT: { id: studioId } },
      select: { tradeName: true },
    });
    if (clash) {
      return { ok: false, error: `That GSTIN is already on ${clash.tradeName}.` };
    }

    await prisma.$transaction(async (tx) => {
      const before = await tx.studio.findUniqueOrThrow({
        where: { id: studioId },
        select: { gstin: true },
      });

      await tx.studio.update({
        where: { id: studioId },
        data: { gstin: result.gstin, panLast4: result.parts.pan.slice(-4) },
      });

      await writeAudit(tx, actor, 'studio.gstin.set', 'Studio', studioId, before, {
        gstin: result.gstin,
        state: result.parts.stateName,
        holderType: result.parts.holderType,
      });
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not save the GSTIN.' };
  }
}

// ── Reading the trail ──────────────────────────────────────────

export interface AuditEntry {
  id: string;
  action: string;
  actorName: string;
  createdAt: Date;
  before: unknown;
  after: unknown;
}

export async function studioAuditTrail(studioId: string, limit = 50): Promise<AuditEntry[]> {
  await requireRole('OPS');

  const rows = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType: 'Studio', entityId: studioId },
        { entityType: 'VerificationCheck', entityId: { startsWith: `${studioId}:` } },
      ],
    },
    include: { actor: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    actorName: r.actor?.name ?? r.actor?.email ?? 'Unknown',
    createdAt: r.createdAt,
    before: r.before,
    after: r.after,
  }));
}

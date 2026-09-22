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
import { requireRole, getCurrentUser, hasRole, type AuthUser } from '@/modules/auth/session';
import { hasDatabase } from '@/lib/env';
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

      /**
       * Tell them they are on the roster.
       *
       * Written here, inside the same transaction as the status change,
       * because those two facts must not be able to disagree: a studio who
       * is ACTIVE and was never told is a studio wondering for a week why
       * nothing happened, and a notification written outside the
       * transaction is one that survives a rolled-back approval.
       *
       * Only on the way IN to ACTIVE. Re-saving an already-active studio —
       * which ops does when correcting a tier or a note — must not send a
       * second congratulations.
       */
      if (status === 'ACTIVE' && before.status !== 'ACTIVE') {
        const members = await tx.studioMember.findMany({
          where: { studioId },
          select: { userId: true },
        });

        if (members.length > 0) {
          await tx.notification.createMany({
            data: members.map((m) => ({
              userId: m.userId,
              /* In-app. Email is sent separately by whatever calls this, and
                 deliberately not from inside a transaction — a mail provider
                 having a bad minute must not roll back an approval. */
              channel: 'push',
              template: 'studio.approved',
              payload: { studioId, tradeName: before.tradeName },
            })),
          });
        }
      }

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

/**
 * Mark a studio row as a test record, or put it back.
 *
 * ## Why this is not a status
 *
 * Every `StudioStatus` is a statement about a real studio, and two of them —
 * SUSPENDED and REMOVED — carry an appeal that `/verification` promises will
 * be decided by someone who did not make the original call. Filing something
 * you created while testing under REMOVED puts a fiction into the column that
 * appeal reads. Do it twice and "removed" stops meaning anything.
 *
 * So hiding is a separate axis: not a judgement about a studio, a statement
 * that there is no studio.
 *
 * ## Why no reason is demanded
 *
 * `setStudioStatus` requires ten characters because a studio can appeal it.
 * Nobody appeals this — there is nobody to appeal. Demanding an explanation
 * for tidying up your own test data is ceremony that teaches people to type
 * "test" ten times, and a required field answered meaninglessly is worse than
 * no field.
 *
 * It is still audited, because an ops account making a studio disappear from
 * the roster is exactly the action a log exists for. If this is ever used on
 * something real, the audit trail is what finds it.
 *
 * ## Why it is reversible
 *
 * Deleting is not, and "I was sure it was a test" is a thing people are sure
 * of right up until they are wrong. `unhide` is one click away and the row is
 * untouched in the meantime.
 */
export async function setHiddenAsTest(
  studioId: string,
  hidden: boolean,
): Promise<RecordResult> {
  const actor = await requireRole('OPS');

  try {
    const refusal = await prisma.$transaction(async (tx) => {
      const before = await tx.studio.findUniqueOrThrow({
        where: { id: studioId },
        select: { hiddenAsTestAt: true, tradeName: true, status: true },
      });

      // A live studio being hidden is the one case worth refusing. ACTIVE
      // means it has passed verification and can be matched to a customer,
      // which a test record cannot have done — so this is far likelier to be a
      // mis-click on the wrong row than a genuine intent, and the cost of
      // being wrong is a real studio silently vanishing from the roster.
      if (hidden && before.status === 'ACTIVE') {
        return 'This studio is ACTIVE — it has been verified and can be matched to a customer, so it is not a test record. Change its status first if you really mean this.';
      }

      const hiddenAsTestAt = hidden ? new Date() : null;
      await tx.studio.update({ where: { id: studioId }, data: { hiddenAsTestAt } });

      await writeAudit(
        tx,
        actor,
        hidden ? 'studio.hidden_as_test' : 'studio.unhidden',
        'Studio',
        studioId,
        { hiddenAsTestAt: before.hiddenAsTestAt?.toISOString() ?? null },
        { hiddenAsTestAt: hiddenAsTestAt?.toISOString() ?? null, tradeName: before.tradeName },
      );

      return null;
    });

    return refusal ? { ok: false, error: refusal } : { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not change this.',
    };
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
        data: {
          gstin: result.gstin,
          panLast4: result.parts.pan.slice(-4),
          // A number and "we have no registration" are mutually exclusive
          // answers to the same question. Leaving the declaration standing
          // would have the ops screen render "studio says no registration,
          // verify on PAN and bank records" directly above the GSTIN that ops
          // had just typed in off a phone call. The studio-side `saveGstin`
          // already clears these; this path did not.
          gstinNotApplicable: false,
          gstinNote: null,
        },
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

/**
 * The audit trail for one studio.
 *
 * `hasRole`, not `requireRole` — and the difference is a live 500.
 *
 * This is a RENDER-path read: `/ops/[slug]` awaits it while building the page.
 * `requireRole` throws, and a throw during render races the layout's redirect
 * and wins, so a non-OPS visitor got a stack trace instead of a redirect — and
 * under the dev bypass, where there is no session at all, EVERY studio detail
 * page was a guaranteed 500. That page is what every row on `/ops/verification`
 * and `/ops/allocation` links to.
 *
 * Four other comments in this codebase warn about exactly this mistake. It is
 * now the non-throwing form the rest of the ops surface uses: no rows rather
 * than no page, and `hasDatabase()` so an unmigrated database degrades the
 * same way.
 */
export async function studioAuditTrail(studioId: string, limit = 50): Promise<AuditEntry[]> {
  const user = await getCurrentUser();
  if (!hasRole(user, 'OPS')) return [];
  if (!hasDatabase()) return [];

  try {
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
  } catch {
    return [];
  }
}

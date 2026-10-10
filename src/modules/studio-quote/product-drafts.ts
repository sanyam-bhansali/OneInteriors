import 'server-only';

/**
 * The product master read from a studio's own quotations, on its way in.
 *
 * ## Where the rows come from
 *
 * Not from the web app. The owner reads a studio's quotations in their own
 * Claude app (`/read-quotations`, docs/READ-QUOTATIONS.md), and the local
 * script `npm run quotes:submit` writes the result here as PENDING drafts —
 * one run at a time, a newer run superseding the older pending rows. Reading
 * through the API from a request got stuck at READING and ran up the bill
 * (10 Oct 2026); this keeps every read in front of a person.
 *
 * ## Where they go
 *
 * Ops checks them on /ops/[slug] — can fix a figure, can drop a line — and
 * approves the run. Approval writes them into StudioProduct (the one price
 * list, owner's decision of 10 Oct 2026), stamps `ratesFilledAt`, and tells
 * the studio to check them; the quotation builder opens when the studio
 * confirms (rates-gate.ts).
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/modules/auth/session';
import { fromDb, rupeesToPaise } from '@/lib/money';

export interface DraftRow {
  id: string;
  runId: string;
  name: string;
  code: 'MODULAR' | 'ONSITE';
  unit: 'AREA' | 'SQFT' | 'RFT' | 'UNIT';
  details: string | null;
  ratePaise: number;
  rooms: string[];
  defaultWidthMm: number | null;
  defaultHeightMm: number | null;
  defaultQty: number | null;
  inStandardBuild: boolean;
  rules: Record<string, unknown> | null;
  fromQuotations: number;
  evidence: Record<string, unknown> | null;
  state: string;
  note: string | null;
  createdAt: string;
}

export interface DraftRun {
  runId: string;
  createdAt: string;
  rows: DraftRow[];
  /** Rows already in the studio's product master, by lower-case name. */
  existing: Record<string, number>;
}

/** The studio's newest run of PENDING drafts, for ops. Null when there is none. */
export async function pendingDraftRun(studioId: string): Promise<DraftRun | null> {
  await requireRole('OPS');
  const rows = await prisma.studioProductDraft.findMany({
    where: { studioId, state: 'PENDING' },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  if (rows.length === 0) return null;

  const runId = rows.reduce((a, b) => (a.createdAt > b.createdAt ? a : b)).runId;
  const run = rows.filter((r) => r.runId === runId);
  const products = await prisma.studioProduct.findMany({
    where: { studioId },
    select: { name: true, ratePaise: true },
  });

  return {
    runId,
    createdAt: run[0]!.createdAt.toISOString(),
    rows: run.map((r) => ({
      id: r.id,
      runId: r.runId,
      name: r.name,
      code: r.code,
      unit: r.unit,
      details: r.details,
      ratePaise: fromDb(r.ratePaise),
      rooms: r.rooms,
      defaultWidthMm: r.defaultWidthMm,
      defaultHeightMm: r.defaultHeightMm,
      defaultQty: r.defaultQty,
      inStandardBuild: r.inStandardBuild,
      rules: (r.rules as Record<string, unknown> | null) ?? null,
      fromQuotations: r.fromQuotations,
      evidence: (r.evidence as Record<string, unknown> | null) ?? null,
      state: r.state,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    })),
    existing: Object.fromEntries(products.map((p) => [p.name.toLowerCase(), fromDb(p.ratePaise)])),
  };
}

export type DraftResult = { ok: true; message: string } | { ok: false; error: string };

/** Ops corrects one figure before approving. Rupees in; a pending row only. */
export async function setDraftRate(id: string, rupees: number): Promise<DraftResult> {
  await requireRole('OPS');
  if (!Number.isFinite(rupees) || rupees < 0 || rupees >= 1e8) {
    return { ok: false, error: 'That is not a rate. Check for an extra digit.' };
  }
  const row = await prisma.studioProductDraft.findUnique({ where: { id }, select: { state: true } });
  if (!row || row.state !== 'PENDING') return { ok: false, error: 'That line is no longer waiting.' };
  await prisma.studioProductDraft.update({ where: { id }, data: { ratePaise: BigInt(rupeesToPaise(rupees)) } });
  return { ok: true, message: 'Saved.' };
}

/** Ops drops one line from the run. It does not reach the product master. */
export async function rejectDraft(id: string, note: string): Promise<DraftResult> {
  const actor = await requireRole('OPS');
  const row = await prisma.studioProductDraft.findUnique({ where: { id }, select: { state: true } });
  if (!row || row.state !== 'PENDING') return { ok: false, error: 'That line is no longer waiting.' };
  await prisma.studioProductDraft.update({
    where: { id },
    data: { state: 'REJECTED', note: note.trim().slice(0, 500) || null, reviewedAt: new Date(), reviewedById: actor.id },
  });
  return { ok: true, message: 'Dropped from this run.' };
}

/**
 * Approve the run: every PENDING row of it goes into the product master.
 *
 * Matched on name, case-insensitive — a product the studio already has is
 * updated (rate, code, unit, details, rooms, sizes, rules), a new one is
 * created. Products the run does not mention are left alone: approval adds
 * and corrects, it never deletes a studio's line.
 */
export async function approveDraftRun(studioId: string, runId: string): Promise<DraftResult> {
  const actor = await requireRole('OPS');

  const rows = await prisma.studioProductDraft.findMany({ where: { studioId, runId, state: 'PENDING' } });
  if (rows.length === 0) return { ok: false, error: 'Nothing in this run is waiting.' };
  if (rows.some((r) => r.ratePaise <= BigInt(0))) {
    return { ok: false, error: 'Some lines have no rate. Fill them or drop them first.' };
  }

  const existing = await prisma.studioProduct.findMany({ where: { studioId }, select: { id: true, name: true } });
  const byName = new Map(existing.map((p) => [p.name.toLowerCase(), p.id]));
  const members = await prisma.studioMember.findMany({ where: { studioId }, select: { userId: true } });
  const now = new Date();

  let created = 0;
  let updated = 0;
  await prisma.$transaction(
    async (tx) => {
      for (const r of rows) {
        const data = {
          code: r.code,
          unit: r.unit,
          details: r.details,
          ratePaise: r.ratePaise,
          rooms: r.rooms,
          defaultWidthMm: r.defaultWidthMm,
          defaultHeightMm: r.defaultHeightMm,
          defaultQty: r.defaultQty,
          inStandardBuild: r.inStandardBuild,
          rules: (r.rules ?? undefined) as Prisma.InputJsonValue | undefined,
          sortOrder: r.sortOrder,
          isActive: true,
        };
        const id = byName.get(r.name.toLowerCase());
        if (id) {
          await tx.studioProduct.update({ where: { id }, data });
          updated += 1;
        } else {
          await tx.studioProduct.create({ data: { studioId, name: r.name, ...data } });
          created += 1;
        }
      }

      await tx.studioProductDraft.updateMany({
        where: { studioId, runId, state: 'PENDING' },
        data: { state: 'APPROVED', reviewedAt: now, reviewedById: actor.id },
      });
      await tx.studio.update({ where: { id: studioId }, data: { ratesFilledAt: now } });

      const archiveIds = [...new Set(rows.map((r) => r.archiveId).filter((x): x is string => Boolean(x)))];
      if (archiveIds.length > 0) {
        await tx.quotationArchive.updateMany({
          where: { id: { in: archiveIds } },
          data: { state: 'FILED', analysisState: 'READ', analysedAt: now },
        });
      }

      if (members.length > 0) {
        await tx.notification.createMany({
          data: members.map((m) => ({
            userId: m.userId,
            channel: 'push',
            template: 'rates.filled',
            payload: { studioId, products: rows.length },
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'products.drafts.approve',
          entityType: 'Studio',
          entityId: studioId,
          // Names and counts, never the rates — the audit log is read by
          // ops and must not become a back door onto private pricing.
          after: { runId, created, updated } as Prisma.InputJsonValue,
        },
      });
    },
    { timeout: 30_000 },
  );

  return {
    ok: true,
    message: `Approved: ${created} new and ${updated} updated in their product master. The studio has been asked to check them.`,
  };
}

import 'server-only';

/**
 * The project closure (owner, 13 Oct 2026; docs/studio-os/PROJECT-LIFECYCLE.md):
 * the detailed final account once the provisional handover step is ticked.
 *
 * - Reads: `payment.read` on the project (owner, accounts; PM and designer
 *   on it). Writes: `project.closure` (owner; PM and designer on it).
 * - The account: the contract (the design final's total once the design is
 *   signed off, else the signed total), the changes agreed on decisions,
 *   extra work for the client and deductions / credits (lines), GST on the
 *   net the quotation's way (its rate), what has been paid (the recorded,
 *   counted payments) and the final amount due (lifecycle-rules.ts
 *   `closureTotals`).
 * - Append-only: every save is a new version (`HomeProjectClosure` +
 *   lines); the version saved with "Close the project" is `final` and fixes
 *   the final payment. Nothing is ever edited.
 *
 * ## The accounts handoff — TO BE SPECIFIED by the owner
 *
 * The owner will define the accounts flow later. For now, closing writes one
 * `HomeQuoteChange` ("Project closure: final account") on the last payment
 * stage for the difference between the closure's total and what the ledger
 * already owes, so the existing ledger's balance equals the final amount
 * due and accounts records it with the existing payment recording on the
 * payments desk ("Final payment from closure: ₹X", payments-flow.ts
 * `paymentsDesk`). The project then moves on to snags.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fromDb, toDb } from '@/lib/money';
import { memberOnProject } from '@/modules/studio/access';
import { readDesignChanges } from '@/modules/studio-design/customer-view';
import { recordEvent, type ProjectActor } from './events';
import { applyPhaseEvent } from './lifecycle';
import { checkClosureLines, closureTotals, effectivePhase, isPhase, type ClosureLineInput, type ClosureTotals, type Phase } from './lifecycle-rules';
import { ledgerOf, lockProject } from './payments-flow';
import { dayFromDb, istDay } from './working-days';

export const CLOSURE_CHANGE_LABEL = 'Project closure: final account';

export interface ClosureLineView extends ClosureLineInput {
  id: string;
}

export interface ClosureVersion {
  version: number;
  savedOn: string;
  final: boolean;
  totals: ClosureTotals;
  lines: ClosureLineView[];
  note: string | null;
}

export interface ClosureView {
  projectId: string;
  phase: Phase;
  /** Where the contract figure comes from. */
  contractFrom: 'design-final' | 'signed';
  /** What the account comes to right now, before any line is added: the starting point for a new version. */
  base: { contractPaise: number; changesPaise: number; gstBps: number; paidPaise: number; waitingPaise: number };
  /** The latest saved version; null before the first save. */
  latest: ClosureVersion | null;
  /** Every version, newest first (history). */
  history: { version: number; savedOn: string; final: boolean; finalDuePaise: number }[];
  /** Fixed: the project was closed out with this version. */
  closedOn: string | null;
  provisionalOn: string | null;
  /** The closure is open to work out (CLOSURE phase, not yet fixed) and this member may. */
  canEdit: boolean;
  /** Nothing signed in the app: there is no contract to close against. */
  noContract: boolean;
}

const VERSION_SELECT = {
  version: true,
  createdAt: true,
  final: true,
  contractPaise: true,
  changesPaise: true,
  extrasPaise: true,
  deductionsPaise: true,
  gstBps: true,
  gstPaise: true,
  totalPaise: true,
  paidPaise: true,
  finalDuePaise: true,
  note: true,
  lines: { orderBy: { sortOrder: 'asc' }, select: { id: true, kind: true, description: true, qtyMilli: true, ratePaise: true, amountPaise: true, note: true } },
} as const satisfies Prisma.HomeProjectClosureSelect;

type VersionRow = Prisma.HomeProjectClosureGetPayload<{ select: typeof VERSION_SELECT }>;

const PROJECT_SELECT = {
  phase: true,
  warrantyEndsOn: true,
  provisionalHandoverAt: true,
  closedOutAt: true,
  contractPaise: true,
  signedQuoteId: true,
  designFinalQuoteId: true,
  designClosedAt: true,
  designChanges: true,
  paymentPhases: true,
  paidPhases: true,
  payments: {
    select: {
      id: true,
      stageIndex: true,
      amountPaise: true,
      receivedOn: true,
      mode: true,
      receiptDocumentId: true,
      correctsId: true,
      recordedById: true,
      recordedAt: true,
      customerConfirmedAt: true,
      disputedAt: true,
    },
  },
  quoteChanges: { select: { deltaPaise: true, stageIndex: true, label: true } },
} as const satisfies Prisma.HomeProjectSelect;

type ProjectRow = Prisma.HomeProjectGetPayload<{ select: typeof PROJECT_SELECT }>;

function toVersion(r: VersionRow): ClosureVersion {
  return {
    version: r.version,
    savedOn: istDay(r.createdAt),
    final: r.final,
    note: r.note,
    totals: {
      contractPaise: fromDb(r.contractPaise),
      changesPaise: fromDb(r.changesPaise),
      extrasPaise: fromDb(r.extrasPaise),
      deductionsPaise: fromDb(r.deductionsPaise),
      netPaise: fromDb(r.extrasPaise) - fromDb(r.deductionsPaise),
      gstBps: r.gstBps,
      gstPaise: fromDb(r.gstPaise),
      totalPaise: fromDb(r.totalPaise),
      paidPaise: fromDb(r.paidPaise),
      finalDuePaise: fromDb(r.finalDuePaise),
    },
    lines: r.lines.map((l) => ({
      id: l.id,
      kind: l.kind === 'DEDUCTION' ? 'DEDUCTION' : 'EXTRA',
      description: l.description,
      qtyMilli: l.qtyMilli,
      ratePaise: l.ratePaise === null ? null : fromDb(l.ratePaise),
      amountPaise: fromDb(l.amountPaise),
      note: l.note,
    })),
  };
}

/** The starting figures: contract (design final, else signed), decision changes (not the closure's own), GST rate, paid. */
async function baseOf(db: Prisma.TransactionClient | typeof prisma, p: ProjectRow) {
  const design = p.designClosedAt ? readDesignChanges(p.designChanges) : null;
  const contractPaise = design ? design.designTotalPaise : p.contractPaise === null ? 0 : fromDb(p.contractPaise);
  const changesPaise = p.quoteChanges.filter((c) => c.label !== CLOSURE_CHANGE_LABEL).reduce((a, c) => a + fromDb(c.deltaPaise), 0);
  const quoteId = p.designFinalQuoteId ?? p.signedQuoteId;
  const q = quoteId ? await db.studioQuote.findUnique({ where: { id: quoteId }, select: { gstBps: true } }) : null;
  const l = ledgerOf(p);
  return {
    contractFrom: (design ? 'design-final' : 'signed') as ClosureView['contractFrom'],
    base: { contractPaise, changesPaise, gstBps: q?.gstBps ?? 0, paidPaise: l?.paidPaise ?? 0, waitingPaise: l?.waitingPaise ?? 0 },
    ledgerTotalPaise: l?.totalPaise ?? null,
  };
}

/** The closure for the project's Closure section and My Execution. Null when the member may not see its money. */
export async function closureFor(projectId: string, now = new Date()): Promise<ClosureView | null> {
  const check = await memberOnProject(projectId, 'payment.read');
  if (!check.ok) return null;
  const [p, versions] = await Promise.all([
    prisma.homeProject.findUnique({ where: { id: projectId }, select: PROJECT_SELECT }),
    prisma.homeProjectClosure.findMany({ where: { projectId }, orderBy: { version: 'desc' }, select: VERSION_SELECT }),
  ]);
  if (!p || !isPhase(p.phase)) return null;
  const b = await baseOf(prisma, p);
  const phase = effectivePhase(p.phase, p.warrantyEndsOn ? dayFromDb(p.warrantyEndsOn) : null, now);
  const fixed = versions.find((v) => v.final) ?? null;
  return {
    projectId,
    phase,
    contractFrom: b.contractFrom,
    base: b.base,
    latest: versions[0] ? toVersion(versions[0]) : null,
    history: versions.map((v) => ({ version: v.version, savedOn: istDay(v.createdAt), final: v.final, finalDuePaise: fromDb(v.finalDuePaise) })),
    closedOn: fixed ? istDay(fixed.createdAt) : p.closedOutAt ? istDay(p.closedOutAt) : null,
    provisionalOn: p.provisionalHandoverAt ? istDay(p.provisionalHandoverAt) : null,
    canEdit: phase === 'CLOSURE' && !fixed && check.access.may('project.closure'),
    noContract: ledgerOf(p) === null,
  };
}

export type ClosureResult = { ok: true; message: string; version: number } | { ok: false; error: string };

/**
 * Saves a new version of the closure; with `fix`, closes the project out:
 * the final payment is fixed, the ledger is brought to the closure's total
 * (the accounts handoff above) and the project moves to snags.
 */
export async function saveClosure(projectId: string, raw: { lines: unknown; note?: unknown; fix?: boolean }, now = new Date()): Promise<ClosureResult> {
  const check = await memberOnProject(projectId, 'project.closure');
  if (!check.ok) return check;
  const c = checkClosureLines(raw.lines);
  if (!c.ok) return c;
  const note = typeof raw.note === 'string' ? raw.note.replace(/\s+/g, ' ').trim().slice(0, 500) || null : null;
  const actor: ProjectActor = { type: 'STUDIO', id: check.member.userId };
  try {
    return await prisma.$transaction(async (tx) => {
      await lockProject(tx, projectId);
      const p = await tx.homeProject.findUnique({ where: { id: projectId }, select: PROJECT_SELECT });
      if (!p) return { ok: false, error: 'That project is gone.' } as const;
      if (p.phase !== 'CLOSURE') {
        return { ok: false, error: p.closedOutAt ? 'This project is closed out already: its final payment is fixed.' : 'The project closure opens once the provisional handover step is ticked.' } as const;
      }
      if (!ledgerOf(p)) return { ok: false, error: 'This project was not signed in the app, so there are no payment stages to close against.' } as const;
      const b = await baseOf(tx, p);
      const totals = closureTotals({ ...b.base, lines: c.lines });
      const last = await tx.homeProjectClosure.findFirst({ where: { projectId }, orderBy: { version: 'desc' }, select: { version: true, final: true } });
      if (last?.final) return { ok: false, error: 'This project is closed out already: its final payment is fixed.' } as const;
      const version = (last?.version ?? 0) + 1;
      const fix = raw.fix === true;
      const row = await tx.homeProjectClosure.create({
        data: {
          projectId,
          version,
          contractPaise: toDb(totals.contractPaise),
          changesPaise: toDb(totals.changesPaise),
          extrasPaise: toDb(totals.extrasPaise),
          deductionsPaise: toDb(totals.deductionsPaise),
          gstBps: totals.gstBps,
          gstPaise: toDb(totals.gstPaise),
          totalPaise: toDb(totals.totalPaise),
          paidPaise: toDb(totals.paidPaise),
          finalDuePaise: toDb(totals.finalDuePaise),
          note,
          final: fix,
          createdById: check.member.userId,
          lines: {
            create: c.lines.map((l, i) => ({
              kind: l.kind,
              description: l.description,
              qtyMilli: l.qtyMilli,
              ratePaise: l.ratePaise === null ? null : toDb(l.ratePaise),
              amountPaise: toDb(l.amountPaise),
              note: l.note,
              sortOrder: i,
            })),
          },
        },
        select: { id: true },
      });
      await recordEvent(tx, { projectId, type: fix ? 'closure.fixed' : 'closure.saved', actor, refId: row.id, at: now, payload: { version, lines: c.lines.length } });
      if (fix) {
        // TO BE SPECIFIED (owner): the accounts flow. For now the ledger is brought to the closure's total on the last stage,
        // so accounts records the final payment with the existing payment recording.
        const delta = totals.totalPaise - (b.ledgerTotalPaise ?? totals.totalPaise);
        if (delta !== 0) {
          const stages = Array.isArray(p.paymentPhases) ? p.paymentPhases.length : 0;
          await tx.homeQuoteChange.create({
            data: { projectId, label: CLOSURE_CHANGE_LABEL, deltaPaise: toDb(delta), stageIndex: stages > 0 ? stages - 1 : null, byId: check.member.userId, at: now },
          });
        }
        const m = await applyPhaseEvent(tx, projectId, { kind: 'closure.fixed' }, actor, now);
        if (!m.ok) throw new Error(m.error);
      }
      return {
        ok: true,
        version,
        message: fix
          ? `Project closed out. Final payment ${totals.finalDuePaise >= 0 ? 'due' : 'to refund'}: fixed and sent to accounts. The project moves on to snags.`
          : `Saved as version ${version}. Close the project when the account is right.`,
      } as const;
    });
  } catch (error) {
    console.error('[closure] save failed', error);
    return { ok: false, error: 'We could not save the closure. Try again.' };
  }
}

/** The fixed final payment of each project, for the accounts payments desk ("Final payment from closure: ₹X"). */
export async function finalPayments(projectIds: readonly string[]): Promise<Map<string, { finalDuePaise: number; closedOn: string }>> {
  if (!projectIds.length) return new Map();
  const rows = await prisma.homeProjectClosure.findMany({
    where: { projectId: { in: [...projectIds] }, final: true },
    select: { projectId: true, finalDuePaise: true, createdAt: true },
  });
  return new Map(rows.map((r) => [r.projectId, { finalDuePaise: fromDb(r.finalDuePaise), closedOn: istDay(r.createdAt) }]));
}

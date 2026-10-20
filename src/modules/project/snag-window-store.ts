import 'server-only';

/**
 * The snag window's reads (rules in snag-window.ts): one project's window
 * from its closure day, its ledger and the studio's days. Used by the
 * customer's raise (snag-flow.ts), the studio's project header and the
 * customer projection (which reads the same columns itself).
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fromDb } from '@/lib/money';
import { readSignedStages } from '@/modules/portal/payments';
import { ledger, isBackfilled, type Ledger, type PaymentModeName } from './payment-ledger';
import { windowFromLedger, type SnagWindow } from './snag-window';
import { dayFromDb, istDay } from './working-days';

export const SNAG_WINDOW_SELECT = {
  closedOutAt: true,
  paymentPhases: true,
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
      beforeJoining: true,
      recordedAt: true,
      customerConfirmedAt: true,
      disputedAt: true,
    },
  },
  quoteChanges: { select: { deltaPaise: true, stageIndex: true } },
  introduction: { select: { studio: { select: { snagWindowDays: true } } } },
} as const satisfies Prisma.HomeProjectSelect;

type WindowRow = Prisma.HomeProjectGetPayload<{ select: typeof SNAG_WINDOW_SELECT }>;

/** The ledger from the rows (the same as payments-flow.ts `ledgerOf`). */
export function ledgerFromRows(p: Pick<WindowRow, 'paymentPhases' | 'payments' | 'quoteChanges'>): Ledger | null {
  const stages = readSignedStages(p.paymentPhases);
  if (!stages) return null;
  return ledger(
    stages,
    (p.quoteChanges ?? []).map((c) => ({ deltaPaise: fromDb(c.deltaPaise), stageIndex: c.stageIndex })),
    (p.payments ?? []).map((r) => ({
      id: r.id,
      stageIndex: r.stageIndex,
      amountPaise: fromDb(r.amountPaise),
      receivedOn: dayFromDb(r.receivedOn),
      mode: (r.mode ?? null) as PaymentModeName | null,
      receiptDocumentId: r.receiptDocumentId,
      correctsId: r.correctsId,
      recordedAt: r.recordedAt.toISOString(),
      customerConfirmedAt: r.customerConfirmedAt?.toISOString() ?? null,
      disputedAt: r.disputedAt?.toISOString() ?? null,
      backfilled: isBackfilled(r),
    })),
  );
}

export function windowOfRow(p: WindowRow): SnagWindow | null {
  // Not closed out: no window yet (and no ledger read).
  if (!p.closedOutAt) return null;
  return windowFromLedger(istDay(p.closedOutAt), ledgerFromRows(p), p.introduction?.studio?.snagWindowDays ?? 30);
}

/** One project's snag window, or null (not closed out, the handover payment not recorded, or no signed stages). */
export async function snagWindowFor(projectId: string): Promise<SnagWindow | null> {
  const p = await prisma.homeProject.findUnique({ where: { id: projectId }, select: SNAG_WINDOW_SELECT });
  return p ? windowOfRow(p) : null;
}

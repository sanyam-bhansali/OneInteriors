import 'server-only';

/**
 * The reads for the project statement, the money-due list and the closure
 * step's "still due" (owner, 13 Nov 2026). The rules are in
 * statement-rules.ts and closure-due.ts; every figure comes from the payment
 * ledger (payments-flow.ts `ledgerOf`), the same as the Payments tab.
 *
 * - The statement: anyone who may read the project's payments
 *   (`payment.read` on it: owner, accounts, the designer and PM on it).
 * - Money due: the owner, accounts and the design head ("who owes how
 *   much"), across the projects they may see the money of.
 */

import type { ChangeOrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fromDb } from '@/lib/money';
import { currentMember } from '@/modules/studio/access';
import { projectsVisibleTo } from '@/modules/studio/roles';
import { siteLabel } from '@/modules/studio/team-rules';
import { dueAtClosure, type ClosureDue, type DueExtra } from './closure-due';
import { staffOn } from './flow-access';
import { rowStatuses } from './payment-ledger';
import { ledgerOf, toLedgerRow } from './payments-flow';
import { buildStatement, moneyDue, IN_TOTAL_STATUSES, PENDING_STATUSES, type MoneyDueRow, type Statement } from './statement-rules';

const ROW_SELECT = {
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
  changeOrderId: true,
} as const;

const PROJECT_SELECT = {
  paymentPhases: true,
  paidPhases: true,
  signedQuoteId: true,
  designFinalQuoteId: true,
  payments: { select: ROW_SELECT },
  quoteChanges: { orderBy: { at: 'asc' as const }, select: { deltaPaise: true, stageIndex: true, label: true, changeOrderId: true } },
  changeOrders: {
    where: { status: { in: [...IN_TOTAL_STATUSES, ...PENDING_STATUSES] as ChangeOrderStatus[] } },
    orderBy: { number: 'asc' as const },
    select: {
      id: true,
      number: true,
      title: true,
      status: true,
      totalPaise: true,
      scopeQuoteId: true,
      lines: { orderBy: { sortOrder: 'asc' as const }, select: { room: true, product: true, amountPaise: true } },
    },
  },
  introduction: {
    select: {
      studio: { select: { tradeName: true } },
      brief: { select: { society: true, locality: true, propertyType: true, contactName: true, user: { select: { name: true } } } },
    },
  },
} as const;

export interface ProjectStatement {
  projectId: string;
  client: string;
  home: string;
  studio: string;
  /** IST day it was made. */
  on: string;
  statement: Statement;
}

const clientOf = (b: { contactName: string | null; user: { name: string | null } | null }) => b.contactName?.trim() || b.user?.name?.trim() || 'Client';

/** One project's statement; null when the member may not read its money or nothing was signed in the app. */
export async function projectStatement(projectId: string, now = new Date()): Promise<ProjectStatement | null> {
  const staff = await staffOn(projectId, 'payment.read');
  if (!staff.ok) return null;
  const p = await prisma.homeProject.findUnique({ where: { id: projectId }, select: PROJECT_SELECT });
  if (!p) return null;
  const l = ledgerOf(p);
  if (!l) return null;
  const quoteIds = [p.designFinalQuoteId, p.signedQuoteId, ...p.changeOrders.map((o) => o.scopeQuoteId)].filter((x): x is string => Boolean(x));
  const quotes = quoteIds.length
    ? await prisma.studioQuote.findMany({ where: { id: { in: quoteIds }, studioId: staff.studioId }, select: { id: true, number: true } })
    : [];
  const number = new Map(quotes.map((q) => [q.id, q.number]));
  const statuses = new Map(rowStatuses(p.payments.map(toLedgerRow)).map((r) => [r.id, r.status]));
  const statement = buildStatement({
    quoteNumber: (p.designFinalQuoteId && number.get(p.designFinalQuoteId)) || (p.signedQuoteId && number.get(p.signedQuoteId)) || null,
    ledger: l,
    orders: p.changeOrders.map((o) => ({
      id: o.id,
      number: (o.scopeQuoteId && number.get(o.scopeQuoteId)) || `CO-${o.number}`,
      title: o.title,
      status: o.status,
      totalPaise: fromDb(o.totalPaise),
      lines: o.lines.map((x) => ({ room: x.room, product: x.product, amountPaise: fromDb(x.amountPaise) })),
    })),
    changes: p.quoteChanges.map((c) => ({ label: c.label, deltaPaise: fromDb(c.deltaPaise), changeOrderId: c.changeOrderId })),
    payments: p.payments.map((r) => ({ changeOrderId: r.changeOrderId, amountPaise: fromDb(r.amountPaise), status: statuses.get(r.id) ?? 'waiting' })),
  });
  return {
    projectId,
    client: clientOf(p.introduction.brief),
    home: siteLabel(p.introduction.brief),
    studio: p.introduction.studio.tradeName,
    on: new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10),
    statement,
  };
}

/**
 * What is still due when the closure step is ticked: the open payment stages
 * (the last one is the handover payment) and approved extra work not yet
 * paid. Read for anyone who may tick the plan; null with no signed plan.
 */
export async function closureDueFor(projectId: string): Promise<ClosureDue | null> {
  const p = await prisma.homeProject.findUnique({ where: { id: projectId }, select: PROJECT_SELECT });
  if (!p) return null;
  const l = ledgerOf(p);
  if (!l) return null;
  const statuses = new Map(rowStatuses(p.payments.map(toLedgerRow)).map((r) => [r.id, r.status]));
  const extras: DueExtra[] = p.changeOrders
    .filter((o) => o.status === 'APPROVED')
    .map((o) => {
      const recorded = p.payments
        .filter((r) => r.changeOrderId === o.id)
        .filter((r) => {
          const s = statuses.get(r.id);
          return s === 'confirmed' || s === 'earlier' || s === 'waiting';
        })
        .reduce((n, r) => n + fromDb(r.amountPaise), 0);
      return { number: `CO-${o.number}`, title: o.title, openPaise: Math.max(0, fromDb(o.totalPaise) - recorded) };
    });
  return dueAtClosure(l, extras);
}

/** May this member see the studio's money-due list? The owner, accounts and the design head (owner, 13 Nov 2026). */
export const seesMoneyDue = (m: { role: string; designHead?: boolean; status?: string } | null): boolean =>
  m !== null && (m.role === 'OWNER' || m.role === 'ACCOUNTS' || (m.role === 'DESIGNER' && m.designHead === true));

export interface MoneyDueView {
  rows: MoneyDueRow[];
  totals: { totalPaise: number; paidPaise: number; waitingPaise: number; remainingPaise: number };
  canOpen: boolean;
}

/** Who owes how much, across the running projects (not cancelled, not closed out and fully paid). Null when this member may not see it. */
export async function moneyDueList(): Promise<MoneyDueView | null> {
  const member = await currentMember();
  if (!member || !seesMoneyDue(member)) return null;
  const rows = await prisma.homeProject.findMany({
    where: { ...projectsVisibleTo(member, 'payments'), cancelledAt: null },
    orderBy: { startOn: 'desc' },
    take: 300,
    select: {
      id: true,
      closedOutAt: true,
      paymentPhases: true,
      paidPhases: true,
      payments: { select: ROW_SELECT },
      quoteChanges: { select: { deltaPaise: true, stageIndex: true } },
      introduction: { select: { brief: { select: { society: true, locality: true, propertyType: true, contactName: true, user: { select: { name: true } } } } } },
    },
  });
  const projects = rows.map((p) => ({ id: p.id, label: siteLabel(p.introduction.brief), customer: clientOf(p.introduction.brief), ledger: ledgerOf(p), closed: p.closedOutAt !== null }));
  /* Running: a closed-out project stays on the list while it still owes money. */
  const running = projects.filter((p) => !p.closed || (p.ledger?.balancePaise ?? 0) > 0);
  return { ...moneyDue(running), canOpen: member.role !== 'ACCOUNTS' };
}

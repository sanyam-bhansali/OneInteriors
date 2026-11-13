import 'server-only';

/**
 * Additional scope on the studio's project page.
 *
 * 13 Nov 2026 (owner): "It should not open the whole quotation builder. It's
 * an additional item: it should just have a cost and a day. No need to
 * generate a big PDF." "Just a click: write the element, write the cost,
 * write the days, send for approval. That's all." So the project page has a
 * small form: 1 to 10 lines (item, details, amount with GST), what it does to
 * the timeline (moves the project by N days / within the timeline / this item
 * only, by a date), Send for approval (project/change-orders.ts
 * `sendSimpleScope`). Once sent it shows here at once as waiting for the
 * client; approved, it is due that day in Payments, on the project total, and
 * the whole project is on hold until it is paid.
 *
 * 12 Nov 2026: scope was built as a quotation in the builder
 * (studio_quotes.scopeForProjectId). Drafts made that way still show here,
 * open in the builder and can still be sent (`sendAdditionalScope`); no new
 * ones are started.
 */

import { prisma } from '@/lib/prisma';
import { fromDb } from '@/lib/money';
import { readSignedStages } from '@/modules/portal/payments';
import {
  extraPaid,
  extraTotals,
  extrasOpen,
  scopeImpactOf,
  type ChangeOrderStatusName,
  type ScopeImpactView,
} from '@/modules/project/change-order-rules';
import { paymentsByOrder } from '@/modules/project/change-orders';
import { staffOn } from '@/modules/project/flow-access';
import { dayFromDb, istDay } from '@/modules/project/working-days';

export interface ScopeQuoteView {
  id: string;
  number: string;
  /** DRAFT until sent; then the change order carries it. */
  draft: boolean;
  lines: number;
  totalPaise: number;
}

/** A scope sent to the client, as the project page lists it. */
export interface ScopeSentView {
  id: string;
  title: string;
  status: ChangeOrderStatusName;
  lines: { item: string; details: string | null; amountPaise: number }[];
  totalPaise: number;
  /** Amounts include GST (the simple kind). */
  inclGst: boolean;
  impact: ScopeImpactView;
  /** The day its payment is due (the approval day for the simple kind). */
  dueOn: string | null;
  recordedPaise: number;
  declineReason: string | null;
}

export interface ScopeView {
  projectId: string;
  /** Allowed now (the design final is made, the project not closed out, a signed plan to land on), and why not. */
  open: { ok: true } | { ok: false; error: string };
  canWrite: boolean;
  /** 12 Nov builder drafts still to send. */
  drafts: ScopeQuoteView[];
  /** Sent scope, newest first: waiting for the client, approved, paid, declined. Cancelled ones are left out. */
  sent: ScopeSentView[];
  /** Today in India, YYYY-MM-DD: "due today", and the earliest day an item-only date may be. */
  today: string;
}

export async function scopeView(projectId: string, now = new Date()): Promise<ScopeView | null> {
  const staff = await staffOn(projectId, 'payment.read');
  if (!staff.ok) return null;
  const project = await prisma.homeProject.findUnique({ where: { id: projectId }, select: { phase: true, closedOutAt: true, designFinalQuoteId: true, paymentPhases: true } });
  if (!project) return null;
  const [quotes, orders, payRows] = await Promise.all([
    prisma.studioQuote.findMany({
      where: { studioId: staff.studioId, scopeForProjectId: projectId, status: 'DRAFT' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, number: true, discountBps: true, gstBps: true, lines: { select: { code: true, unit: true, ratePaise: true, amountPaise: true, widthMm: true, heightMm: true, qtyMilli: true } } },
    }),
    prisma.homeChangeOrder.findMany({
      where: { projectId, status: { not: 'CANCELLED' }, OR: [{ scopeImpact: { not: null } }, { scopeQuoteId: { not: null } }] },
      orderBy: { number: 'desc' },
      take: 30,
      select: {
        id: true,
        title: true,
        status: true,
        totalPaise: true,
        scopeQuoteId: true,
        scopeImpact: true,
        daysRequired: true,
        itemDueOn: true,
        dueOn: true,
        declineReason: true,
        lines: { orderBy: { sortOrder: 'asc' }, select: { product: true, details: true, amountPaise: true } },
      },
    }),
    prisma.homeProjectPayment.findMany({
      // Every row: corrections chain across rows (change-orders.ts `paymentsByOrder`).
      where: { projectId },
      select: { id: true, changeOrderId: true, stageIndex: true, amountPaise: true, receivedOn: true, mode: true, receiptDocumentId: true, correctsId: true, recordedById: true, beforeJoining: true, recordedAt: true, customerConfirmedAt: true, disputedAt: true },
    }),
  ]);
  const byOrder = paymentsByOrder(payRows);
  const open = !project.designFinalQuoteId
    ? ({ ok: false, error: 'Additional scope opens once the design final quotation is made.' } as const)
    : !readSignedStages(project.paymentPhases)
      ? ({ ok: false, error: 'This project has no signed payment plan for additional scope to land on.' } as const)
      : extrasOpen(project.phase, project.closedOutAt !== null, true);
  return {
    projectId,
    today: istDay(now),
    open,
    canWrite: staff.may('extras.write'),
    drafts: quotes.map((q) => ({
      id: q.id,
      number: q.number,
      draft: true,
      lines: q.lines.length,
      totalPaise: extraTotals(q.lines.map((l) => ({ ...l, ratePaise: fromDb(l.ratePaise), amountPaise: fromDb(l.amountPaise) })), { discountBps: q.discountBps, gstBps: q.gstBps }).totalPaise,
    })),
    sent: orders.flatMap((o) => {
      const impact = scopeImpactOf({ scopeImpact: o.scopeImpact, daysRequired: o.daysRequired, itemDueOn: o.itemDueOn ? dayFromDb(o.itemDueOn) : null, builderScope: o.scopeQuoteId !== null });
      if (!impact || o.status === 'DRAFT') return [];
      const totalPaise = fromDb(o.totalPaise);
      return [
        {
          id: o.id,
          title: o.title,
          status: o.status,
          lines: o.lines.map((l) => ({ item: l.product, details: l.details, amountPaise: fromDb(l.amountPaise) })),
          totalPaise,
          inclGst: o.scopeImpact !== null,
          impact,
          dueOn: o.dueOn ? dayFromDb(o.dueOn) : null,
          recordedPaise: extraPaid(totalPaise, byOrder.get(o.id) ?? []).recordedPaise,
          declineReason: o.status === 'DECLINED' ? o.declineReason : null,
        },
      ];
    }),
  };
}

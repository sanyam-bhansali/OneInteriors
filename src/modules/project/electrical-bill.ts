import 'server-only';

/**
 * The electrical bill (owner, 22 Nov 2026): the writes and the views. Rules in
 * electrical-rules.ts. It is a change order of kind ELECTRICAL, so sending,
 * cancelling and the client's approval are change-orders.ts's own; on
 * approval its total is spread over the unpaid stages (`answerExtra`).
 *
 * - The electrical rate list: kept by the owner or the design head.
 * - A bill: made by whoever may add extra work on the project (the designer,
 *   the PM, the owner), priced from the rate list only.
 */

import { prisma } from '@/lib/prisma';
import { fromDb, toDb } from '@/lib/money';
import { readSignedStages } from '@/modules/portal/payments';
import { currentMember, type StudioMemberRef } from '@/modules/studio/access';
import { extrasOpen } from './change-order-rules';
import { recordEvent } from './events';
import { staffOn } from './flow-access';
import { lockProject } from './payments-flow';
import { checkElectricalLines, ELECTRICAL, ELECTRICAL_TITLE, electricalTotals, parseDiscount, parseQty, type ElectricalItem } from './electrical-rules';

export type ElectricalResult = { ok: true; message: string; id?: string } | { ok: false; error: string };

// ── The rate list ─────────────────────────────────────────────

export const mayKeepRates = (m: StudioMemberRef | null): m is StudioMemberRef => m !== null && !m.viewOnly && (m.role === 'OWNER' || (m.role === 'DESIGNER' && m.designHead === true));

export interface RateRow extends ElectricalItem {
  isActive: boolean;
  sortOrder: number;
}

export async function electricalRates(): Promise<{ rows: RateRow[]; canEdit: boolean } | null> {
  const me = await currentMember();
  if (!me) return null;
  const rows = await prisma.studioElectricalItem.findMany({ where: { studioId: me.studioId }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  return {
    rows: rows.map((r) => ({ id: r.id, name: r.name, unit: r.unit, details: r.details, ratePaise: fromDb(r.ratePaise), isActive: r.isActive, sortOrder: r.sortOrder })),
    canEdit: mayKeepRates(me),
  };
}

const clean = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');

function parseRate(raw: unknown): number | null {
  const s = typeof raw === 'string' ? raw.replace(/[₹,\s]/g, '') : typeof raw === 'number' ? String(raw) : '';
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const p = Math.round(Number(s) * 100);
  return p > 0 && p <= 10_00_000 * 100 ? p : null;
}

/** Adds an item to the rate list, or changes one. */
export async function saveRate(input: { id?: unknown; name: unknown; unit: unknown; details: unknown; rate: unknown }): Promise<ElectricalResult> {
  const me = await currentMember();
  if (!mayKeepRates(me)) return { ok: false, error: 'The owner or the design head keeps the electrical rate list.' };
  const name = clean(input.name, 120);
  if (name.length < 2) return { ok: false, error: 'Name the item, like "Light point".' };
  const unit = clean(input.unit, 20).toLowerCase();
  if (!unit) return { ok: false, error: 'Say what it is counted in: point, metre, nos…' };
  const ratePaise = parseRate(input.rate);
  if (ratePaise === null) return { ok: false, error: 'Write the rate in rupees, like 850.' };
  const data = { name, unit, details: clean(input.details, 300) || null, ratePaise: toDb(ratePaise) };
  const id = typeof input.id === 'string' && input.id ? input.id : null;
  try {
    if (id) {
      const { count } = await prisma.studioElectricalItem.updateMany({ where: { id, studioId: me.studioId }, data });
      if (count !== 1) return { ok: false, error: 'That item is not on your list. Reload the page.' };
      return { ok: true, message: 'Saved. New bills use the new rate; bills already made keep theirs.' };
    }
    const last = await prisma.studioElectricalItem.findFirst({ where: { studioId: me.studioId }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
    await prisma.studioElectricalItem.create({ data: { studioId: me.studioId, ...data, sortOrder: (last?.sortOrder ?? 0) + 10 } });
    return { ok: true, message: `${name} added.` };
  } catch {
    return { ok: false, error: 'An item with that name is on the list already.' };
  }
}

export async function setRateActive(id: unknown, active: boolean): Promise<ElectricalResult> {
  const me = await currentMember();
  if (!mayKeepRates(me)) return { ok: false, error: 'The owner or the design head keeps the electrical rate list.' };
  const { count } = await prisma.studioElectricalItem.updateMany({ where: { id: typeof id === 'string' ? id : '', studioId: me.studioId }, data: { isActive: active } });
  return count === 1 ? { ok: true, message: active ? 'Back on the list.' : 'Taken off the list for new bills.' } : { ok: false, error: 'That item is not on your list.' };
}

async function activeItems(studioId: string): Promise<ElectricalItem[]> {
  const rows = await prisma.studioElectricalItem.findMany({ where: { studioId, isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  return rows.map((r) => ({ id: r.id, name: r.name, unit: r.unit, details: r.details, ratePaise: fromDb(r.ratePaise) }));
}

/** The project's GST rate: the design final's, else the signed quotation's. */
async function gstOf(studioId: string, p: { designFinalQuoteId: string | null; signedQuoteId: string | null }): Promise<{ quoteId: string | null; gstBps: number }> {
  const quoteId = p.designFinalQuoteId ?? p.signedQuoteId;
  if (!quoteId) return { quoteId: null, gstBps: 0 };
  const q = await prisma.studioQuote.findFirst({ where: { id: quoteId, studioId }, select: { id: true, gstBps: true } });
  return q ? { quoteId: q.id, gstBps: q.gstBps } : { quoteId: null, gstBps: 0 };
}

// ── A bill ────────────────────────────────────────────────────

/** Saves the electrical bill as a draft (new, or a draft changed). Rates come from the list, never from the browser. */
export async function saveElectricalDraft(projectId: string, input: { id?: unknown; lines: unknown; discount?: unknown }, now = new Date()): Promise<ElectricalResult> {
  const staff = await staffOn(projectId, 'extras.write');
  if (!staff.ok) return staff;
  const project = await prisma.homeProject.findUnique({ where: { id: projectId }, select: { phase: true, closedOutAt: true, paymentPhases: true, designFinalQuoteId: true, signedQuoteId: true } });
  if (!project) return { ok: false, error: 'That project is gone.' };
  const open = extrasOpen(project.phase, project.closedOutAt !== null, project.designFinalQuoteId !== null);
  if (!open.ok) return { ok: false, error: open.error.replace(/Extra work|extra work/g, 'The electrical bill') };
  if (!readSignedStages(project.paymentPhases)) return { ok: false, error: 'This project has no signed payment plan for the electrical bill to land on.' };
  const items = await activeItems(staff.studioId);
  if (items.length === 0) return { ok: false, error: 'The electrical rate list is empty. The owner or the design head adds the items first.' };
  const checked = checkElectricalLines(input.lines, new Map(items.map((i) => [i.id, i])));
  if (!checked.ok) return checked;
  // 15% off unless the designer changes it (owner, 22 Nov 2026).
  const discountBps = parseDiscount(input.discount);
  if (discountBps === null) return { ok: false, error: 'The discount is a percent from 0 to 50, like 15.' };
  const terms = await gstOf(staff.studioId, project);
  const totals = electricalTotals(checked.lines, terms.gstBps, discountBps);
  const money = { quoteId: terms.quoteId, discountBps, gstBps: terms.gstBps, workPaise: toDb(totals.workPaise), discountPaise: toDb(totals.discountPaise), gstPaise: toDb(totals.gstPaise), totalPaise: toDb(totals.totalPaise) };
  const lineRows = checked.lines.map((l, i) => ({
    productId: null,
    room: 'Electrical',
    product: l.product,
    details: l.details,
    code: 'ONSITE' as const,
    unit: 'UNIT' as const,
    widthMm: null,
    heightMm: null,
    qtyMilli: l.qtyMilli,
    ratePaise: toDb(l.ratePaise),
    amountPaise: toDb(l.amountPaise),
    note: l.note,
    unitLabel: l.unitLabel,
    sortOrder: i,
  }));
  const editId = typeof input.id === 'string' && input.id ? input.id.slice(0, 64) : null;
  try {
    const id = await prisma.$transaction(async (tx) => {
      await lockProject(tx, projectId);
      if (editId) {
        const o = await tx.homeChangeOrder.findFirst({ where: { id: editId, projectId, kind: ELECTRICAL }, select: { id: true, status: true } });
        if (!o) throw new Refused('That electrical bill is not on this project.');
        if (o.status !== 'DRAFT') throw new Refused('Only a draft can be changed. Cancel it and make a new one if the client has not answered.');
        await tx.homeChangeOrderLine.deleteMany({ where: { changeOrderId: o.id } });
        await tx.homeChangeOrder.update({ where: { id: o.id }, data: { ...money, lines: { create: lineRows } } });
        await recordEvent(tx, { projectId, type: 'extra.edited', actor: staff.actor, refId: o.id, at: now, payload: { electrical: true, lines: lineRows.length, totalPaise: totals.totalPaise } });
        return o.id;
      }
      const last = await tx.homeChangeOrder.findFirst({ where: { projectId }, orderBy: { number: 'desc' }, select: { number: true } });
      const row = await tx.homeChangeOrder.create({
        data: { projectId, number: (last?.number ?? 0) + 1, kind: ELECTRICAL, title: ELECTRICAL_TITLE, reason: null, ...money, createdById: staff.userId, lines: { create: lineRows } },
        select: { id: true },
      });
      await tx.homeChangeOrderEvent.create({ data: { changeOrderId: row.id, fromStatus: null, toStatus: 'DRAFT', actorType: staff.actor.type, actorId: staff.userId, at: now } });
      await recordEvent(tx, { projectId, type: 'extra.created', actor: staff.actor, refId: row.id, at: now, payload: { electrical: true, lines: lineRows.length, totalPaise: totals.totalPaise } });
      return row.id;
    });
    return { ok: true, id, message: editId ? 'Draft saved.' : 'Saved as a draft. Send it to the client when it is right.' };
  } catch (error) {
    if (error instanceof Refused) return { ok: false, error: error.message };
    console.error('[electrical] save failed', error);
    return { ok: false, error: 'We could not save the electrical bill. Try again.' };
  }
}

class Refused extends Error {}

export interface ElectricalBillView {
  id: string;
  number: number;
  status: string;
  lines: { product: string; details: string | null; note: string | null; unitLabel: string; qtyMilli: number; ratePaise: number; amountPaise: number; itemId: string | null }[];
  workPaise: number;
  discountBps: number;
  discountPaise: number;
  gstPaise: number;
  totalPaise: number;
  gstBps: number;
  decidedOn: string | null;
  declineReason: string | null;
}

const BILL_SELECT = {
  id: true,
  number: true,
  status: true,
  workPaise: true,
  discountBps: true,
  discountPaise: true,
  gstPaise: true,
  totalPaise: true,
  gstBps: true,
  decidedAt: true,
  declineReason: true,
  lines: { orderBy: { sortOrder: 'asc' }, select: { product: true, details: true, note: true, unitLabel: true, qtyMilli: true, ratePaise: true, amountPaise: true } },
} as const;

function toView(
  o: {
    id: string;
    number: number;
    status: string;
    workPaise: bigint;
    discountBps: number;
    discountPaise: bigint;
    gstPaise: bigint;
    totalPaise: bigint;
    gstBps: number;
    decidedAt: Date | null;
    declineReason: string | null;
    lines: { product: string; details: string | null; note: string | null; unitLabel: string | null; qtyMilli: number | null; ratePaise: bigint; amountPaise: bigint }[];
  },
  items: readonly ElectricalItem[],
): ElectricalBillView {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    lines: o.lines.map((l) => ({
      product: l.product,
      details: l.details,
      note: l.note,
      unitLabel: l.unitLabel ?? 'nos',
      qtyMilli: l.qtyMilli ?? 0,
      ratePaise: fromDb(l.ratePaise),
      amountPaise: fromDb(l.amountPaise),
      itemId: items.find((i) => i.name === l.product)?.id ?? null,
    })),
    workPaise: fromDb(o.workPaise),
    discountBps: o.discountBps,
    discountPaise: fromDb(o.discountPaise),
    gstPaise: fromDb(o.gstPaise),
    totalPaise: fromDb(o.totalPaise),
    gstBps: o.gstBps,
    decidedOn: o.decidedAt ? o.decidedAt.toISOString().slice(0, 10) : null,
    declineReason: o.declineReason,
  };
}

/** The project's electrical bills and the rate list, for its Electrical tab. Null when this person may not see the project's money. */
export async function electricalForProject(projectId: string): Promise<{ bills: ElectricalBillView[]; items: ElectricalItem[]; canWrite: boolean; open: string | null; gstBps: number } | null> {
  const view = await staffOn(projectId, 'payment.read');
  if (!view.ok) return null;
  const write = await staffOn(projectId, 'extras.write');
  const project = await prisma.homeProject.findUnique({ where: { id: projectId }, select: { phase: true, closedOutAt: true, paymentPhases: true, designFinalQuoteId: true, signedQuoteId: true } });
  if (!project) return null;
  const [items, orders, terms] = await Promise.all([
    activeItems(view.studioId),
    prisma.homeChangeOrder.findMany({ where: { projectId, kind: ELECTRICAL }, orderBy: { number: 'desc' }, take: 50, select: BILL_SELECT }),
    gstOf(view.studioId, project),
  ]);
  const open = extrasOpen(project.phase, project.closedOutAt !== null, project.designFinalQuoteId !== null);
  return {
    bills: orders.map((o) => toView(o, items)),
    items,
    canWrite: write.ok,
    open: !open.ok ? open.error.replace(/Extra work|extra work/g, 'The electrical bill') : !readSignedStages(project.paymentPhases) ? 'This project has no signed payment plan for the electrical bill to land on.' : null,
    gstBps: terms.gstBps,
  };
}

/** Approved electrical bills of a project (for its value and its PDF). */
export async function approvedElectrical(projectId: string): Promise<ElectricalBillView[]> {
  const orders = await prisma.homeChangeOrder.findMany({ where: { projectId, kind: ELECTRICAL, status: { in: ['APPROVED', 'PAID'] } }, orderBy: { number: 'asc' }, select: BILL_SELECT });
  return orders.map((o) => toView(o, []));
}

/** The project of a quotation (its design final or the one it was signed on), for the PDF. */
export async function projectOfQuote(quoteId: string): Promise<string | null> {
  const p = await prisma.homeProject.findFirst({ where: { OR: [{ designFinalQuoteId: quoteId }, { signedQuoteId: quoteId }], cancelledAt: null }, select: { id: true } });
  return p?.id ?? null;
}

export { parseQty };

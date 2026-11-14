import 'server-only';

/**
 * Change orders: extra work after design sign-off (owner, 15 Oct 2026). The
 * rules, the statuses and what the client sees are in change-order-rules.ts;
 * this file reads and writes.
 *
 * - The studio (owner; PM and designer on the project, `extras.write`) adds
 *   extra work from the project's Extra work tab: product master lines sized
 *   like the quotation builder, or custom lines with an amount, a reason and
 *   an optional photo or drawing. It is a DRAFT until sent.
 * - Sending tells the client once (push, else email; never WhatsApp) and
 *   files the photo in the locker.
 * - The client (the owner of the brief) approves or declines with a reason,
 *   on the website or the phone app (POST /api/app/v1/extras/:id). Approving
 *   lands the total on the final payment stage (`HomeQuoteChange` with
 *   `changeOrderId`), so the ledger, the closure and the client's payments
 *   all know it is owed, and the signed lines stay as signed.
 * - Accounts (or the owner; `payment.record`) records the money with the
 *   existing payment recording (payments-flow.ts `recordPayment`, the row
 *   carrying `changeOrderId`); the client confirms it as any payment. Once
 *   the recorded money covers it the order is PAID: "Ready to release".
 * - The studio releases it to the factory / the work.
 *
 * Every move writes a `HomeChangeOrderEvent` (append-only) and a project
 * event in the same transaction.
 */

import type { ChangeOrderStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { formatINR, fromDb, toDb } from '@/lib/money';
import { notify, notifyStudio } from '@/modules/notify/service';
import { readSignedStages } from '@/modules/portal/payments';
import { signedDocUrls, storeProjectDoc } from '@/modules/storage/project-docs';
import { quotingStudioId } from '@/modules/studio/lead-scope';
import type { QuoteUnitName, WorkCodeName } from '@/modules/studio-quote/pricing';
import {
  canMove,
  checkDaysRequired,
  checkDeclineReason,
  checkExtraLines,
  checkTitle,
  extraChangeLabel,
  extraPaid,
  extraTotals,
  extrasOpen,
  releaseRefusal,
  checkScopeImpact,
  checkScopeLines,
  scopeImpactOf,
  scopeImpactWords,
  scopeMoveDays,
  scopeTitle,
  sizeLabel,
  type ScopeImpactView,
  STATUS_LABEL,
  TEXT_MAX,
  type ChangeOrderStatusName,
  type ExtraPaid,
  type ProductForExtra,
} from './change-order-rules';
import { recordEvent, type ProjectActor } from './events';
import { staffOn } from './flow-access';
import { isBackfilled, rowStatuses } from './payment-ledger';
import { lockProject, recordPayment, type RecordInput } from './payments-flow';
import { dayFromDb, dayToDb, istDay } from './working-days';
import { holdDays } from '@/modules/studio-hold/rules';
import { shiftPlanForClient } from '@/modules/studio-hold/store';

export type ExtraResult = { ok: true; id?: string; message?: string } | { ok: false; error: string };

type Tx = Prisma.TransactionClient;

const LINE_SELECT = {
  id: true,
  productId: true,
  room: true,
  product: true,
  details: true,
  code: true,
  unit: true,
  widthMm: true,
  heightMm: true,
  qtyMilli: true,
  ratePaise: true,
  amountPaise: true,
} as const;

const ORDER_SELECT = {
  id: true,
  projectId: true,
  number: true,
  title: true,
  reason: true,
  status: true,
  quoteId: true,
  discountBps: true,
  gstBps: true,
  workPaise: true,
  discountPaise: true,
  gstPaise: true,
  totalPaise: true,
  photoDocumentId: true,
  createdById: true,
  createdAt: true,
  sentAt: true,
  decidedAt: true,
  declineReason: true,
  paidAt: true,
  releasedAt: true,
  cancelledAt: true,
  scopeQuoteId: true,
  daysRequired: true,
  dueOn: true,
  scopeImpact: true,
  itemDueOn: true,
  lines: { orderBy: { sortOrder: 'asc' }, select: LINE_SELECT },
  events: { orderBy: { at: 'asc' }, select: { fromStatus: true, toStatus: true, actorType: true, text: true, at: true } },
  quoteChanges: { select: { stageIndex: true } },
} as const satisfies Prisma.HomeChangeOrderSelect;

type OrderRow = Prisma.HomeChangeOrderGetPayload<{ select: typeof ORDER_SELECT }>;

const PAY_SELECT = {
  id: true,
  changeOrderId: true,
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
} as const;

type PayRow = Prisma.HomeProjectPaymentGetPayload<{ select: typeof PAY_SELECT }>;

/** Each order's payment rows with their ledger status, from every row on the project (corrections chain across rows). */
export function paymentsByOrder(rows: readonly PayRow[]): Map<string, { amountPaise: number; status: 'confirmed' | 'earlier' | 'waiting' | 'disputed' | 'replaced'; receivedOn: string }[]> {
  const statuses = rowStatuses(
    rows.map((r) => ({
      id: r.id,
      stageIndex: r.stageIndex,
      amountPaise: fromDb(r.amountPaise),
      receivedOn: dayFromDb(r.receivedOn),
      mode: r.mode,
      receiptDocumentId: r.receiptDocumentId,
      correctsId: r.correctsId,
      recordedAt: r.recordedAt.toISOString(),
      customerConfirmedAt: r.customerConfirmedAt?.toISOString() ?? null,
      disputedAt: r.disputedAt?.toISOString() ?? null,
      backfilled: isBackfilled(r),
    })),
  );
  const orderOf = new Map(rows.map((r) => [r.id, r.changeOrderId]));
  const out = new Map<string, { amountPaise: number; status: 'confirmed' | 'earlier' | 'waiting' | 'disputed' | 'replaced'; receivedOn: string }[]>();
  for (const r of statuses) {
    const order = orderOf.get(r.id);
    if (!order) continue;
    const list = out.get(order) ?? [];
    list.push({ amountPaise: r.amountPaise, status: r.status, receivedOn: r.receivedOn });
    out.set(order, list);
  }
  return out;
}

/** The quotation an order is priced from, and its terms: the design final once there is one, else the signed quotation. */
async function pricingQuote(db: Tx | typeof prisma, studioId: string, p: { designFinalQuoteId: string | null; signedQuoteId: string | null }) {
  const quoteId = p.designFinalQuoteId ?? p.signedQuoteId;
  if (!quoteId) return { quoteId: null, number: null, discountBps: 0, gstBps: 0 };
  const q = await db.studioQuote.findFirst({ where: { id: quoteId, studioId }, select: { id: true, number: true, discountBps: true, gstBps: true } });
  return q ? { quoteId: q.id, number: q.number, discountBps: q.discountBps, gstBps: q.gstBps } : { quoteId: null, number: null, discountBps: 0, gstBps: 0 };
}

/** The studio's active products, for the picker and for pricing a line (never a rate typed in the browser). */
async function productsOf(studioId: string): Promise<ProductForExtra[]> {
  const rows = await prisma.studioProduct.findMany({
    where: { studioId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    take: 600,
    select: { id: true, name: true, code: true, unit: true, details: true, ratePaise: true },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, code: r.code as WorkCodeName, unit: r.unit as QuoteUnitName, details: r.details, ratePaise: fromDb(r.ratePaise) }));
}

async function moveOrder(
  tx: Tx,
  o: { id: string; projectId: string; status: ChangeOrderStatus },
  to: ChangeOrderStatusName,
  actor: ProjectActor,
  at: Date,
  data: Prisma.HomeChangeOrderUpdateManyMutationInput = {},
  text: string | null = null,
): Promise<boolean> {
  // Only from the state read: two taps at once cannot both move it.
  const { count } = await tx.homeChangeOrder.updateMany({ where: { id: o.id, status: o.status }, data: { ...data, status: to } });
  if (count === 0) return false;
  await tx.homeChangeOrderEvent.create({
    data: { changeOrderId: o.id, fromStatus: o.status, toStatus: to, actorType: actor.type, actorId: actor.id ?? null, text, at },
  });
  const type = (
    { SENT_TO_CLIENT: 'extra.sent', APPROVED: 'extra.approved', DECLINED: 'extra.declined', PAID: 'extra.paid', RELEASED: 'extra.released', CANCELLED: 'extra.cancelled', DRAFT: 'extra.edited' } as const
  )[to];
  await recordEvent(tx, { projectId: o.projectId, type, actor, refId: o.id, at, payload: { from: o.status, to } });
  return true;
}

// ── The studio writes ─────────────────────────────────────────

export interface ExtraDraftInput {
  /** Set to edit a draft. */
  id?: unknown;
  title: unknown;
  reason?: unknown;
  lines: unknown;
}

/** Add extra work as a draft, or change a draft. The photo or drawing is optional; a new one replaces the last. */
export async function saveExtraDraft(projectId: string, input: ExtraDraftInput, photo: File | null = null, now = new Date()): Promise<ExtraResult> {
  const staff = await staffOn(projectId, 'extras.write');
  if (!staff.ok) return staff;
  const title = checkTitle(input.title);
  if (!title) return { ok: false, error: 'Give the extra work a name the client will recognise: "Loft in bedroom 2".' };
  const reason = typeof input.reason === 'string' ? input.reason.replace(/\s+/g, ' ').trim().slice(0, TEXT_MAX) || null : null;
  const project = await prisma.homeProject.findUnique({
    where: { id: projectId },
    select: { phase: true, closedOutAt: true, paymentPhases: true, designFinalQuoteId: true, signedQuoteId: true },
  });
  if (!project) return { ok: false, error: 'That project is gone.' };
  const open = extrasOpen(project.phase, project.closedOutAt !== null, project.designFinalQuoteId !== null);
  if (!open.ok) return open;
  if (!readSignedStages(project.paymentPhases)) return { ok: false, error: 'This project was not signed in the app, so there is no payment plan for extra work to land on.' };
  const products = await productsOf(staff.studioId);
  const checked = checkExtraLines(input.lines, new Map(products.map((p) => [p.id, p])));
  if (!checked.ok) return checked;
  const terms = await pricingQuote(prisma, staff.studioId, project);
  const totals = extraTotals(checked.lines, terms);
  if (totals.totalPaise <= 0) return { ok: false, error: 'This comes to nothing after the discount. Check the lines.' };

  let stored: { path: string; name: string; type: string; bytes: number } | null = null;
  if (photo && photo.size > 0) {
    const r = await storeProjectDoc(projectId, photo);
    if (!r.ok) return { ok: false, error: `Not saved: ${r.error}` };
    stored = { path: r.path, name: photo.name, type: photo.type, bytes: photo.size };
  }
  const editId = typeof input.id === 'string' && input.id ? input.id.slice(0, 64) : null;
  const money = {
    quoteId: terms.quoteId,
    discountBps: terms.discountBps,
    gstBps: terms.gstBps,
    workPaise: toDb(totals.workPaise),
    discountPaise: toDb(totals.discountPaise),
    gstPaise: toDb(totals.gstPaise),
    totalPaise: toDb(totals.totalPaise),
  };
  const lineRows = checked.lines.map((l, i) => ({
    productId: l.productId,
    room: l.room,
    product: l.product,
    details: l.details,
    code: l.code,
    unit: l.unit,
    widthMm: l.widthMm,
    heightMm: l.heightMm,
    qtyMilli: l.qtyMilli,
    ratePaise: toDb(l.ratePaise),
    amountPaise: toDb(l.amountPaise),
    sortOrder: i,
  }));
  try {
    const id = await prisma.$transaction(async (tx) => {
      await lockProject(tx, projectId);
      let photoDocumentId: string | null | undefined;
      if (stored) {
        const doc = await tx.homeDocument.create({
          data: {
            projectId,
            kind: 'DRAWINGS',
            title: `Extra work: ${title}`.slice(0, 100),
            storageKey: stored.path,
            originalName: stored.name.slice(0, 200),
            contentType: stored.type,
            bytes: stored.bytes,
            uploadedById: staff.userId,
            byStudio: staff.byStudio,
            // Shared when the order is sent.
            sharedAt: null,
          },
          select: { id: true },
        });
        photoDocumentId = doc.id;
      }
      if (editId) {
        const o = await tx.homeChangeOrder.findFirst({ where: { id: editId, projectId }, select: { id: true, status: true, number: true } });
        if (!o) throw new Refused('That extra work is not on this project.');
        if (o.status !== 'DRAFT') throw new Refused('Only a draft can be changed. Cancel it and add it again if the client has not answered.');
        await tx.homeChangeOrderLine.deleteMany({ where: { changeOrderId: o.id } });
        await tx.homeChangeOrder.update({
          where: { id: o.id },
          data: { title, reason, ...money, ...(photoDocumentId ? { photoDocumentId } : {}), lines: { create: lineRows } },
        });
        await recordEvent(tx, { projectId, type: 'extra.edited', actor: staff.actor, refId: o.id, at: now, payload: { lines: lineRows.length, totalPaise: totals.totalPaise } });
        return o.id;
      }
      const last = await tx.homeChangeOrder.findFirst({ where: { projectId }, orderBy: { number: 'desc' }, select: { number: true } });
      const row = await tx.homeChangeOrder.create({
        data: {
          projectId,
          number: (last?.number ?? 0) + 1,
          title,
          reason,
          ...money,
          photoDocumentId: photoDocumentId ?? null,
          createdById: staff.userId,
          lines: { create: lineRows },
        },
        select: { id: true },
      });
      await tx.homeChangeOrderEvent.create({ data: { changeOrderId: row.id, fromStatus: null, toStatus: 'DRAFT', actorType: staff.actor.type, actorId: staff.userId, at: now } });
      await recordEvent(tx, { projectId, type: 'extra.created', actor: staff.actor, refId: row.id, at: now, payload: { lines: lineRows.length, totalPaise: totals.totalPaise } });
      return row.id;
    });
    return { ok: true, id, message: editId ? 'Draft saved.' : 'Saved as a draft. Send it to the client when it is right.' };
  } catch (error) {
    if (error instanceof Refused) return { ok: false, error: error.message };
    console.error('[extras] save failed', error);
    return { ok: false, error: 'We could not save the extra work. Try again.' };
  }
}

class Refused extends Error {}

async function orderForStudio(id: string) {
  return prisma.homeChangeOrder.findUnique({ where: { id: id.slice(0, 64) }, select: { id: true, projectId: true, status: true, number: true, title: true, totalPaise: true, photoDocumentId: true } });
}

/** Send a draft to the client: they are told once, and the photo is filed in their locker. */
export async function sendExtra(id: string, now = new Date()): Promise<ExtraResult> {
  const o = await orderForStudio(id);
  if (!o) return { ok: false, error: 'That extra work is gone.' };
  const staff = await staffOn(o.projectId, 'extras.write');
  if (!staff.ok) return staff;
  if (!canMove(o.status, 'SENT_TO_CLIENT', 'studio')) return { ok: false, error: `It is ${STATUS_LABEL[o.status].toLowerCase()}, so it cannot be sent.` };
  if (fromDb(o.totalPaise) <= 0) return { ok: false, error: 'It has no price yet.' };
  const project = await prisma.homeProject.findUnique({ where: { id: o.projectId }, select: { phase: true, closedOutAt: true, designFinalQuoteId: true } });
  const open = project ? extrasOpen(project.phase, project.closedOutAt !== null, project.designFinalQuoteId !== null) : ({ ok: false, error: 'That project is gone.' } as const);
  if (!open.ok) return open;
  const moved = await prisma.$transaction(async (tx) => {
    const ok = await moveOrder(tx, o, 'SENT_TO_CLIENT', staff.actor, now, { sentAt: now });
    if (ok && o.photoDocumentId) {
      await tx.homeDocument.updateMany({ where: { id: o.photoDocumentId, projectId: o.projectId, sharedAt: null }, data: { sharedAt: now } });
      await recordEvent(tx, { projectId: o.projectId, type: 'document.shared', actor: staff.actor, refId: o.photoDocumentId, at: now, payload: { kind: 'DRAWINGS', changeOrderId: o.id } });
    }
    return ok;
  });
  if (!moved) return { ok: false, error: 'Someone just changed this. Reload to see it.' };
  if (staff.customerId) void notify(staff.customerId, { kind: 'extra-work', studio: staff.studioName, title: o.title, totalPaise: fromDb(o.totalPaise) });
  return { ok: true, id: o.id, message: 'Sent. The client approves or declines it in the app.' };
}

/** Take back a draft, or a sent order the client has not answered. */
export async function cancelExtra(id: string, now = new Date()): Promise<ExtraResult> {
  const o = await orderForStudio(id);
  if (!o) return { ok: false, error: 'That extra work is gone.' };
  const staff = await staffOn(o.projectId, 'extras.write');
  if (!staff.ok) return staff;
  if (!canMove(o.status, 'CANCELLED', 'studio')) return { ok: false, error: 'Only a draft, or one the client has not answered yet, can be cancelled.' };
  const moved = await prisma.$transaction((tx) => moveOrder(tx, o, 'CANCELLED', staff.actor, now, { cancelledAt: now }));
  return moved ? { ok: true, id: o.id, message: 'Cancelled.' } : { ok: false, error: 'Someone just changed this. Reload to see it.' };
}

/** Paid: release it to the factory / the work. */
export async function releaseExtra(id: string, now = new Date()): Promise<ExtraResult> {
  const o = await orderForStudio(id);
  if (!o) return { ok: false, error: 'That extra work is gone.' };
  const staff = await staffOn(o.projectId, 'extras.write');
  if (!staff.ok) return staff;
  const rows = await prisma.homeProjectPayment.findMany({ where: { projectId: o.projectId }, select: PAY_SELECT });
  const paid = extraPaid(fromDb(o.totalPaise), paymentsByOrder(rows).get(o.id) ?? []);
  const refusal = releaseRefusal(o.status, paid);
  if (refusal) return { ok: false, error: refusal };
  const moved = await prisma.$transaction((tx) => moveOrder(tx, o, 'RELEASED', staff.actor, now, { releasedAt: now, releasedById: staff.userId }));
  return moved ? { ok: true, id: o.id, message: 'Released to the factory / the work.' } : { ok: false, error: 'Someone just changed this. Reload to see it.' };
}

/**
 * Accounts records the money for an approved order: the existing payment
 * recording, on the stage its price landed on, the row carrying the order.
 * Once what is recorded covers it, the order is PAID (ready to release).
 */
export async function recordExtraPayment(id: string, input: Omit<RecordInput, 'stageIndex'>, receipt: File | null = null, now = new Date()): Promise<ExtraResult> {
  const o = await prisma.homeChangeOrder.findUnique({
    where: { id: id.slice(0, 64) },
    select: {
      id: true,
      projectId: true,
      status: true,
      number: true,
      title: true,
      totalPaise: true,
      scopeQuoteId: true,
      daysRequired: true,
      scopeImpact: true,
      itemDueOn: true,
      quoteChanges: { select: { stageIndex: true } },
      project: { select: { paymentPhases: true } },
    },
  });
  if (!o) return { ok: false, error: 'That extra work is gone.' };
  const staff = await staffOn(o.projectId, 'payment.record');
  if (!staff.ok) return staff;
  if (o.status !== 'APPROVED' && o.status !== 'PAID') return { ok: false, error: 'Record a payment for extra work once the client has approved it.' };
  const stages = readSignedStages(o.project.paymentPhases);
  if (!stages) return { ok: false, error: 'This project has no signed payment plan.' };
  const stageIndex = o.quoteChanges[0]?.stageIndex ?? stages.length - 1;
  const r = await recordPayment(o.projectId, { ...input, stageIndex }, receipt, now, { changeOrderId: o.id });
  if (!r.ok) return r;
  const rows = await prisma.homeProjectPayment.findMany({ where: { projectId: o.projectId }, select: PAY_SELECT });
  const paid = extraPaid(fromDb(o.totalPaise), paymentsByOrder(rows).get(o.id) ?? []);
  if (paid.covered && o.status === 'APPROVED') {
    let moved = 0;
    const impact = scopeImpactOf({ scopeImpact: o.scopeImpact, daysRequired: o.daysRequired, itemDueOn: o.itemDueOn ? dayFromDb(o.itemDueOn) : null, builderScope: o.scopeQuoteId !== null });
    await prisma.$transaction(async (tx) => {
      const ok = await moveOrder(tx, o, 'PAID', staff.actor, now, { paidAt: now });
      if (ok && impact) moved = await scopePaid(tx, { projectId: o.projectId, orderId: o.id, impact, label: o.title, byId: staff.userId, actor: staff.actor, now });
    });
    if (impact) return { ok: true, id: r.id, message: `Recorded. The additional scope is paid: the project is off hold${moved > 0 ? ` and the plan moved ${moved} day${moved === 1 ? '' : 's'} later, on the client's side` : ''}.` };
    return { ok: true, id: r.id, message: 'Recorded. The extra work is paid: it can be released.' };
  }
  return { ok: true, id: r.id, message: `Recorded. ${paid.openPaise > 0 ? 'Part paid so far.' : ''}`.trim() };
}

/**
 * Additional scope paid (owner, 12 Nov 2026; 13 Nov: the whole project holds
 * for every kind): its hold ends today and the plan moves later by the days
 * on hold, plus the days the work needs only when it "moves the project", on
 * the client's side. The days moved.
 */
async function scopePaid(tx: Tx, input: { projectId: string; orderId: string; impact: ScopeImpactView; label: string; byId: string; actor: ProjectActor; now: Date }): Promise<number> {
  const today = istDay(input.now);
  const hold = await tx.homeProjectHold.findFirst({ where: { projectId: input.projectId, changeOrderId: input.orderId, status: 'ON' }, select: { id: true, startedOn: true } });
  const held = hold ? holdDays(hold.startedOn ? dayFromDb(hold.startedOn) : null, today, today) : 0;
  const days = scopeMoveDays(held, input.impact);
  if (hold) await tx.homeProjectHold.updateMany({ where: { id: hold.id, status: 'ON' }, data: { status: 'ENDED', endedOn: dayToDb(today), endedById: input.byId, shiftedDays: days } });
  const workDays = input.impact.kind === 'MOVES_PROJECT' ? input.impact.days : 0;
  const note = `${input.label}: paid after ${held} day${held === 1 ? '' : 's'} on hold${workDays > 0 ? `, and ${workDays} day${workDays === 1 ? '' : 's'} for the work` : ''}.`;
  await shiftPlanForClient(tx, { projectId: input.projectId, days, note, byId: input.byId, actor: input.actor, now: input.now, ref: { changeOrderId: input.orderId } });
  if (hold) await recordEvent(tx, { projectId: input.projectId, type: 'project.hold_ended', actor: input.actor, refId: hold.id, at: input.now, payload: { days, changeOrderId: input.orderId } });
  return days;
}

/**
 * Sends an additional-scope quotation to the client (owner, 12 Nov 2026):
 * its lines become a change order priced like extra work (the quotation's
 * discount and GST), with the days the work needs and its payment due today,
 * the day it was built. The client approves the items, the amount and the
 * days in the app.
 */
export async function sendAdditionalScope(projectId: string, quoteId: string, rawDays: unknown, now = new Date()): Promise<ExtraResult> {
  const staff = await staffOn(projectId, 'extras.write');
  if (!staff.ok) return staff;
  const days = checkDaysRequired(rawDays);
  if (!days.ok) return days;
  const project = await prisma.homeProject.findUnique({ where: { id: projectId }, select: { phase: true, closedOutAt: true, paymentPhases: true, designFinalQuoteId: true } });
  if (!project) return { ok: false, error: 'That project is gone.' };
  const open = extrasOpen(project.phase, project.closedOutAt !== null, project.designFinalQuoteId !== null);
  if (!open.ok) return open;
  if (!readSignedStages(project.paymentPhases)) return { ok: false, error: 'This project has no signed payment plan for the additional scope to land on.' };
  const q = await prisma.studioQuote.findFirst({
    where: { id: quoteId.slice(0, 64), studioId: staff.studioId, scopeForProjectId: projectId },
    select: { id: true, number: true, status: true, discountBps: true, gstBps: true, lines: { orderBy: { sortOrder: 'asc' }, select: { room: true, product: true, details: true, code: true, unit: true, widthMm: true, heightMm: true, qtyMilli: true, ratePaise: true, amountPaise: true } } },
  });
  if (!q) return { ok: false, error: 'That additional scope is not on this project.' };
  if (q.status !== 'DRAFT') return { ok: false, error: 'This additional scope was sent already.' };
  if (q.lines.length === 0) return { ok: false, error: 'Add the new items to the quotation first.' };
  const lines = q.lines.map((l) => ({ ...l, ratePaise: fromDb(l.ratePaise), amountPaise: fromDb(l.amountPaise) }));
  const totals = extraTotals(lines, { discountBps: q.discountBps, gstBps: q.gstBps });
  if (totals.totalPaise <= 0) return { ok: false, error: 'This comes to nothing. Check the items.' };
  const title = `Additional scope ${q.number}`;
  try {
    const id = await prisma.$transaction(async (tx) => {
      await lockProject(tx, projectId);
      const sent = await tx.studioQuote.updateMany({ where: { id: q.id, status: 'DRAFT' }, data: { status: 'ISSUED' } });
      if (sent.count !== 1) throw new Refused('This additional scope was sent already.');
      const last = await tx.homeChangeOrder.findFirst({ where: { projectId }, orderBy: { number: 'desc' }, select: { number: true } });
      const row = await tx.homeChangeOrder.create({
        data: {
          projectId,
          number: (last?.number ?? 0) + 1,
          title,
          reason: null,
          quoteId: q.id,
          scopeQuoteId: q.id,
          daysRequired: days.days,
          dueOn: dayToDb(istDay(now)),
          discountBps: q.discountBps,
          gstBps: q.gstBps,
          workPaise: toDb(totals.workPaise),
          discountPaise: toDb(totals.discountPaise),
          gstPaise: toDb(totals.gstPaise),
          totalPaise: toDb(totals.totalPaise),
          createdById: staff.userId,
          lines: { create: lines.map((l, i) => ({ productId: null, room: l.room, product: l.product, details: l.details, code: l.code, unit: l.unit, widthMm: l.widthMm, heightMm: l.heightMm, qtyMilli: l.qtyMilli, ratePaise: toDb(l.ratePaise), amountPaise: toDb(l.amountPaise), sortOrder: i })) },
        },
        select: { id: true, projectId: true, status: true },
      });
      await tx.homeChangeOrderEvent.create({ data: { changeOrderId: row.id, fromStatus: null, toStatus: 'DRAFT', actorType: staff.actor.type, actorId: staff.userId, at: now } });
      await recordEvent(tx, { projectId, type: 'extra.created', actor: staff.actor, refId: row.id, at: now, payload: { lines: lines.length, totalPaise: totals.totalPaise, scope: true, daysRequired: days.days } });
      await moveOrder(tx, row, 'SENT_TO_CLIENT', staff.actor, now, { sentAt: now });
      return row.id;
    });
    if (staff.customerId) void notify(staff.customerId, { kind: 'extra-work', studio: staff.studioName, title, totalPaise: totals.totalPaise });
    return { ok: true, id, message: `Sent to the client: ${title}, due today, ${days.days} day${days.days === 1 ? '' : 's'} more. Once they approve, the project is on hold until it is paid.` };
  } catch (error) {
    if (error instanceof Refused) return { ok: false, error: error.message };
    throw error;
  }
}

export interface SimpleScopeInput {
  /** `{ item, details?, amount }` rows, 1 to 10: amounts in rupees, GST included. */
  lines: unknown;
  /** MOVES_PROJECT | WITHIN_TIMELINE | ITEM_ONLY. */
  impact: unknown;
  /** Days the project moves (MOVES_PROJECT). */
  days?: unknown;
  /** The day the item comes by, YYYY-MM-DD (ITEM_ONLY). */
  date?: unknown;
}

/**
 * Simple additional scope (owner, 13 Nov 2026): "Just a click: write the
 * element, write the cost, write the days, send for approval. That's all."
 * No quotation, no PDF, no discount: each line's amount is what the client
 * pays, GST included. It goes straight to the client (the studio sees it on
 * the project page as waiting for them); on their approval it lands on the
 * project total, is due that day and the whole project holds until it is
 * paid (`answerExtra`, `recordExtraPayment`). The designer on the project,
 * the design head, the PM or the owner sends it (`extras.write`).
 */
export async function sendSimpleScope(projectId: string, input: SimpleScopeInput, now = new Date()): Promise<ExtraResult> {
  const staff = await staffOn(projectId, 'extras.write');
  if (!staff.ok) return staff;
  const checked = checkScopeLines(input.lines);
  if (!checked.ok) return checked;
  const today = istDay(now);
  const impact = checkScopeImpact({ impact: input.impact, days: input.days, date: input.date }, today);
  if (!impact.ok) return impact;
  const project = await prisma.homeProject.findUnique({ where: { id: projectId }, select: { phase: true, closedOutAt: true, paymentPhases: true, designFinalQuoteId: true } });
  if (!project) return { ok: false, error: 'That project is gone.' };
  if (!project.designFinalQuoteId) return { ok: false, error: 'Additional scope opens once the design final quotation is made.' };
  const open = extrasOpen(project.phase, project.closedOutAt !== null, true);
  if (!open.ok) return open;
  if (!readSignedStages(project.paymentPhases)) return { ok: false, error: 'This project has no signed payment plan for the additional scope to land on.' };
  const i = impact.impact;
  const totalPaise = checked.totalPaise;
  try {
    const sent = await prisma.$transaction(async (tx) => {
      await lockProject(tx, projectId);
      const [last, scopes] = await Promise.all([
        tx.homeChangeOrder.findFirst({ where: { projectId }, orderBy: { number: 'desc' }, select: { number: true } }),
        tx.homeChangeOrder.count({ where: { projectId, OR: [{ scopeImpact: { not: null } }, { scopeQuoteId: { not: null } }] } }),
      ]);
      const title = scopeTitle(scopes);
      const row = await tx.homeChangeOrder.create({
        data: {
          projectId,
          number: (last?.number ?? 0) + 1,
          title,
          // Never a reason text (owner, 13 Nov 2026): the client sees item, details, cost and the impact.
          reason: null,
          quoteId: null,
          scopeImpact: i.kind,
          daysRequired: i.kind === 'MOVES_PROJECT' ? i.days : 0,
          itemDueOn: i.kind === 'ITEM_ONLY' ? dayToDb(i.on) : null,
          dueOn: dayToDb(today),
          // "No discount on these. One line item costing, take it or leave it." Amounts include GST.
          discountBps: 0,
          gstBps: 0,
          workPaise: toDb(totalPaise),
          discountPaise: toDb(0),
          gstPaise: toDb(0),
          totalPaise: toDb(totalPaise),
          createdById: staff.userId,
          lines: {
            create: checked.lines.map((l, n) => ({
              productId: null,
              room: null,
              product: l.item,
              details: l.details,
              code: 'ONSITE' as const,
              unit: 'UNIT' as const,
              widthMm: null,
              heightMm: null,
              qtyMilli: 1000,
              ratePaise: toDb(l.amountPaise),
              amountPaise: toDb(l.amountPaise),
              sortOrder: n,
            })),
          },
        },
        select: { id: true, projectId: true, status: true },
      });
      await tx.homeChangeOrderEvent.create({ data: { changeOrderId: row.id, fromStatus: null, toStatus: 'DRAFT', actorType: staff.actor.type, actorId: staff.userId, at: now } });
      await recordEvent(tx, { projectId, type: 'extra.created', actor: staff.actor, refId: row.id, at: now, payload: { lines: checked.lines.length, totalPaise, scope: true, impact: i.kind } });
      await moveOrder(tx, row, 'SENT_TO_CLIENT', staff.actor, now, { sentAt: now });
      return { id: row.id, title };
    });
    if (staff.customerId) void notify(staff.customerId, { kind: 'extra-work', studio: staff.studioName, title: sent.title, totalPaise });
    return { ok: true, id: sent.id, message: `Sent for approval: ${sent.title}, ${formatINR(totalPaise)} with GST (“${scopeImpactWords(i)}”). Once approved, it is due that day and the project is on hold until it is paid.` };
  } catch (error) {
    if (error instanceof Refused) return { ok: false, error: error.message };
    throw error;
  }
}

// ── The client answers ────────────────────────────────────────

/** The owner of the brief approves or declines an order sent to them. Approving puts its price on the final payment stage. */
export async function answerExtra(userId: string, id: string, answer: { approve: unknown; reason?: unknown }, now = new Date()): Promise<ExtraResult> {
  const o = await prisma.homeChangeOrder.findUnique({
    where: { id: id.slice(0, 64) },
    select: {
      id: true,
      projectId: true,
      status: true,
      number: true,
      title: true,
      totalPaise: true,
      createdById: true,
      scopeQuoteId: true,
      scopeImpact: true,
      project: { select: { paymentPhases: true, introduction: { select: { studioId: true, brief: { select: { userId: true } } } } } },
    },
  });
  if (!o || o.project.introduction.brief.userId !== userId) return { ok: false, error: 'That extra work is not on your project.' };
  const approve = answer.approve === true;
  const to: ChangeOrderStatusName = approve ? 'APPROVED' : 'DECLINED';
  if (o.status === to) return { ok: true, id: o.id };
  if (!canMove(o.status, to, 'customer')) {
    return { ok: false, error: o.status === 'CANCELLED' ? 'The studio took this back.' : 'You have answered this already.' };
  }
  let reason: string | null = null;
  if (!approve) {
    const r = checkDeclineReason(answer.reason);
    if (!r.ok) return r;
    reason = r.reason;
  }
  const stages = readSignedStages(o.project.paymentPhases);
  const actor: ProjectActor = { type: 'CUSTOMER', id: userId };
  const totalPaise = fromDb(o.totalPaise);
  /* Additional scope: the 12 Nov builder-made kind or the 13 Nov simple kind. */
  const scope = o.scopeQuoteId !== null || o.scopeImpact !== null;
  const moved = await prisma.$transaction(async (tx) => {
    await lockProject(tx, o.projectId);
    // Simple scope (owner, 13 Nov 2026): "once the client approves, it shows in Payments as due today".
    const due = approve && o.scopeImpact !== null ? { dueOn: dayToDb(istDay(now)) } : {};
    const ok = await moveOrder(tx, o, to, actor, now, { decidedAt: now, decidedById: userId, declineReason: reason, ...due }, reason);
    if (!ok) return false;
    if (approve && stages) {
      const change = await tx.homeQuoteChange.create({
        data: { projectId: o.projectId, changeOrderId: o.id, label: extraChangeLabel(o.number, o.title), deltaPaise: toDb(totalPaise), stageIndex: stages.length - 1, byId: userId, at: now },
        select: { id: true },
      });
      await recordEvent(tx, { projectId: o.projectId, type: 'quote.changed', actor, refId: change.id, at: now, payload: { changeOrderId: o.id, deltaPaise: totalPaise, stageIndex: stages.length - 1 } });
    }
    if (scope) {
      if (o.scopeQuoteId) await tx.studioQuote.updateMany({ where: { id: o.scopeQuoteId }, data: { status: approve ? 'ACCEPTED' : 'DECLINED' } });
      // Additional scope (owner, 12 Nov 2026; 13 Nov: "yes the whole project on hold", every kind): on hold from the approval until the payment is recorded. Not when a hold is on already.
      if (approve && (await tx.homeProjectHold.count({ where: { projectId: o.projectId, status: { in: ['ASKED', 'ON'] } } })) === 0) {
        const hold = await tx.homeProjectHold.create({
          data: { projectId: o.projectId, status: 'ON', reason: 'ADDITIONAL_SCOPE', askedById: o.createdById, askedAt: now, decidedById: userId, decidedAt: now, startedOn: dayToDb(istDay(now)), changeOrderId: o.id },
          select: { id: true },
        });
        await recordEvent(tx, { projectId: o.projectId, type: 'project.hold_started', actor, refId: hold.id, at: now, payload: { reason: 'ADDITIONAL_SCOPE', changeOrderId: o.id } });
      }
    }
    return true;
  });
  if (!moved) return { ok: false, error: 'You have answered this already. Pull down to see it.' };
  const event = { kind: 'extra-answered', projectId: o.projectId, title: `Extra work ${o.number}: ${o.title}`, approved: approve, totalPaise } as const;
  void notifyStudio(o.project.introduction.studioId, event);
  void notify(o.createdById, event, { email: false });
  return { ok: true, id: o.id, message: approve ? (scope ? 'Approved. The payment is due now; the project restarts once it is paid.' : 'Approved. Pay the studio for it; they start once it is paid.') : 'Declined. The studio has your reason.' };
}

// ── What the studio reads ─────────────────────────────────────

export interface StudioExtraLine {
  product: string;
  room: string | null;
  details: string | null;
  size: string | null;
  ratePaise: number;
  amountPaise: number;
  fromMaster: boolean;
}

export interface StudioExtra {
  id: string;
  number: number;
  title: string;
  reason: string | null;
  status: ChangeOrderStatusName;
  statusLabel: string;
  lines: StudioExtraLine[];
  workPaise: number;
  discountPaise: number;
  discountBps: number;
  gstBps: number;
  gstPaise: number;
  totalPaise: number;
  paid: ExtraPaid;
  createdOn: string;
  sentOn: string | null;
  decidedOn: string | null;
  declineReason: string | null;
  paidOn: string | null;
  releasedOn: string | null;
  photoUrl: string | null;
  history: { from: string | null; to: string; by: string; text: string | null; on: string }[];
  /**
   * Additional scope (owner, 12 Nov 2026): its quotation (the 12 Nov builder
   * kind; null for the 13 Nov simple kind), the extra days, the day its
   * payment is due, and what it does to the timeline. Null on ordinary extra
   * work. `inclGst`: the simple kind's amounts include GST (no GST line).
   */
  scope: { quoteId: string | null; daysRequired: number; dueOn: string | null; impact: ScopeImpactView; inclGst: boolean } | null;
  /** For the lines editor: the raw lines of a draft. */
  draftLines: { productId: string | null; room: string | null; description: string; widthMm: number | null; heightMm: number | null; qty: string | null; amount: string | null; code: WorkCodeName }[];
}

export interface StudioExtras {
  projectId: string;
  extras: StudioExtra[];
  /** Approved extras (approved, paid, released), GST included: the quotation's "Extras after sign-off". */
  approvedPaise: number;
  /** The quotation they are priced from and its terms. */
  quote: { id: string | null; number: string | null; discountBps: number; gstBps: number };
  /** May add extra work now (and why not). */
  open: { ok: true } | { ok: false; error: string };
  canWrite: boolean;
  canRecord: boolean;
  products: ProductForExtra[];
  noPlan: boolean;
}

const ACTOR_WORD: Record<string, string> = { CUSTOMER: 'Client', STUDIO: 'Studio', OPS: 'One Interiors', SYSTEM: 'System' };

function toStudioExtra(o: OrderRow, rows: Map<string, { amountPaise: number; status: 'confirmed' | 'earlier' | 'waiting' | 'disputed' | 'replaced'; receivedOn: string }[]>, photoUrl: string | null): StudioExtra {
  const totalPaise = fromDb(o.totalPaise);
  const impact = scopeImpactOf({ scopeImpact: o.scopeImpact, daysRequired: o.daysRequired, itemDueOn: o.itemDueOn ? dayFromDb(o.itemDueOn) : null, builderScope: o.scopeQuoteId !== null });
  return {
    id: o.id,
    number: o.number,
    title: o.title,
    reason: o.reason,
    status: o.status,
    statusLabel: STATUS_LABEL[o.status],
    lines: o.lines.map((l) => ({
      product: l.product,
      room: l.room,
      details: l.details,
      size: sizeLabel({ unit: l.unit, widthMm: l.widthMm, heightMm: l.heightMm, qtyMilli: l.qtyMilli, productId: l.productId }),
      ratePaise: fromDb(l.ratePaise),
      amountPaise: fromDb(l.amountPaise),
      fromMaster: l.productId !== null,
    })),
    workPaise: fromDb(o.workPaise),
    discountPaise: fromDb(o.discountPaise),
    discountBps: o.discountBps,
    gstBps: o.gstBps,
    gstPaise: fromDb(o.gstPaise),
    totalPaise,
    paid: extraPaid(totalPaise, rows.get(o.id) ?? []),
    createdOn: istDay(o.createdAt),
    sentOn: o.sentAt ? istDay(o.sentAt) : null,
    decidedOn: o.decidedAt ? istDay(o.decidedAt) : null,
    declineReason: o.declineReason,
    scope: impact ? { quoteId: o.scopeQuoteId, daysRequired: o.daysRequired ?? 0, dueOn: o.dueOn ? dayFromDb(o.dueOn) : null, impact, inclGst: o.scopeImpact !== null } : null,
    paidOn: o.paidAt ? istDay(o.paidAt) : null,
    releasedOn: o.releasedAt ? istDay(o.releasedAt) : null,
    photoUrl,
    history: o.events.map((e) => ({ from: e.fromStatus, to: e.toStatus, by: ACTOR_WORD[e.actorType] ?? 'Studio', text: e.text, on: istDay(e.at) })),
    draftLines:
      o.status === 'DRAFT'
        ? o.lines.map((l) => ({
            productId: l.productId,
            room: l.room,
            description: l.product,
            widthMm: l.widthMm,
            heightMm: l.heightMm,
            qty: l.productId && l.unit !== 'AREA' && l.qtyMilli ? String(l.qtyMilli / 1000) : null,
            amount: l.productId ? null : String(fromDb(l.amountPaise) / 100),
            code: l.code as WorkCodeName,
          }))
        : [],
  };
}

export const APPROVED_SET: readonly ChangeOrderStatusName[] = ['APPROVED', 'PAID', 'RELEASED'];

/** The project's change orders for the studio (those who see its money: `payment.read`). Null when they may not. */
export async function extrasForStudio(projectId: string): Promise<StudioExtras | null> {
  const staff = await staffOn(projectId, 'payment.read');
  if (!staff.ok) return null;
  const [project, orders, rows] = await Promise.all([
    prisma.homeProject.findUnique({ where: { id: projectId }, select: { phase: true, closedOutAt: true, paymentPhases: true, designFinalQuoteId: true, signedQuoteId: true } }),
    prisma.homeChangeOrder.findMany({ where: { projectId }, orderBy: { number: 'desc' }, take: 100, select: ORDER_SELECT }),
    prisma.homeProjectPayment.findMany({ where: { projectId }, select: PAY_SELECT }),
  ]);
  if (!project) return null;
  const canWrite = staff.may('extras.write');
  const [quote, products, docs] = await Promise.all([
    pricingQuote(prisma, staff.studioId, project),
    canWrite ? productsOf(staff.studioId) : Promise.resolve([]),
    prisma.homeDocument.findMany({
      where: { projectId, id: { in: orders.map((o) => o.photoDocumentId).filter((x): x is string => Boolean(x)) }, deletedAt: null },
      select: { id: true, storageKey: true },
    }),
  ]);
  const urls = await signedDocUrls(docs.map((d) => d.storageKey));
  const urlOf = new Map(docs.map((d, i) => [d.id, urls[i] || null]));
  const byOrder = paymentsByOrder(rows);
  const extras = orders.map((o) => toStudioExtra(o, byOrder, o.photoDocumentId ? (urlOf.get(o.photoDocumentId) ?? null) : null));
  return {
    projectId,
    extras,
    approvedPaise: extras.filter((e) => APPROVED_SET.includes(e.status)).reduce((a, e) => a + e.totalPaise, 0),
    quote: { id: quote.quoteId, number: quote.number, discountBps: quote.discountBps, gstBps: quote.gstBps },
    open: extrasOpen(project.phase, project.closedOutAt !== null, project.designFinalQuoteId !== null),
    canWrite,
    canRecord: staff.may('payment.record'),
    products,
    noPlan: readSignedStages(project.paymentPhases) === null,
  };
}

/** Approved change orders for the closure: read-only lines, apart from the closure's own extras. */
export async function approvedExtras(db: Tx | typeof prisma, projectId: string): Promise<{ id: string; number: number; title: string; status: ChangeOrderStatusName; totalPaise: number }[]> {
  const rows = await db.homeChangeOrder.findMany({
    where: { projectId, status: { in: [...APPROVED_SET] } },
    orderBy: { number: 'asc' },
    select: { id: true, number: true, title: true, status: true, totalPaise: true },
  });
  return rows.map((r) => ({ id: r.id, number: r.number, title: r.title, status: r.status, totalPaise: fromDb(r.totalPaise) }));
}

/** Per project: how many orders wait for the client, and how many are paid and ready to release (the designer's My Execution). */
export async function extraCounts(projectIds: readonly string[]): Promise<Map<string, { withClient: number; toRelease: number; toPay: number }>> {
  const out = new Map<string, { withClient: number; toRelease: number; toPay: number }>();
  if (!projectIds.length) return out;
  const rows = await prisma.homeChangeOrder.groupBy({
    by: ['projectId', 'status'],
    where: { projectId: { in: [...projectIds] }, status: { in: ['SENT_TO_CLIENT', 'APPROVED', 'PAID'] } },
    _count: { _all: true },
  });
  for (const r of rows) {
    const c = out.get(r.projectId) ?? { withClient: 0, toRelease: 0, toPay: 0 };
    if (r.status === 'SENT_TO_CLIENT') c.withClient += r._count._all;
    else if (r.status === 'PAID') c.toRelease += r._count._all;
    else c.toPay += r._count._all;
    out.set(r.projectId, c);
  }
  return out;
}


export interface ExtraToCollect {
  id: string;
  projectId: string;
  number: number;
  title: string;
  status: ChangeOrderStatusName;
  totalPaise: number;
  paid: ExtraPaid;
  /** Additional scope (owner, 13 Nov 2026): "shows in Payments as due today". Null on ordinary extra work. */
  scopeDueOn: string | null;
}

/**
 * Approved extra work still to be paid, for the accounts payments desk
 * (/studio/payments): the projects are the ones the desk already lists for
 * this member (payments-flow.ts `paymentsDesk`); recording goes through
 * `recordExtraPayment`, which checks `payment.record` on the project.
 */
export async function extrasToCollect(projectIds: readonly string[]): Promise<Map<string, ExtraToCollect[]>> {
  const out = new Map<string, ExtraToCollect[]>();
  if (!projectIds.length) return out;
  const orders = await prisma.homeChangeOrder.findMany({
    where: { projectId: { in: [...projectIds] }, status: { in: ['APPROVED', 'PAID'] } },
    orderBy: { number: 'asc' },
    select: { id: true, projectId: true, number: true, title: true, status: true, totalPaise: true, dueOn: true, scopeQuoteId: true, scopeImpact: true },
  });
  if (!orders.length) return out;
  const rows = await prisma.homeProjectPayment.findMany({ where: { projectId: { in: [...new Set(orders.map((o) => o.projectId))] } }, select: { ...PAY_SELECT, projectId: true } });
  const byProject = new Map<string, PayRow[]>();
  for (const r of rows) byProject.set(r.projectId, [...(byProject.get(r.projectId) ?? []), r]);
  const paidBy = new Map<string, ReturnType<typeof paymentsByOrder>>();
  for (const [pid, list] of byProject) paidBy.set(pid, paymentsByOrder(list));
  for (const o of orders) {
    const paid = extraPaid(fromDb(o.totalPaise), paidBy.get(o.projectId)?.get(o.id) ?? []);
    if (o.status === 'PAID' && paid.covered) continue;
    out.set(o.projectId, [...(out.get(o.projectId) ?? []), { id: o.id, projectId: o.projectId, number: o.number, title: o.title, status: o.status, totalPaise: fromDb(o.totalPaise), paid, scopeDueOn: (o.scopeQuoteId !== null || o.scopeImpact !== null) && o.dueOn ? dayFromDb(o.dueOn) : null }]);
  }
  return out;
}

/**
 * The quotation's "Extras after sign-off": approved change orders priced
 * from this quotation (approved, paid or released), for the quotation's
 * document. Scoped to the member's quoting studio; the signed lines are
 * never touched.
 */
export async function extrasOnQuote(quoteId: string): Promise<{ number: number; title: string; status: ChangeOrderStatusName; workPaise: number; discountPaise: number; gstPaise: number; totalPaise: number; approvedOn: string | null }[]> {
  const studioId = await quotingStudioId();
  if (!studioId) return [];
  const rows = await prisma.homeChangeOrder.findMany({
    where: { quoteId, status: { in: [...APPROVED_SET] }, project: { introduction: { studioId } } },
    orderBy: { number: 'asc' },
    select: { number: true, title: true, status: true, workPaise: true, discountPaise: true, gstPaise: true, totalPaise: true, decidedAt: true },
  });
  return rows.map((r) => ({
    number: r.number,
    title: r.title,
    status: r.status,
    workPaise: fromDb(r.workPaise),
    discountPaise: fromDb(r.discountPaise),
    gstPaise: fromDb(r.gstPaise),
    totalPaise: fromDb(r.totalPaise),
    approvedOn: r.decidedAt ? istDay(r.decidedAt) : null,
  }));
}

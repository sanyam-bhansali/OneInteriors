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
import { fromDb, toDb } from '@/lib/money';
import { notify, notifyStudio } from '@/modules/notify/service';
import { readSignedStages } from '@/modules/portal/payments';
import { signedDocUrls, storeProjectDoc } from '@/modules/storage/project-docs';
import { quotingStudioId } from '@/modules/studio/lead-scope';
import type { QuoteUnitName, WorkCodeName } from '@/modules/studio-quote/pricing';
import {
  canMove,
  checkDeclineReason,
  checkExtraLines,
  checkTitle,
  extraChangeLabel,
  extraPaid,
  extraTotals,
  extrasOpen,
  releaseRefusal,
  sizeLabel,
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
import { dayFromDb, istDay } from './working-days';

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
  const open = extrasOpen(project.phase, project.closedOutAt !== null);
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
  const project = await prisma.homeProject.findUnique({ where: { id: o.projectId }, select: { phase: true, closedOutAt: true } });
  const open = project ? extrasOpen(project.phase, project.closedOutAt !== null) : ({ ok: false, error: 'That project is gone.' } as const);
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
    select: { id: true, projectId: true, status: true, number: true, title: true, totalPaise: true, quoteChanges: { select: { stageIndex: true } }, project: { select: { paymentPhases: true } } },
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
    await prisma.$transaction((tx) => moveOrder(tx, o, 'PAID', staff.actor, now, { paidAt: now }));
    return { ok: true, id: r.id, message: 'Recorded. The extra work is paid: it can be released.' };
  }
  return { ok: true, id: r.id, message: `Recorded. ${paid.openPaise > 0 ? 'Part paid so far.' : ''}`.trim() };
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
  const moved = await prisma.$transaction(async (tx) => {
    await lockProject(tx, o.projectId);
    const ok = await moveOrder(tx, o, to, actor, now, { decidedAt: now, decidedById: userId, declineReason: reason }, reason);
    if (!ok) return false;
    if (approve && stages) {
      const change = await tx.homeQuoteChange.create({
        data: { projectId: o.projectId, changeOrderId: o.id, label: extraChangeLabel(o.number, o.title), deltaPaise: toDb(totalPaise), stageIndex: stages.length - 1, byId: userId, at: now },
        select: { id: true },
      });
      await recordEvent(tx, { projectId: o.projectId, type: 'quote.changed', actor, refId: change.id, at: now, payload: { changeOrderId: o.id, deltaPaise: totalPaise, stageIndex: stages.length - 1 } });
    }
    return true;
  });
  if (!moved) return { ok: false, error: 'You have answered this already. Pull down to see it.' };
  const event = { kind: 'extra-answered', projectId: o.projectId, title: `Extra work ${o.number}: ${o.title}`, approved: approve, totalPaise } as const;
  void notifyStudio(o.project.introduction.studioId, event);
  void notify(o.createdById, event, { email: false });
  return { ok: true, id: o.id, message: approve ? 'Approved. Pay the studio for it; they start once it is paid.' : 'Declined. The studio has your reason.' };
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
    open: extrasOpen(project.phase, project.closedOutAt !== null),
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
    select: { id: true, projectId: true, number: true, title: true, status: true, totalPaise: true },
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
    out.set(o.projectId, [...(out.get(o.projectId) ?? []), { id: o.id, projectId: o.projectId, number: o.number, title: o.title, status: o.status, totalPaise: fromDb(o.totalPaise), paid }]);
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

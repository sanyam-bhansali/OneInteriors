import 'server-only';

/**
 * Payments on a customer's project (studio workspace Phase 5, brief §6):
 *
 * - Accounts or the owner marks money received against a stage: amount, the
 *   day it arrived, how (UPI, bank, cheque, cash), and the receipt, which is
 *   filed in the customer's locker by itself. One `HomeProjectPayment` row,
 *   never edited; a mistake is put right with a correction row.
 * - Overpaying a stage is refused with the difference said in rupees
 *   (payment-ledger.ts `canRecord`, the `canPay()` pattern).
 * - The customer confirms with one tap, or says "I didn't pay this", which
 *   goes to our team (ops) with their words; the studio sees only that it
 *   is being looked into.
 * - Paid and balance are computed from the rows every time
 *   (payment-ledger.ts). Backfilled rows count as paid (see there).
 *
 * Every write is one transaction with its `HomeProjectEvent`, and keeps
 * `HomeProject.paidPhases[].paidOn` in step for the readers that still use it
 * (payment-ledger.ts `mirrorPaidOn`). The project row is locked first, so
 * two people recording the same money at once cannot both get past the
 * overpayment check.
 */

import type { PaymentMode, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fromDb, toDb } from '@/lib/money';
import { readSignedStages } from '@/modules/portal/payments';
import { notify, notifyOps } from '@/modules/notify/service';
import { signedDocUrls, storeProjectDoc } from '@/modules/storage/project-docs';
import { currentMember, projectsVisibleTo } from '@/modules/studio/access';
import { can } from '@/modules/studio/roles';
import { siteLabel } from '@/modules/studio/team-rules';
import { recordEvent, type ProjectActor } from './events';
import { staffOn, type Staff } from './flow-access';
import { dayFromDb, dayToDb, isDay, istDay } from './working-days';
import {
  canRecord,
  dueDates,
  isBackfilled,
  isPaymentMode,
  ledger,
  mirrorPaidOn,
  parseRupees,
  rupees,
  suggestedStage,
  type Ledger,
  type LedgerRow,
  type LedgerRowInput,
  type PaymentModeName,
} from './payment-ledger';

export type FlowResult = { ok: true; id?: string } | { ok: false; error: string };

type Tx = Prisma.TransactionClient;

const ROW_SELECT = {
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
} as const;

type RowRecord = Prisma.HomeProjectPaymentGetPayload<{ select: typeof ROW_SELECT }>;

export const toLedgerRow = (r: RowRecord): LedgerRowInput => ({
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
});

const MONEY_SELECT = {
  paymentPhases: true,
  paidPhases: true,
  payments: { select: ROW_SELECT },
  quoteChanges: { select: { deltaPaise: true, stageIndex: true } },
} as const;

type MoneyRecord = Prisma.HomeProjectGetPayload<{ select: typeof MONEY_SELECT }>;

/** The project's ledger from its rows; null when nothing was signed in the app (no stages to pay against). */
export function ledgerOf(p: MoneyRecord): Ledger | null {
  const stages = readSignedStages(p.paymentPhases);
  if (!stages) return null;
  return ledger(
    stages,
    p.quoteChanges.map((c) => ({ deltaPaise: fromDb(c.deltaPaise), stageIndex: c.stageIndex })),
    p.payments.map(toLedgerRow),
  );
}

/** Lock the project row for the rest of the transaction: payments on it are checked and written one at a time. */
export async function lockProject(tx: Tx, projectId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "home_projects" WHERE "id" = ${projectId} FOR UPDATE`;
}

async function moneyIn(tx: Tx, projectId: string): Promise<{ record: MoneyRecord; ledger: Ledger } | null> {
  const record = await tx.homeProject.findUnique({ where: { id: projectId }, select: MONEY_SELECT });
  if (!record) return null;
  const l = ledgerOf(record);
  return l ? { record, ledger: l } : null;
}

/** Rewrite `paidPhases[].paidOn` from the rows, inside the same transaction. */
export async function mirror(tx: Tx, projectId: string): Promise<void> {
  const now = await moneyIn(tx, projectId);
  if (!now) return;
  await tx.homeProject.update({ where: { id: projectId }, data: { paidPhases: mirrorPaidOn(now.record.paidPhases, now.ledger) as unknown as Prisma.InputJsonValue } });
}

class Refused extends Error {}

// ── The studio records money received ─────────────────────────

export interface RecordInput {
  stageIndex: unknown;
  /** Rupees as typed: "7,36,000". */
  amount: unknown;
  /** "YYYY-MM-DD". */
  receivedOn: unknown;
  mode: unknown;
  /** Only your team: UTR, cheque number, who paid. */
  note?: unknown;
}

interface CheckedPayment {
  stageIndex: number;
  amountPaise: number;
  receivedOn: string;
  mode: PaymentModeName | null;
  note: string | null;
}

export function checkPaymentInput(input: RecordInput, now = new Date(), opts: { modeOptional?: boolean } = {}): { ok: true; value: CheckedPayment } | { ok: false; error: string } {
  const stageIndex = typeof input.stageIndex === 'string' ? Number(input.stageIndex) : input.stageIndex;
  if (typeof stageIndex !== 'number' || !Number.isInteger(stageIndex) || stageIndex < 0) return { ok: false, error: 'Pick the payment stage.' };
  const amountPaise = parseRupees(input.amount);
  if (amountPaise === null || amountPaise <= 0) return { ok: false, error: 'Enter the amount received, in rupees.' };
  if (!isDay(input.receivedOn)) return { ok: false, error: 'Pick the day the money arrived.' };
  if (input.receivedOn > istDay(now)) return { ok: false, error: 'The day the money arrived cannot be in the future.' };
  if (input.receivedOn < '2020-01-01') return { ok: false, error: 'Pick the day the money arrived.' };
  const mode = isPaymentMode(input.mode) ? input.mode : null;
  if (!mode && !opts.modeOptional) return { ok: false, error: 'Say how it was paid: UPI, bank transfer, cheque or cash.' };
  const note = typeof input.note === 'string' ? input.note.trim().replace(/\s+/g, ' ').slice(0, 300) || null : null;
  return { ok: true, value: { stageIndex, amountPaise, receivedOn: input.receivedOn, mode, note } };
}

async function writePayment(
  staff: Staff,
  projectId: string,
  p: CheckedPayment,
  opts: { receipt?: { path: string; name: string; type: string; bytes: number } | null; correctsId?: string | null; changeOrderId?: string | null } = {},
): Promise<{ ok: true; id: string; stageLabel: string } | { ok: false; error: string }> {
  try {
    const out = await prisma.$transaction(async (tx) => {
      await lockProject(tx, projectId);
      const money = await moneyIn(tx, projectId);
      if (!money) throw new Refused('This project has no signed payment plan, so there is nothing to record against.');
      const stage = money.ledger.stages[p.stageIndex];
      if (!stage) throw new Refused('That payment stage is not on this project.');
      // A correction is checked as if the row it replaces were already gone.
      const l = opts.correctsId
        ? ledger(
            readSignedStages(money.record.paymentPhases)!,
            money.record.quoteChanges.map((c) => ({ deltaPaise: fromDb(c.deltaPaise), stageIndex: c.stageIndex })),
            [...money.record.payments.map(toLedgerRow), { ...ghost(opts.correctsId), stageIndex: p.stageIndex }],
          )
        : money.ledger;
      if (p.amountPaise > 0) {
        const allowed = canRecord(l, p.stageIndex, p.amountPaise);
        if (!allowed.ok) throw new Refused(allowed.error);
      }
      let receiptDocumentId: string | null = null;
      if (opts.receipt) {
        const doc = await tx.homeDocument.create({
          data: {
            projectId,
            kind: 'RECEIPT',
            title: `Receipt: ${stage.label}, ${rupees(p.amountPaise)}`.slice(0, 100),
            storageKey: opts.receipt.path,
            originalName: opts.receipt.name.slice(0, 200),
            contentType: opts.receipt.type,
            bytes: opts.receipt.bytes,
            uploadedById: staff.userId,
            byStudio: staff.byStudio,
            sharedAt: new Date(),
          },
          select: { id: true },
        });
        receiptDocumentId = doc.id;
        await recordEvent(tx, { projectId, type: 'document.filed', actor: staff.actor, refId: doc.id, payload: { kind: 'RECEIPT' } });
      }
      const row = await tx.homeProjectPayment.create({
        data: {
          projectId,
          stageIndex: p.stageIndex,
          amountPaise: toDb(p.amountPaise),
          receivedOn: dayToDb(p.receivedOn),
          mode: p.mode as PaymentMode | null,
          receiptDocumentId,
          note: p.note,
          recordedById: staff.userId,
          correctsId: opts.correctsId ?? null,
          /* Money for a change order (project/change-orders.ts); a correction keeps the order of the row it replaces. */
          changeOrderId: opts.changeOrderId ?? null,
        },
        select: { id: true },
      });
      await recordEvent(tx, {
        projectId,
        type: opts.correctsId ? 'payment.corrected' : 'payment.recorded',
        actor: staff.actor,
        refId: row.id,
        payload: {
          stageIndex: p.stageIndex,
          amountPaise: p.amountPaise,
          mode: p.mode,
          receipt: receiptDocumentId !== null,
          ...(opts.correctsId ? { corrects: opts.correctsId } : {}),
          ...(opts.changeOrderId ? { changeOrderId: opts.changeOrderId } : {}),
        },
      });
      await mirror(tx, projectId);
      return { id: row.id, stageLabel: stage.label };
    });
    return { ok: true, ...out };
  } catch (error) {
    if (error instanceof Refused) return { ok: false, error: error.message };
    throw error;
  }
}

/** A zero row correcting `id`: what "this row is gone" looks like to the ledger. */
function ghost(id: string): LedgerRowInput {
  return {
    id: `ghost:${id}`,
    stageIndex: -1,
    amountPaise: 0,
    receivedOn: '2020-01-01',
    mode: null,
    receiptDocumentId: null,
    correctsId: id,
    recordedAt: '9999-12-31T00:00:00.000Z',
    customerConfirmedAt: null,
    disputedAt: null,
    backfilled: false,
  };
}

/**
 * Mark money received against a stage, with the receipt when there is one.
 * Accounts and the owner (`payment.record`); ops too. The customer is asked
 * to confirm it.
 */
export async function recordPayment(
  projectId: string,
  input: RecordInput,
  receipt: File | null = null,
  now = new Date(),
  /* A payment for a change order (project/change-orders.ts `recordExtraPayment`). */
  opts: { changeOrderId?: string | null } = {},
): Promise<FlowResult> {
  const staff = await staffOn(projectId, 'payment.record');
  if (!staff.ok) return staff;
  const check = checkPaymentInput(input, now);
  if (!check.ok) return check;
  let stored: { path: string; name: string; type: string; bytes: number } | null = null;
  if (receipt && receipt.size > 0) {
    const r = await storeProjectDoc(projectId, receipt);
    if (!r.ok) return { ok: false, error: `The payment was not saved: ${r.error}` };
    stored = { path: r.path, name: receipt.name, type: receipt.type, bytes: receipt.size };
  }
  const r = await writePayment(staff, projectId, check.value, { receipt: stored, changeOrderId: opts.changeOrderId ?? null });
  if (!r.ok) return r;
  if (staff.customerId) {
    void notify(staff.customerId, { kind: 'payment-to-confirm', stage: r.stageLabel, amountPaise: check.value.amountPaise, studio: staff.studioName });
  }
  return { ok: true, id: r.id };
}

/**
 * Put a recorded payment right: a new row replacing it, with the corrected
 * amount (0 = recorded by mistake). The original stays, marked replaced.
 * The customer is asked to confirm the new figure.
 */
export async function correctPayment(paymentId: string, input: { amount: unknown }): Promise<FlowResult> {
  const original = await prisma.homeProjectPayment.findUnique({
    where: { id: paymentId },
    select: { ...ROW_SELECT, projectId: true, note: true, changeOrderId: true, corrections: { select: { id: true } } },
  });
  if (!original) return { ok: false, error: 'That payment is not on record.' };
  const staff = await staffOn(original.projectId, 'payment.record');
  if (!staff.ok) return staff;
  if (original.corrections.length) return { ok: false, error: 'This entry was already corrected. Correct the newer one.' };
  const amountPaise = input.amount === 0 || input.amount === '0' ? 0 : parseRupees(input.amount);
  if (amountPaise === null) return { ok: false, error: 'Enter the right amount, in rupees, or 0 if nothing came in.' };
  if (amountPaise === fromDb(original.amountPaise)) return { ok: false, error: 'That is the amount already recorded.' };
  const r = await writePayment(
    staff,
    original.projectId,
    {
      stageIndex: original.stageIndex,
      amountPaise,
      receivedOn: dayFromDb(original.receivedOn),
      mode: original.mode,
      note: original.note,
    },
    { correctsId: original.id, changeOrderId: original.changeOrderId },
  );
  if (!r.ok) return r;
  if (staff.customerId && amountPaise > 0) {
    void notify(staff.customerId, { kind: 'payment-to-confirm', stage: r.stageLabel, amountPaise, studio: staff.studioName });
  }
  return { ok: true, id: r.id };
}

/**
 * The older "Mark received" / "Undo" on a stage (project-store.ts
 * `setPaymentStage`, the /studio/updates screen): received records what is
 * still open on the stage, mode not said; undo corrects every live entry on
 * the stage to zero. Both are rows, so paid and balance stay the rows' sums.
 */
export async function setStagePaidFromLegacy(projectId: string, index: number, paidOn: string | null): Promise<FlowResult> {
  const staff = await staffOn(projectId, 'payment.record');
  if (!staff.ok) return staff;
  const project = await prisma.homeProject.findUnique({ where: { id: projectId }, select: MONEY_SELECT });
  const l = project ? ledgerOf(project) : null;
  const stage = l?.stages[index];
  if (!l || !stage) return { ok: false, error: 'That payment stage is not on this project.' };
  if (paidOn) {
    if (stage.openPaise === 0) return { ok: true };
    const check = checkPaymentInput({ stageIndex: index, amount: stage.openPaise / 100, receivedOn: paidOn, mode: null }, new Date(), { modeOptional: true });
    if (!check.ok) return check;
    const r = await writePayment(staff, projectId, check.value);
    if (!r.ok) return r;
    if (staff.customerId) void notify(staff.customerId, { kind: 'payment-to-confirm', stage: stage.label, amountPaise: check.value.amountPaise, studio: staff.studioName });
    return { ok: true, id: r.id };
  }
  const live = l.rows.filter((row) => row.stageIndex === index && row.status !== 'replaced' && row.amountPaise > 0);
  for (const row of live) {
    const r = await writePayment(
      staff,
      projectId,
      { stageIndex: index, amountPaise: 0, receivedOn: row.receivedOn, mode: row.mode, note: null },
      { correctsId: row.id },
    );
    if (!r.ok) return r;
  }
  return { ok: true };
}

// ── The customer answers ──────────────────────────────────────

async function customersPayment(userId: string, paymentId: string) {
  const row = await prisma.homeProjectPayment.findUnique({
    where: { id: paymentId },
    select: {
      ...ROW_SELECT,
      projectId: true,
      corrections: { select: { id: true } },
      project: {
        select: {
          paymentPhases: true,
          introduction: { select: { studio: { select: { tradeName: true } }, brief: { select: { userId: true, contactName: true, user: { select: { name: true } } } } } },
        },
      },
    },
  });
  // Only the owner of the brief answers for money; family can see, not confirm.
  if (!row || row.project.introduction.brief.userId !== userId) return null;
  return row;
}

/** "Yes, I paid this." One tap; once. */
export async function confirmPayment(userId: string, paymentId: string, now = new Date()): Promise<FlowResult> {
  const row = await customersPayment(userId, paymentId);
  if (!row) return { ok: false, error: 'That payment is not on your project.' };
  if (row.corrections.length) return { ok: false, error: 'The studio corrected this entry. Pull down to see the new one.' };
  if (row.customerConfirmedAt) return { ok: true, id: row.id };
  if (row.disputedAt) return { ok: false, error: 'You told us you did not pay this. Our team is looking into it and will call you.' };
  const actor: ProjectActor = { type: 'CUSTOMER', id: userId };
  await prisma.$transaction(async (tx) => {
    await lockProject(tx, row.projectId);
    const { count } = await tx.homeProjectPayment.updateMany({
      where: { id: row.id, customerConfirmedAt: null, disputedAt: null },
      data: { customerConfirmedAt: now, customerConfirmedById: userId },
    });
    if (count === 0) return;
    await recordEvent(tx, { projectId: row.projectId, type: 'payment.confirmed', actor, refId: row.id, payload: { stageIndex: row.stageIndex, amountPaise: fromDb(row.amountPaise) } });
    await mirror(tx, row.projectId);
  });
  return { ok: true, id: row.id };
}

/** "I didn't pay this." Goes to our team with the customer's words; the stage is owed again. */
export async function disputePayment(userId: string, paymentId: string, note: unknown, now = new Date()): Promise<FlowResult> {
  const row = await customersPayment(userId, paymentId);
  if (!row) return { ok: false, error: 'That payment is not on your project.' };
  if (row.corrections.length) return { ok: false, error: 'The studio corrected this entry. Pull down to see the new one.' };
  if (row.disputedAt) return { ok: true, id: row.id };
  if (row.customerConfirmedAt) return { ok: false, error: 'You confirmed this payment earlier. If that was a mistake, ask your expert.' };
  const words = typeof note === 'string' ? note.trim().replace(/\s+/g, ' ').slice(0, 600) || null : null;
  const actor: ProjectActor = { type: 'CUSTOMER', id: userId };
  let written = false;
  await prisma.$transaction(async (tx) => {
    await lockProject(tx, row.projectId);
    const { count } = await tx.homeProjectPayment.updateMany({
      where: { id: row.id, customerConfirmedAt: null, disputedAt: null },
      data: { disputedAt: now, disputedById: userId, disputeNote: words },
    });
    if (count === 0) return;
    written = true;
    await recordEvent(tx, { projectId: row.projectId, type: 'payment.disputed', actor, refId: row.id, payload: { stageIndex: row.stageIndex, amountPaise: fromDb(row.amountPaise) } });
    await mirror(tx, row.projectId);
  });
  if (written) {
    const brief = row.project.introduction.brief;
    const stages = readSignedStages(row.project.paymentPhases);
    void notifyOps({
      kind: 'payment-disputed',
      customer: brief.contactName?.trim() || brief.user?.name?.trim() || 'A customer',
      studio: row.project.introduction.studio.tradeName,
      stage: stages?.[row.stageIndex]?.label ?? `Stage ${row.stageIndex + 1}`,
      amountPaise: fromDb(row.amountPaise),
      note: words,
    });
  }
  return { ok: true, id: row.id };
}

// ── What the studio reads ─────────────────────────────────────

export interface StudioPaymentRow {
  id: string;
  stageIndex: number;
  stageLabel: string;
  amountPaise: number;
  receivedOn: string;
  mode: PaymentModeName | null;
  status: LedgerRow['status'];
  /** Signed link to the receipt in the locker, or null. */
  receiptUrl: string | null;
  /** Only your team. */
  note: string | null;
  /** The entry this one corrected. */
  replaces: string | null;
  /** The newest of its chain, so it can still be corrected. */
  live: boolean;
}

export interface StudioPayments {
  projectId: string;
  ledger: Ledger;
  rows: StudioPaymentRow[];
  /** The stage a new payment is most likely for, and what is open on it. */
  suggested: { index: number; openPaise: number } | null;
  /** Each stage's due date, as the studio set it ("YYYY-MM-DD"). */
  dueOn: Record<number, string>;
  canRecord: boolean;
  /** Setting when a stage is due: accounts, the owner, or the PM on the project (studio/roles.ts). */
  canSetDue: boolean;
}

const PROJECT_MONEY_SELECT = {
  ...MONEY_SELECT,
  payments: { select: { ...ROW_SELECT, note: true, receiptDocument: { select: { storageKey: true, deletedAt: true } } } },
} as const;

type ProjectMoney = Prisma.HomeProjectGetPayload<{ select: typeof PROJECT_MONEY_SELECT }>;

async function studioView(projectId: string, p: ProjectMoney, mayRecord: boolean, maySetDue: boolean): Promise<StudioPayments | null> {
  const l = ledgerOf(p);
  if (!l) return null;
  const byId = new Map(p.payments.map((r) => [r.id, r]));
  const receipts = l.rows.map((r) => byId.get(r.id)?.receiptDocument);
  const keys = receipts.map((d) => (d && !d.deletedAt ? d.storageKey : null));
  const signed = await signedDocUrls(keys.filter((k): k is string => k !== null));
  let k = 0;
  const urls = keys.map((key) => (key ? signed[k++] || null : null));
  return {
    projectId,
    ledger: l,
    rows: l.rows.map((r, i) => ({
      id: r.id,
      stageIndex: r.stageIndex,
      stageLabel: l.stages[r.stageIndex]?.label ?? `Stage ${r.stageIndex + 1}`,
      amountPaise: r.amountPaise,
      receivedOn: r.receivedOn,
      mode: r.mode,
      status: r.status,
      receiptUrl: urls[i] ?? null,
      note: byId.get(r.id)?.note ?? null,
      replaces: r.replaces,
      live: r.status !== 'replaced',
    })),
    suggested: (() => {
      const s = suggestedStage(l);
      return s ? { index: s.index, openPaise: s.openPaise } : null;
    })(),
    dueOn: Object.fromEntries(dueDates(p.paidPhases)),
    canRecord: mayRecord,
    canSetDue: maySetDue,
  };
}

/** One project's payments for the studio (`payment.read`): the ledger, every entry, and whether this person may record. */
export async function studioPayments(projectId: string): Promise<StudioPayments | null> {
  const staff = await staffOn(projectId, 'payment.read');
  if (!staff.ok) return null;
  const p = await prisma.homeProject.findUnique({ where: { id: projectId }, select: PROJECT_MONEY_SELECT });
  if (!p) return null;
  return studioView(projectId, p, staff.may('payment.record'), staff.may('payment.record') || staff.may('plan.edit'));
}

export interface DeskProject {
  id: string;
  label: string;
  customer: string;
  payments: StudioPayments | null;
  /** May open the project workspace (accounts may not: money only). */
  canOpen: boolean;
}

/**
 * The accounts landing (/studio/payments): every project this member may
 * read the money of (`projectsVisibleTo(member, 'payments')` — accounts and
 * the owner: all; a PM: theirs; a supervisor: none), each with its ledger.
 */
export async function paymentsDesk(): Promise<DeskProject[]> {
  const member = await currentMember();
  if (!member) return [];
  const mayRecord = can(member, 'payment.record', { assigned: true });
  const mayDue = mayRecord || can(member, 'plan.edit', { assigned: true });
  const mayOpen = can(member, 'project.read', { assigned: true });
  const rows = await prisma.homeProject.findMany({
    where: { ...projectsVisibleTo(member, 'payments'), cancelledAt: null },
    orderBy: { startOn: 'desc' },
    take: 200,
    select: {
      id: true,
      ...PROJECT_MONEY_SELECT,
      introduction: { select: { brief: { select: { society: true, locality: true, propertyType: true, contactName: true, user: { select: { name: true } } } } } },
    },
  });
  return Promise.all(
    rows.map(async (p) => ({
      id: p.id,
      label: siteLabel(p.introduction.brief),
      customer: p.introduction.brief.contactName?.trim() || p.introduction.brief.user?.name?.trim() || 'Customer',
      payments: await studioView(p.id, p, mayRecord, mayDue),
      canOpen: mayOpen,
    })),
  );
}


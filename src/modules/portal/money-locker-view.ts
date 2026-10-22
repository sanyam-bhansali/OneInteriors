/**
 * Phase 5's part of the customer projection (customer-project-view.ts):
 * decisions' options as rows, the money from the payment rows, the recorded
 * quote changes, the materials with their product codes, and the versioned
 * documents. Pure; the selects name every column read, and the mappers build
 * each field by hand (tests/customer-projection.test.ts).
 *
 * Never selected here: `studioCostDeltaPaise`, a payment's `note`,
 * `disputeNote`, `recordedById`, `customerConfirmedById`, `disputedById`,
 * a quote change's `byId`.
 */

import { fromDb } from '@/lib/money';
import { customerChoice, changesFromRows, type CustomerChoice } from '@/modules/project/decision-rules';
import { dueDates, isBackfilled, ledger, type Ledger, type PaymentModeName, type RowStatus, type StageState } from '@/modules/project/payment-ledger';
import { decisionOfDoc } from '@/modules/project/locker-rules';
import type { ChangesView, MoneyView, PayStage } from './payments';
import { readSignedStages } from './payments';

/** A decision's options, for the customer: never the studio's cost. */
export const CUSTOMER_CHOICE_SELECT = { id: true, sortOrder: true, label: true, detail: true, photoPath: true, swatch: true, deltaPaise: true } as const;

/** Payments as the customer may see them: never the note, the dispute's words or who recorded it. */
export const CUSTOMER_PAYMENT_SELECT = {
  id: true,
  stageIndex: true,
  amountPaise: true,
  receivedOn: true,
  mode: true,
  receiptDocumentId: true,
  correctsId: true,
  recordedAt: true,
  customerConfirmedAt: true,
  disputedAt: true,
  /* Received before the project was brought in: counts as paid ('earlier'). */
  beforeJoining: true,
} as const;

export const CUSTOMER_QUOTE_CHANGE_SELECT = {
  id: true,
  decisionId: true,
  label: true,
  deltaPaise: true,
  stageIndex: true,
  at: true,
  option: { select: { label: true } },
  decision: { select: { title: true } },
} as const;

export const CUSTOMER_MATERIAL_SELECT = { id: true, room: true, item: true, spec: true, productCode: true, orderedAt: true } as const;

// ── Decisions ─────────────────────────────────────────────────

type ChoiceRow = { id: string; label: string; detail: string | null; photoPath?: string | null; swatch: string | null; deltaPaise: bigint | number };

/** The options as rows; `photos[i]` is choice i's signed link ("" for none). */
export function customerChoices(choices: readonly ChoiceRow[] | undefined, photos: readonly string[] = []): CustomerChoice[] {
  return (choices ?? []).map((c, i) => customerChoice(c, photos[i] || null));
}

// ── Money ─────────────────────────────────────────────────────

type PaymentRow = {
  id: string;
  stageIndex: number;
  amountPaise: bigint;
  receivedOn?: Date | null;
  mode?: string | null;
  receiptDocumentId?: string | null;
  correctsId?: string | null;
  recordedAt?: Date | null;
  customerConfirmedAt?: Date | null;
  disputedAt?: Date | null;
  beforeJoining?: boolean | null;
};

type ChangeRow = {
  id: string;
  decisionId?: string | null;
  label: string;
  deltaPaise: bigint;
  stageIndex?: number | null;
  at?: Date | null;
  option?: { label: string } | null;
  decision?: { title: string } | null;
};

export interface CustomerPaymentEntry {
  id: string;
  stageIndex: number;
  stage: string;
  amountPaise: number;
  /** "YYYY-MM-DD". */
  receivedOn: string;
  mode: PaymentModeName | null;
  /** waiting = asks the customer to confirm; earlier = recorded before confirmations started (counts as paid). */
  status: Exclude<RowStatus, 'replaced'>;
  /** The receipt in the locker, when there is one. */
  receiptDocumentId: string | null;
  /** The owner may confirm or say "I didn't pay this" (family can only see). */
  canAnswer: boolean;
}

export interface CustomerPaymentStage {
  index: number;
  label: string;
  amountPaise: number;
  /** Recorded quote changes landing on this stage (decisions, on the last one). */
  changesPaise: number;
  paidPaise: number;
  waitingPaise: number;
  state: StageState;
  dueOn: string | null;
}

export interface CustomerPayments {
  /** As signed. */
  signedPaise: number;
  /** Recorded changes so far (may be negative). */
  changesPaise: number;
  /** What the job costs now. */
  totalPaise: number;
  /** Confirmed, or recorded before confirmations started. */
  paidPaise: number;
  /** Recorded by the studio, waiting for the customer's yes. */
  waitingPaise: number;
  balancePaise: number;
  stages: CustomerPaymentStage[];
  /** Newest first; corrected-away entries left out. */
  entries: CustomerPaymentEntry[];
}

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '');

/** The ledger from the rows the projection read; null when nothing was signed in the app. */
export function customerLedger(p: { paymentPhases: unknown; payments?: readonly PaymentRow[]; quoteChanges?: readonly ChangeRow[] }): Ledger | null {
  const stages = readSignedStages(p.paymentPhases);
  if (!stages) return null;
  return ledger(
    stages,
    (p.quoteChanges ?? []).map((c) => ({ deltaPaise: fromDb(c.deltaPaise), stageIndex: c.stageIndex ?? null })),
    (p.payments ?? []).map((r) => ({
      id: r.id,
      stageIndex: r.stageIndex,
      amountPaise: fromDb(r.amountPaise),
      receivedOn: day(r.receivedOn),
      mode: (r.mode ?? null) as PaymentModeName | null,
      receiptDocumentId: r.receiptDocumentId ?? null,
      correctsId: r.correctsId ?? null,
      recordedAt: r.recordedAt?.toISOString() ?? '',
      customerConfirmedAt: r.customerConfirmedAt?.toISOString() ?? null,
      disputedAt: r.disputedAt?.toISOString() ?? null,
      backfilled: isBackfilled(r),
    })),
  );
}

/** The payments block of the customer's project. `sharedDocs` are the ids of documents the customer can open. */
export function customerPayments(l: Ledger | null, marks: unknown, owner: boolean, sharedDocs: ReadonlySet<string>): CustomerPayments | null {
  if (!l) return null;
  const due = dueDates(marks);
  return {
    signedPaise: l.signedPaise,
    changesPaise: l.changesPaise,
    totalPaise: l.totalPaise,
    paidPaise: l.paidPaise,
    waitingPaise: l.waitingPaise,
    balancePaise: l.balancePaise,
    stages: l.stages.map((s) => ({
      index: s.index,
      label: s.label,
      amountPaise: s.amountPaise,
      changesPaise: s.changesPaise,
      paidPaise: s.paidPaise,
      waitingPaise: s.waitingPaise,
      state: s.state,
      dueOn: due.get(s.index) ?? null,
    })),
    entries: l.rows
      .filter((r): r is typeof r & { status: Exclude<RowStatus, 'replaced'> } => r.status !== 'replaced' && r.amountPaise > 0)
      .reverse()
      .map((r) => ({
        id: r.id,
        stageIndex: r.stageIndex,
        stage: l.stages[r.stageIndex]?.label ?? `Stage ${r.stageIndex + 1}`,
        amountPaise: r.amountPaise,
        receivedOn: r.receivedOn,
        mode: r.mode,
        status: r.status,
        receiptDocumentId: r.receiptDocumentId && sharedDocs.has(r.receiptDocumentId) ? r.receiptDocumentId : null,
        canAnswer: owner && (r.status === 'waiting' || r.status === 'earlier'),
      })),
  };
}

/**
 * The older `money` block, same shape, now from the rows: the total includes
 * recorded changes (the final stage carries them), a stage is paid once its
 * counted payments cover it, and its paid day is the last of them.
 */
export function moneyFromLedger(l: Ledger | null, marks: unknown): MoneyView | null {
  if (!l) return null;
  const due = dueDates(marks);
  let nextFound = false;
  const stages: PayStage[] = l.stages.map((s) => {
    const paid = s.state === 'paid';
    const state: PayStage['state'] = paid ? 'paid' : nextFound ? 'later' : 'next';
    if (!paid) nextFound = true;
    return { label: s.label, pct: s.pct, amountPaise: s.amountPaise, index: s.index, dueOn: due.get(s.index) ?? null, paidOn: s.paidOn, state };
  });
  return {
    contractPaise: l.totalPaise,
    paidPaise: l.paidPaise,
    next: stages.find((s) => s.state === 'next') ?? null,
    laterPaise: stages.filter((s) => s.state === 'later').reduce((n, s) => n + s.amountPaise, 0),
    stages,
  };
}

/** "Changes so far", from the recorded quote changes. */
export function changesFromQuote(rows: readonly ChangeRow[] | undefined): ChangesView {
  return changesFromRows(
    (rows ?? []).map((r) => ({
      id: r.id,
      decisionId: r.decisionId ?? null,
      label: r.label,
      deltaPaise: fromDb(r.deltaPaise),
      at: r.at ?? null,
      decisionTitle: r.decision?.title ?? null,
      optionLabel: r.option?.label ?? null,
    })),
  );
}

// ── Locker ────────────────────────────────────────────────────

export interface CustomerMaterial {
  id: string;
  room: string;
  item: string;
  /** What it is: the quoted spec, or the option picked on a decision. */
  spec: string | null;
  /** Added by the studio when ordered. */
  productCode: string | null;
  ordered: boolean;
}

type MaterialRow = { id: string; room: string; item: string; spec: string | null; productCode: string | null; orderedAt: Date | null };

export function customerMaterials(rows: readonly MaterialRow[] | undefined): CustomerMaterial[] {
  return (rows ?? []).map((m) => ({ id: m.id, room: m.room, item: m.item, spec: m.spec, productCode: m.orderedAt ? m.productCode : null, ordered: m.orderedAt !== null }));
}

/** Which documents the customer sees: the newest shared version of each (an older one replaced by a shared revision drops out). */
export function visibleDocIndexes(docs: readonly { id: string; supersedesId?: string | null }[]): number[] {
  const replaced = new Set(docs.map((d) => d.supersedesId).filter((id): id is string => Boolean(id)));
  return docs.map((d, i) => (replaced.has(d.id) ? -1 : i)).filter((i) => i >= 0);
}

/** The decision a filed outcome opens, for the app to open its own screen. */
export const docDecisionId = (storageKey: string): string | null => decisionOfDoc(storageKey);

/**
 * Where the customer's project is, in three lines (owner, 13 Oct 2026;
 * docs/studio-os/PROJECT-LIFECYCLE.md): the current step, the next step,
 * and the one thing the customer must do to unlock it — or "Nothing needed
 * from you" with what the studio is doing. Pure, built from what the
 * projection already lets the customer see (the design card, the tracker's
 * stages and starred milestones, the payment ledger, snags, decisions), so
 * nothing internal can come through here: no unstarred step name, no crew
 * money, no team note. Tested in tests/customer-lifecycle.test.ts and the
 * no-leak block of tests/customer-projection.test.ts.
 *
 * Words are not built here: `kind`s and plain values go out, and the
 * website and the phone app say them in English, Hindi or Marathi.
 */

import type { Phase } from '@/modules/project/lifecycle-rules';
import { mayRaiseSnag, type SnagWindow } from '@/modules/project/snag-window';
import type { CustomerDesign } from '@/modules/studio-design/customer-view';
import type { CustomerPayments } from './money-locker-view';
import type { CustomerTracker } from './tracker-view';

export type CustomerPhase = 'design' | 'execution' | 'closure' | 'snags' | 'warranty' | 'closed';

export type StepKind =
  /** A design milestone, by its (starred) name. */
  | 'design'
  /** An execution stage, by the studio's stage name. */
  | 'stage'
  /** The design as a whole (no starred step left). */
  | 'design_done'
  | 'closure'
  | 'snags'
  | 'sign_off'
  | 'warranty'
  | 'closed';

export interface CustomerLifecycleStep {
  kind: StepKind;
  /** The milestone's or stage's name, for `design` and `stage`; null otherwise. */
  label: string | null;
}

export type BlockerKind =
  /** Pay a payment stage: `label` is the stage, `amountPaise` what is open on it. */
  | 'pay'
  /** Confirm a payment the studio recorded (`count` entries). */
  | 'confirm_payment'
  /** Answer a drawing or 3D render (`label` the first one's title, `count` how many wait). */
  | 'answer_drawing'
  /** The design's next step is the customer's own (`label` its name). */
  | 'your_step'
  /** Pick an option on a decision (`label` its title). */
  | 'decide'
  /** Confirm a fixed snag is fixed (`count`). */
  | 'confirm_snag'
  /** Every snag is closed: sign off the handover. */
  | 'sign_off'
  /** Change orders (15 Oct 2026): extra work the studio sent waits for the owner's yes or no (`label` its title, `count` how many). */
  | 'approve_extra'
  /** Approved extra work not paid yet (`amountPaise` what is still due on it). */
  | 'pay_extra'
  /** The studio asked the owner to sign the design final / the sales final (digital sign-off). */
  | 'sign_design_final'
  | 'sign_sales_final';

export interface CustomerBlocker {
  kind: BlockerKind;
  label: string | null;
  amountPaise: number | null;
  count: number | null;
}

export interface CustomerLifecycle {
  phase: CustomerPhase;
  current: CustomerLifecycleStep;
  next: CustomerLifecycleStep | null;
  /** What the customer must do to unlock the next step; null = "Nothing needed from you". */
  blocker: CustomerBlocker | null;
  /** What the studio is doing meanwhile (said when there is no blocker). */
  studioDoing: 'design' | 'site' | 'closure' | 'snags' | 'warranty' | 'closed';
  /** Snags still open (a fix waiting for the customer's yes counts). */
  openSnags: number;
  /** "In warranty until <date>" (YYYY-MM-DD); null before the sign-off. */
  warrantyEndsOn: string | null;
  /** The owner of the brief may sign off the handover now. */
  canSignOff: boolean;
  /**
   * The snag window (owner, 15 Oct 2026; project/snag-window.ts): the last
   * day snags may be raised (YYYY-MM-DD), from the handover payment until
   * the handover sign-off; null when there is none (yet), and during the
   * warranty (warranty snags instead).
   */
  snagWindowEndsOn: string | null;
  /** A snag may be raised in the app today (false after the window or the warranty). */
  canRaiseSnag: boolean;
}

export interface LifecycleInput {
  phase: Phase;
  role: 'owner' | 'family';
  today: string;
  warrantyEndsOn: string | null;
  design: CustomerDesign | null;
  tracker: CustomerTracker | null;
  payments: CustomerPayments | null;
  snags: readonly { status: 'OPEN' | 'FIXED'; progress: { state: string; canAnswer: boolean } }[];
  decisions: readonly { title: string; state: string }[];
  /** Change orders the customer sees (portal extras, change-order-rules.ts `toCustomerExtra`). */
  extras?: readonly { state: string; title: string; duePaise: number }[];
  /** Sign-offs the studio asked for (signoff-rules.ts `toCustomerSignoff`). */
  signoffs?: readonly { kind: string; state: string }[];
  /** The snag window, once the handover payment is recorded after the closure. */
  snagWindow?: SnagWindow | null;
}

const PHASE_OUT: Record<Phase, CustomerPhase> = {
  DESIGN: 'design',
  PRE_EXECUTION: 'design',
  EXECUTION: 'execution',
  CLOSURE: 'closure',
  SNAGS: 'snags',
  WARRANTY: 'warranty',
  CLOSED: 'closed',
};

const openOn = (s: { amountPaise: number; changesPaise: number; paidPaise: number; waitingPaise: number }) => Math.max(0, s.amountPaise + s.changesPaise - s.paidPaise - s.waitingPaise);

/** The payment the customer must make now, if any: the one the design waits on, one past its due day, or the final payment after the closure. */
function paymentBlocker(i: LifecycleInput): CustomerBlocker | null {
  const p = i.payments;
  if (!p) return null;
  const by = (label: string) => p.stages.find((s) => s.label.trim().toLowerCase() === label.trim().toLowerCase()) ?? null;
  if (i.phase === 'DESIGN' && i.design?.waitingFor) {
    const st = by(i.design.waitingFor);
    const open = st ? openOn(st) : null;
    if (open === null || open > 0) return { kind: 'pay', label: i.design.waitingFor, amountPaise: open, count: null };
  }
  const overdue = p.stages.find((s) => s.dueOn !== null && s.dueOn <= i.today && openOn(s) > 0);
  if (overdue) return { kind: 'pay', label: overdue.label, amountPaise: openOn(overdue), count: null };
  // After the closure fixed the final payment: what is left to pay.
  if (['SNAGS', 'WARRANTY'].includes(i.phase)) {
    const left = p.stages.reduce((a, s) => a + openOn(s), 0);
    if (left > 0) {
      const last = [...p.stages].reverse().find((s) => openOn(s) > 0)!;
      return { kind: 'pay', label: last.label, amountPaise: left, count: null };
    }
  }
  return null;
}

export function customerLifecycle(input: LifecycleInput): CustomerLifecycle {
  /* Pre-execution is the studio's own hand-over to the site team; the client still reads it as getting the design ready (DESIGN-PROCESS-PLAN.md Decision 11). */
  const i: LifecycleInput = input.phase === 'PRE_EXECUTION' ? { ...input, phase: 'DESIGN' } : input;
  const phase = PHASE_OUT[i.phase];
  const owner = i.role === 'owner';
  const openSnags = i.snags.filter((s) => s.progress.state !== 'closed').length;
  const toConfirm = i.snags.filter((s) => s.progress.state === 'fixed').length;

  // ── current and next ──
  let current: CustomerLifecycleStep;
  let next: CustomerLifecycleStep | null;
  const stages = (i.tracker?.stages ?? []).filter((s) => s.kind !== 'DESIGN');
  const nowStage = stages.find((s) => s.state === 'now') ?? stages.find((s) => s.state !== 'done') ?? null;
  switch (i.phase) {
    case 'DESIGN': {
      const d = i.design;
      const steps = d?.steps ?? [];
      const firstOpen = steps.findIndex((s) => !s.done);
      current = firstOpen >= 0 ? { kind: 'design', label: steps[firstOpen]!.label } : { kind: 'design_done', label: null };
      const after = firstOpen >= 0 ? steps.slice(firstOpen + 1).find((s) => !s.done) : null;
      const firstExec = stages[0] ?? null;
      next = after ? { kind: 'design', label: after.label } : firstExec ? { kind: 'stage', label: firstExec.label } : { kind: 'closure', label: null };
      break;
    }
    case 'EXECUTION': {
      current = nowStage ? { kind: 'stage', label: nowStage.label } : { kind: 'stage', label: null };
      const idx = nowStage ? stages.indexOf(nowStage) : -1;
      const later = idx >= 0 ? stages[idx + 1] : null;
      next = later ? { kind: 'stage', label: later.label } : { kind: 'closure', label: null };
      break;
    }
    case 'CLOSURE':
      current = { kind: 'closure', label: null };
      next = { kind: 'snags', label: null };
      break;
    case 'SNAGS':
      current = { kind: 'snags', label: null };
      next = { kind: 'sign_off', label: null };
      break;
    case 'WARRANTY':
      current = { kind: 'warranty', label: null };
      next = { kind: 'closed', label: null };
      break;
    default:
      current = { kind: 'closed', label: null };
      next = null;
  }

  // ── the blocker, most pressing first ──
  const canSignOff = owner && i.phase === 'SNAGS' && openSnags === 0;
  let blocker: CustomerBlocker | null = null;
  const pay = paymentBlocker(i);
  /* Change orders and sign-offs (15 Oct 2026): extra work to approve, approved extra work to pay, a quotation to sign. */
  const extrasWaiting = (i.extras ?? []).filter((e) => e.state === 'waiting');
  const extraDue = (i.extras ?? []).filter((e) => e.state === 'approved').reduce((a, e) => a + Math.max(0, e.duePaise), 0);
  const toSign = (i.signoffs ?? []).find((s) => s.state === 'waiting' && s.kind === 'DESIGN_FINAL') ?? (i.signoffs ?? []).find((s) => s.state === 'waiting') ?? null;
  if (i.phase === 'SNAGS' && openSnags === 0) blocker = { kind: 'sign_off', label: null, amountPaise: null, count: null };
  else if (toConfirm > 0) blocker = { kind: 'confirm_snag', label: null, amountPaise: null, count: toConfirm };
  else if (pay) blocker = pay;
  else if (extrasWaiting.length > 0) blocker = { kind: 'approve_extra', label: extrasWaiting[0]!.title, amountPaise: null, count: extrasWaiting.length };
  else if (extraDue > 0) blocker = { kind: 'pay_extra', label: null, amountPaise: extraDue, count: null };
  else if (toSign) blocker = { kind: toSign.kind === 'SALES_FINAL' ? 'sign_sales_final' : 'sign_design_final', label: null, amountPaise: null, count: null };
  else {
    const waitingEntries = (i.payments?.entries ?? []).filter((e) => e.status === 'waiting').length;
    const drawings = (i.design?.drawings ?? []).filter((d) => d.state === 'waiting');
    const decision = i.decisions.find((d) => d.state !== 'chosen') ?? null;
    if (waitingEntries > 0) blocker = { kind: 'confirm_payment', label: null, amountPaise: null, count: waitingEntries };
    else if (i.phase === 'DESIGN' && drawings.length > 0) blocker = { kind: 'answer_drawing', label: drawings[0]!.title, amountPaise: null, count: drawings.length };
    else if (i.phase === 'DESIGN' && i.design?.yourStep) blocker = { kind: 'your_step', label: i.design.yourStep, amountPaise: null, count: null };
    else if (decision && ['DESIGN', 'EXECUTION'].includes(i.phase)) blocker = { kind: 'decide', label: decision.title, amountPaise: null, count: null };
  }

  const studioDoing: CustomerLifecycle['studioDoing'] =
    i.phase === 'DESIGN' ? 'design' : i.phase === 'EXECUTION' ? 'site' : i.phase === 'CLOSURE' ? 'closure' : i.phase === 'SNAGS' ? 'snags' : i.phase === 'WARRANTY' ? 'warranty' : 'closed';

  return {
    phase,
    current,
    next,
    blocker,
    studioDoing,
    openSnags,
    warrantyEndsOn: ['WARRANTY', 'CLOSED'].includes(i.phase) ? i.warrantyEndsOn : null,
    canSignOff,
    snagWindowEndsOn: i.snagWindow && ['CLOSURE', 'SNAGS'].includes(i.phase) ? i.snagWindow.endsOn : null,
    canRaiseSnag: mayRaiseSnag(i.phase, i.snagWindow ?? null, i.today).ok,
  };
}

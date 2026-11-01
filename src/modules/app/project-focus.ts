/**
 * What the customer's Project screen shows, by where the project is (owner,
 * 1 Nov 2026: "when he is in design process he sees only design progress on
 * top and only important things"). Pure, and shared by the website
 * (app/app/project) and the phone app (mobile project tab), so both show the
 * same things in the same order. tests/customer-project-focus.test.ts pins it.
 *
 * - Design: design progress on top, what is needed from them, the design
 *   itself, the next payment. Site and snags wait until work starts.
 * - Execution: the home's progress on top, today's site, decisions, snags
 *   once any are raised, the next payment. The design folds away, files kept.
 * - Handover (closure, snags, warranty, closed): snags, the sign-off, the
 *   final payment, the warranty.
 *
 * Everything not shown is one tap away under "See the whole plan", never gone.
 */

import type { CustomerPhase } from '@/modules/portal/lifecycle-view';

export type Focus = 'design' | 'site' | 'handover';

export type Block =
  /** The big progress number: design % in design, the home's % after. */
  | 'progress'
  /** On time · Paid · Handover. */
  | 'stats'
  /** Where it is, what is next, what is needed from them. */
  | 'lifecycle'
  /** Quotations to sign and extra work to approve. */
  | 'signoffs'
  | 'decision'
  | 'design'
  | 'site'
  | 'snags'
  /** One card: the next payment, amount and when. */
  | 'nextPayment'
  /** The payment ring, every stage and the entries. */
  | 'payments'
  | 'changes'
  | 'stages';

export interface ProjectFocus {
  focus: Focus;
  /** On the screen, in this order. */
  main: Block[];
  /** Under "See the whole plan", in this order. */
  folded: Block[];
}

export interface FocusInput {
  phase: CustomerPhase | null | undefined;
  /** The design still runs (not closed). */
  designRunning: boolean;
  snags: number;
  /** A payment the studio recorded waits for their yes: the full payments stay on screen to confirm it. */
  paymentToConfirm: boolean;
}

export function focusOf(phase: CustomerPhase | null | undefined, designRunning: boolean): Focus {
  if (phase === 'closure' || phase === 'snags' || phase === 'warranty' || phase === 'closed') return 'handover';
  if (phase === 'design' || (!phase && designRunning)) return 'design';
  return 'site';
}

export function projectFocus(i: FocusInput): ProjectFocus {
  const focus = focusOf(i.phase, i.designRunning);
  const pay: Block = i.paymentToConfirm ? 'payments' : 'nextPayment';
  let main: Block[];
  if (focus === 'design') main = ['progress', 'lifecycle', 'signoffs', 'decision', 'design', pay];
  else if (focus === 'site') main = ['progress', 'stats', 'lifecycle', 'signoffs', 'decision', 'site', ...(i.snags > 0 ? (['snags'] as Block[]) : []), pay];
  else main = ['lifecycle', 'snags', 'signoffs', 'decision', pay];
  const all: Block[] = ['progress', 'stats', 'design', 'site', 'snags', 'stages', 'payments', 'changes'];
  /* The whole plan always has the stages and the full payments; the rest is whatever the screen left out. */
  const folded = all.filter((b) => !main.includes(b) && !(b === 'progress' && focus === 'handover'));
  return { focus, main, folded };
}

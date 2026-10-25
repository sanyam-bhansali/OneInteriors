/**
 * One project's card on the designer's dashboard (owner, 13 Oct 2026;
 * docs/studio-os/PROJECT-LIFECYCLE.md): the current step, the next step,
 * what is blocking it (the client's side or the studio's) and how late it
 * is. The studio's own view: internal step names are fine here. Pure,
 * tested in tests/project-lifecycle-card.test.ts; lifecycle-store.ts reads
 * the rows.
 */

import { daysBetween } from './working-days';
import type { Phase } from './lifecycle-rules';

export interface CardStep {
  label: string;
  done: boolean;
  inScope: boolean;
  /** YYYY-MM-DD, or null. */
  plannedOn: string | null;
  /** Design steps: who does it (DESIGNER | SALES | ACCOUNTS | PM | CLIENT); null on execution steps. */
  responsible: string | null;
  /** The payment the step waits for; null when open. */
  lockedBy: string | null;
  /** Execution steps: the stage's name. */
  stage?: string;
}

export interface CardInput {
  phase: Phase;
  today: string;
  designSteps: readonly CardStep[];
  execSteps: readonly CardStep[];
  /** Shared drawings waiting for the client's answer. */
  drawingsWaiting: number;
  /** Open snags (fixes the client has not confirmed count). */
  openSnags: number;
  /** Of those, fixed and waiting for the client's yes. */
  snagsWithClient: number;
  /** Warranty snags still open. */
  warrantyOpen: number;
  closureSaved: boolean;
  warrantyEndsOn: string | null;
}

export interface CardBlocker {
  side: 'client' | 'studio';
  text: string;
}

export interface LifecycleCardView {
  current: string;
  next: string | null;
  blocker: CardBlocker | null;
  /** Days past the current step's planned day (0 when on time or undated). */
  lateDays: number;
}

const WHO: Record<string, string> = { DESIGNER: 'Designer', SALES: 'Sales', ACCOUNTS: 'Accounts', PM: 'Project manager', CLIENT: 'Client' };

/** "12 Oct 2027" from a YYYY-MM-DD day. */
export const dayWords = (day: string): string => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const openOf = (steps: readonly CardStep[]) => steps.filter((s) => s.inScope && !s.done);
/** Days the step is past its day; 0 for a step waiting on a payment (DESIGN-PROCESS-PLAN.md Decision 5). */
const late = (s: CardStep | undefined, today: string) => (s?.plannedOn && !s.lockedBy && s.plannedOn < today ? daysBetween(s.plannedOn, today) : 0);

export function lifecycleCard(i: CardInput): LifecycleCardView {
  switch (i.phase) {
    case 'DESIGN': {
      const open = openOf(i.designSteps);
      const cur = open[0];
      if (!cur) return { current: 'Every design step ticked', next: 'Design sign-off', blocker: { side: 'studio', text: 'Sign off the design (send the Design Final first)' }, lateDays: 0 };
      let blocker: CardBlocker;
      if (cur.lockedBy) blocker = { side: 'client', text: `Client to pay the ${cur.lockedBy}` };
      else if (i.drawingsWaiting > 0) blocker = { side: 'client', text: `Client to answer ${i.drawingsWaiting} drawing${i.drawingsWaiting === 1 ? '' : 's'}` };
      else if (cur.responsible === 'CLIENT') blocker = { side: 'client', text: `Client: ${cur.label}` };
      else blocker = { side: 'studio', text: `${WHO[cur.responsible ?? 'DESIGNER'] ?? 'Studio'} to do it` };
      return { current: cur.label, next: open[1]?.label ?? 'Design sign-off', blocker, lateDays: late(cur, i.today) };
    }
    case 'PRE_EXECUTION': {
      // The execution team owns it; the designer supports (DESIGN-PROCESS-PLAN.md Decision 10).
      const open = openOf(i.designSteps);
      const cur = open[0];
      if (!cur) return { current: 'Every pre-execution step ticked', next: 'Execution', blocker: null, lateDays: 0 };
      const blocker: CardBlocker = cur.lockedBy
        ? { side: 'client', text: `Client to pay the ${cur.lockedBy}` }
        : cur.responsible === 'CLIENT'
          ? { side: 'client', text: `Client: ${cur.label}` }
          : { side: 'studio', text: `${WHO[cur.responsible ?? 'PM'] ?? 'Studio'} to do it` };
      return { current: cur.label, next: open[1]?.label ?? 'Execution', blocker, lateDays: late(cur, i.today) };
    }
    case 'EXECUTION': {
      const open = openOf(i.execSteps);
      const cur = open[0];
      if (!cur) return { current: 'Every execution step ticked', next: 'Project closure', blocker: { side: 'studio', text: 'Tick the provisional handover' }, lateDays: 0 };
      const blocker: CardBlocker = cur.lockedBy ? { side: 'client', text: `Client to pay the ${cur.lockedBy}` } : { side: 'studio', text: 'Site team or designer to tick it, with a photo and a sentence' };
      return { current: cur.stage ? `${cur.label} (${cur.stage})` : cur.label, next: open[1]?.label ?? 'Project closure', blocker, lateDays: late(cur, i.today) };
    }
    case 'CLOSURE':
      return {
        current: 'Project closure',
        next: 'Snags, then the client signs off',
        blocker: { side: 'studio', text: i.closureSaved ? 'Check the final account and close the project' : 'Work out the final account' },
        lateDays: 0,
      };
    case 'SNAGS': {
      const blocker: CardBlocker =
        i.openSnags === 0
          ? { side: 'client', text: 'Client to sign off the handover in the app' }
          : i.snagsWithClient === i.openSnags
            ? { side: 'client', text: `Client to confirm ${i.snagsWithClient} fixed snag${i.snagsWithClient === 1 ? '' : 's'}` }
            : { side: 'studio', text: `Fix ${i.openSnags - i.snagsWithClient} open snag${i.openSnags - i.snagsWithClient === 1 ? '' : 's'}` };
      return { current: i.openSnags ? `${i.openSnags} snag${i.openSnags === 1 ? '' : 's'} open` : 'Every snag closed', next: 'Client signs off the handover', blocker, lateDays: 0 };
    }
    case 'WARRANTY':
      return {
        current: i.warrantyEndsOn ? `In warranty until ${dayWords(i.warrantyEndsOn)}` : 'In warranty',
        next: 'Project closed',
        blocker: i.warrantyOpen ? { side: 'studio', text: `Fix ${i.warrantyOpen} warranty snag${i.warrantyOpen === 1 ? '' : 's'}` } : null,
        lateDays: 0,
      };
    default:
      return { current: 'Closed', next: null, blocker: null, lateDays: 0 };
  }
}

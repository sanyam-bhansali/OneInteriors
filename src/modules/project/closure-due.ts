/**
 * The project closure step (owner, 13 Nov 2026): "at this stage you also
 * close the 5%" — the handover payment, "I give you the keys today, you give
 * me the money" — and any extras found late, paid 100% in advance. Ticking
 * the step shows what is still due so the team asks for it; it never blocks
 * the tick. Pure, and tested (tests/closure-statement.test.ts). The figures
 * are the payment ledger's (payment-ledger.ts), the same as the Payments tab.
 */

import type { Ledger } from './payment-ledger';

export interface DueStage {
  label: string;
  /** Owed and not yet recorded (payment-ledger.ts `openPaise`). */
  openPaise: number;
  /** Recorded, waiting for the client's yes. */
  waitingPaise: number;
  /** The last stage: the handover payment. */
  last: boolean;
}

export interface DueExtra {
  number: string;
  title: string;
  /** Approved and not yet recorded in full. Already inside the last stage's figure (change-orders.ts lands it there). */
  openPaise: number;
}

export interface ClosureDue {
  stages: DueStage[];
  extras: DueExtra[];
  /** Every stage's open money: what the team still asks for. */
  openPaise: number;
  /** Recorded money still waiting for the client's confirmation. */
  waitingPaise: number;
}

/**
 * What is still due at the closure: each payment stage with money open or
 * waiting (the last one marked as the handover payment), and approved extra
 * work not yet paid. Null when nothing was signed in the app (no stages).
 */
export function dueAtClosure(l: Ledger | null, extras: readonly DueExtra[] = []): ClosureDue | null {
  if (!l) return null;
  const lastIndex = l.stages.length - 1;
  const stages = l.stages
    .filter((s) => s.openPaise > 0 || s.waitingPaise > 0)
    .map((s) => ({ label: s.label, openPaise: s.openPaise, waitingPaise: s.waitingPaise, last: s.index === lastIndex }));
  return {
    stages,
    extras: extras.filter((e) => e.openPaise > 0),
    openPaise: l.stages.reduce((n, s) => n + s.openPaise, 0),
    waitingPaise: l.stages.reduce((n, s) => n + s.waitingPaise, 0),
  };
}

/**
 * Where the closure step goes on a running project's carpentry stage
 * (scripts/add-closure-step.ts): after the last step, in its group, on its
 * planned day (else the stage's end).
 */
export function closureStepPlacement(
  items: readonly { room: string; sortOrder: number; plannedOn: Date | null }[],
  stageEnd: Date,
): { group: string; sortOrder: number; plannedOn: Date } {
  const last = [...items].sort((a, b) => a.sortOrder - b.sortOrder)[items.length - 1];
  return { group: last?.room?.trim() || 'Execution stage 2B', sortOrder: last ? last.sortOrder + 1 : 0, plannedOn: last?.plannedOn ?? stageEnd };
}

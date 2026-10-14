/**
 * Execution payment locks for the client (Studio OS Phase 3 §7): Hauspire's
 * material procurement (40%) and material dispatch (40%) each open an
 * execution step, with the same lock Phase 2 uses for design steps
 * (studio-design/rules.ts `gateOf`): the step cannot be ticked until accounts
 * has recorded that payment.
 *
 * Matched by words, like the design gates: a rule says "a step whose name
 * contains X waits for the payment stage whose name contains Y". Rules live
 * in the studio's crew settings (Settings → Crews and trades), so a studio
 * edits them without touching any project; a step's own `gatePayment`, when
 * set, wins. No match, or a project with no payment stages, means no lock.
 *
 * Pure, tested in tests/studio-crews-gates.test.ts.
 */

import { gateIndexFor, gateOf, type GateStage, type GateState } from '@/modules/studio-design/rules';

export interface ExecGateRule {
  /** Words in the step's name. */
  step: string;
  /** Words in the payment stage's name. */
  payment: string;
}

/**
 * Hauspire's defaults (decided here, editable): the procurement payment opens
 * "Material at site" (buying the ply and moulding needs the money); the
 * dispatch payment opens "Shutters delivered" (the made furniture leaves for
 * site).
 */
export const DEFAULT_EXEC_GATES: readonly ExecGateRule[] = [
  { step: 'Material at site', payment: 'material procurement' },
  { step: 'Shutters delivered', payment: 'material dispatch' },
];

/** The payment stage index locking this step, or null. */
export function execGateIndex(step: { label: string; gatePayment: number | null }, rules: readonly ExecGateRule[], payments: readonly { label: string }[]): number | null {
  if (step.gatePayment !== null && step.gatePayment !== undefined) return step.gatePayment;
  const label = step.label.toLowerCase();
  for (const r of rules) {
    const words = r.step.trim().toLowerCase();
    if (!words || !label.includes(words)) continue;
    const i = gateIndexFor(r.payment, payments);
    if (i !== null) return i;
  }
  return null;
}

/** Whether this execution step is open, and if not, which payment it waits for. */
export function execGate(
  step: { label: string; gatePayment: number | null },
  rules: readonly ExecGateRule[],
  payments: readonly { label: string }[],
  stages: readonly GateStage[] | null,
): GateState {
  return gateOf(execGateIndex(step, rules, payments), stages);
}

/**
 * The customer's two plans (owner decision, 11 Oct 2026;
 * docs/APP-API-JOURNEY.md). Pure, and tested; the database side is
 * `plan-store.ts`.
 *
 * - **Basic** is free and the default: the project, site feed, snags,
 *   decisions, payments, Locker and notices. No GEIO and no expert calls.
 * - **Assured** is paid (the fee is not set yet): we make sure the tracker
 *   and site feed are updated every day, GEIO, and five expert calls across
 *   the project.
 *
 * Until the fee is set, choosing Assured only registers interest. The
 * project stays on Basic with `assuredRequestedAt` stamped, ops is told, and
 * only ops switches the plan. So the customer can never talk their way onto
 * a paid plan, and nobody is charged a fee that was never quoted to them.
 */

export type PlanName = 'basic' | 'assured';
export type DbPlan = 'BASIC' | 'ASSURED';

/** Expert calls in Assured, across the whole project. The free call before signing does not count. */
export const ASSURED_EXPERT_CALLS = 5;

export interface PlanView {
  plan: PlanName;
  /** Asked for Assured and not switched yet. False once on Assured. */
  assuredRequested: boolean;
  /** Null on Basic, which has no expert calls. */
  expertCalls: { used: number; total: number } | null;
}

export function parsePlan(value: unknown): PlanName | null {
  return value === 'basic' || value === 'assured' ? value : null;
}

export const planName = (db: DbPlan): PlanName => (db === 'ASSURED' ? 'assured' : 'basic');

export function planView(row: { plan: DbPlan; assuredRequestedAt: Date | null }, callsUsed: number): PlanView {
  const plan = planName(row.plan);
  return {
    plan,
    assuredRequested: plan === 'basic' && row.assuredRequestedAt !== null,
    expertCalls: plan === 'assured' ? { used: Math.min(callsUsed, ASSURED_EXPERT_CALLS), total: ASSURED_EXPERT_CALLS } : null,
  };
}

/**
 * May this person use GEIO? Before signing there is no plan and GEIO stays
 * open, as it always has. Once they have a project, only Assured opens it —
 * any one of their projects on Assured is enough (a family member reads the
 * owner's).
 */
export function geioOpen(plans: PlanName[]): boolean {
  return plans.length === 0 || plans.includes('assured');
}

/**
 * The words for the choice at the Sign step, shared by the website and the
 * phone app so the two cannot promise different things. The fee is not set,
 * so no price is named.
 */
export const PLAN_COPY: Record<PlanName, { name: string; price: string; points: string[] }> = {
  basic: {
    name: 'Basic',
    price: 'Free',
    points: [
      'Your project, site updates, snags, decisions, payments and Locker',
      'You and the studio agree to keep the tracker and site feed up to date',
    ],
  },
  assured: {
    name: 'Assured',
    price: 'Paid',
    points: [
      'We make sure the tracker and site feed are updated every day, and call the studio when a day is missed',
      'GEIO, your home assistant',
      `${ASSURED_EXPERT_CALLS} expert calls across your project`,
      'Everything in Basic',
    ],
  },
};

export const ASSURED_FEE_NOTE = 'Your fee is confirmed by our team before anything is charged.';

/** What GEIO says to a signed customer on Basic, on the website and in the app. */
export const GEIO_LOCKED = `GEIO comes with the Assured plan, and your project is on Basic. Ask for Assured and our team will call you. ${ASSURED_FEE_NOTE}`;

/**
 * The studio software plans (owner, 19 Oct 2026): **Pro** for every studio,
 * **Max** for the full Studio OS (Hauspire while it is tested), and (owner,
 * 21 Oct 2026) **Pro Solo**: Pro for a one-person company, one login, no
 * team screen and no lead pool (studio/surfaces.ts reads `solo`). Pure;
 * tests/studio-software-plan.test.ts pins it.
 *
 * What each plan opens is decided in one place, studio/pilot.ts (the door)
 * and roles.ts `can()` (the actions), both of which read the member's
 * `fullSoftware`, which is simply "this studio is on Max".
 */

export type SoftwarePlan = 'SOLO' | 'PRO' | 'MAX';

export const SOFTWARE_PLANS: Record<SoftwarePlan, { name: string; line: string; includes: readonly string[] }> = {
  SOLO: {
    name: 'Pro Solo',
    line: 'Leads and quotations, for a one-person studio.',
    includes: ['Leads and numbers', 'Quotations, first quote and the quotation PDF', 'Product master', 'Today and Calendar', 'Settings for quoting', 'One login: yours'],
  },
  PRO: {
    name: 'Pro',
    line: 'Leads and quotations, run like a sales team.',
    includes: ['Leads, pool and numbers', 'Quotations, first quote and the quotation PDF', 'Product master', 'Today and Calendar', 'Settings for quoting'],
  },
  MAX: {
    name: 'Max',
    line: 'The whole studio, from booking to warranty.',
    includes: [
      'Everything in Pro',
      'Projects: design, execution, snags, closure and warranty',
      'Site mode for supervisors',
      'Payments desk and change orders',
      'Crews and work orders',
      'Your team with their own apps',
      'The client app with sign-off and approvals',
    ],
  },
};

export function isSoftwarePlan(v: unknown): v is SoftwarePlan {
  return v === 'SOLO' || v === 'PRO' || v === 'MAX';
}

/**
 * The plan a studio row is on. Ops always writes the plan and the older
 * switch together, so they agree; while both columns exist, either one
 * saying Max means Max.
 */
export function planOf(row: { softwarePlan?: string | null; fullSoftware?: boolean | null } | null | undefined): SoftwarePlan {
  if (row?.softwarePlan === 'MAX' || row?.fullSoftware === true) return 'MAX';
  return row?.softwarePlan === 'SOLO' ? 'SOLO' : 'PRO';
}

/** How many people a plan lets into the studio (members, invited or not). Null: no limit. */
export function seatLimit(plan: SoftwarePlan): number | null {
  return plan === 'SOLO' ? 1 : null;
}

/** Whether the full Studio OS is open (what roles.ts and pilot.ts call `fullSoftware`). */
export const opensFullSoftware = (plan: SoftwarePlan): boolean => plan === 'MAX';

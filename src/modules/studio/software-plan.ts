/**
 * The studio CRM plans: **Free, Pro and Max** (owner, approved 24 Nov 2026;
 * the plan doc "OneInteriors Studio CRM — Subscription plans and setup quiz").
 *
 * - **Free**: one person running their own leads and quotations, within limits.
 *   Replaces Pro Solo (owner, 21 Oct 2026).
 * - **Pro**: a studio with a sales team: the lead pool, sales roles and teams,
 *   quotation requests.
 * - **Max**: the whole studio, booking to warranty (projects, design, site
 *   mode, the payments desk, crews, the client app, aftercare).
 *
 * Each plan opens everything the plan below it opens, so an upgrade only ever
 * opens things and a downgrade only ever hides them: no plan change deletes a
 * record.
 *
 * ## Where a plan is enforced
 *
 * This file is the matrix and nothing else; it is pure (CONTRIBUTING §9.5)
 * and tests/studio-software-plan.test.ts pins it. The door is
 * `surfaces.ts mayOpen` (which screens), the lock is `roles.ts can()` (which
 * actions); both read the member's `fullSoftware` (Max) and `solo` (Free),
 * which `access.ts memberFor` sets from `planOf`. The Free limits are checked
 * where a lead, a printed quotation or a file is made (`plan-usage.ts`).
 *
 * ## The database still says SOLO for the old Pro Solo studios
 *
 * `StudioSoftwarePlan` keeps SOLO until the founding-studio script (the plan
 * doc's billing PR) moves those studios to FREE. Until then SOLO reads as
 * Free with its limits waived, so no current studio loses anything the day
 * this ships (the plan doc: "Every current studio keeps exactly what it opens
 * today"). A studio ops or signup puts on FREE gets the limits.
 */

export type SoftwarePlan = 'FREE' | 'PRO' | 'MAX';

export const PLAN_ORDER: readonly SoftwarePlan[] = ['FREE', 'PRO', 'MAX'];

/** The roles a plan lets into the studio (roles.ts StudioRoleName). */
type RoleName = 'OWNER' | 'SALES' | 'DESIGNER' | 'PM' | 'SUPERVISOR' | 'ACCOUNTS';

export interface PlanLimits {
  /** Seats included: members, invited or active. Null: not limited here (Pro and Max seats are bought with billing). */
  seats: number | null;
  /** Leads still in play (not won, lost or in the Bin, not the sample). Null: no limit. */
  activeLeads: number | null;
  /** Quotations printed for the first time in a calendar month (reprints are free). Null: no limit. */
  quotePrintsPerMonth: number | null;
  /** Files on leads (floor plans, photos), in bytes. Null: no limit. */
  storageBytes: number | null;
}

export interface PlanCriteria {
  name: string;
  line: string;
  /** Seats the price includes (the plan doc's matrix). Extra seats are bought on Pro and Max. */
  includedSeats: number;
  roles: readonly RoleName[];
  includes: readonly string[];
  limits: PlanLimits;
  /** Whether the studio may take "Prepared with One Interiors" off its quotations (studio-quote/mark.ts). */
  mayRemoveMark: boolean;
}

const GB = 1024 * 1024 * 1024;

/**
 * The matrix. The Free limits are the plan doc's proposals (owner's open
 * decision "Free limits"): changing one is a one-line edit here.
 */
export const SOFTWARE_PLANS: Record<SoftwarePlan, PlanCriteria> = {
  FREE: {
    name: 'Free',
    line: 'Leads and quotations, for one person.',
    includedSeats: 1,
    roles: ['OWNER'],
    includes: ['Leads, analytics, import and bin', 'The quotation builder and the quotation PDF', 'Product master', 'Today and Calendar', 'Settings for quoting', 'One login: yours'],
    limits: { seats: 1, activeLeads: 200, quotePrintsPerMonth: 20, storageBytes: 1 * GB },
    mayRemoveMark: false,
  },
  PRO: {
    name: 'Pro',
    line: 'Leads and quotations, run like a sales team.',
    includedSeats: 5,
    roles: ['OWNER', 'SALES'],
    includes: ['Everything in Free, without its limits', 'The lead pool and lead routing', 'Sales roles, reach and teams', 'Quotation requests (To build)', 'Your quotations without our line'],
    limits: { seats: null, activeLeads: null, quotePrintsPerMonth: null, storageBytes: null },
    mayRemoveMark: true,
  },
  MAX: {
    name: 'Max',
    line: 'The whole studio, from booking to warranty.',
    includedSeats: 15,
    roles: ['OWNER', 'SALES', 'DESIGNER', 'PM', 'SUPERVISOR', 'ACCOUNTS'],
    includes: [
      'Everything in Pro',
      'Projects: design, execution, snags, closure and warranty',
      'Site mode for supervisors',
      'Payments desk, invoices and change orders',
      'Crews and work orders',
      'Your team with their own apps',
      'The client app with chat, sign-off and approvals',
      'Societies and service visits',
    ],
    limits: { seats: null, activeLeads: null, quotePrintsPerMonth: null, storageBytes: null },
    mayRemoveMark: true,
  },
};

export function isSoftwarePlan(v: unknown): v is SoftwarePlan {
  return v === 'FREE' || v === 'PRO' || v === 'MAX';
}

type PlanRow = { softwarePlan?: string | null; fullSoftware?: boolean | null } | null | undefined;

/**
 * The plan a studio row is on. While the older `fullSoftware` switch exists,
 * either one saying Max means Max; SOLO (the old Pro Solo) is Free.
 */
export function planOf(row: PlanRow): SoftwarePlan {
  if (row?.softwarePlan === 'MAX' || row?.fullSoftware === true) return 'MAX';
  if (row?.softwarePlan === 'FREE' || row?.softwarePlan === 'SOLO') return 'FREE';
  return 'PRO';
}

/**
 * The limits that hold for this studio now. A studio still marked SOLO (Pro
 * Solo before the plans) keeps its old, unlimited Pro Solo until the
 * founding-studio script moves it: only its one seat holds.
 */
export function limitsFor(row: PlanRow): PlanLimits {
  const plan = planOf(row);
  const limits = SOFTWARE_PLANS[plan].limits;
  if (plan === 'FREE' && row?.softwarePlan === 'SOLO') return { seats: limits.seats, activeLeads: null, quotePrintsPerMonth: null, storageBytes: null };
  return limits;
}

/** How many people a plan lets into the studio (members, invited or not). Null: not limited here. */
export function seatLimit(plan: SoftwarePlan): number | null {
  return SOFTWARE_PLANS[plan].limits.seats;
}

/** Whether the full Studio OS is open (what roles.ts and pilot.ts call `fullSoftware`). */
export const opensFullSoftware = (plan: SoftwarePlan): boolean => plan === 'MAX';

/** Whether the studio works as one person (what surfaces.ts and apps.ts call `solo`): no team screen, no lead pool. */
export const worksAlone = (plan: SoftwarePlan): boolean => plan === 'FREE';

/** Whether a role may be in a studio on this plan. */
export function planAllowsRole(plan: SoftwarePlan, role: RoleName): boolean {
  return SOFTWARE_PLANS[plan].roles.includes(role);
}

/** The cheapest plan that lets this role in (for "upgrade to …" lines). */
export function planForRole(role: RoleName): SoftwarePlan {
  return PLAN_ORDER.find((p) => planAllowsRole(p, role)) ?? 'MAX';
}

export type LimitKey = 'activeLeads' | 'quotePrintsPerMonth' | 'storageBytes' | 'seats';

/**
 * Whether `adding` more fits under a limit with `used` already counted.
 * A null limit always fits. Pure, so every limit is tested at and past its edge.
 */
export function fits(limit: number | null, used: number, adding = 1): boolean {
  if (limit === null) return true;
  return used + adding <= limit;
}

const IST_OFFSET_MS = 330 * 60 * 1000;

/** The instant the current IST calendar month began: Free's print month starts on the 1st, India time. */
export function istMonthStart(now: Date): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - IST_OFFSET_MS);
}

/** What a studio at a limit is told: what the limit is, and that nothing is lost. */
export function limitMessage(key: LimitKey, limits: PlanLimits): string {
  switch (key) {
    case 'activeLeads':
      return `Free holds ${limits.activeLeads} open leads. Close or bin some (nothing is deleted), or move to Pro for no limit. Leads from your enquiry form still arrive.`;
    case 'quotePrintsPerMonth':
      return `Free prints ${limits.quotePrintsPerMonth} new quotations a month; quotations already printed this month print again as often as you like. Move to Pro for no limit, or wait for the 1st.`;
    case 'storageBytes':
      return `Free holds ${Math.round((limits.storageBytes ?? 0) / GB)} GB of files on your leads, and it is full. Remove old files, or move to Pro for no limit.`;
    case 'seats':
      return 'Free is for one person. Move to Pro to add your team.';
  }
}

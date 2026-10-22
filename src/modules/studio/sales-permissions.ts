/**
 * The sales permission catalogue (owner, 22 Oct 2026; docs/studio-os/
 * SALES-ROLES.md). Pure (CONTRIBUTING §9.5), no Prisma, no `server-only`:
 * the Roles tab draws its matrix from it in the browser, the migration's
 * built-in roles were written from `BUILT_IN_SALES_ROLES`, and the resolver
 * (sales-access.ts) reads a role's stored JSON only through
 * `readSalesPermissions`. Tested in tests/studio-sales-permissions.test.ts.
 *
 * ## Why a small, fixed catalogue
 *
 * The owner's brief, after AxLeads' RBAC (lib/auth/permissions.ts: a role
 * holds keys, each with a data scope): the studio admin makes roles and
 * switches each permission on or off; lead permissions carry a reach. Every
 * key here maps to a feature that exists and is enforced in the module layer
 * (roles.ts `can` → sales-access.ts). A key with no code behind it would be a
 * switch that promises something nobody checks, so there is none.
 *
 * ## Reach
 *
 *  - **own** — leads assigned to them.
 *  - **team** — leads assigned to anyone below them in the reporting tree
 *    (themselves included), and unassigned leads in the team pools of the
 *    heads in that tree.
 *  - **all** — every lead in the studio.
 *
 * A permission without a reach is simply on (`true`). Stored as
 * `{ [key]: 'own' | 'team' | 'all' | true }`; a key that is off is absent.
 *
 * ## Only SALES members
 *
 * The fixed roles (roles.ts GRANTS) are untouched: an owner may do
 * everything, a PM keeps every lead, designers, supervisors and accounts
 * have none. A sales role only refines what a SALES member may do.
 */

export type SalesReach = 'own' | 'team' | 'all';
export const SALES_REACHES: readonly SalesReach[] = ['own', 'team', 'all'];

export const REACH_LABELS: Record<SalesReach, string> = {
  own: 'Their own',
  team: 'Their team',
  all: 'Everyone',
};

export type SalesPermissionKey =
  | 'leads.view'
  | 'leads.edit'
  | 'leads.add'
  | 'leads.assign'
  | 'leads.pool'
  | 'leads.bulk'
  | 'leads.merge'
  | 'leads.delete'
  | 'leads.import'
  | 'leads.export'
  | 'calls.log'
  | 'quotes.write'
  | 'quotes.salesFinal'
  | 'quotes.build'
  | 'analytics.view'
  | 'settings.leads'
  | 'team.manageSales';

export type SalesGroup = 'Leads' | 'Pool & assigning' | 'Calling' | 'Quotations' | 'Analytics' | 'Settings' | 'Team';
export const SALES_GROUPS: readonly SalesGroup[] = ['Leads', 'Pool & assigning', 'Calling', 'Quotations', 'Analytics', 'Settings', 'Team'];

export interface SalesPermissionDef {
  key: SalesPermissionKey;
  label: string;
  /** One line under the label on the matrix. */
  hint: string;
  group: SalesGroup;
  /** The reaches this permission may take, narrowest first; null when it is simply on or off. */
  reaches: readonly SalesReach[] | null;
}

export const SALES_PERMISSIONS: readonly SalesPermissionDef[] = [
  { key: 'leads.view', group: 'Leads', label: 'See leads', hint: 'The board, the list, a lead’s page, search, Today and the calendar.', reaches: ['own', 'team', 'all'] },
  { key: 'leads.edit', group: 'Leads', label: 'Work leads', hint: 'Details, notes, files, the meeting, the column, tasks and follow-ups.', reaches: ['own', 'team', 'all'] },
  { key: 'leads.add', group: 'Leads', label: 'Add leads', hint: 'Add a lead by hand. It is theirs.', reaches: null },
  { key: 'leads.merge', group: 'Leads', label: 'Merge duplicates', hint: 'Fold a duplicate lead into another (both must be leads they may work).', reaches: null },
  { key: 'leads.delete', group: 'Leads', label: 'Delete leads', hint: 'Move leads to the bin, restore them, erase them for good.', reaches: null },
  { key: 'leads.import', group: 'Leads', label: 'Import leads', hint: 'Bring in a spreadsheet of leads. They land in the studio pool, or in their own team pool when their pool reach is their team.', reaches: null },
  { key: 'leads.export', group: 'Leads', label: 'Download the leads list', hint: 'Every phone number they can see, in a spreadsheet. Off by default.', reaches: null },
  { key: 'leads.bulk', group: 'Leads', label: 'Act on many leads at once', hint: 'Select leads and move, tag, claim, assign or bin them together (each action still needs its own permission).', reaches: ['own', 'team', 'all'] },
  { key: 'leads.pool', group: 'Pool & assigning', label: 'See and claim from the pool', hint: 'Team: the pools of the teams they are in (and below them). Everyone: every pool and the studio pool.', reaches: ['team', 'all'] },
  { key: 'leads.assign', group: 'Pool & assigning', label: 'Give leads to people', hint: 'Hand out leads, or put them back in a pool. Team: only their team’s leads, only to their team.', reaches: ['team', 'all'] },
  { key: 'calls.log', group: 'Calling', label: 'Log calls', hint: 'Log a call, its outcome and the next follow-up.', reaches: ['own', 'team', 'all'] },
  { key: 'quotes.write', group: 'Quotations', label: 'Write quotations', hint: 'First quote, the builder, revisions, sending.', reaches: ['own', 'team', 'all'] },
  { key: 'quotes.salesFinal', group: 'Quotations', label: 'Mark the sales final', hint: 'Mark a revision as the sales final.', reaches: ['own', 'team', 'all'] },
  {
    key: 'quotes.build',
    group: 'Quotations',
    label: 'Builds quotations',
    hint: 'Gets quotation requests (floor plan added / quotation requested on a lead), handed out in turns among everyone with this permission; sees the lead, floor plan and first-quote draft of requests given to them, whatever their lead reach.',
    reaches: null,
  },
  { key: 'analytics.view', group: 'Analytics', label: 'See the numbers', hint: 'Lead analytics, calling numbers and by campaign. Team: their team’s numbers only.', reaches: ['team', 'all'] },
  { key: 'settings.leads', group: 'Settings', label: 'Change lead settings', hint: 'The pipeline, the lead fields, lead sources and where new leads go.', reaches: null },
  { key: 'team.manageSales', group: 'Team', label: 'Manage the sales team', hint: 'Invite salespeople, give them a role, set who reports to whom, edit roles.', reaches: null },
];

export const SALES_PERMISSION_KEYS: readonly SalesPermissionKey[] = SALES_PERMISSIONS.map((p) => p.key);

const DEFS = new Map(SALES_PERMISSIONS.map((p) => [p.key, p]));

export const permissionDef = (key: SalesPermissionKey): SalesPermissionDef => DEFS.get(key)!;

export type SalesPermissionValue = SalesReach | true;
export type SalesPermissionMap = Partial<Record<SalesPermissionKey, SalesPermissionValue>>;

const isReach = (v: unknown): v is SalesReach => typeof v === 'string' && (SALES_REACHES as readonly string[]).includes(v);

/**
 * A role's stored JSON, repaired: unknown keys dropped; a reach permission
 * keeps only a reach it allows; an on/off permission is on only when it is
 * exactly `true`. Anything else is OFF — an unreadable value never grants.
 */
export function readSalesPermissions(raw: unknown): SalesPermissionMap {
  const out: SalesPermissionMap = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const def = DEFS.get(key as SalesPermissionKey);
    if (!def) continue;
    if (def.reaches) {
      if (isReach(value) && def.reaches.includes(value)) out[def.key] = value;
    } else if (value === true) {
      out[def.key] = true;
    }
  }
  return out;
}

const RANK: Record<SalesReach, number> = { own: 0, team: 1, all: 2 };

/** The narrower of two reaches. */
export function narrower(a: SalesReach, b: SalesReach): SalesReach {
  return RANK[a] <= RANK[b] ? a : b;
}

/** Whether `a` reaches at least as far as `b`. */
export const reachesAtLeast = (a: SalesReach, b: SalesReach): boolean => RANK[a] >= RANK[b];

export type SystemSalesRole = 'ADMIN' | 'HEAD' | 'REP';
export const SYSTEM_SALES_ROLES: readonly SystemSalesRole[] = ['ADMIN', 'HEAD', 'REP'];

export interface BuiltInSalesRole {
  system: SystemSalesRole;
  name: string;
  description: string;
  permissions: SalesPermissionMap;
  sortOrder: number;
}

/**
 * The three roles every studio starts with (the migration
 * 20261022110000_sales_roles_teams writes exactly these; tests pin that they
 * match). Renamable and editable, never deletable.
 *
 *  - **Admin** — the whole sales side, across the studio, including the team
 *    and lead settings. Not the leads download: that stayed the owner's alone
 *    (22 Oct 2026, "26,000 phone numbers"), so it is off until the owner
 *    switches it on.
 *  - **Sales head** — their team: everyone below them and their team pool.
 *  - **Sales rep** — the Phase 1 salesperson exactly: their own leads, and
 *    claims from the pools of the teams they are in (with nobody above them
 *    but the owner, that is the studio pool, as before).
 */
export const BUILT_IN_SALES_ROLES: readonly BuiltInSalesRole[] = [
  {
    system: 'ADMIN',
    name: 'Admin',
    description: 'Runs the whole sales side: every lead, every pool, the numbers, lead settings and the sales team.',
    sortOrder: 0,
    permissions: {
      'leads.view': 'all',
      'leads.edit': 'all',
      'leads.add': true,
      'leads.merge': true,
      'leads.delete': true,
      'leads.import': true,
      'leads.bulk': 'all',
      'leads.pool': 'all',
      'leads.assign': 'all',
      'calls.log': 'all',
      'quotes.write': 'all',
      'quotes.salesFinal': 'all',
      'quotes.build': true,
      'analytics.view': 'all',
      'settings.leads': true,
      'team.manageSales': true,
    },
  },
  {
    system: 'HEAD',
    name: 'Sales head',
    description: 'Runs a team: sees and works the leads of everyone below them, hands out their team pool, sees their team’s numbers.',
    sortOrder: 1,
    permissions: {
      'leads.view': 'team',
      'leads.edit': 'team',
      'leads.add': true,
      'leads.bulk': 'team',
      'leads.pool': 'team',
      'leads.assign': 'team',
      'calls.log': 'team',
      'quotes.write': 'team',
      'quotes.salesFinal': 'team',
      'quotes.build': true,
      'analytics.view': 'team',
    },
  },
  {
    system: 'REP',
    name: 'Sales rep',
    description: 'Works their own leads: calls, floor plans, quotations, the sales final. Claims leads from their team’s pool.',
    sortOrder: 2,
    permissions: {
      'leads.view': 'own',
      'leads.edit': 'own',
      'leads.add': true,
      'leads.bulk': 'own',
      'leads.pool': 'team',
      'calls.log': 'own',
      'quotes.write': 'own',
      'quotes.salesFinal': 'own',
    },
  },
];

/** The built-ins as rows for `prisma.studioSalesRole.createMany` (provision.ts, and the lazy path in sales-team-store.ts). */
export function builtInSalesRoleRows(studioId: string): { studioId: string; system: SystemSalesRole; name: string; description: string; permissions: SalesPermissionMap; sortOrder: number }[] {
  return BUILT_IN_SALES_ROLES.map((r) => ({ studioId, system: r.system, name: r.name, description: r.description, permissions: { ...r.permissions }, sortOrder: r.sortOrder }));
}

export const MAX_SALES_ROLES = 30;

export interface SalesRoleInput {
  name: string;
  description: string | null;
  permissions: SalesPermissionMap;
}

export type SalesRoleCheck = { ok: true; role: SalesRoleInput } | { ok: false; error: string };

/**
 * What the Roles tab sent, cleaned. A role must at least see leads (a sales
 * role that cannot see a lead is a role that can do nothing); every other
 * permission is the admin's choice. Unknown keys and reaches are dropped by
 * `readSalesPermissions`, never kept.
 */
export function checkSalesRole(raw: { name?: unknown; description?: unknown; permissions?: unknown }): SalesRoleCheck {
  const name = typeof raw.name === 'string' ? raw.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2) return { ok: false, error: 'Give the role a name.' };
  if (name.length > 40) return { ok: false, error: 'Keep the name under 40 letters.' };
  const description = typeof raw.description === 'string' ? raw.description.trim().replace(/\s+/g, ' ').slice(0, 200) || null : null;
  const permissions = readSalesPermissions(raw.permissions);
  if (!permissions['leads.view']) return { ok: false, error: 'A sales role needs “See leads” at least.' };
  return { ok: true, role: { name, description, permissions } };
}

/** "Their team" etc. for one row of a role, or "On" / "Off". */
export function permissionWords(map: SalesPermissionMap, key: SalesPermissionKey): string {
  const v = map[key];
  if (v === undefined) return 'Off';
  return v === true ? 'On' : REACH_LABELS[v];
}

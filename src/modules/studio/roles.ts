/**
 * Who on a studio's team may do what (docs/studio-workspace/STUDIO-WORKSPACE-
 * BUILD.md §3). Pure: the table, as one function, tested cell by cell in
 * tests/studio-roles.test.ts.
 *
 * ## Why one function
 *
 * The brief's rule is "enforce in the module layer on every read and write,
 * not only in the UI". A permission written out at each call site drifts the
 * first time somebody adds a role; a table read through `can()` cannot. The
 * server side (`access.ts`) works out the one fact this file cannot know —
 * whether this member is on this project — and asks here.
 *
 * ## The shape of the table
 *
 * - The owner can do everything, on every project.
 * - A project manager and a site supervisor act only on projects they are
 *   assigned to (`StudioProjectMember`). Unassigned, they cannot even read
 *   one. Creating a project is the exception: it does not exist yet.
 * - Accounts sees and records payments across every project, and nothing else.
 * - Anyone not ACTIVE (invited and not yet signed in, or suspended) can do
 *   nothing. A suspended supervisor whose session is still alive is exactly
 *   the case this has to stop.
 *
 * Two readings of the brief worth knowing:
 * - "PMs and supervisors see only projects assigned to them" says nothing on
 *   payments. A PM reads them on their own projects (they chase the next
 *   payment); a supervisor does not (site mode has no use for the money).
 * - Setting when a payment stage is DUE is part of the schedule, so
 *   `plan.edit` covers it as well as `payment.record`. Marking it RECEIVED is
 *   `payment.record` only.
 *
 * Phases 2–5 (docs/studio-workspace/PHASES-2-5-FOUNDATION.md) reuse the rows
 * above rather than adding near-duplicates: moving a plan date is
 * `plan.edit`; disputing a snag is the other answer to accepting it,
 * `snag.accept`; correcting a site log or marking nobody on site is
 * `update.post`; filing a decision's options with the studio's cost is
 * `decision.create`. Two studio-wide settings are new: `crew.manage` and
 * `calendar.edit` (owner and PM, no assignment — they belong to the studio,
 * not a project). The customer confirming or disputing a payment is the
 * customer's own action, not a studio one, so it is not here.
 *
 * ## Leads, quotations and bookings (Studio OS Phase 1)
 *
 * docs/studio-os/PHASE-1-SALES.md made the lead rights per action instead
 * of all or nothing, and added SALES. For a salesperson the `assigned` fact
 * means "this lead is assigned to them": they read and work only their own
 * leads (`OWN_LEAD_ONLY`), never the pool or a colleague's. Owner and PM see
 * every lead. Assigning, merging, deleting, importing and the pool are owner
 * and PM only. Recording a booking is accounts, owner and PM; the payment
 * stages template is the owner's.
 *
 * ## Design (Studio OS Phase 2)
 *
 * docs/studio-os/PHASE-2-DESIGN.md adds DESIGNER: the projects they are the
 * designer on (a `StudioProjectMember` row, written with
 * `HomeProject.designerId`), read, files, and the design work itself
 * (`design.work`: design steps, drawings, mood board, site visits,
 * measurements). No payments, no leads. Picking the designer is
 * `design.assign` (owner, PM on the project); the studio's design steps are
 * the owner's (`design.template`); the designers' workload is owner and PM.
 *
 * ## Site crews (Studio OS Phase 3)
 *
 * docs/studio-os/PHASE-3-EXECUTION.md: accounts keeps the crews, their KYC,
 * rates and payments (`crew.edit`, `workorder.money`, `crew.pay`, studio-wide
 * like the rest of accounts). The PM builds work orders on their projects
 * (`workorder.build`) and sees quantities only — never `workorder.money`; the
 * server strips money from every read for them (studio-crews/rules.ts
 * `stripMoney`). A supervisor sees which crew is on which of their jobs
 * (`workorder.read`). Trades and routing are the owner's (`crew.settings`);
 * labour cost against the contract stays `vendor.rates` (owner).
 */

import type { Prisma } from '@prisma/client';

export type StudioRoleName = 'OWNER' | 'PM' | 'SUPERVISOR' | 'ACCOUNTS' | 'SALES' | 'DESIGNER';
export type StudioMemberStatusName = 'INVITED' | 'ACTIVE' | 'SUSPENDED';

export const STUDIO_ROLES: readonly StudioRoleName[] = ['OWNER', 'PM', 'SUPERVISOR', 'ACCOUNTS', 'SALES', 'DESIGNER'];

/** One per row of the brief's table, plus reading a project and its payments. */
export type StudioAction =
  /** Invite or remove team, set roles, sign a member out everywhere. */
  | 'team.manage'
  /** Create a project from a signed quote. */
  | 'project.create'
  /** Edit plan dates and stage names; set when a payment is due. */
  | 'plan.edit'
  /** Post today's update, mark nobody on site. */
  | 'update.post'
  /** Tick checklist items (and, until stages come from items, a stage done). */
  | 'checklist.tick'
  /** Create a decision for the customer. */
  | 'decision.create'
  /** Accept a snag, set its fix-by date, assign it; raise one from the studio side. */
  | 'snag.accept'
  /** Mark a snag fixed, with the after photo. */
  | 'snag.fix'
  /** Mark a payment received, attach the receipt. */
  | 'payment.record'
  /** See a project's payment stages and what is paid. */
  | 'payment.read'
  /** Upload, share, supersede or remove drawings and documents. */
  | 'document.upload'
  /** See vendor rates, work orders, vendor payments and margins. */
  | 'vendor.rates'
  /** Read a project at all: its plan, updates, decisions, snags, documents. */
  | 'project.read'
  /** Keep the studio's crew list (the faces site mode taps). Studio-wide. */
  | 'crew.manage'
  /** Set the studio's working days and holidays (reminders count on them). Studio-wide. */
  | 'calendar.edit'
  /** See a lead, its timeline, files and quotations. SALES: own leads only. */
  | 'lead.read'
  /** Work a lead: details, calls, notes, files, meeting, column. SALES: own leads only. */
  | 'lead.edit'
  /** Add a lead by hand. */
  | 'lead.add'
  /** Give leads to somebody, or back to the pool. */
  | 'lead.assign'
  /** Fold a duplicate lead into another. */
  | 'lead.merge'
  /** Delete to the bin, restore, erase. */
  | 'lead.delete'
  /** Import a spreadsheet of leads. */
  | 'lead.import'
  /** See the pool: leads nobody has. */
  | 'lead.pool'
  /** Take a lead nobody has (the pool) for yourself. SALES too (owner, 12 Oct 2026, after AxLeads); only ever an unassigned lead — the write checks. */
  | 'lead.claim'
  /** Write and send a lead's quotations. SALES: own leads only. */
  | 'quote.write'
  /** Mark a quotation revision as the sales final. SALES: own leads only. */
  | 'quote.salesFinal'
  /** Record the booking advance on a sales final (creates the project). */
  | 'booking.record'
  /** Refund a booking within the refund days (the owner may also later). */
  | 'booking.refund'
  /** Set the studio's payment stages (Settings, Payment stages). */
  | 'payments.template'
  /** Design work on a project: tick design steps, drawings, mood board, site visits, measurements (Phase 2). */
  | 'design.work'
  /** Pick or change a project's designer, close the design (Phase 2). */
  | 'design.assign'
  /** Set the studio's design steps (Settings, Design steps). */
  | 'design.template'
  /** See every designer's design projects and load (Phase 2). */
  | 'design.workload'
  /** Phase 3: see the studio's crews to pick one (names, trades, phone; no KYC, no rates). */
  | 'crew.list'
  /** Phase 3: add and edit crews, their KYC scans, payee details and rate cards; archive. */
  | 'crew.edit'
  /** Phase 3: the studio's trades, routing, rate templates and crew settings. */
  | 'crew.settings'
  /** Phase 3: see a project's work orders: which crew is on which job (money only with `workorder.money`). */
  | 'workorder.read'
  /** Phase 3: build work orders, pick crews, enter quantities and extras, mark work done. */
  | 'workorder.build'
  /** Phase 3: see and set rates, agreed amounts, bills, balances and payments on work orders. */
  | 'workorder.money'
  /** Phase 3: record a payment to a crew, or correct one. */
  | 'crew.pay';

export const STUDIO_ACTIONS: readonly StudioAction[] = [
  'team.manage',
  'project.create',
  'plan.edit',
  'update.post',
  'checklist.tick',
  'decision.create',
  'snag.accept',
  'snag.fix',
  'payment.record',
  'payment.read',
  'document.upload',
  'vendor.rates',
  'project.read',
  'crew.manage',
  'calendar.edit',
  'lead.read',
  'lead.edit',
  'lead.add',
  'lead.assign',
  'lead.merge',
  'lead.delete',
  'lead.import',
  'lead.pool',
  'lead.claim',
  'quote.write',
  'quote.salesFinal',
  'booking.record',
  'booking.refund',
  'payments.template',
  'design.work',
  'design.assign',
  'design.template',
  'design.workload',
  'crew.list',
  'crew.edit',
  'crew.settings',
  'workorder.read',
  'workorder.build',
  'workorder.money',
  'crew.pay',
];

/** Everything a PM does with leads and sales: all of it, across the studio. */
const PM_SALES: readonly StudioAction[] = [
  'lead.read',
  'lead.edit',
  'lead.add',
  'lead.assign',
  'lead.merge',
  'lead.delete',
  'lead.import',
  'lead.pool',
  'lead.claim',
  'quote.write',
  'quote.salesFinal',
  'booking.record',
  'booking.refund',
];

/** What each role may do. The owner is not listed: the owner may do everything. */
const GRANTS: Record<Exclude<StudioRoleName, 'OWNER'>, readonly StudioAction[]> = {
  SALES: ['lead.read', 'lead.edit', 'lead.add', 'lead.claim', 'quote.write', 'quote.salesFinal'],
  PM: [
    ...PM_SALES,
    'project.create',
    'plan.edit',
    'update.post',
    'checklist.tick',
    'decision.create',
    'snag.accept',
    'snag.fix',
    'payment.read',
    'document.upload',
    'project.read',
    'crew.manage',
    'calendar.edit',
    'design.work',
    'design.assign',
    'design.workload',
    /* Phase 3: quantities only — never `workorder.money` or `crew.pay`. */
    'crew.list',
    'workorder.read',
    'workorder.build',
  ],
  SUPERVISOR: ['update.post', 'checklist.tick', 'snag.fix', 'project.read', 'workorder.read'],
  ACCOUNTS: ['payment.read', 'payment.record', 'booking.record', 'booking.refund', 'crew.list', 'crew.edit', 'workorder.read', 'workorder.money', 'crew.pay'],
  /* Studio OS Phase 2: only the projects they are the designer on; no money. */
  DESIGNER: ['project.read', 'document.upload', 'design.work'],
};

/** Lead actions a salesperson may take only on a lead assigned to them. */
const OWN_LEAD_ONLY: ReadonlySet<StudioAction> = new Set<StudioAction>(['lead.read', 'lead.edit', 'quote.write', 'quote.salesFinal']);

/** Actions on one project, which a PM or supervisor may take only when assigned to it. */
const NEEDS_ASSIGNMENT: ReadonlySet<StudioAction> = new Set<StudioAction>([
  'plan.edit',
  'update.post',
  'checklist.tick',
  'decision.create',
  'snag.accept',
  'snag.fix',
  'payment.read',
  'payment.record',
  'document.upload',
  'project.read',
  'design.work',
  'design.assign',
  'workorder.read',
  'workorder.build',
]);

/** Accounts works across every project, so assignment never applies to it. */
const STUDIO_WIDE_ROLES: ReadonlySet<StudioRoleName> = new Set(['OWNER', 'ACCOUNTS']);

export interface MemberRole {
  role: StudioRoleName;
  status: StudioMemberStatusName;
}

/**
 * Whether this member may take this action.
 *
 * `ctx.assigned` is whether they are on the project in question. Leave it
 * out for an action with no project (inviting, creating a project, vendor
 * rates); for a project action a PM or supervisor then gets `false`, which is
 * the safe answer to a question asked without the facts.
 */
export function can(member: MemberRole, action: StudioAction, ctx: { assigned?: boolean } = {}): boolean {
  if (member.status !== 'ACTIVE') return false;
  if (member.role === 'OWNER') return true;
  if (!GRANTS[member.role]?.includes(action)) return false;
  // A lead action: only a salesperson is limited, to their own leads.
  if (OWN_LEAD_ONLY.has(action)) return member.role !== 'SALES' || ctx.assigned === true;
  if (STUDIO_WIDE_ROLES.has(member.role) || !NEEDS_ASSIGNMENT.has(action)) return true;
  return ctx.assigned === true;
}

/**
 * The leads a member may see, as a `where` for `prisma.studioClient`: the
 * whole studio for owner and PM, only those assigned to them for a
 * salesperson, none for anyone else. Always scoped to their own studio. The
 * caller still adds `deletedAt: null` (LISTED or LIVE).
 */
export function leadsVisibleTo(member: MemberRole & { id: string; studioId: string }): Prisma.StudioClientWhereInput {
  if (!can(member, 'lead.read', { assigned: true })) return { studioId: member.studioId, id: { in: [] } };
  if (member.role === 'SALES') return { studioId: member.studioId, assignedToId: member.id };
  return { studioId: member.studioId };
}

/**
 * The pool a member may see and claim from (owner, 12 Oct 2026): leads
 * nobody has, in their own studio. Owner, PM and sales; nobody else. A
 * salesperson sees the pool as a list to claim from — never a colleague's
 * lead, and not the pool lead's own page until they have claimed it
 * (`leadsVisibleTo` stays their own leads only).
 */
export function poolVisibleTo(member: MemberRole & { id: string; studioId: string }): Prisma.StudioClientWhereInput {
  if (!can(member, 'lead.claim')) return { studioId: member.studioId, id: { in: [] } };
  return { studioId: member.studioId, assignedToId: null };
}

/**
 * The quotations a member may see, as a `where` for `prisma.studioQuote`:
 * the studio's for owner and PM; for a salesperson only quotations of a
 * lead assigned to them (a quotation with no lead is not theirs to see).
 */
export function quotesVisibleTo(member: MemberRole & { id: string; studioId: string }): Prisma.StudioQuoteWhereInput {
  if (!can(member, 'quote.write', { assigned: true })) return { studioId: member.studioId, id: { in: [] } };
  if (member.role === 'SALES') return { studioId: member.studioId, client: { assignedToId: member.id, deletedAt: null } };
  return { studioId: member.studioId };
}

/** Whether this role needs a `StudioProjectMember` row to act on a project. */
export const needsAssignment = (role: StudioRoleName): boolean => !STUDIO_WIDE_ROLES.has(role);

/**
 * The customer projects a member may see, as a `where` for
 * `prisma.homeProject.findMany` — for the office Projects list, site mode's
 * "My sites today", accounts' payments list.
 *
 * `purpose: 'payments'` is the accounts view: every project's money. For
 * anything else accounts sees none. Always scoped to the member's own studio
 * through the introduction, so no role can reach another studio's project.
 */
export function projectsVisibleTo(
  member: MemberRole & { id: string; studioId: string },
  purpose: 'project' | 'payments' = 'project',
): Prisma.HomeProjectWhereInput {
  const action: StudioAction = purpose === 'payments' ? 'payment.read' : 'project.read';
  const studio: Prisma.HomeProjectWhereInput = { introduction: { studioId: member.studioId } };
  if (!can(member, action, { assigned: true })) return { id: { in: [] } };
  if (!needsAssignment(member.role)) return studio;
  return { ...studio, team: { some: { memberId: member.id } } };
}

/** Free seats before a studio pays (Settings → Team). */
export const FREE_SEATS = 5;

/** A seat: signed in at least once (INVITED becomes ACTIVE on first sign-in) and not suspended. */
export const isSeat = (m: { status: StudioMemberStatusName }): boolean => m.status === 'ACTIVE';

/**
 * How long a studio sign-in lasts. Supervisors 90 days: they sign in on a
 * site phone, often a shared one, and being asked for a code on a ladder is
 * how site mode stops being used. Everyone else keeps the usual 30. Computed
 * from the role when the session is made, so nothing is stored.
 */
export const sessionDaysFor = (role: StudioRoleName): number => (role === 'SUPERVISOR' ? 90 : 30);

/** Roles that are put on particular projects (site chips on Settings → Team). */
export const PICKS_SITES: readonly StudioRoleName[] = ['PM', 'SUPERVISOR'];

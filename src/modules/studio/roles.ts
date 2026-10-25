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
 * measurements). No leads. Picking the designer is
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
 *
 * ## The project lifecycle (owner, 13 Oct 2026)
 *
 * docs/studio-os/PROJECT-LIFECYCLE.md. **Designers see money everywhere on
 * the projects they design** (this reverses the 12 Oct "designer sees no
 * money" rule): the project's payments (`payment.read`), quotation money,
 * the project closure and the crews' money on that project
 * (`workorder.read` + `workorder.money`, read only: crew writes stay
 * `workorder.build`, which a designer does not have). Still only projects
 * they are the designer on (their team row): `workorder.money` now needs the
 * assignment like every project action — owner and accounts are studio-wide,
 * so nothing changes for them, and a PM still never has it (quantities only).
 * The designer and the supervisor both tick execution steps
 * (`checklist.tick` + `update.post`: each tick needs a photo and a sentence
 * in the site log). Signing off the design is `design.close` (owner; PM and
 * designer on the project); the project closure — the final payment — is
 * `project.closure` (owner; PM and designer on the project). The client's
 * handover sign-off is the customer's own act, not a studio one.
 *
 * ## Bringing in running projects (owner, 20 Oct 2026)
 *
 * docs/studio-os/BRING-IN-PROJECTS.md: `project.bringIn` (owner, PM,
 * designer; Max only, like every project action). The project does not exist
 * yet, so no assignment applies; whoever brings it in is put on it. Inside
 * that flow only, they may pick or add the client's lead and import or pick
 * its quotation; the rest of the leads and the builder keep their own rights.
 */

import type { Prisma } from '@prisma/client';
import { STUDIO_POOL_ONLY, inPool, leadInReach, poolAccessOf, poolWhere, reachOf, reachWhere, type LeadFacts, type SalesContext } from './sales-access';
import type { SalesPermissionKey } from './sales-permissions';

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
  /** Download the leads list as a spreadsheet (improvement 8, owner 22 Oct 2026): the owner's alone — 26,000 phone numbers is the studio's whole business walking out of the door, so no other role is granted it. */
  | 'lead.export'
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
  | 'crew.pay'
  /** Lifecycle: sign off the design (close it), which moves the project to execution. */
  | 'design.close'
  /** Lifecycle: work out and fix the project closure (the final payment). */
  | 'project.closure'
  /** Change orders (15 Oct 2026): add extra work after design sign-off, send it to the client, release it once paid. */
  | 'extras.write'
  /** Ask the client to sign a quotation (sales final, design final) digitally (15 Oct 2026). */
  | 'signoff.request'
  /** Bring a running project onto One Interiors ("Add an existing project", 20 Oct 2026): its client, quotation, steps done, payments received, team. */
  | 'project.bringIn'
  /** Sales roles (owner, 22 Oct 2026): log a call on a lead, its outcome and the next follow-up. Was part of `lead.edit`; SALES: own leads only. */
  | 'lead.call'
  /** Sales roles: select many leads and act on them together (each action still needs its own right). */
  | 'lead.bulk'
  /** Sales roles: lead analytics, calling numbers, by campaign. */
  | 'lead.analytics'
  /** Sales roles: the pipeline, lead fields, lead sources and "New leads go to" (the sources screen used to ask `lead.import`). */
  | 'lead.settings'
  /** Sales roles: invite salespeople, give them a sales role and a reporting line, edit sales roles. */
  | 'team.sales'
  /** Sales roles: builds quotations; gets quotation requests in turns (the queue is a follow-up). */
  | 'quote.build';

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
  'lead.export',
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
  'design.close',
  'project.closure',
  'extras.write',
  'signoff.request',
  'project.bringIn',
  'lead.call',
  'lead.bulk',
  'lead.analytics',
  'lead.settings',
  'team.sales',
  'quote.build',
];

/** Everything a PM does with leads and sales: all of it, across the studio. */
const PM_SALES: readonly StudioAction[] = [
  'lead.read',
  'lead.edit',
  'lead.call',
  'lead.bulk',
  'lead.analytics',
  'lead.settings',
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
  SALES: ['lead.read', 'lead.edit', 'lead.call', 'lead.bulk', 'lead.add', 'lead.claim', 'quote.write', 'quote.salesFinal'],
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
    'design.close',
    'project.closure',
    'extras.write',
    'signoff.request',
    'project.bringIn',
    /* Phase 3: quantities only — never `workorder.money` or `crew.pay`. */
    'crew.list',
    'workorder.read',
    'workorder.build',
  ],
  SUPERVISOR: ['update.post', 'checklist.tick', 'snag.fix', 'project.read', 'workorder.read'],
  ACCOUNTS: ['payment.read', 'payment.record', 'booking.record', 'booking.refund', 'crew.list', 'crew.edit', 'workorder.read', 'workorder.money', 'crew.pay'],
  /* Studio OS Phase 2: only the projects they are the designer on. Lifecycle (owner, 13 Oct 2026): money everywhere on those projects, execution ticks, design sign-off, the closure. */
  DESIGNER: ['project.read', 'document.upload', 'design.work', 'design.close', 'payment.read', 'update.post', 'checklist.tick', 'workorder.read', 'workorder.money', 'project.closure', 'extras.write', 'signoff.request', 'project.bringIn'],
};

/** Lead actions a salesperson may take only on a lead assigned to them. */
const OWN_LEAD_ONLY: ReadonlySet<StudioAction> = new Set<StudioAction>(['lead.read', 'lead.edit', 'lead.call', 'quote.write', 'quote.salesFinal']);

/**
 * Sales roles (owner, 22 Oct 2026; docs/studio-os/SALES-ROLES.md): which
 * sales permission decides each lead action for a SALES member who has a
 * sales role. Anything not listed is refused for them (SALES has no other
 * grant). Owners, PMs and the other fixed roles never come through here.
 */
const SALES_KEY_FOR: Partial<Record<StudioAction, SalesPermissionKey>> = {
  'lead.read': 'leads.view',
  'lead.edit': 'leads.edit',
  'lead.call': 'calls.log',
  'lead.add': 'leads.add',
  'lead.assign': 'leads.assign',
  'lead.merge': 'leads.merge',
  'lead.delete': 'leads.delete',
  'lead.import': 'leads.import',
  'lead.export': 'leads.export',
  'lead.pool': 'leads.pool',
  'lead.claim': 'leads.pool',
  'lead.bulk': 'leads.bulk',
  'lead.analytics': 'analytics.view',
  'lead.settings': 'settings.leads',
  'team.sales': 'team.manageSales',
  'quote.write': 'quotes.write',
  'quote.salesFinal': 'quotes.salesFinal',
  'quote.build': 'quotes.build',
};

/** Actions decided per lead by the permission's reach (own / team / all). */
const REACH_ACTIONS: ReadonlySet<StudioAction> = new Set<StudioAction>(['lead.read', 'lead.edit', 'lead.call', 'quote.write', 'quote.salesFinal', 'lead.assign', 'lead.bulk']);

/**
 * A SALES member with a sales role. Without a lead in `ctx`, a per-lead
 * action is allowed only on their own lead (`assigned: true`), i.e. "may
 * they do this at all", and refused otherwise: a question asked without the
 * facts gets the safe answer. Assign and bulk without a lead: whether they
 * have the permission at all. `lead.claim` with a lead: unassigned and in a
 * pool they may see.
 */
function canBySalesRole(sales: SalesContext, action: StudioAction, ctx: CanContext): boolean {
  const key = SALES_KEY_FOR[action];
  if (!key) return false;
  const reach = reachOf(sales, key);
  if (reach === null) return false;
  if (action === 'lead.claim' || action === 'lead.pool') return ctx.lead ? inPool(poolAccessOf(sales), ctx.lead) : true;
  if (!REACH_ACTIONS.has(action)) return true;
  if (ctx.lead) return leadInReach(sales, reach, ctx.lead);
  if (action === 'lead.assign' || action === 'lead.bulk') return true;
  return ctx.assigned === true;
}

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
  /* Lifecycle: a designer sees crew money only on their own projects. Owner and accounts are studio-wide, so unchanged. */
  'workorder.money',
  'design.close',
  'project.closure',
  'extras.write',
  'signoff.request',
]);

/** Accounts works across every project, so assignment never applies to it. */
const STUDIO_WIDE_ROLES: ReadonlySet<StudioRoleName> = new Set(['OWNER', 'ACCOUNTS']);

export interface MemberRole {
  role: StudioRoleName;
  status: StudioMemberStatusName;
  /**
   * The studio's pilot switch (`Studio.fullSoftware`, owner 14 Oct 2026;
   * studio/pilot.ts). `memberFor` always sets it. Left out (a pure test, a
   * caller that has no studio row) nothing is narrowed; explicitly `false`
   * closes the full-software roles and actions below.
   */
  fullSoftware?: boolean;
  /**
   * The studio is on Pro Solo (owner, 21 Oct 2026; software-plan.ts): one
   * person, so studio/surfaces.ts closes the team screen and the lead pool.
   */
  solo?: boolean;
  /** Their membership id, when known (`memberFor` sets it): lets `can()` tell "their own lead" from `ctx.lead`. */
  id?: string;
  /**
   * Design head (owner and Hauspire's design team, 24 Oct 2026;
   * docs/studio-os/DESIGN-PROCESS-PLAN.md §2.6): a designer who sees and
   * works every project of the studio as if on it, and the designers' load
   * page. Only read on a DESIGNER.
   */
  designHead?: boolean;
  /**
   * Sales roles (owner, 22 Oct 2026): a SALES member's sales role and place
   * in the reporting tree, built per request (access.ts `memberFor`). Null
   * or left out on a SALES member keeps the Phase 1 rule exactly. Ignored for
   * every other role.
   */
  sales?: SalesContext | null;
  /**
   * Developer access (owner, 22 Oct 2026; docs/studio-os/VIEW-AS.md): One
   * Interiors staff looking at the studio as this member. Set only by
   * access.ts for a live view. `can()` then allows the read actions alone
   * (`READ_ACTIONS`); every other action is refused, whatever the role.
   */
  viewOnly?: boolean;
}

/**
 * The actions that only read (developer access, owner 22 Oct 2026). A
 * `viewOnly` member may take these and nothing else: every action not listed
 * is a write (or, for `lead.export`, the studio's whole lead list leaving the
 * building) and is refused at the root of `can()`. Explicit both ways, and
 * tests/view-as.test.ts walks every action in `STUDIO_ACTIONS` against it, so a
 * new action is a write until somebody decides otherwise here.
 *
 * Two reads also gate some writes: `vendor.rates` (seeing rates and margins;
 * labour rates are edited under it) and `workorder.money` (seeing crew money;
 * bills and balances are set under it). They are reads here so the view shows
 * the money that member sees; their writes are still refused, because a
 * viewing session resolves to no member at all on a write request (access.ts
 * `currentMember`, tenancy.ts `myStudioId`) and the middleware refuses the
 * request before that.
 */
export const READ_ACTIONS: ReadonlySet<StudioAction> = new Set<StudioAction>([
  'project.read',
  'payment.read',
  'lead.read',
  'lead.pool',
  'lead.analytics',
  'design.workload',
  'crew.list',
  'workorder.read',
  'workorder.money',
  'vendor.rates',
]);

/** Whether the action only reads (`READ_ACTIONS`). */
export const isReadAction = (action: StudioAction): boolean => READ_ACTIONS.has(action);

/**
 * The member as their own screens are drawn for them, ignoring a staff view's
 * read-only flag: which screens open (surfaces.ts `mayOpen`), which apps show
 * and which rows a list holds. Never for deciding a write.
 */
export function asSeenBy<T extends MemberRole>(member: T): T {
  return member.viewOnly ? { ...member, viewOnly: false } : member;
}

/** What `can()` may be told about the thing acted on. */
export interface CanContext {
  /** On the project in question; for a lead, the lead is theirs. */
  assigned?: boolean;
  /** The lead acted on (sales roles reach by its owner and its pool). */
  lead?: LeadFacts;
}

/** Whether a SALES member is governed by a sales role (else the Phase 1 rule). */
export const hasSalesRole = (member: MemberRole): member is MemberRole & { sales: SalesContext } => member.role === 'SALES' && !!member.sales;

/**
 * The roles that only make sense with the full software (owner, 14 Oct
 * 2026): in a studio without it they can do nothing, and their home says so.
 */
export const FULL_SOFTWARE_ROLES: readonly StudioRoleName[] = ['PM', 'DESIGNER', 'SUPERVISOR', 'ACCOUNTS'];

/**
 * What a studio without the full software cannot do, whoever asks (the
 * owner included): projects, site, design, the payments desk and crews.
 * Leads, quotations, booking a sales final, the payment stages template,
 * the calendar and the team stay: on Pro (owner, 21 Oct 2026) the owner adds
 * salespeople, and team-store.ts refuses the full-software roles.
 */
export const FULL_SOFTWARE_ACTIONS: ReadonlySet<StudioAction> = new Set<StudioAction>([
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
  'design.close',
  'project.closure',
  'extras.write',
  'signoff.request',
  'project.bringIn',
]);

/**
 * Whether this member may take this action.
 *
 * `ctx.assigned` is whether they are on the project in question. Leave it
 * out for an action with no project (inviting, creating a project, vendor
 * rates); for a project action a PM or supervisor then gets `false`, which is
 * the safe answer to a question asked without the facts.
 */
/** What a design head may do beyond a designer: see every designer's load. */
const DESIGN_HEAD_ACTIONS: ReadonlySet<StudioAction> = new Set<StudioAction>(['design.workload']);

export function can(member: MemberRole, action: StudioAction, ctx: CanContext = {}): boolean {
  if (member.status !== 'ACTIVE') return false;
  /* Developer access (owner, 22 Oct 2026): staff viewing as this member read, and never write. First, before the owner's "everything". */
  if (member.viewOnly === true && !READ_ACTIONS.has(action)) return false;
  /* The pilot switch (studio/pilot.ts): checked before the owner's "everything". */
  if (member.fullSoftware === false && (FULL_SOFTWARE_ROLES.includes(member.role) || FULL_SOFTWARE_ACTIONS.has(action))) return false;
  if (member.role === 'OWNER') return true;
  /* Sales roles (owner, 22 Oct 2026): the role and its reach decide, not GRANTS. */
  if (hasSalesRole(member)) return canBySalesRole(member.sales, action, ctx);
  const head = member.role === 'DESIGNER' && member.designHead === true;
  /* A design head sees every designer's load (DESIGN-PROCESS-PLAN.md §2.6). */
  if (head && DESIGN_HEAD_ACTIONS.has(action)) return true;
  if (!GRANTS[member.role]?.includes(action)) return false;
  /* A design head is on every project of the studio. */
  const assigned = head ? true : (ctx.assigned ?? (ctx.lead && member.id ? ctx.lead.assignedToId !== null && ctx.lead.assignedToId === member.id : undefined));
  /* Phase 1 pool: a salesperson without a sales role claims only from the studio pool. */
  if (action === 'lead.claim' && member.role === 'SALES' && ctx.lead) return inPool(STUDIO_POOL_ONLY, ctx.lead);
  // A lead action: only a salesperson is limited, to their own leads.
  if (OWN_LEAD_ONLY.has(action)) return member.role !== 'SALES' || assigned === true;
  if (STUDIO_WIDE_ROLES.has(member.role) || !NEEDS_ASSIGNMENT.has(action)) return true;
  return assigned === true;
}

/**
 * The leads a member may see, as a `where` for `prisma.studioClient`: the
 * whole studio for owner and PM, only those assigned to them for a
 * salesperson, none for anyone else. Always scoped to their own studio. The
 * caller still adds `deletedAt: null` (LISTED or LIVE).
 */
export function leadsVisibleTo(member: MemberRole & { id: string; studioId: string }): Prisma.StudioClientWhereInput {
  if (!can(member, 'lead.read', { assigned: true })) return { studioId: member.studioId, id: { in: [] } };
  /* Sales roles: as far as `leads.view` reaches (sales-access.ts `reachWhere`). */
  if (hasSalesRole(member)) return reachWhere(member.sales, reachOf(member.sales, 'leads.view'), member.studioId);
  if (member.role === 'SALES') return { studioId: member.studioId, assignedToId: member.id };
  return { studioId: member.studioId };
}

/** The per-lead actions a write may be fenced by (`leadsWhereFor`). */
export type LeadWriteAction = 'lead.read' | 'lead.edit' | 'lead.call' | 'quote.write' | 'quote.salesFinal' | 'lead.assign' | 'lead.bulk';

/**
 * The leads a member may take this action on, as a `where` for
 * `prisma.studioClient` (sales roles and teams, owner 22 Oct 2026). A write
 * ANDs it with the lead's id, so an action whose reach is narrower than what
 * they can see (a head who sees their team but edits only their own) matches
 * nothing outside it. Owner and PM: the studio. A Phase 1 salesperson: their
 * own leads (assign: none). Anyone else: none. Always inside their studio.
 */
export function leadsWhereFor(member: MemberRole & { id: string; studioId: string }, action: LeadWriteAction): Prisma.StudioClientWhereInput {
  const none: Prisma.StudioClientWhereInput = { studioId: member.studioId, id: { in: [] } };
  const general = action === 'lead.assign' || action === 'lead.bulk' ? can(member, action) : can(member, action, { assigned: true });
  if (!general) return none;
  if (hasSalesRole(member)) {
    const key = SALES_KEY_FOR[action];
    return key ? reachWhere(member.sales, reachOf(member.sales, key), member.studioId) : none;
  }
  if (member.role === 'SALES') return action === 'lead.assign' ? none : { studioId: member.studioId, assignedToId: member.id };
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
  /* Who may claim is who sees the pool; a staff view sees it as the member does (`asSeenBy`), and still cannot claim. */
  if (!can(asSeenBy(member), 'lead.claim')) return { studioId: member.studioId, id: { in: [] } };
  /* Sales roles (owner, 22 Oct 2026): the pools `leads.pool` reaches; a Phase 1 salesperson, the studio pool. */
  if (hasSalesRole(member)) return poolWhere(poolAccessOf(member.sales), member.studioId);
  if (member.role === 'SALES') return poolWhere(STUDIO_POOL_ONLY, member.studioId);
  return { studioId: member.studioId, assignedToId: null };
}

/**
 * The quotations a member may see, as a `where` for `prisma.studioQuote`:
 * the studio's for owner and PM; for a salesperson only quotations of a
 * lead assigned to them (a quotation with no lead is not theirs to see).
 */
export function quotesVisibleTo(member: MemberRole & { id: string; studioId: string }): Prisma.StudioQuoteWhereInput {
  /* A read: a staff view sees the quotations the member sees (`asSeenBy`); writing still asks `can()`. */
  if (!can(asSeenBy(member), 'quote.write', { assigned: true })) return { studioId: member.studioId, id: { in: [] } };
  /* Sales roles: the quotations of the leads they may see (writing still asks `quote.write` on the lead). */
  if (hasSalesRole(member)) {
    const reach = reachOf(member.sales, 'leads.view');
    if (reach === 'all') return { studioId: member.studioId };
    return { studioId: member.studioId, client: { ...reachWhere(member.sales, reach, member.studioId), deletedAt: null } };
  }
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
  if (!needsAssignment(member.role) || (member.role === 'DESIGNER' && member.designHead === true)) return studio;
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

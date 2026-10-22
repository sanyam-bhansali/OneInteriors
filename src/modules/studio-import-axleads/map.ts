/**
 * An AxLeads workspace export, as this studio's leads, history and team
 * (owner, 21 Oct 2026; docs/studio-os/AXLEADS-IMPORT.md). Pure: no Prisma,
 * no `server-only` (CONTRIBUTING §9.5), because the runner is a laptop
 * script (`scripts/import-axleads.ts`) and because everything that can go
 * wrong with a migration goes wrong in here, so this is the half that has to
 * be testable. `import.ts` reads the studio, hands it to `planImport`, prints
 * the report and — unless it is a dry run — writes exactly the plan.
 *
 * Tested in tests/axleads-import-map.test.ts with the FAKE export in
 * tests/fixtures/axleads-export.fake.json.
 *
 * ## The rules
 *
 * - **Nothing is lost.** Every lead comes over with its stage, owner, notes
 *   and every history line at its original time. What has no column here
 *   (score, form answers that are not one of the studio's fields,
 *   follow-ups, a phone that is not a mobile) goes into a "From AxLeads"
 *   block in the lead's notes. The export file itself is the full archive.
 * - **Ad attribution** (owner, 22 Oct 2026): the leadgen, campaign, ad set,
 *   ad and form ids, gclid and utm land in the lead's attribution columns
 *   (`adAttributionFor`), not the notes, so lead analytics counts them "By
 *   campaign" and a Meta lead can be reported to Meta. A merge into a card
 *   that already has an ad keeps the card's and lists the merged lead's ad
 *   in its merge note.
 * - **Stages** map by name first (spacing and case ignored) when the meaning
 *   agrees — a lost lead lands only in a Lost-kind column, a won one only in a
 *   Signed or Finished one — then by meaning (intake → the intake column, won
 *   → the first Signed column, lost → the first Lost column). Anything else
 *   lands in the intake column and is reported. `--roles` can name the column
 *   for any AxLeads stage.
 * - **Sources**: Meta lead ads → Facebook, or Instagram when the lead says so;
 *   Google lead forms and AxLeads' own forms → Website; WhatsApp → Other with
 *   the studio's own source name "WhatsApp" / "WhatsApp ads"; referral →
 *   Referral; typed in → Other.
 * - **People** match a studio member by phone, then email. Somebody who is
 *   not on the team yet is added as INVITED — no message is sent, ever —
 *   under the same rules as Settings → Team: a number that is a customer's,
 *   One Interiors' or another studio's is refused and reported. Without a
 *   phone (AxLeads keeps none on the membership) nobody is added; their leads
 *   go to the pool. Leavers are never added; their names stay on the history.
 * - **Duplicates**: a lead whose phone is already on the board, or on an
 *   earlier lead in the same file, is merged into that card — its history
 *   appended, blanks filled, nothing overwritten — rather than made twice.
 * - **Idempotent**: each lead gets `importedFrom = "axleads"` + its AxLeads id,
 *   and each history line `externalId = "axleads:<id>"`, both unique per
 *   studio. A second run skips what the first wrote; it only gives a lead in
 *   the pool to its person if that person has since been matched.
 * - **The sales team** (owner, 22 Oct 2026): the roles file can name each
 *   person (`name`), give a salesperson a sales role (`salesRole`, made from
 *   another role plus permissions when the studio has no role of that name)
 *   and a reporting line (`reportsTo`), and send the pool leads to a head's
 *   team pool (`poolTeam`). Planned by `planSalesTeam` under the same rules as
 *   Settings → Team (sales-team-store.ts): sales roles and reporting lines are
 *   for SALES members only, same studio, no loops; the owner is everything and
 *   gets neither. Anything the file asks for that cannot be done is a problem
 *   in the report, and a real run writes nothing until the file is fixed.
 */

import { normalisePhone as clientPhone, tidyName } from '@/modules/studio-practice/csv';
import { normalisePhone as memberPhone } from '@/modules/studio/phone';
import {
  assignedSummary,
  contactSummary,
  lostSummary,
  stageSummary,
  type CallOutcomeId,
  type EventKindName,
} from '@/modules/studio-practice/event-copy';
import { fieldKeyFrom, SOURCE_LABELS, type ClientSourceName, type FieldTypeName, type LostReasonName, type StageKindName } from '@/modules/studio-practice/vocabulary';
import { cleanValues, type FieldShape } from '@/modules/studio-practice/field-values';
import { addTags } from '@/modules/studio-sales/tag-rules';
import { STUDIO_ROLES, type StudioRoleName } from '@/modules/studio/roles';
import { adColumns, emptyAds, platformWord, UTM_KEYS, type AdColumns } from '@/modules/studio-intake/payloads';
import { checkReportsTo, type ReportsToMember } from '@/modules/studio/sales-access';
import {
  BUILT_IN_SALES_ROLES,
  MAX_SALES_ROLES,
  SALES_PERMISSION_KEYS,
  checkSalesRole,
  permissionDef,
  reachesAtLeast,
  readSalesPermissions,
  type SalesPermissionKey,
  type SalesPermissionMap,
  type SalesReach,
} from '@/modules/studio/sales-permissions';

export const IMPORTED_FROM = 'axleads';
export const EXPORT_FORMAT = 'axleads-export';

// ── The export file (AxLeads scripts/export-tenant.mjs, version 1) ─────────

export type AxRole = 'OWNER' | 'AGENT';
export type AxSemantic = 'INTAKE' | 'ACTIVE' | 'FOLLOWUP' | 'WON' | 'LOST';

export interface AxMember {
  id: string;
  userId: string;
  displayName: string;
  email: string | null;
  /** From the Supabase auth user, when the export could read it. */
  phone: string | null;
  role: AxRole;
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED';
  deletedAt: string | null;
}

export interface AxStage {
  id: string;
  pipelineId: string;
  name: string;
  position: number;
  semantic: AxSemantic;
  deletedAt: string | null;
}

export interface AxFieldDef {
  key: string;
  label: string;
  type: 'TEXT' | 'PHONE' | 'EMAIL' | 'NUMBER' | 'SELECT' | 'DATE' | 'TEXTAREA';
  options: string[];
  groupable?: boolean;
  position: number;
  deletedAt: string | null;
}

export interface AxActivity {
  id: string;
  kind: string;
  data: Record<string, unknown> | null;
  actorKind: 'HUMAN' | 'AGENT' | 'SYSTEM';
  createdAt: string;
  createdBy: string | null;
}

export interface AxMessage {
  id: string;
  channel: string;
  direction: 'INBOUND' | 'OUTBOUND';
  body: string | null;
  templateKey?: string | null;
  createdAt: string;
}

export interface AxLead {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  stageId: string;
  assignedTo: string | null;
  city: string | null;
  locality: string | null;
  budgetMinInr: number | null;
  budgetMaxInr: number | null;
  timelineText: string | null;
  requirements: string[];
  customFields: Record<string, unknown> | null;
  tags: string[];
  score: number;
  isHot: boolean;
  source: string;
  sourceConnectionId: string | null;
  sourceDetail: Record<string, unknown> | null;
  leadgenId: string | null;
  gclid: string | null;
  campaignId: string | null;
  adsetId: string | null;
  adId: string | null;
  formId: string | null;
  utm: unknown;
  referredBy: string | null;
  nextAttemptAt: string | null;
  nextAttemptDoneAt: string | null;
  followUps: unknown;
  lostReason: string | null;
  lostAt: string | null;
  createdAt: string;
  deletedAt: string | null;
  contact: { name: string | null; phone: string | null; email: string | null } | null;
  activities: AxActivity[];
  messages: AxMessage[];
}

export interface AxExport {
  format: typeof EXPORT_FORMAT;
  version: 1;
  exportedAt: string;
  tenant: { id: string; name: string; slug: string };
  members: AxMember[];
  stages: AxStage[];
  fieldDefs: AxFieldDef[];
  sourceConnections?: { id: string; provider: string; label: string }[];
  hostedForms?: { id: string; slug: string; title: string }[];
  leads: AxLead[];
}

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/** The file, checked only as far as the importer relies on it. */
export function parseExport(raw: unknown): { ok: true; data: AxExport } | { ok: false; error: string } {
  if (!isObj(raw)) return { ok: false, error: 'That is not an AxLeads export (not a JSON object).' };
  if (raw.format !== EXPORT_FORMAT) return { ok: false, error: `That is not an AxLeads export (format is ${JSON.stringify(raw.format)}).` };
  if (raw.version !== 1) return { ok: false, error: `This importer reads version 1 exports; the file is version ${JSON.stringify(raw.version)}.` };
  for (const key of ['members', 'stages', 'fieldDefs', 'leads'] as const) {
    if (!Array.isArray(raw[key])) return { ok: false, error: `The export has no "${key}" list.` };
  }
  if (!isObj(raw.tenant)) return { ok: false, error: 'The export has no workspace ("tenant").' };
  const leads = raw.leads as unknown[];
  const bad = leads.findIndex((l) => !isObj(l) || typeof l.id !== 'string' || typeof l.stageId !== 'string' || typeof l.createdAt !== 'string');
  if (bad >= 0) return { ok: false, error: `Lead ${bad + 1} in the file has no id, stage or date.` };
  const data = raw as unknown as AxExport;
  // Older or hand-trimmed files: missing child lists read as empty, never as a crash halfway through a write.
  for (const l of data.leads) {
    l.activities = Array.isArray(l.activities) ? l.activities : [];
    l.messages = Array.isArray(l.messages) ? l.messages : [];
    l.tags = Array.isArray(l.tags) ? l.tags : [];
    l.requirements = Array.isArray(l.requirements) ? l.requirements : [];
  }
  return { ok: true, data };
}

// ── The owner's choices (--roles roles.json) ────────────────────────────

/**
 * What the owner can decide without editing code. Every key optional.
 *
 *   {
 *     "roles":   { "OWNER": "OWNER", "AGENT": "SALES" },
 *     "members": { "<email, AxLeads user id or membership id>": { "role": "DESIGNER", "phone": "+91…", "skip": true } },
 *     "stages":  { "<AxLeads stage name>": "<studio column name>" },
 *     "binned":  "bin" | "skip",
 *     "skipIfAnswered": ["<form question key>", …],   (e.g. a hiring form's questions)
 *     "createFields": true,
 *     "poolTeam": "<member key of a sales head>"
 *   }
 *
 * and, per member (owner, 22 Oct 2026): "name", "salesRole", "salesRoleFrom",
 * "addPermissions", "reportsTo" — see `MemberChoice`.
 */
export interface Choices {
  roles: Record<AxRole, StudioRoleName>;
  members: Record<string, MemberChoice>;
  stages: Record<string, string>;
  binned: 'bin' | 'skip';
  /** Form questions (custom-field keys, any case) whose answer means "not a client": a job application. */
  skipIfAnswered: string[];
  createFields: boolean;
  /**
   * A member key (lowercased) of a sales head whose TEAM pool receives the
   * leads that were unassigned on AxLeads and the leads of people skipped or
   * gone — instead of the studio pool (owner, 22 Oct 2026). Null: the studio pool.
   */
  poolTeam: string | null;
}

/** A permission the roles file adds to a copied role: on, or a reach (never narrower than the copy's). */
export interface AddedPermission {
  key: SalesPermissionKey;
  reach: SalesReach | null;
}

/**
 * One person in the roles file, keyed by AxLeads email, user id or membership id.
 *
 *  - `name` — their name here, used when they are added (an existing login keeps its own name).
 *  - `salesRole` — a sales role of the studio ("Admin", "Sales head", "Sales rep" or one of its own).
 *  - `salesRoleFrom` + `addPermissions` — when the studio has no role named `salesRole`, it is made:
 *    a copy of `salesRoleFrom` with these permissions added ("quotes.build", "leads.view:team").
 *  - `reportsTo` — another member key in the file, or the phone of someone on the studio's team.
 */
export interface MemberChoice {
  role?: StudioRoleName;
  phone?: string;
  skip?: boolean;
  name?: string;
  salesRole?: string;
  salesRoleFrom?: string;
  addPermissions?: AddedPermission[];
  /** A member key (lowercased) when it has an @ or is not a phone; else an E.164 phone. */
  reportsTo?: { key: string } | { phone: string };
}

/**
 * AxLeads has two roles. An OWNER there runs the workspace, so owner here;
 * an AGENT works the leads they are given, which is our Sales role exactly
 * (sees their own leads and the pool). Both are the owner's to change.
 */
export const DEFAULT_ROLES: Record<AxRole, StudioRoleName> = { OWNER: 'OWNER', AGENT: 'SALES' };

export const DEFAULT_CHOICES: Choices = { roles: { ...DEFAULT_ROLES }, members: {}, stages: {}, binned: 'bin', skipIfAnswered: [], createFields: true, poolTeam: null };

const isRole = (v: unknown): v is StudioRoleName => typeof v === 'string' && (STUDIO_ROLES as readonly string[]).includes(v);

/** A role or person name as typed: trimmed, inner spacing collapsed. */
const tidy = (s: string) => s.trim().replace(/\s+/g, ' ');

/** "quotes.build" or "leads.view:team", checked against the catalogue (sales-permissions.ts). */
function parsePermission(raw: unknown, where: string): { ok: true; p: AddedPermission } | { ok: false; error: string } {
  if (typeof raw !== 'string' || !raw.trim()) return { ok: false, error: `${where} must be permission keys such as "quotes.build" or "leads.view:team".` };
  const [key, reach, ...rest] = raw.trim().split(':');
  if (rest.length || !(SALES_PERMISSION_KEYS as readonly string[]).includes(key!)) return { ok: false, error: `${where} has "${raw}", which is not a sales permission. The keys are: ${SALES_PERMISSION_KEYS.join(', ')}.` };
  const def = permissionDef(key as SalesPermissionKey);
  if (reach === undefined) return { ok: true, p: { key: def.key, reach: null } };
  if (!def.reaches) return { ok: false, error: `${where} has "${raw}": ${def.key} is simply on or off, it takes no reach.` };
  if (!(def.reaches as readonly string[]).includes(reach)) return { ok: false, error: `${where} has "${raw}": ${def.key} takes ${def.reaches.join(' / ')}.` };
  return { ok: true, p: { key: def.key, reach: reach as SalesReach } };
}

export function parseChoices(raw: unknown): { ok: true; choices: Choices } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, choices: { ...DEFAULT_CHOICES, roles: { ...DEFAULT_ROLES }, members: {}, stages: {}, skipIfAnswered: [] } };
  if (!isObj(raw)) return { ok: false, error: 'The roles file must be a JSON object.' };
  const choices: Choices = { roles: { ...DEFAULT_ROLES }, members: {}, stages: {}, binned: 'bin', skipIfAnswered: [], createFields: true, poolTeam: null };
  if (raw.roles !== undefined) {
    if (!isObj(raw.roles)) return { ok: false, error: '"roles" must map OWNER / AGENT to a studio role.' };
    for (const [k, v] of Object.entries(raw.roles)) {
      if (k !== 'OWNER' && k !== 'AGENT') return { ok: false, error: `"roles" has ${k}; AxLeads roles are OWNER and AGENT.` };
      if (!isRole(v)) return { ok: false, error: `"roles.${k}" must be one of ${STUDIO_ROLES.join(', ')}.` };
      choices.roles[k] = v;
    }
  }
  if (raw.members !== undefined) {
    if (!isObj(raw.members)) return { ok: false, error: '"members" must be an object keyed by email or AxLeads user id.' };
    for (const [k, v] of Object.entries(raw.members)) {
      if (!isObj(v)) return { ok: false, error: `"members.${k}" must be an object.` };
      if (v.role !== undefined && !isRole(v.role)) return { ok: false, error: `"members.${k}.role" must be one of ${STUDIO_ROLES.join(', ')}.` };
      if (v.phone !== undefined && (typeof v.phone !== 'string' || !memberPhone(v.phone))) return { ok: false, error: `"members.${k}.phone" is not an Indian mobile number.` };
      const key = k.trim().toLowerCase();
      const one: MemberChoice = { role: v.role as StudioRoleName | undefined, phone: v.phone as string | undefined, skip: v.skip === true };
      if (v.name !== undefined) {
        const name = typeof v.name === 'string' ? tidy(v.name) : '';
        if (name.length < 2 || name.length > 80) return { ok: false, error: `"members.${k}.name" must be a name of 2 to 80 letters.` };
        one.name = name;
      }
      if (v.salesRole !== undefined) {
        const name = typeof v.salesRole === 'string' ? tidy(v.salesRole) : '';
        if (name.length < 2 || name.length > 40) return { ok: false, error: `"members.${k}.salesRole" must be a role name of 2 to 40 letters.` };
        one.salesRole = name;
      }
      if (v.salesRoleFrom !== undefined) {
        if (!one.salesRole) return { ok: false, error: `"members.${k}.salesRoleFrom" needs "salesRole": the role to make.` };
        const from = typeof v.salesRoleFrom === 'string' ? tidy(v.salesRoleFrom) : '';
        if (from.length < 2) return { ok: false, error: `"members.${k}.salesRoleFrom" must name a sales role to copy.` };
        one.salesRoleFrom = from;
      }
      if (v.addPermissions !== undefined) {
        if (!one.salesRoleFrom) return { ok: false, error: `"members.${k}.addPermissions" needs "salesRoleFrom": the role whose permissions it adds to.` };
        if (!Array.isArray(v.addPermissions)) return { ok: false, error: `"members.${k}.addPermissions" must be a list of permission keys.` };
        const list: AddedPermission[] = [];
        for (const p of v.addPermissions) {
          const r = parsePermission(p, `"members.${k}.addPermissions"`);
          if (!r.ok) return r;
          list.push(r.p);
        }
        one.addPermissions = list;
      }
      if (v.reportsTo !== undefined) {
        const to = typeof v.reportsTo === 'string' ? v.reportsTo.trim() : '';
        if (!to) return { ok: false, error: `"members.${k}.reportsTo" must be another member's key (their email) or a team member's phone.` };
        const phone = to.includes('@') ? null : memberPhone(to);
        one.reportsTo = phone ? { phone } : { key: to.toLowerCase() };
        if (!phone && to.toLowerCase() === key) return { ok: false, error: `"members.${k}.reportsTo": nobody reports to themselves.` };
      }
      choices.members[key] = one;
    }
    // References inside the file, checked once every key is known.
    for (const [k, one] of Object.entries(choices.members)) {
      if (one.reportsTo && 'key' in one.reportsTo && !choices.members[one.reportsTo.key]) {
        return { ok: false, error: `"members.${k}.reportsTo" is "${one.reportsTo.key}", which is neither a key in "members" nor a mobile number.` };
      }
    }
    // One recipe per new role: two people naming it must not make it two ways.
    const recipes = new Map<string, { from: string; add: string; who: string }>();
    for (const [k, one] of Object.entries(choices.members)) {
      if (!one.salesRole || !one.salesRoleFrom) continue;
      const add = (one.addPermissions ?? []).map((p) => (p.reach ? `${p.key}:${p.reach}` : p.key)).sort().join(',');
      const was = recipes.get(norm(one.salesRole));
      if (was && (norm(was.from) !== norm(one.salesRoleFrom) || was.add !== add)) {
        return { ok: false, error: `"${one.salesRole}" is made two different ways (members.${was.who} and members.${k}). Give the recipe once, or the same both times.` };
      }
      recipes.set(norm(one.salesRole), { from: one.salesRoleFrom, add, who: k });
    }
  }
  if (raw.poolTeam !== undefined && raw.poolTeam !== null) {
    const key = typeof raw.poolTeam === 'string' ? raw.poolTeam.trim().toLowerCase() : '';
    if (!key || !choices.members[key]) return { ok: false, error: '"poolTeam" must be the key (email) of a sales head listed in "members".' };
    choices.poolTeam = key;
  }
  if (raw.stages !== undefined) {
    if (!isObj(raw.stages)) return { ok: false, error: '"stages" must map AxLeads stage names to column names.' };
    for (const [k, v] of Object.entries(raw.stages)) {
      if (typeof v !== 'string' || !v.trim()) return { ok: false, error: `"stages.${k}" must be a column name.` };
      choices.stages[norm(k)] = v;
    }
  }
  if (raw.binned !== undefined) {
    if (raw.binned !== 'bin' && raw.binned !== 'skip') return { ok: false, error: '"binned" must be "bin" or "skip".' };
    choices.binned = raw.binned;
  }
  if (raw.skipIfAnswered !== undefined) {
    if (!Array.isArray(raw.skipIfAnswered) || raw.skipIfAnswered.some((k) => typeof k !== 'string' || !k.trim())) return { ok: false, error: '"skipIfAnswered" must be a list of form question keys.' };
    choices.skipIfAnswered = (raw.skipIfAnswered as string[]).map((k) => k.trim().toLowerCase());
  }
  if (raw.createFields !== undefined) choices.createFields = raw.createFields === true;
  return { ok: true, choices };
}

// ── What the studio already has (read by import.ts) ─────────────────────

export interface StudioStageRef {
  id: string;
  name: string;
  kind: StageKindName;
  isIntake: boolean;
  sortOrder: number;
}

export interface StudioMemberRef {
  id: string;
  name: string;
  role: StudioRoleName;
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED';
  /** E.164, from the User. */
  phone: string | null;
  email: string | null;
  /** Their sales role and reporting line (22 Oct 2026); absent reads as none. */
  salesRoleId?: string | null;
  reportsToId?: string | null;
}

/** One of the studio's sales roles (StudioSalesRole). */
export interface SalesRoleRef {
  id: string;
  name: string;
  system: string | null;
  permissions: unknown;
}

/** A User found by an AxLeads member's phone or email. */
export interface UserRef {
  id: string;
  role: 'CUSTOMER' | 'STUDIO' | 'OPS' | 'ADMIN';
  deleted: boolean;
  /** The studio they are on, if any. */
  studioId: string | null;
}

/** A card already on the board, found by phone (ten digits). */
export interface ExistingClient {
  id: string;
  name: string;
  assignedToId: string | null;
  email: string | null;
  locality: string | null;
  society: string | null;
  config: string | null;
  carpetSqft: number | null;
  budgetPaise: number | null;
  notes: string | null;
  tags: string[];
  /** Set while planning, once a merge has given it a person. */
  assignedNew?: boolean;
  /** It already has an ad (leadgen, campaign or gclid): a merge does not replace it. */
  attributed?: boolean;
}

export interface StudioContext {
  studioId: string;
  stages: StudioStageRef[];
  fields: FieldShape[];
  leadSources: { id: string; name: string }[];
  members: StudioMemberRef[];
  usersByPhone: Map<string, UserRef>;
  usersByEmail: Map<string, UserRef>;
  /** Not deleted, not the sample lead. Keyed by the ten digits. */
  existingByPhone: Map<string, ExistingClient>;
  /** AxLeads lead ids this studio already holds (a card or a merge line). */
  imported: Map<string, ImportedRef>;
  /** The studio's sales roles; absent reads as none (the built-ins are then planned as missing). */
  salesRoles?: SalesRoleRef[];
}

/** What an earlier run left for one AxLeads lead. */
export interface ImportedRef {
  clientId: string;
  assignedToId: string | null;
  /** The pool it sits in (null: the studio pool). */
  poolTeamId?: string | null;
  /** The card was made by the import (not a merge into a card that was already there). */
  fromImport?: boolean;
  /** Anything happened on the card after its import line (a call, a note, a move): it is left alone. */
  touched?: boolean;
}

// ── Small mappings ──────────────────────────────────────────────────────

/** Case, spacing and punctuation-around-slashes ignored: "Quotation  shared" is "Quotation Shared". */
export function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ');
}

/** Which of our kinds an AxLeads stage meaning may land in. */
export function kindsFor(semantic: AxSemantic): StageKindName[] {
  if (semantic === 'LOST') return ['LOST'];
  if (semantic === 'WON') return ['WON', 'DONE'];
  return ['OPEN'];
}

export type StageHow = 'chosen' | 'name' | 'meaning' | 'intake';

export interface StageMapRow {
  axId: string;
  axName: string;
  semantic: AxSemantic;
  stageId: string;
  stageName: string;
  kind: StageKindName;
  how: StageHow;
  /** Why it is not a plain name match, for the report. */
  note: string | null;
}

export function mapStages(axStages: readonly AxStage[], studio: readonly StudioStageRef[], chosen: Record<string, string> = {}): StageMapRow[] {
  const sorted = [...studio].sort((a, b) => a.sortOrder - b.sortOrder);
  const intake = sorted.find((s) => s.isIntake) ?? sorted[0];
  if (!intake) throw new Error('The studio has no pipeline columns. Open Leads once (it makes the defaults), then run the import again.');
  const byName = new Map(sorted.map((s) => [norm(s.name), s]));
  const firstOf = (kinds: StageKindName[]) => sorted.find((s) => kinds.includes(s.kind));

  return axStages.map((ax) => {
    const row = (s: StudioStageRef, how: StageHow, note: string | null): StageMapRow => ({
      axId: ax.id,
      axName: ax.name,
      semantic: ax.semantic,
      stageId: s.id,
      stageName: s.name,
      kind: s.kind,
      how,
      note,
    });
    const want = chosen[norm(ax.name)];
    if (want) {
      const s = byName.get(norm(want));
      if (s) return row(s, 'chosen', null);
    }
    const kinds = kindsFor(ax.semantic);
    const named = byName.get(norm(ax.name));
    if (named && kinds.includes(named.kind)) return row(named, 'name', null);
    /* A studio that closes leads in a column of this name (Hauspire's Junk is
       lost-kind here, open on AxLeads) keeps them there, as lost. */
    if (named && named.kind === 'LOST' && ax.semantic !== 'WON') return row(named, 'name', null);
    const why = want
      ? `the roles file names "${want}", which is not a column`
      : named
        ? `"${named.name}" here is ${named.kind === 'OPEN' ? 'an open' : `a ${named.kind.toLowerCase()}`} column, and this stage means ${ax.semantic.toLowerCase()}`
        : 'no column of that name';
    if (ax.semantic === 'INTAKE') return row(intake, 'meaning', why);
    if (ax.semantic === 'WON' || ax.semantic === 'LOST') {
      const s = firstOf(kinds);
      if (s) return row(s, 'meaning', why);
    }
    return row(intake, 'intake', why);
  });
}

/** What AxLeads called the source, for the "came in" line. */
export const AX_SOURCE_LABELS: Record<string, string> = {
  META_LEAD_AD: 'Meta lead ad',
  HOSTED_FORM: 'website form',
  WHATSAPP_INBOUND: 'WhatsApp',
  WHATSAPP_ADS: 'WhatsApp ad',
  GENERIC_WEBHOOK: 'webhook',
  GOOGLE_LEAD_FORM: 'Google lead form',
  REFERRAL: 'referral',
  MANUAL: 'typed in',
};

/** The studio's own source names this import uses (StudioLeadSource), by AxLeads source. */
export const OWN_SOURCE_NAMES: Record<string, string> = {
  WHATSAPP_INBOUND: 'WhatsApp',
  WHATSAPP_ADS: 'WhatsApp ads',
  GENERIC_WEBHOOK: 'Webhook',
};

/** Meta does not say which app a lead form ran in unless asked; when the lead does, Instagram counts as Instagram. */
function instagramHint(detail: Record<string, unknown> | null): boolean {
  if (!detail) return false;
  const raw = isObj(detail.raw) ? detail.raw : {};
  const fields = isObj(detail.fields) ? detail.fields : {};
  const hint = [detail.platform, raw.platform, fields.platform, detail.publisher_platform].find((v) => typeof v === 'string');
  return typeof hint === 'string' && /^(ig|insta|instagram)/i.test(hint.trim());
}

export function mapSource(lead: Pick<AxLead, 'source' | 'sourceDetail' | 'sourceConnectionId'>, ax?: Pick<AxExport, 'sourceConnections' | 'hostedForms'>): {
  source: ClientSourceName;
  ownSource: string | null;
  note: string;
} {
  const label = AX_SOURCE_LABELS[lead.source] ?? lead.source.toLowerCase().replace(/_/g, ' ');
  const conn = lead.sourceConnectionId ? ax?.sourceConnections?.find((c) => c.id === lead.sourceConnectionId)?.label : undefined;
  const formId = lead.sourceDetail && typeof lead.sourceDetail.formId === 'string' ? lead.sourceDetail.formId : null;
  const form = formId ? ax?.hostedForms?.find((f) => f.id === formId)?.title : undefined;
  const note = ['AxLeads', label, conn, form].filter(Boolean).join(' · ').slice(0, 200);
  switch (lead.source) {
    case 'META_LEAD_AD':
      return { source: instagramHint(lead.sourceDetail) ? 'INSTAGRAM' : 'FACEBOOK', ownSource: null, note };
    case 'GOOGLE_LEAD_FORM':
    case 'HOSTED_FORM':
      return { source: 'WEBSITE', ownSource: null, note };
    case 'REFERRAL':
      return { source: 'REFERRAL', ownSource: null, note };
    case 'WHATSAPP_INBOUND':
    case 'WHATSAPP_ADS':
    case 'GENERIC_WEBHOOK':
      return { source: 'OTHER', ownSource: OWN_SOURCE_NAMES[lead.source]!, note };
    default:
      return { source: 'OTHER', ownSource: null, note };
  }
}

/**
 * AxLeads keeps the lost reason as free text. Ours is a short list, so the
 * words are read for the reason and ALWAYS kept as the note as well — the
 * list is for counting, the note is what was said.
 */
export function mapLostReason(text: string | null | undefined): LostReasonName {
  const t = (text ?? '').toLowerCase();
  if (!t.trim()) return 'OTHER';
  if (/wrong\s*(no|num)/.test(t)) return 'WRONG_NUMBER';
  if (/budget|expensive|costly|price|afford/.test(t)) return 'BUDGET';
  if (/elsewhere|other (designer|vendor|studio|company)|competitor|went with|chose|another|already (hired|booked|done)|done (it|already)/.test(t)) return 'WENT_ELSEWHERE';
  if (/no (response|reply|answer)|not (reachable|responding|picking|answering)|unreachable|switched off|ringing|did ?n.?t (pick|answer)/.test(t)) return 'NO_RESPONSE';
  if (/postpone|later|future|next year|not now|possession|on hold/.test(t)) return 'POSTPONED';
  if (/time|timeline|urgent|delay/.test(t)) return 'TIMELINE';
  if (/junk|fake|spam|not serious|exploring|test|not interested|just (looking|checking)|enquiry only/.test(t)) return 'NOT_SERIOUS';
  return 'OTHER';
}

/** AxLeads' six call outcomes, in our words. `busy` there is the engaged tone. */
export const CALL_OUTCOME_MAP: Record<string, CallOutcomeId> = {
  picked_up: 'spoke',
  no_answer: 'no_answer',
  busy: 'line_busy',
  switched_off: 'switched_off',
  voicemail: 'voicemail',
  wrong_number: 'wrong_number',
};

/** AxLeads' call reactions, as the lead page showed them. */
export const CALL_REACTION_LABELS: Record<string, string> = {
  interested: 'Interested',
  wants_quote: 'Wants a quote / estimate',
  site_visit: 'Wants a site visit',
  wants_portfolio: 'Asked for portfolio',
  budget_low: 'Budget too low',
  just_exploring: 'Just exploring',
  possession_later: 'Possession not ready',
  comparing: 'Comparing designers',
  already_done: 'Already done',
  call_back: 'Call back later',
  not_interested: 'Not interested',
};

const FIELD_TYPES: Record<AxFieldDef['type'], FieldTypeName> = {
  TEXT: 'TEXT',
  PHONE: 'TEXT',
  EMAIL: 'TEXT',
  TEXTAREA: 'TEXT',
  NUMBER: 'NUMBER',
  SELECT: 'SELECT',
  DATE: 'DATE',
};

/** Form answers that are one of our own columns rather than a field. */
const CANONICAL_KEYS = {
  config: /^(bhk|config|configuration|property_type|flat_type|home_type)$/,
  society: /^(society|society_name|building|building_name|project|project_name|apartment|complex)$/,
  carpet: /^(carpet|carpet_area|area_sqft|carpet_sqft|sqft)$/,
};

// ── People ──────────────────────────────────────────────────────────────

export type MemberPlan = (
  | { kind: 'match'; ax: AxMember; memberId: string; name: string; by: 'phone' | 'email' }
  | { kind: 'create'; ax: AxMember; name: string; phone: string; email: string | null; role: StudioRoleName; reuseUserId: string | null; emailDropped: boolean }
  | { kind: 'refused'; ax: AxMember; phone: string; reason: string }
  | { kind: 'no-phone'; ax: AxMember }
  | { kind: 'gone'; ax: AxMember }
  | { kind: 'skip'; ax: AxMember }
) & {
  /** How the report names them: the roles file's `name`, else the AxLeads display name. */
  label: string;
};

function overrideFor(m: AxMember, choices: Choices): MemberChoice | undefined {
  return choices.members[(m.email ?? '').trim().toLowerCase()] ?? choices.members[m.userId.toLowerCase()] ?? choices.members[m.id.toLowerCase()];
}

/** The keys a roles file may use for this AxLeads member, lowercased. */
function keysOf(m: AxMember): string[] {
  return [(m.email ?? '').trim().toLowerCase(), m.userId.toLowerCase(), m.id.toLowerCase()].filter(Boolean);
}

export function planMembers(axMembers: readonly AxMember[], ctx: Pick<StudioContext, 'studioId' | 'members' | 'usersByPhone' | 'usersByEmail'>, choices: Choices): MemberPlan[] {
  const seenUsers = new Set<string>();
  const claimedPhones = new Set<string>();
  const out: MemberPlan[] = [];
  for (const m of axMembers) {
    if (seenUsers.has(m.userId)) continue;
    seenUsers.add(m.userId);
    const o = overrideFor(m, choices);
    const axName = (m.displayName ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
    const label = o?.name ?? (axName || m.email || 'Someone');
    if (o?.skip) {
      out.push({ kind: 'skip', ax: m, label });
      continue;
    }
    const phone = memberPhone(o?.phone ?? m.phone ?? '');
    const email = (m.email ?? '').trim().toLowerCase() || null;
    const byPhone = phone ? ctx.members.find((s) => s.phone === phone) : undefined;
    const byEmail = !byPhone && email ? ctx.members.find((s) => (s.email ?? '').toLowerCase() === email) : undefined;
    const found = byPhone ?? byEmail;
    if (found) {
      out.push({ kind: 'match', ax: m, memberId: found.id, name: found.name, by: byPhone ? 'phone' : 'email', label });
      continue;
    }
    /* Somebody who left AxLeads is history, not a hire: their name stays on
       every line they wrote, and their open leads go to the pool. */
    if (m.deletedAt || m.status === 'SUSPENDED') {
      out.push({ kind: 'gone', ax: m, label });
      continue;
    }
    if (!phone) {
      out.push({ kind: 'no-phone', ax: m, label });
      continue;
    }
    if (claimedPhones.has(phone)) {
      out.push({ kind: 'refused', ax: m, phone, reason: 'Another AxLeads member in this file has the same number.', label });
      continue;
    }
    // The rules of Settings → Team's "Add someone" (team-store.ts inviteMember).
    const user = ctx.usersByPhone.get(phone);
    let reason: string | null = null;
    if (user?.deleted) reason = 'That number belonged to an account that was closed.';
    else if (user?.role === 'CUSTOMER') reason = 'That number is a One Interiors customer account; one person has one account.';
    else if (user?.role === 'OPS' || user?.role === 'ADMIN') reason = 'That number belongs to the One Interiors team.';
    else if (user?.studioId && user.studioId !== ctx.studioId) reason = 'That number is on another studio’s team.';
    else if (user?.studioId === ctx.studioId) reason = 'That number is on this team already under another account.';
    if (reason) {
      out.push({ kind: 'refused', ax: m, phone, reason, label });
      continue;
    }
    claimedPhones.add(phone);
    /* User.email is unique. If the address is somebody else's login, the
       member is added without it rather than refused: the phone is how a
       studio person signs in. */
    const emailUser = email ? ctx.usersByEmail.get(email) : undefined;
    const emailDropped = !!emailUser && emailUser.id !== user?.id;
    out.push({
      kind: 'create',
      ax: m,
      /* The roles file's name first (22 Oct 2026). It names a NEW login only:
         import.ts never writes it onto a User that already exists. */
      name: o?.name ?? (axName || email || phone),
      phone,
      email: emailDropped ? null : email,
      role: o?.role ?? choices.roles[m.role] ?? DEFAULT_ROLES[m.role] ?? 'SALES',
      reuseUserId: user?.id ?? null,
      emailDropped,
      label,
    });
  }
  return out;
}

/** Who an AxLeads user id is, here: a studio member, one this run adds, or nobody (with their name for history). */
export type PersonRef = { member: { kind: 'existing'; id: string } | { kind: 'new'; axUserId: string } | null; name: string | null };

function personIndex(plans: readonly MemberPlan[]): Map<string, PersonRef> {
  const map = new Map<string, PersonRef>();
  for (const p of plans) {
    const axName = p.ax.displayName?.trim() || p.ax.email || null;
    if (p.kind === 'match') map.set(p.ax.userId, { member: { kind: 'existing', id: p.memberId }, name: p.name });
    else if (p.kind === 'create') map.set(p.ax.userId, { member: { kind: 'new', axUserId: p.ax.userId }, name: p.name });
    else map.set(p.ax.userId, { member: null, name: axName });
  }
  return map;
}

// ── The sales team (roles file: salesRole, reportsTo, poolTeam; 22 Oct 2026) ──

export type MemberRef = NonNullable<PersonRef['member']>;

/** The id a member has, or will have, in the tree checks: `new:<AxLeads user id>` until it is written. */
export const treeId = (ref: MemberRef): string => (ref.kind === 'existing' ? ref.id : `new:${ref.axUserId}`);

export type Change = 'set' | 'same' | 'changed';

export interface SalesTeamLine {
  axUserId: string;
  /** The report's name for them. */
  who: string;
  member: MemberRef;
  fixedRole: StudioRoleName;
  salesRole: { name: string; isNew: boolean; change: Change; was: string | null } | null;
  reportsTo: { to: MemberRef; name: string; change: Change; was: string | null } | null;
}

export interface SalesRoleToCreate {
  name: string;
  from: string;
  added: SalesPermissionKey[];
  permissions: SalesPermissionMap;
}

export interface SalesTeamPlan {
  /** Built-in roles the studio does not have yet (it predates them); import.ts makes them first. */
  builtInsMissing: string[];
  rolesToCreate: SalesRoleToCreate[];
  lines: SalesTeamLine[];
  poolTeam: { member: MemberRef; name: string } | null;
  /** What the file asks for that cannot be done. A real run writes nothing while there are any. */
  problems: string[];
  /** What the file asks for that is left out on purpose (the owner is everything; a designer has no sales role). */
  notes: string[];
  /** Whether the file uses sales roles at all (then the built-ins are ensured). */
  uses: boolean;
}

/** The copy plus the additions; an addition never narrows what the copy already reaches. */
export function derivePermissions(base: SalesPermissionMap, add: readonly AddedPermission[]): SalesPermissionMap {
  const out: SalesPermissionMap = { ...base };
  for (const a of add) {
    const def = permissionDef(a.key);
    if (!def.reaches) {
      out[a.key] = true;
      continue;
    }
    const want = a.reach ?? def.reaches[0]!;
    const have = out[a.key];
    out[a.key] = typeof have === 'string' && reachesAtLeast(have, want) ? have : want;
  }
  return readSalesPermissions(out);
}

/**
 * What the roles file asks of the sales side, checked against the studio
 * before anything is written (owner, 22 Oct 2026). The rules are Settings →
 * Team's (sales-team-store.ts `setMemberSalesRole` / `setReportsTo`, and
 * sales-access.ts `checkReportsTo` itself): only SALES members get a sales
 * role or a reporting line, a salesperson reports to another salesperson of
 * the same studio, nobody to themselves, no loops. The owner is everything:
 * a sales role or a boss for them is reported and left out. Reporting lines
 * are checked in file order against the tree as it will be, new people
 * included under `new:` ids; import.ts checks again, against the database,
 * in one serializable transaction when it writes.
 *
 * Idempotent by construction: an existing member's role or line is changed
 * only when the file names one, and one already as asked is "same".
 */
export function planSalesTeam(members: readonly MemberPlan[], ctx: Pick<StudioContext, 'studioId' | 'members' | 'salesRoles'>, choices: Choices): SalesTeamPlan {
  const problems: string[] = [];
  const notes: string[] = [];
  const lines: SalesTeamLine[] = [];
  const rolesToCreate: SalesRoleToCreate[] = [];

  // The roles there are, the built-ins counted even before import.ts makes them.
  const have = (ctx.salesRoles ?? []).map((r) => ({ id: r.id as string | null, name: r.name, system: r.system, permissions: readSalesPermissions(r.permissions) }));
  const builtInsMissing: string[] = [];
  for (const b of BUILT_IN_SALES_ROLES) {
    if (have.some((r) => r.system === b.system)) continue;
    builtInsMissing.push(b.name);
    if (!have.some((r) => norm(r.name) === norm(b.name))) have.push({ id: null, name: b.name, system: b.system, permissions: { ...b.permissions } });
  }
  const roleNamed = (name: string) => have.find((r) => norm(r.name) === norm(name));
  const roleName = (id: string | null | undefined) => (id ? (ctx.salesRoles ?? []).find((r) => r.id === id)?.name ?? 'another role' : null);

  const keyed = new Map<string, MemberPlan>();
  for (const p of members) for (const k of keysOf(p.ax)) if (!keyed.has(k)) keyed.set(k, p);
  const refOf = (p: MemberPlan): MemberRef | null => (p.kind === 'match' ? { kind: 'existing', id: p.memberId } : p.kind === 'create' ? { kind: 'new', axUserId: p.ax.userId } : null);
  const fixedRoleOf = (p: MemberPlan): StudioRoleName | null => (p.kind === 'match' ? ctx.members.find((s) => s.id === p.memberId)?.role ?? null : p.kind === 'create' ? p.role : null);
  const whyNot = (p: MemberPlan) =>
    p.kind === 'skip' ? 'skipped in the roles file' : p.kind === 'gone' ? 'they left AxLeads' : p.kind === 'no-phone' ? 'no phone' : p.kind === 'refused' ? 'their number was refused' : '';
  const nameOfRef = (ref: MemberRef): string => {
    if (ref.kind === 'existing') return members.find((p) => p.kind === 'match' && p.memberId === ref.id)?.label ?? ctx.members.find((s) => s.id === ref.id)?.name ?? 'someone';
    return members.find((p) => p.ax.userId === ref.axUserId)?.label ?? 'someone';
  };

  // 1. Sales roles.
  const uses = Object.values(choices.members).some((o) => o.salesRole || o.reportsTo) || choices.poolTeam !== null;
  const notedRole = new Set<string>();
  for (const p of members) {
    const o = overrideFor(p.ax, choices);
    if (!o || (!o.salesRole && !o.reportsTo)) continue;
    const asks = [o.salesRole && 'a sales role', o.reportsTo && 'a reporting line'].filter(Boolean).join(' and ');
    const ref = refOf(p);
    if (!ref) {
      notes.push(`${p.label}: not added here (${whyNot(p)}), so ${asks} is left out.`);
      continue;
    }
    const fixedRole = fixedRoleOf(p) ?? 'SALES';
    if (fixedRole === 'OWNER') {
      notes.push(`${p.label} is the owner: owners can do everything, so ${asks} is left out.`);
      continue;
    }
    if (fixedRole !== 'SALES') {
      notes.push(`${p.label} is ${fixedRole}: sales roles and reporting lines are for salespeople, so ${asks} is left out.`);
      continue;
    }
    const line: SalesTeamLine = { axUserId: p.ax.userId, who: p.label, member: ref, fixedRole, salesRole: null, reportsTo: null };
    lines.push(line);
    if (!o.salesRole) continue;

    let role = roleNamed(o.salesRole);
    let isNew = false;
    if (role && o.salesRoleFrom && !notedRole.has(norm(o.salesRole))) {
      notedRole.add(norm(o.salesRole));
      notes.push(`"${role.name}" is already a role here, so salesRoleFrom / addPermissions are not used (edit it on Settings → Team → Roles).`);
    }
    if (!role) {
      const planned = rolesToCreate.find((r) => norm(r.name) === norm(o.salesRole!));
      if (planned) {
        isNew = true;
        role = { id: null, name: planned.name, system: null, permissions: planned.permissions };
      } else if (!o.salesRoleFrom) {
        problems.push(`${p.label}: "${o.salesRole}" is not a sales role here. Use one there is (${have.map((r) => r.name).join(', ')}), or say which role to copy with "salesRoleFrom" (and "addPermissions").`);
        continue;
      } else {
        const from = roleNamed(o.salesRoleFrom);
        if (!from) {
          problems.push(`${p.label}: "${o.salesRoleFrom}" (salesRoleFrom) is not a sales role here (${have.map((r) => r.name).join(', ')}).`);
          continue;
        }
        const permissions = derivePermissions(from.permissions, o.addPermissions ?? []);
        const check = checkSalesRole({ name: o.salesRole, permissions });
        if (!check.ok) {
          problems.push(`${p.label}: "${o.salesRole}" cannot be made: ${check.error}`);
          continue;
        }
        if (have.length + rolesToCreate.length >= MAX_SALES_ROLES) {
          problems.push(`${p.label}: "${o.salesRole}" cannot be made: ${MAX_SALES_ROLES} roles is the most.`);
          continue;
        }
        const made: SalesRoleToCreate = { name: check.role.name, from: from.name, added: (o.addPermissions ?? []).map((a) => a.key), permissions: check.role.permissions };
        rolesToCreate.push(made);
        isNew = true;
        role = { id: null, name: made.name, system: null, permissions: made.permissions };
      }
    }
    const current = ref.kind === 'existing' ? ctx.members.find((s) => s.id === ref.id)?.salesRoleId ?? null : null;
    const change: Change = current && role.id === current ? 'same' : current ? 'changed' : 'set';
    line.salesRole = { name: role.name, isNew, change, was: change === 'changed' ? roleName(current) : null };
  }

  // 2. Reporting lines, in file order, against the tree as it will be.
  const tree: ReportsToMember[] = ctx.members.map((s) => ({ id: s.id, studioId: ctx.studioId, role: s.role, reportsToId: s.reportsToId ?? null }));
  for (const p of members) if (p.kind === 'create') tree.push({ id: `new:${p.ax.userId}`, studioId: ctx.studioId, role: p.role, reportsToId: null });
  for (const line of lines) {
    const p = members.find((m) => m.ax.userId === line.axUserId)!;
    const want = overrideFor(p.ax, choices)?.reportsTo;
    if (!want) continue;
    let to: MemberRef | null = null;
    let label = '';
    if ('key' in want) {
      const target = keyed.get(want.key);
      if (!target) {
        problems.push(`${line.who}: reportsTo "${want.key}" is in the roles file but is nobody in the AxLeads export.`);
        continue;
      }
      to = refOf(target);
      label = target.label;
      if (!to) {
        problems.push(`${line.who}: reportsTo ${target.label}, who is not added here (${whyNot(target)}).`);
        continue;
      }
    } else {
      const s = ctx.members.find((m) => m.phone === want.phone);
      const c = members.find((m) => m.kind === 'create' && m.phone === want.phone);
      to = s ? { kind: 'existing', id: s.id } : c ? { kind: 'new', axUserId: c.ax.userId } : null;
      label = s ? nameOfRef({ kind: 'existing', id: s.id }) : c ? c.label : '';
      if (!to) {
        problems.push(`${line.who}: reportsTo …${want.phone.slice(-4)} is not anyone on this studio's team.`);
        continue;
      }
    }
    const check = checkReportsTo(treeId(line.member), treeId(to), tree);
    if (!check.ok) {
      problems.push(`${line.who}: cannot report to ${label}: ${check.error}`);
      continue;
    }
    const me = tree.find((t) => t.id === treeId(line.member))!;
    const current = me.reportsToId;
    me.reportsToId = check.reportsToId;
    const change: Change = current && current === check.reportsToId ? 'same' : current ? 'changed' : 'set';
    const wasRef: MemberRef | null = current ? (current.startsWith('new:') ? { kind: 'new', axUserId: current.slice(4) } : { kind: 'existing', id: current }) : null;
    line.reportsTo = { to, name: label, change, was: change === 'changed' && wasRef ? nameOfRef(wasRef) : null };
  }

  // 3. The team pool.
  let poolTeam: SalesTeamPlan['poolTeam'] = null;
  if (choices.poolTeam) {
    const target = keyed.get(choices.poolTeam);
    const ref = target ? refOf(target) : null;
    const role = target ? fixedRoleOf(target) : null;
    if (!target) problems.push(`poolTeam "${choices.poolTeam}" is nobody in the AxLeads export.`);
    else if (!ref) problems.push(`poolTeam: ${target.label} is not added here (${whyNot(target)}), so there is no team pool to fill.`);
    else if (role === 'OWNER') problems.push(`poolTeam: ${target.label} is the owner, and the owner's pool is the studio pool. Leave poolTeam out for that.`);
    else if (role !== 'SALES') problems.push(`poolTeam: ${target.label} is ${role}; a team pool belongs to a salesperson who heads a team.`);
    else poolTeam = { member: ref, name: target.label };
  }

  return { builtInsMissing: uses ? builtInsMissing : [], rolesToCreate, lines, poolTeam, problems, notes, uses };
}

// ── Leads ───────────────────────────────────────────────────────────────

export interface EventPlan {
  externalId: string;
  kind: EventKindName;
  summary: string;
  meta: Record<string, unknown>;
  createdAt: Date;
  /** null = SYSTEM. */
  by: PersonRef | null;
}

export interface ClientPlan {
  name: string;
  phone: string | null;
  email: string | null;
  society: string | null;
  locality: string | null;
  city: string;
  config: string | null;
  carpetSqft: number | null;
  budgetPaise: number | null;
  source: ClientSourceName;
  ownSource: string | null;
  sourceNote: string;
  stageId: string;
  lostReason: LostReasonName | null;
  lostNote: string | null;
  fields: Record<string, string>;
  notes: string | null;
  nextAction: string | null;
  nextActionOn: Date | null;
  assignee: PersonRef['member'];
  /** The team pool an unassigned card sits in (roles file `poolTeam`); null: the studio pool. */
  poolTeam: PersonRef['member'];
  lastContactedAt: Date | null;
  tags: string[];
  createdAt: Date;
  deletedAt: Date | null;
  /** The ad columns (22 Oct 2026), or null when AxLeads knew no ad. */
  ads: AdColumns | null;
}

export type LeadPlan =
  | { action: 'create'; axId: string; client: ClientPlan; events: EventPlan[] }
  /** Into a card already on the board: blanks filled, never overwritten. */
  | { action: 'merge-existing'; axId: string; clientId: string; into: string; fill: Partial<ClientPlan>; events: EventPlan[]; name: string; phone: string }
  /** Into an earlier lead of this file (its card carries both). */
  | { action: 'merge-file'; axId: string; intoAxId: string; into: string; events: EventPlan[]; name: string; phone: string }
  /** `pool`: a re-run moves the card, still unassigned and untouched since its import, into this team pool. */
  | { action: 'already'; axId: string; clientId: string; backfill: PersonRef['member']; pool?: MemberRef | null }
  | { action: 'skip-binned'; axId: string }
  /** Answered a question in `skipIfAnswered`: a job applicant, not a client. */
  | { action: 'skip-answered'; axId: string };

export interface Report {
  leadsInFile: number;
  create: number;
  mergeExisting: number;
  mergeFile: number;
  already: number;
  backfill: number;
  binned: number;
  skippedBinned: number;
  skippedAnswered: number;
  events: Partial<Record<EventKindName, number>>;
  eventsSkipped: { scoreUpdates: number; messageDuplicates: number };
  perStage: Record<string, number>;
  perAssignee: Record<string, number>;
  perSource: Record<string, number>;
  members: MemberPlan[];
  stages: StageMapRow[];
  fieldsToCreate: FieldToCreate[];
  leadSourcesToCreate: string[];
  /** Form-answer keys that are not a field here, so they went into the notes. */
  unmappedFields: Record<string, number>;
  /** Values that did not fit their field (a word in a number); kept in the notes. */
  valuesNotFitting: number;
  phonesNotMobile: number;
  noPhone: number;
  merged: { name: string; phone: string; into: string; where: 'board' | 'file' }[];
  /** New cards nobody has, by the pool they land in (studio pool or a head's team pool). */
  perPool: Record<string, number>;
  /** Re-run, poolTeam set: cards moved to the team pool, ones left because somebody worked them, ones there already. */
  poolMoves: number;
  poolLeftTouched: number;
  poolAlready: number;
  salesTeam: SalesTeamPlan;
}

export interface FieldToCreate {
  key: string;
  label: string;
  type: FieldTypeName;
  options: string[];
  groupBy: boolean;
}

export interface Plan {
  members: MemberPlan[];
  stages: StageMapRow[];
  fieldsToCreate: FieldToCreate[];
  leadSourcesToCreate: string[];
  leads: LeadPlan[];
  salesTeam: SalesTeamPlan;
  report: Report;
}

const POOL = 'Pool (nobody)';
export const STUDIO_POOL = 'Studio pool';
export const teamPoolLabel = (name: string) => `${name}’s team pool`;

/** "₹12,00,000". */
function rupees(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function day(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

function words(kind: string): string {
  const w = kind.toLowerCase().replace(/_/g, ' ');
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function text(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(text).filter(Boolean).join(', ') || null;
  return JSON.stringify(v);
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function openFollowUps(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((f): f is Record<string, unknown> => isObj(f) && !f.doneAt && typeof f.label === 'string').map((f) => String(f.label));
}

export interface PlanOptions {
  /** When the import runs; the bin clock and the notes block read it. */
  now: Date;
}

export function planImport(ax: AxExport, ctx: StudioContext, choices: Choices, opts: PlanOptions): Plan {
  const stages = mapStages(ax.stages, ctx.stages, choices.stages);
  const stageById = new Map(stages.map((s) => [s.axId, s]));
  const axStageName = new Map(ax.stages.map((s) => [s.id, s.name]));
  const intake = [...ctx.stages].sort((a, b) => a.sortOrder - b.sortOrder).find((s) => s.isIntake) ?? ctx.stages[0]!;
  const members = planMembers(ax.members, ctx, choices);
  const people = personIndex(members);
  const salesTeam = planSalesTeam(members, ctx, choices);
  const poolTeam = salesTeam.poolTeam?.member ?? null;
  /* The leads `poolTeam` takes (owner, 22 Oct 2026): nobody's on AxLeads, or
     the person was skipped or left. A refused number or a missing phone is a
     fix in the roles file, not a hand-over, so those stay in the studio pool. */
  const kindOf = new Map(members.map((m) => [m.ax.userId, m.kind]));
  const toTeamPool = (l: AxLead): boolean => {
    if (!poolTeam) return false;
    if (!l.assignedTo) return true;
    const k = kindOf.get(l.assignedTo);
    return k === undefined || k === 'gone' || k === 'skip';
  };

  // Fields: the studio's own, plus the AxLeads workspace's live field definitions it does not have yet.
  const fieldsToCreate: FieldToCreate[] = [];
  const fields: FieldShape[] = [...ctx.fields];
  const fieldKeyOf = new Map<string, string>(); // AxLeads key → our key
  for (const f of ctx.fields) fieldKeyOf.set(f.key, f.key);
  for (const def of [...ax.fieldDefs].sort((a, b) => a.position - b.position)) {
    if (def.deletedAt) continue;
    const key = fieldKeyFrom(def.key) || fieldKeyFrom(def.label);
    if (!key) continue;
    if (fieldKeyOf.has(def.key) || fields.some((f) => f.key === key)) {
      fieldKeyOf.set(def.key, key);
      continue;
    }
    if (!choices.createFields) continue;
    const made: FieldToCreate = { key, label: def.label.trim().slice(0, 60) || key, type: FIELD_TYPES[def.type] ?? 'TEXT', options: def.type === 'SELECT' ? def.options : [], groupBy: def.groupable === true && def.type !== 'NUMBER' };
    fieldsToCreate.push(made);
    fields.push({ key: made.key, label: made.label, type: made.type, options: made.options });
    fieldKeyOf.set(def.key, key);
  }

  const report: Report = {
    leadsInFile: ax.leads.length,
    create: 0,
    mergeExisting: 0,
    mergeFile: 0,
    already: 0,
    backfill: 0,
    binned: 0,
    skippedBinned: 0,
    skippedAnswered: 0,
    events: {},
    eventsSkipped: { scoreUpdates: 0, messageDuplicates: 0 },
    perStage: {},
    perAssignee: {},
    perSource: {},
    members,
    stages,
    fieldsToCreate,
    leadSourcesToCreate: [],
    unmappedFields: {},
    valuesNotFitting: 0,
    phonesNotMobile: 0,
    noPhone: 0,
    merged: [],
    perPool: {},
    poolMoves: 0,
    poolLeftTouched: 0,
    poolAlready: 0,
    salesTeam,
  };
  const ownSourcesUsed = new Set<string>();
  const bump = (rec: Record<string, number>, key: string) => (rec[key] = (rec[key] ?? 0) + 1);

  /* The earliest live lead for a number becomes its card; binned ones and
     later ones merge into it. */
  const order = [...ax.leads].sort((a, b) => (a.deletedAt ? 1 : 0) - (b.deletedAt ? 1 : 0) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const cardForPhone = new Map<string, { kind: 'board'; client: ExistingClient } | { kind: 'file'; axId: string; plan: Extract<LeadPlan, { action: 'create' }> }>();
  for (const [p, c] of ctx.existingByPhone) cardForPhone.set(p, { kind: 'board', client: c });

  const leads: LeadPlan[] = [];
  for (const lead of order) {
    const done = ctx.imported.get(lead.id);
    if (done) {
      const assignee = lead.assignedTo ? people.get(lead.assignedTo)?.member ?? null : null;
      const backfill = !done.assignedToId && assignee ? assignee : null;
      /* A re-run with poolTeam: a card this import made, still nobody's and
         untouched since (no line after its import line), moves into the team
         pool. Anything somebody has worked stays where they left it. */
      let pool: MemberRef | null = null;
      if (poolTeam && done.fromImport && !done.assignedToId && !backfill && toTeamPool(lead)) {
        if (poolTeam.kind === 'existing' && done.poolTeamId === poolTeam.id) report.poolAlready += 1;
        else if (done.touched) report.poolLeftTouched += 1;
        else {
          pool = poolTeam;
          report.poolMoves += 1;
        }
      }
      leads.push({ action: 'already', axId: lead.id, clientId: done.clientId, backfill, pool });
      report.already += 1;
      if (backfill) report.backfill += 1;
      continue;
    }
    if (lead.deletedAt && choices.binned === 'skip') {
      leads.push({ action: 'skip-binned', axId: lead.id });
      report.skippedBinned += 1;
      continue;
    }
    if (answeredAny(lead, choices.skipIfAnswered)) {
      leads.push({ action: 'skip-answered', axId: lead.id });
      report.skippedAnswered += 1;
      continue;
    }

    const built = buildLead(lead, { ax, stageById, axStageName, intake, people, fields, fieldKeyOf, now: opts.now });
    if (!built.client.assignee && toTeamPool(lead)) built.client.poolTeam = poolTeam;
    report.valuesNotFitting += built.valuesNotFitting;
    report.eventsSkipped.scoreUpdates += built.scoreUpdates;
    report.eventsSkipped.messageDuplicates += built.messageStubs;
    for (const k of built.unmappedKeys) bump(report.unmappedFields, k);
    if (built.phoneNotMobile) report.phonesNotMobile += 1;
    const phone = built.client.phone;
    const card = phone ? cardForPhone.get(phone) : undefined;

    if (card?.kind === 'board') {
      const c = card.client;
      /* Blanks only, and the card in hand is updated as it is filled, so a
         second AxLeads lead with the same number fills what the first left. */
      const fill: Partial<ClientPlan> = {};
      for (const k of ['email', 'locality', 'society', 'config'] as const) {
        if (!c[k] && built.client[k]) c[k] = fill[k] = built.client[k];
      }
      if (c.carpetSqft === null && built.client.carpetSqft !== null) c.carpetSqft = fill.carpetSqft = built.client.carpetSqft;
      if (c.budgetPaise === null && built.client.budgetPaise !== null) c.budgetPaise = fill.budgetPaise = built.client.budgetPaise;
      if (!c.assignedToId && !c.assignedNew && built.client.assignee) {
        fill.assignee = built.client.assignee;
        c.assignedNew = true;
      }
      if (!c.attributed && built.client.ads) {
        fill.ads = built.client.ads;
        c.attributed = true;
        built.adsTaken = true;
      }
      const tags = addTags(c.tags, built.client.tags).tags;
      if (tags.length !== c.tags.length) c.tags = fill.tags = tags;
      c.notes = fill.notes = joinNotes(c.notes, mergedBlock(lead, built));
      const events = [...built.events, mergeLine(lead, built.client, c.name, opts.now)];
      leads.push({ action: 'merge-existing', axId: lead.id, clientId: c.id, into: c.name, fill, events, name: built.client.name, phone: phone! });
      report.mergeExisting += 1;
      report.merged.push({ name: built.client.name, phone: phone!.slice(-4), into: c.name, where: 'board' });
      count(report, events);
      continue;
    }
    if (card?.kind === 'file') {
      const target = card.plan.client;
      if (!target.ads && built.client.ads) {
        target.ads = built.client.ads;
        built.adsTaken = true;
      }
      target.notes = joinNotes(target.notes, mergedBlock(lead, built));
      target.tags = addTags(target.tags, built.client.tags).tags;
      for (const k of ['email', 'locality', 'society', 'config'] as const) if (!target[k] && built.client[k]) target[k] = built.client[k];
      if (target.carpetSqft === null) target.carpetSqft = built.client.carpetSqft;
      if (target.budgetPaise === null) target.budgetPaise = built.client.budgetPaise;
      if (!target.assignee && built.client.assignee) target.assignee = built.client.assignee;
      if (built.client.lastContactedAt && (!target.lastContactedAt || built.client.lastContactedAt > target.lastContactedAt)) target.lastContactedAt = built.client.lastContactedAt;
      for (const [k, v] of Object.entries(built.client.fields)) if (!(k in target.fields)) target.fields[k] = v;
      const events = [...built.events, mergeLine(lead, built.client, target.name, opts.now)];
      leads.push({ action: 'merge-file', axId: lead.id, intoAxId: card.axId, into: target.name, events, name: built.client.name, phone: phone! });
      report.mergeFile += 1;
      report.merged.push({ name: built.client.name, phone: phone!.slice(-4), into: target.name, where: 'file' });
      count(report, events);
      continue;
    }

    const events = [...built.events, importLine(lead, built, opts.now)];
    const plan: Extract<LeadPlan, { action: 'create' }> = { action: 'create', axId: lead.id, client: built.client, events };
    leads.push(plan);
    if (phone) cardForPhone.set(phone, { kind: 'file', axId: lead.id, plan });
    report.create += 1;
    if (built.client.deletedAt) report.binned += 1;
    if (!phone) report.noPhone += 1;
    if (built.client.ownSource) ownSourcesUsed.add(built.client.ownSource);
    count(report, events);
  }

  // Tallies off the final cards, after every merge has had its say about the assignee.
  const stageName = new Map(ctx.stages.map((s) => [s.id, s.name]));
  const memberName = (ref: PersonRef['member']): string => {
    if (!ref) return POOL;
    if (ref.kind === 'existing') return ctx.members.find((m) => m.id === ref.id)?.name ?? ref.id;
    const p = members.find((m) => m.kind === 'create' && m.ax.userId === ref.axUserId);
    return `${p && p.kind === 'create' ? p.name : ref.axUserId} (new, invited)`;
  };
  for (const l of leads) {
    if (l.action !== 'create') continue;
    bump(report.perStage, stageName.get(l.client.stageId) ?? l.client.stageId);
    bump(report.perAssignee, memberName(l.client.assignee));
    if (!l.client.assignee) bump(report.perPool, l.client.poolTeam && salesTeam.poolTeam ? teamPoolLabel(salesTeam.poolTeam.name) : STUDIO_POOL);
    bump(report.perSource, l.client.ownSource ?? SOURCE_LABELS[l.client.source]);
  }

  const have = new Set(ctx.leadSources.map((s) => s.name.toLowerCase()));
  const leadSourcesToCreate = [...ownSourcesUsed].filter((n) => !have.has(n.toLowerCase()));
  report.leadSourcesToCreate = leadSourcesToCreate;
  return { members, stages, fieldsToCreate, leadSourcesToCreate, leads, salesTeam, report };
}

function count(report: Report, events: readonly EventPlan[]) {
  for (const e of events) report.events[e.kind] = (report.events[e.kind] ?? 0) + 1;
}

function joinNotes(a: string | null, b: string | null): string | null {
  const parts = [a?.trim(), b?.trim()].filter((x): x is string => !!x);
  return parts.length ? parts.join('\n\n') : null;
}

interface Built {
  client: ClientPlan;
  events: EventPlan[];
  /** The "From AxLeads" lines, kept apart so a merge can append them under a heading. */
  extra: string[];
  stage: StageMapRow;
  unmappedKeys: string[];
  valuesNotFitting: number;
  phoneNotMobile: boolean;
  scoreUpdates: number;
  messageStubs: number;
  /** Set by a merge when the card took this lead's ad into its columns. */
  adsTaken?: boolean;
}

interface BuildCtx {
  ax: AxExport;
  stageById: Map<string, StageMapRow>;
  axStageName: Map<string, string>;
  intake: StudioStageRef;
  people: Map<string, PersonRef>;
  fields: FieldShape[];
  fieldKeyOf: Map<string, string>;
  now: Date;
}

function buildLead(lead: AxLead, b: BuildCtx): Built {
  const stage: StageMapRow = b.stageById.get(lead.stageId) ?? {
    axId: lead.stageId,
    axName: '(a stage not in the file)',
    semantic: 'ACTIVE',
    stageId: b.intake.id,
    stageName: b.intake.name,
    kind: b.intake.kind,
    how: 'intake',
    note: 'the stage is not in the export',
  };
  const extra: string[] = [];

  // Who and how to reach them.
  const rawPhone = (lead.phone ?? lead.contact?.phone ?? '').trim();
  const phone = rawPhone ? clientPhone(rawPhone) : null;
  const phoneNotMobile = !!rawPhone && !phone;
  if (phoneNotMobile) extra.push(`Phone as it was on AxLeads: ${rawPhone} (not a mobile number, so not in the phone box)`);
  const email = (lead.email ?? lead.contact?.email ?? '').trim().toLowerCase() || null;
  let name = tidyName(lead.name ?? lead.contact?.name ?? '');
  if (name.length < 2) name = email ? email.split('@')[0]! : phone ? `AxLeads lead …${phone.slice(-4)}` : `AxLeads lead ${lead.id.slice(0, 8)}`;

  // Form answers: our columns, the studio's fields, or the notes.
  const custom = isObj(lead.customFields) ? lead.customFields : {};
  let config: string | null = null;
  let society: string | null = null;
  let carpetSqft: number | null = null;
  const submitted: Record<string, string> = {};
  const unmappedKeys: string[] = [];
  const answers: string[] = [];
  for (const [k, v] of Object.entries(custom)) {
    const value = text(v);
    if (!value) continue;
    const key = k.trim().toLowerCase();
    if (!config && CANONICAL_KEYS.config.test(key)) {
      config = value.slice(0, 60);
      continue;
    }
    if (!society && CANONICAL_KEYS.society.test(key)) {
      society = value.slice(0, 200);
      continue;
    }
    if (carpetSqft === null && CANONICAL_KEYS.carpet.test(key) && /^\d{2,5}(\.\d+)?$/.test(value.replace(/,/g, ''))) {
      carpetSqft = Math.round(Number(value.replace(/,/g, '')));
      // Also the studio's field when it has one of this key — falls through.
      if (!b.fieldKeyOf.has(k)) continue;
    }
    const ours = b.fieldKeyOf.get(k);
    if (ours) submitted[ours] = value;
    else {
      unmappedKeys.push(k);
      answers.push(`${k.replace(/_/g, ' ')}: ${clip(value, 300)}`);
    }
  }
  const { values, problems } = cleanValues(b.fields, submitted);
  for (const p of problems) answers.push(`${p.label}: ${submitted[p.key]} (did not fit the field)`);

  // Budget: ours is one figure; a range is kept in words too.
  const budgetInr = lead.budgetMaxInr ?? lead.budgetMinInr ?? null;
  const budgetPaise = budgetInr !== null && budgetInr > 0 ? Math.round(budgetInr * 100) : null;
  if (lead.budgetMinInr && lead.budgetMaxInr && lead.budgetMinInr !== lead.budgetMaxInr) extra.push(`Budget ${rupees(lead.budgetMinInr)} – ${rupees(lead.budgetMaxInr)}`);

  // Stage, and lost.
  const lostHere = stage.kind === 'LOST';
  const axSaysLost = stage.semantic === 'LOST' || !!lead.lostReason;
  const lostText = lead.lostReason?.trim() || ((stage.semantic === 'LOST' && norm(stage.axName) !== norm(stage.stageName)) || (lostHere && stage.semantic !== 'LOST') ? stage.axName : null);
  const lostReason: LostReasonName | null = lostHere ? mapLostReason(lostText ?? stage.axName) : null;
  const lostNote = lostHere ? lostText : null;
  if (!lostHere && axSaysLost && lead.lostReason) extra.push(`Lost reason on AxLeads: ${lead.lostReason}`);
  if (stage.how !== 'name' && stage.how !== 'chosen') extra.push(`Stage on AxLeads: ${stage.axName}`);

  // Source.
  const src = mapSource(lead, b.ax);

  // Everything with no column here.
  const meta: string[] = [];
  if (lead.score) meta.push(`score ${lead.score}${lead.isHot ? ' (hot)' : ''}`);
  else if (lead.isHot) meta.push('hot');
  if (lead.timelineText) meta.push(`timeline: ${lead.timelineText}`);
  if (lead.requirements.length) meta.push(`requirements: ${lead.requirements.join(', ')}`);
  if (meta.length) extra.push(meta.join(' · '));
  /* The ad ids and utm are columns now (22 Oct 2026), not lines here. */
  const ads = adAttributionFor(lead);
  if (lead.referredBy) extra.push(`Referred by ${lead.referredBy}`);
  if (lead.sourceDetail && typeof lead.sourceDetail.firstMessage === 'string' && lead.sourceDetail.firstMessage.trim()) extra.push(`First WhatsApp message: ${clip(lead.sourceDetail.firstMessage.trim(), 300)}`);
  if (answers.length) extra.push(`Form answers — ${answers.join('; ')}`);
  const open = openFollowUps(lead.followUps);
  if (open.length) extra.push(`Open follow-ups: ${open.join('; ')}`);
  if (lead.deletedAt) extra.push(`In the AxLeads bin since ${day(lead.deletedAt)}`);
  const tagsIn = addTags([], lead.tags);
  if (tagsIn.refused) extra.push(`More tags: ${lead.tags.slice(tagsIn.tags.length).join(', ')}`);

  // Follow-up: the call-back AxLeads had booked, when it is still open.
  const due = lead.nextAttemptAt && !lead.nextAttemptDoneAt ? new Date(lead.nextAttemptAt) : null;
  const nextAction = due ? clip(open[0] ?? 'Call back', 120) : null;

  const assignee = lead.assignedTo ? b.people.get(lead.assignedTo)?.member ?? null : null;
  if (lead.assignedTo && !assignee) {
    const who = b.people.get(lead.assignedTo)?.name;
    extra.push(`Was with ${who ?? 'someone'} on AxLeads (not on the team here, so in the pool)`);
  }

  const { events, lastCall, scoreUpdates, messageStubs } = buildEvents(lead, b, src.note);

  const notesBlock = extra.length ? `From AxLeads (imported ${day(b.now)}):\n${extra.map((l) => `• ${l}`).join('\n')}` : null;

  return {
    client: {
      name: name.slice(0, 120),
      phone,
      email,
      society,
      locality: lead.locality?.trim().slice(0, 200) || null,
      city: lead.city?.trim().slice(0, 60) || 'Pune',
      config,
      carpetSqft,
      budgetPaise,
      source: src.source,
      ownSource: src.ownSource,
      sourceNote: src.note,
      stageId: stage.stageId,
      lostReason,
      lostNote,
      fields: values,
      notes: notesBlock,
      nextAction,
      nextActionOn: due,
      assignee,
      poolTeam: null,
      lastContactedAt: lastCall,
      tags: tagsIn.tags,
      createdAt: new Date(lead.createdAt),
      ads,
      /* The bin erases after thirty days from deletedAt. Keeping AxLeads'
         date would let the purge erase a lead the moment it arrived, so the
         clock starts at the import; the old date is in the notes. */
      deletedAt: lead.deletedAt ? b.now : null,
    },
    events,
    extra,
    stage,
    unmappedKeys,
    valuesNotFitting: problems.length,
    phoneNotMobile,
    scoreUpdates,
    messageStubs,
  };
}

function buildEvents(lead: AxLead, b: BuildCtx, sourceNote: string): { events: EventPlan[]; lastCall: Date | null; scoreUpdates: number; messageStubs: number } {
  const events: EventPlan[] = [];
  let lastCall: Date | null = null;
  let scoreUpdates = 0;
  let messageStubs = 0;
  const stageName = (v: unknown): string | null => (typeof v === 'string' ? b.axStageName.get(v) ?? v : null);
  const studioStage = (v: unknown): string | null => (typeof v === 'string' ? b.stageById.get(v)?.stageId ?? null : null);
  const who = (a: AxActivity): PersonRef | null => {
    if (a.actorKind !== 'HUMAN') return null;
    if (!a.createdBy) return null;
    return b.people.get(a.createdBy) ?? { member: null, name: 'Someone on AxLeads' };
  };
  const personName = (userId: unknown): string | null => (typeof userId === 'string' ? b.people.get(userId)?.name ?? 'someone' : null);
  const hasMessages = lead.messages.length > 0;
  let created = false;

  for (const a of lead.activities) {
    const d = isObj(a.data) ? a.data : {};
    const at = new Date(a.createdAt);
    const base = { externalId: `axleads:${a.id}`, createdAt: at, by: who(a) };
    const raw = { axleads: { kind: a.kind, data: d } };
    let kind: EventKindName;
    let summary: string;
    let meta: Record<string, unknown> = raw;

    switch (a.kind) {
      case 'LEAD_CREATED':
        kind = 'CREATED';
        summary = `Came in on AxLeads — ${AX_SOURCE_LABELS[String(d.source ?? lead.source)] ?? words(String(d.source ?? lead.source))}`;
        created = true;
        break;
      case 'STAGE_CHANGED': {
        kind = 'STAGE_CHANGED';
        const to = stageName(d.to) ?? 'another stage';
        summary = d.reason === 'stage_removed' ? `Moved to ${to} (the old stage was removed on AxLeads)` : stageSummary(stageName(d.from), to);
        meta = { ...raw, fromStageId: studioStage(d.from), toStageId: studioStage(d.to) };
        break;
      }
      case 'CALL_LOGGED': {
        kind = 'CONTACTED';
        const outcome = CALL_OUTCOME_MAP[String(d.outcome)];
        const reactions = Array.isArray(d.reactions) ? d.reactions.map((r) => CALL_REACTION_LABELS[String(r)] ?? String(r)) : [];
        const parts = [outcome ? contactSummary(outcome) : `Called — ${words(String(d.outcome ?? 'logged'))}`];
        if (reactions.length) parts.push(reactions.join(', '));
        if (typeof d.durationMin === 'number') parts.push(`${d.durationMin} min`);
        if (typeof d.note === 'string' && d.note.trim()) parts.push(d.note.trim());
        summary = parts.join(' · ');
        meta = { ...raw, outcome: outcome ?? null };
        if (!lastCall || at > lastCall) lastCall = at;
        break;
      }
      case 'NOTE':
        kind = 'NOTE';
        summary = typeof d.text === 'string' && d.text.trim() ? d.text.trim() : 'Note';
        break;
      case 'ASSIGNED': {
        kind = 'ASSIGNED';
        const to = personName(d.to);
        summary = d.claimed ? `Claimed from the pool by ${to ?? 'someone'}` : assignedSummary(to);
        const ref = typeof d.to === 'string' ? b.people.get(d.to)?.member ?? null : null;
        meta = { ...raw, toMemberId: ref?.kind === 'existing' ? ref.id : null };
        break;
      }
      case 'LOST': {
        kind = 'LOST';
        const reason = typeof d.reason === 'string' ? d.reason : null;
        summary = lostSummary(mapLostReason(reason), reason);
        break;
      }
      case 'REOPENED':
        kind = 'STAGE_CHANGED';
        summary = 'Reopened on AxLeads — back to the first column';
        break;
      case 'DELETED':
        kind = 'BINNED';
        summary = 'Deleted on AxLeads';
        break;
      case 'RESTORED':
        kind = 'RESTORED';
        summary = 'Brought back from the AxLeads bin';
        break;
      case 'TAG_ADDED':
      case 'TAG_REMOVED':
        kind = 'EDITED';
        summary = `${a.kind === 'TAG_ADDED' ? 'Tag added' : 'Tag removed'}: ${text(d.tag) ?? ''}`.trim();
        break;
      case 'SCORE_UPDATED':
        /* Written on every scoring pass; dozens per lead and nothing a
           person did. The current score is in the notes block. */
        scoreUpdates += 1;
        continue;
      case 'MESSAGE_IN':
      case 'MESSAGE_OUT':
        // The messages themselves come over from `messages`, with their text.
        if (hasMessages) {
          messageStubs += 1;
          continue;
        }
        kind = 'IMPORTED';
        summary = `${a.kind === 'MESSAGE_IN' ? 'WhatsApp from them' : 'WhatsApp to them'}${text(d.text ?? d.body) ? `: ${clip(text(d.text ?? d.body)!, 500)}` : ''}`;
        break;
      case 'DUPLICATE_FLAGGED':
        kind = 'IMPORTED';
        summary = 'Flagged as a possible duplicate on AxLeads';
        break;
      case 'HOT_ALERTED':
        kind = 'IMPORTED';
        summary = 'Marked hot on AxLeads';
        break;
      case 'COLD_TRIGGER_SENT':
        kind = 'IMPORTED';
        summary = `AxLeads sent a follow-up message${typeof d.day === 'number' ? ` (day ${d.day})` : ''}`;
        break;
      case 'COLD_CLOSED':
        kind = 'IMPORTED';
        summary = 'Closed as gone cold by AxLeads';
        break;
      default:
        kind = 'IMPORTED';
        summary = `${words(a.kind)} (AxLeads)`;
    }
    events.push({ ...base, kind, summary: clip(summary, 2000), meta });
  }

  for (const m of lead.messages) {
    const body = (m.body ?? '').trim();
    const label = `${m.channel === 'WHATSAPP' ? 'WhatsApp' : words(m.channel)} ${m.direction === 'INBOUND' ? 'from them' : 'to them'}`;
    events.push({
      externalId: `axleads:msg:${m.id}`,
      kind: 'IMPORTED',
      summary: body ? `${label}: ${clip(body, 500)}` : m.templateKey ? `${label} (template ${m.templateKey})` : label,
      meta: { axleads: { message: { channel: m.channel, direction: m.direction, templateKey: m.templateKey ?? null } } },
      createdAt: new Date(m.createdAt),
      by: null,
    });
  }

  // Every lead says how it arrived, even one AxLeads wrote no line for.
  if (!created) {
    events.unshift({
      externalId: `axleads:lead:${lead.id}:created`,
      kind: 'CREATED',
      summary: `Came in on AxLeads — ${sourceNote.replace(/^AxLeads · /, '')}`,
      meta: { axleads: { source: lead.source } },
      createdAt: new Date(lead.createdAt),
      by: null,
    });
  }
  return { events, lastCall, scoreUpdates, messageStubs };
}

/** The marker line: one per AxLeads lead, and what a second run looks for. */
export const markerId = (axLeadId: string) => `axleads:lead:${axLeadId}`;

function importLine(lead: AxLead, built: Built, now: Date): EventPlan {
  return {
    externalId: markerId(lead.id),
    kind: 'IMPORTED',
    summary: `Imported from AxLeads — was in ${built.stage.axName}${built.stage.stageName !== built.stage.axName ? `, now in ${built.stage.stageName}` : ''}`,
    meta: { axleads: { leadId: lead.id, stageId: lead.stageId, stage: built.stage.axName, how: built.stage.how } },
    createdAt: now,
    by: null,
  };
}

function mergeLine(lead: AxLead, client: ClientPlan, into: string, now: Date): EventPlan {
  return {
    externalId: markerId(lead.id),
    kind: 'IMPORTED',
    summary: `Imported from AxLeads and merged into this card: ${client.name} had the same number (${client.sourceNote})`,
    meta: { axleads: { leadId: lead.id, mergedInto: into } },
    createdAt: now,
    by: null,
  };
}

/** One line naming an ad, for a merge note: "Ad: campaign … · ad set … · lead id …". */
function adLine(a: AdColumns): string | null {
  const ids = [
    a.campaignName ? `campaign ${a.campaignName}` : a.campaignId && `campaign ${a.campaignId}`,
    a.adsetId && `ad set ${a.adsetId}`,
    a.adId && `ad ${a.adId}`,
    a.formId && `form ${a.formId}`,
    a.leadgenId && `lead id ${a.leadgenId}`,
    a.gclid && `gclid ${a.gclid}`,
  ].filter(Boolean);
  return ids.length ? `Ad: ${ids.join(' · ')}` : null;
}

/**
 * An AxLeads lead's ad, as our attribution columns (owner, 22 Oct 2026).
 * The ids AxLeads kept on the lead; names, when its Meta lead (sourceDetail)
 * carried them; the platform from the source (Meta lead ad: Facebook or
 * Instagram; Google lead form or a gclid: Google; click-to-WhatsApp ads:
 * Facebook) or utm_source. `leadgenId` only for a Meta lead ad, and only when
 * it is Meta's digits. Null when there is nothing.
 */
export function adAttributionFor(lead: Pick<AxLead, 'source' | 'sourceDetail' | 'leadgenId' | 'gclid' | 'campaignId' | 'adsetId' | 'adId' | 'formId' | 'utm'>): AdColumns | null {
  const detail = isObj(lead.sourceDetail) ? lead.sourceDetail : {};
  const raw = isObj(detail.raw) ? detail.raw : {};
  const pick = (...keys: string[]): string | null => {
    for (const where of [detail, raw]) for (const k of keys) if (typeof where[k] === 'string' && (where[k] as string).trim()) return (where[k] as string).trim();
    return null;
  };
  const utmIn = isObj(lead.utm) ? lead.utm : {};
  const utm: Record<string, string> = {};
  for (const k of UTM_KEYS) if (typeof utmIn[k] === 'string' && (utmIn[k] as string).trim()) utm[k] = (utmIn[k] as string).trim();
  const platform =
    lead.source === 'META_LEAD_AD'
      ? instagramHint(lead.sourceDetail) ? 'instagram' : 'facebook'
      : lead.source === 'GOOGLE_LEAD_FORM' || lead.gclid
        ? 'google'
        : lead.source === 'WHATSAPP_ADS'
          ? 'facebook'
          : platformWord(utm.utm_source ?? null);
  const cols = adColumns({
    ...emptyAds(),
    adPlatform: platform,
    leadgenId: lead.source === 'META_LEAD_AD' ? lead.leadgenId : null,
    campaignId: lead.campaignId,
    campaignName: pick('campaign_name', 'campaignName') ?? utm.utm_campaign ?? null,
    adsetId: lead.adsetId,
    adsetName: pick('adset_name', 'adsetName'),
    adId: lead.adId,
    adName: pick('ad_name', 'adName'),
    formId: lead.formId,
    gclid: lead.gclid,
    utm,
  });
  /* A platform alone (a typed-in lead's source) is not an ad. */
  const anyAd = (Object.keys(cols) as (keyof AdColumns)[]).some((k) => k !== 'adPlatform' && cols[k] !== null);
  return anyAd ? cols : null;
}

function mergedBlock(lead: AxLead, built: Built): string {
  const head = `Merged from AxLeads: ${built.client.name}, ${built.stage.axName}, came in ${day(lead.createdAt)} (${built.client.sourceNote})`;
  const lines = [...built.extra.filter((l) => !l.startsWith('Stage on AxLeads'))];
  /* The card keeps its own ad in its columns; this lead's, when it had a different one, is kept here. */
  const ad = built.client.ads && !built.adsTaken ? adLine(built.client.ads) : null;
  if (ad) lines.push(ad);
  if (built.client.email) lines.unshift(`Email: ${built.client.email}`);
  return [head, ...lines.map((l) => `• ${l}`)].join('\n');
}

// ── The report ──────────────────────────────────────────────────────────

const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length));

function table(rec: Record<string, number>): string[] {
  return Object.entries(rec)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `    ${pad(k, 40)} ${v}`);
}

/** The dry run's whole output, and the first half of a real run's. Phones are shown by their last four digits. */
export function formatReport(r: Report, opts: { tenant: string; studio: string; dryRun: boolean }): string {
  const out: string[] = [];
  out.push(`AxLeads "${opts.tenant}" → studio ${opts.studio}${opts.dryRun ? '  (DRY RUN — nothing is written)' : ''}`);
  out.push('');
  out.push(`Leads in the file        ${r.leadsInFile}`);
  out.push(`  new cards              ${r.create}${r.binned ? ` (${r.binned} into the bin, as they were on AxLeads)` : ''}`);
  out.push(`  merged into a card     ${r.mergeExisting} already on the board, ${r.mergeFile} with an earlier lead in this file`);
  out.push(`  already imported       ${r.already}${r.backfill ? ` (${r.backfill} now given to their person)` : ''}`);
  if (r.skippedBinned) out.push(`  binned, skipped        ${r.skippedBinned}`);
  if (r.skippedAnswered) out.push(`  left out (answered a skipIfAnswered question, e.g. job applicants)  ${r.skippedAnswered}`);
  out.push(`  without a phone        ${r.noPhone}${r.phonesNotMobile ? `; ${r.phonesNotMobile} phones were not mobiles (kept in the notes)` : ''}`);
  out.push('');
  out.push('New cards per column:');
  out.push(...table(r.perStage));
  out.push('New cards per person:');
  out.push(...table(r.perAssignee));
  out.push('New cards per source:');
  out.push(...table(r.perSource));
  if (Object.keys(r.perPool).length || r.salesTeam.poolTeam) {
    out.push('New cards nobody has, per pool:');
    out.push(...table(r.perPool));
  }
  if (r.poolMoves || r.poolLeftTouched || r.poolAlready) {
    out.push(`Already imported, nobody's, now for ${r.salesTeam.poolTeam ? teamPoolLabel(r.salesTeam.poolTeam.name) : 'the team pool'}: ${r.poolMoves} moved there, ${r.poolLeftTouched} left where they are (worked since the import), ${r.poolAlready} there already`);
  }
  out.push('');
  out.push('History lines:');
  out.push(...table(r.events as Record<string, number>));
  out.push(`    (left out: ${r.eventsSkipped.scoreUpdates} score recalculations, ${r.eventsSkipped.messageDuplicates} message stubs)`);
  out.push('');
  out.push('Stages:');
  for (const s of r.stages) {
    const tag = s.how === 'name' ? '' : s.how === 'chosen' ? '  (your choice)' : `  ← CHECK: ${s.note}`;
    out.push(`    ${pad(`${s.axName} [${s.semantic}]`, 44)} → ${s.stageName}${tag}`);
  }
  out.push('');
  out.push('People:');
  const mask = (p: string) => `…${p.slice(-4)}`;
  const st = r.salesTeam;
  const handOver = st.poolTeam ? teamPoolLabel(st.poolTeam.name) : 'the pool';
  for (const m of r.members) {
    const who = `${m.label} <${m.ax.email ?? 'no email'}> [${m.ax.role}]`;
    if (m.kind === 'match') out.push(`    ${pad(who, 56)} = ${m.name} (by ${m.by})`);
    else if (m.kind === 'create') out.push(`    ${pad(who, 56)} + ADD as ${m.role}, INVITED, ${mask(m.phone)}${m.emailDropped ? ' (email is another login; added without it)' : ''}${m.reuseUserId ? ' (their existing login, which keeps its name)' : ''} — no invite is sent`);
    else if (m.kind === 'refused') out.push(`    ${pad(who, 56)} ✗ REFUSED ${mask(m.phone)}: ${m.reason} Their leads go to the pool.`);
    else if (m.kind === 'no-phone') out.push(`    ${pad(who, 56)} ✗ no phone on AxLeads — add one in the roles file ("members"), or their leads go to the pool`);
    else if (m.kind === 'gone') out.push(`    ${pad(who, 56)} – left AxLeads; history keeps the name, leads go to ${handOver}`);
    else out.push(`    ${pad(who, 56)} – skipped (roles file)${st.poolTeam ? `; leads go to ${handOver}` : ''}`);
    const line = st.lines.find((l) => l.axUserId === m.ax.userId);
    const was = (c: Change, w: string | null) => (c === 'same' ? ' (unchanged)' : c === 'changed' ? ` (was ${w ?? 'another'})` : '');
    if (line?.salesRole) out.push(`        sales role: ${line.salesRole.name}${line.salesRole.isNew ? ' (new role)' : ''}${was(line.salesRole.change, line.salesRole.was)}`);
    if (line?.reportsTo) out.push(`        reports to: ${line.reportsTo.name}${was(line.reportsTo.change, line.reportsTo.was ?? 'the owner')}`);
    const ref: MemberRef | null = m.kind === 'match' ? { kind: 'existing', id: m.memberId } : m.kind === 'create' ? { kind: 'new', axUserId: m.ax.userId } : null;
    if (st.poolTeam && ref && treeId(ref) === treeId(st.poolTeam.member)) {
      out.push('        team pool: gets the leads nobody had on AxLeads, and those of people skipped or gone');
    }
  }
  out.push('');
  if (st.builtInsMissing.length) out.push(`Sales roles this studio does not have yet, made first: ${st.builtInsMissing.join(', ')}`);
  for (const role of st.rolesToCreate) {
    out.push(`Sales role to make: ${role.name} — a copy of ${role.from}${role.added.length ? ` plus ${role.added.join(', ')}` : ''}`);
  }
  for (const n of st.notes) out.push(`Note: ${n}`);
  if (st.problems.length) {
    out.push(`✗ The roles file asks for ${st.problems.length === 1 ? 'something that cannot be done' : `${st.problems.length} things that cannot be done`}. Nothing is written until it is fixed:`);
    for (const p of st.problems) out.push(`    ✗ ${p}`);
  }
  if (st.builtInsMissing.length || st.rolesToCreate.length || st.notes.length || st.problems.length) out.push('');
  if (r.fieldsToCreate.length) out.push(`Fields to add in Settings → Fields: ${r.fieldsToCreate.map((f) => `${f.label} (${f.type.toLowerCase()})`).join(', ')}`);
  if (r.leadSourcesToCreate.length) out.push(`Source names to add: ${r.leadSourcesToCreate.join(', ')}`);
  const unmapped = Object.entries(r.unmappedFields).sort((a, b) => b[1] - a[1]);
  if (unmapped.length) out.push(`Form answers with no field here (kept in the notes): ${unmapped.map(([k, n]) => `${k} ×${n}`).join(', ')}`);
  if (r.valuesNotFitting) out.push(`Values that did not fit their field (kept in the notes): ${r.valuesNotFitting}`);
  if (r.merged.length) {
    out.push(`Duplicates merged (${r.merged.length}):`);
    for (const m of r.merged.slice(0, 100)) out.push(`    ${m.name} (…${m.phone}) → ${m.into}${m.where === 'board' ? ' (already on the board)' : ' (earlier in this file)'}`);
    if (r.merged.length > 100) out.push(`    … and ${r.merged.length - 100} more`);
  }
  return out.join('\n');
}

/** Whether this lead answered any of these form questions (custom-field keys, any case, non-empty answer). */
export function answeredAny(lead: Pick<AxLead, 'customFields'>, keys: readonly string[]): boolean {
  if (!keys.length || !isObj(lead.customFields)) return false;
  const want = new Set(keys);
  return Object.entries(lead.customFields).some(([k, v]) => want.has(k.trim().toLowerCase()) && v !== null && v !== undefined && String(v).trim() !== '');
}

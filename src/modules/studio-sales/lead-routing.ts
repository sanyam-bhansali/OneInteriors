/**
 * "New leads go to" (owner, 22 Oct 2026; docs/studio-os/LEAD-INTAKE.md):
 * who gets a lead that arrives by itself — lead intake (Meta lead ads, Google
 * lead forms, the website, portals) and the enquiry form. Never a lead typed
 * by hand ("Add a client") and never an import: somebody chose those.
 *
 * Pure, no `server-only` (CONTRIBUTING §9.5), and tested case by case in
 * tests/studio-lead-routing.test.ts. `land.ts` asks here and writes what it
 * is told; the settings screen asks here what the rule will do.
 *
 * ## Four modes (ported from AxLeads' `resolveDefaultAssignee`, widened)
 *
 *  - **POOL** — nobody, as before 22 Oct. The default for every studio.
 *  - **PERSON** — one chosen member gets every new lead.
 *  - **TURNS** — round the chosen members in the order the owner put them.
 *  - **TEAM** — sales roles and teams (owner, 22 Oct 2026; docs/studio-os/
 *    SALES-ROLES.md): nobody yet, but in the team pool of the chosen head
 *    (`personId` / `routeMemberId` names the head), for the head to hand out
 *    or the team to claim. A head who has left or is suspended, or is not a
 *    salesperson, is unavailable and the lead falls to the studio pool.
 *
 * A door (StudioLeadConnection) may override the studio's rule: Meta leads
 * always to one person, a portal's always to the pool. Null follows the
 * studio.
 *
 * ## Fair and race-safe turns
 *
 * TURNS keeps one counter on the studio (`leadRouteTurn`). The landing
 * transaction bumps it atomically and hands the new value here; the next
 * person is `eligible[(turn - 1) % eligible.length]`. Two leads landing in
 * the same instant get two different values, so they go to two different
 * people. Somebody suspended this week is skipped without the others losing
 * their place in the order.
 *
 * ## Never throws, and the pool is the fallback
 *
 * This runs on a webhook. AxLeads' rule, kept: a lead in the pool is
 * recoverable in seconds, a failed lead never existed. So a chosen person who
 * has left, is suspended or invited and not yet signed in, or is on a role
 * that cannot work leads (a supervisor, accounts, a designer; a project
 * manager on Pro) is skipped, and with nobody left the lead goes to the pool
 * with the reason, for the timeline.
 */

import { can, type StudioMemberStatusName, type StudioRoleName } from '@/modules/studio/roles';

export type LeadRouteModeName = 'POOL' | 'PERSON' | 'TURNS' | 'TEAM';
export const LEAD_ROUTE_MODES: readonly LeadRouteModeName[] = ['POOL', 'PERSON', 'TURNS', 'TEAM'];

/** Twenty people in a turn list is far more than a studio's sales team. */
export const MAX_TURN_MEMBERS = 20;

/** The studio's rule, as stored on Studio. */
export interface StudioRouting {
  mode: LeadRouteModeName;
  personId: string | null;
  turnIds: string[];
}

/** One door's override, as stored on StudioLeadConnection. `mode` null follows the studio. */
export interface ConnectionRouting {
  mode: LeadRouteModeName | null;
  personId: string | null;
  /** The door's name, for the timeline line ("leads from 99acres go to Asha"). */
  label: string;
}

export interface RoutingMember {
  id: string;
  role: StudioRoleName;
  status: StudioMemberStatusName;
  name: string;
}

/** The rule that applies to one lead, after the door's override. */
export interface EffectiveRule {
  mode: LeadRouteModeName;
  personId: string | null;
  turnIds: string[];
  /** Whose rule it is: the studio's, or this door's. */
  from: 'studio' | 'connection';
  /** The door's name when `from` is connection. */
  label: string | null;
}

export type RouteDecision =
  | { kind: 'person'; memberId: string; name: string; mode: 'PERSON' | 'TURNS'; from: 'studio' | 'connection'; label: string | null }
  /** TEAM: unassigned, in this head's team pool. */
  | { kind: 'team'; headId: string; name: string; from: 'studio' | 'connection'; label: string | null }
  | {
      kind: 'pool';
      /** POOL: the rule says pool. UNAVAILABLE: the rule named people, none can take it. */
      why: 'POOL' | 'UNAVAILABLE';
      from: 'studio' | 'connection';
      label: string | null;
    };

const isMode = (v: unknown): v is LeadRouteModeName => typeof v === 'string' && (LEAD_ROUTE_MODES as readonly string[]).includes(v);

/** The stored columns, repaired: an unknown mode is POOL, ids are de-duplicated and capped. */
export function readRouting(row: { leadRouteMode?: unknown; leadRouteMemberId?: unknown; leadRouteTurnIds?: unknown } | null | undefined): StudioRouting {
  const mode = isMode(row?.leadRouteMode) ? row.leadRouteMode : 'POOL';
  const personId = typeof row?.leadRouteMemberId === 'string' && row.leadRouteMemberId ? row.leadRouteMemberId : null;
  const raw = Array.isArray(row?.leadRouteTurnIds) ? row.leadRouteTurnIds : [];
  const turnIds = [...new Set(raw.filter((v): v is string => typeof v === 'string' && v.length > 0))].slice(0, MAX_TURN_MEMBERS);
  return { mode, personId, turnIds };
}

/** A door's override, repaired. */
export function readConnectionRouting(row: { routeMode?: unknown; routeMemberId?: unknown; label?: unknown } | null | undefined): ConnectionRouting | null {
  if (!row) return null;
  return {
    mode: isMode(row.routeMode) ? row.routeMode : null,
    personId: typeof row.routeMemberId === 'string' && row.routeMemberId ? row.routeMemberId : null,
    label: typeof row.label === 'string' ? row.label : '',
  };
}

/** The rule for this lead: the door's when it has one, else the studio's. TURNS always uses the studio's list. */
export function effectiveRule(studio: StudioRouting, door: ConnectionRouting | null): EffectiveRule {
  if (door && door.mode) {
    return { mode: door.mode, personId: door.mode === 'PERSON' || door.mode === 'TEAM' ? door.personId : null, turnIds: studio.turnIds, from: 'connection', label: door.label || null };
  }
  return { mode: studio.mode, personId: studio.personId, turnIds: studio.turnIds, from: 'studio', label: null };
}

/**
 * Whether this member may be given a new lead: active, and on a role that
 * works leads in this studio's plan (`lead.edit` on a lead assigned to them —
 * owner, PM on Max, salesperson).
 */
export function canTakeLeads(member: Pick<RoutingMember, 'role' | 'status'>, fullSoftware: boolean): boolean {
  return can({ role: member.role, status: member.status, fullSoftware }, 'lead.edit', { assigned: true });
}

/**
 * Whether this member's team pool can take new leads (TEAM): an active
 * salesperson. The owner's own pool is the studio pool (POOL), and the other
 * fixed roles have no sales team.
 */
export function canHeadTeam(member: Pick<RoutingMember, 'role' | 'status'>): boolean {
  return member.role === 'SALES' && member.status === 'ACTIVE';
}

/** The head whose team pool this TEAM rule fills, if they can have one now. */
export function teamHeadFor(rule: EffectiveRule, members: readonly RoutingMember[]): RoutingMember | null {
  if (rule.mode !== 'TEAM' || !rule.personId) return null;
  const head = members.find((m) => m.id === rule.personId);
  return head && canHeadTeam(head) ? head : null;
}

/** The people this rule could give a lead to now, in the rule's order. */
export function eligibleFor(rule: EffectiveRule, members: readonly RoutingMember[], fullSoftware: boolean): RoutingMember[] {
  const byId = new Map(members.map((m) => [m.id, m]));
  const ids = rule.mode === 'PERSON' ? (rule.personId ? [rule.personId] : []) : rule.mode === 'TURNS' ? rule.turnIds : [];
  return ids.map((id) => byId.get(id)).filter((m): m is RoutingMember => !!m && canTakeLeads(m, fullSoftware));
}

/**
 * Whether landing this lead needs a turn from the counter. Only TURNS with
 * somebody to give it to: a counter bumped for a lead that went to the pool
 * would skip a person's turn for nothing.
 */
export function needsTurn(rule: EffectiveRule, members: readonly RoutingMember[], fullSoftware: boolean): boolean {
  return rule.mode === 'TURNS' && eligibleFor(rule, members, fullSoftware).length > 0;
}

/**
 * Who gets this lead. `turn` is the counter's new value (1, 2, 3…) after the
 * landing transaction bumped it; only TURNS reads it, and a TURNS rule
 * without one (or with a nonsense one) is treated as the first turn rather
 * than refused.
 */
export function routeLead(rule: EffectiveRule, members: readonly RoutingMember[], fullSoftware: boolean, turn: number | null = null): RouteDecision {
  const base = { from: rule.from, label: rule.label };
  if (rule.mode === 'POOL') return { kind: 'pool', why: 'POOL', ...base };
  if (rule.mode === 'TEAM') {
    const head = teamHeadFor(rule, members);
    return head ? { kind: 'team', headId: head.id, name: head.name, ...base } : { kind: 'pool', why: 'UNAVAILABLE', ...base };
  }
  const eligible = eligibleFor(rule, members, fullSoftware);
  if (eligible.length === 0) return { kind: 'pool', why: 'UNAVAILABLE', ...base };
  if (rule.mode === 'PERSON') {
    const m = eligible[0]!;
    return { kind: 'person', memberId: m.id, name: m.name, mode: 'PERSON', ...base };
  }
  const n = typeof turn === 'number' && Number.isInteger(turn) && turn > 0 ? turn : 1;
  const m = eligible[(n - 1) % eligible.length]!;
  return { kind: 'person', memberId: m.id, name: m.name, mode: 'TURNS', ...base };
}

/** "new leads go to Asha", "leads from 99acres take turns": the words in brackets. */
function ruleWords(d: RouteDecision, who: string | null): string {
  const subject = d.from === 'connection' && d.label ? `leads from ${d.label}` : 'new leads';
  if (d.kind === 'person' && d.mode === 'TURNS') return `${subject} take turns`;
  if (d.kind === 'team') return `${subject} go to ${d.name}’s team`;
  return `${subject} go to ${who ?? 'a chosen person'}`;
}

/**
 * The timeline line. A person: the ASSIGNED line, "Given to Asha (new leads
 * go to Asha)". The pool because nobody could take it: a NOTE, so the owner
 * reading the card knows the rule did not simply forget. The plain pool: none.
 */
export function routedLine(d: RouteDecision, wanted: string | null = null): { kind: 'ASSIGNED' | 'NOTE'; summary: string } | null {
  if (d.kind === 'person') return { kind: 'ASSIGNED', summary: `Given to ${d.name} (${ruleWords(d, d.name)})` };
  if (d.kind === 'team') return { kind: 'NOTE', summary: `In ${d.name}’s team pool (${ruleWords(d, d.name)})` };
  if (d.why === 'UNAVAILABLE') {
    const subject = d.from === 'connection' && d.label ? `leads from ${d.label}` : 'new leads';
    return { kind: 'NOTE', summary: `Left in the pool: ${subject} go to ${wanted ?? 'chosen people'}, and nobody chosen can take leads right now.` };
  }
  return null;
}

/** What the settings screen says the studio's rule does, in one sentence. */
export function describeRouting(r: StudioRouting, members: readonly RoutingMember[], fullSoftware: boolean): string {
  if (r.mode === 'POOL') return 'New leads land in the pool. Anyone who works leads can take one.';
  if (r.mode === 'TEAM') {
    const head = teamHeadFor(effectiveRule(r, null), members);
    return head ? `New leads land in ${head.name}’s team pool, for ${head.name} to hand out or the team to claim.` : 'The team chosen cannot take leads right now, so new leads land in the studio pool.';
  }
  const rule = effectiveRule(r, null);
  const eligible = eligibleFor(rule, members, fullSoftware);
  if (r.mode === 'PERSON') {
    return eligible[0] ? `Every new lead goes to ${eligible[0].name}.` : 'The person chosen cannot take leads right now, so new leads land in the pool.';
  }
  if (eligible.length === 0) return 'Nobody in the turn list can take leads right now, so new leads land in the pool.';
  return `New leads go to ${eligible.map((m) => m.name).join(', ')} in turn.`;
}

export type RoutingCheck = { ok: true; routing: StudioRouting } | { ok: false; error: string };

/**
 * What the owner picked, checked against the studio's team. A person must be
 * one who can take leads now; a turn list needs at least two of them (one is
 * "a person").
 */
export function checkRouting(input: { mode: unknown; personId?: unknown; turnIds?: unknown }, members: readonly RoutingMember[], fullSoftware: boolean): RoutingCheck {
  if (!isMode(input.mode)) return { ok: false, error: 'Pick where new leads go.' };
  const takers = new Map(members.filter((m) => canTakeLeads(m, fullSoftware)).map((m) => [m.id, m]));
  if (input.mode === 'POOL') return { ok: true, routing: { mode: 'POOL', personId: null, turnIds: [] } };
  if (input.mode === 'TEAM') {
    const id = typeof input.personId === 'string' ? input.personId : '';
    const head = members.find((m) => m.id === id);
    if (!head || !canHeadTeam(head)) return { ok: false, error: 'Pick the team. Its head must be an active salesperson.' };
    return { ok: true, routing: { mode: 'TEAM', personId: id, turnIds: [] } };
  }
  if (input.mode === 'PERSON') {
    const id = typeof input.personId === 'string' ? input.personId : '';
    if (!takers.has(id)) return { ok: false, error: 'Pick the person. Only someone active who works leads can be given them.' };
    return { ok: true, routing: { mode: 'PERSON', personId: id, turnIds: [] } };
  }
  const raw = Array.isArray(input.turnIds) ? input.turnIds : [];
  const ids = [...new Set(raw.filter((v): v is string => typeof v === 'string'))];
  if (ids.some((id) => !takers.has(id))) return { ok: false, error: 'Someone in the list cannot take leads. Pick only people who are active and work leads.' };
  if (ids.length < 2) return { ok: false, error: 'Pick at least two people to take turns. For one person, choose "A person".' };
  if (ids.length > MAX_TURN_MEMBERS) return { ok: false, error: `${MAX_TURN_MEMBERS} people is the most in a turn list.` };
  return { ok: true, routing: { mode: 'TURNS', personId: null, turnIds: ids } };
}

export type OverrideCheck = { ok: true; mode: LeadRouteModeName | null; personId: string | null } | { ok: false; error: string };

/** A door's override: "" or null follows the studio; POOL, TURNS; or PERSON with a person who can take leads. */
export function checkOverride(input: { mode: unknown; personId?: unknown }, members: readonly RoutingMember[], fullSoftware: boolean): OverrideCheck {
  if (input.mode === null || input.mode === '' || input.mode === undefined) return { ok: true, mode: null, personId: null };
  if (!isMode(input.mode)) return { ok: false, error: 'Pick where this source’s leads go.' };
  if (input.mode === 'TEAM') {
    const id = typeof input.personId === 'string' ? input.personId : '';
    const head = members.find((x) => x.id === id);
    if (!head || !canHeadTeam(head)) return { ok: false, error: 'Pick the team. Its head must be an active salesperson.' };
    return { ok: true, mode: 'TEAM', personId: id };
  }
  if (input.mode !== 'PERSON') return { ok: true, mode: input.mode, personId: null };
  const id = typeof input.personId === 'string' ? input.personId : '';
  const m = members.find((x) => x.id === id);
  if (!m || !canTakeLeads(m, fullSoftware)) return { ok: false, error: 'Pick the person. Only someone active who works leads can be given them.' };
  return { ok: true, mode: 'PERSON', personId: id };
}

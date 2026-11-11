import 'server-only';

/**
 * Societies (owner, 11 Nov 2026; Max plan). Reads and writes for the Leads
 * app's Societies tab. The rules (priority, heat, order) are pure, in
 * `society-rules.ts`; this file only fetches and fences.
 *
 * Who sees what (the plan the owner approved):
 * - Owner, PM and a sales role that sees every lead: every society.
 * - A salesperson with team reach: societies owned by them or their team.
 * - Anyone else: the societies owned by them.
 *
 * Who changes what: anyone who sees a society adds notes and wings. Its
 * owner, or anyone who may assign leads (owner/admin, sales heads), changes
 * the owner, sets priority or heat by hand, and edits its details. Import
 * needs `lead.import`. A studio not on Max sees none of it.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { can } from '@/modules/studio/roles';
import { myLeadScope, type LeadScope } from '@/modules/studio/lead-scope';
import { bulkAssign, bulkSplit } from '@/modules/studio-sales/bulk';
import { normalisePhone } from './csv';
import { recordMany } from './events';
import { intakeStageId } from './stages';
import type { SocietyImportPayload } from './society-import';
import {
  compareSocieties,
  effectiveHeat,
  effectivePriority,
  heatFor,
  parsePossession,
  priorityFor,
  societyKey,
  HEAT_WINDOW_DAYS,
  type AutoHeat,
  type Heat,
  type Priority,
} from './society-rules';

export interface SocietyAccess {
  scope: LeadScope;
  /** Change owner, overrides and details on every society they see. */
  mayManage: boolean;
  mayImport: boolean;
  mayAdd: boolean;
  /** Add to every studioSociety where. */
  where: Prisma.StudioSocietyWhereInput;
}

/** The signed-in member's society access, or null (not Max, or no leads). */
export async function mySocietyAccess(): Promise<SocietyAccess | null> {
  const scope = await myLeadScope();
  if (!scope) return null;
  const m = scope.member;
  if (m.fullSoftware !== true) return null;
  const where: Prisma.StudioSocietyWhereInput = scope.seesAll
    ? { studioId: scope.studioId }
    : scope.reach === 'team' && scope.team
      ? { studioId: scope.studioId, assignedToId: { in: [...scope.team] } }
      : { studioId: scope.studioId, assignedToId: m.id };
  const mayManage = can(m, 'lead.assign');
  return { scope, mayManage, mayImport: can(m, 'lead.import'), mayAdd: can(m, 'lead.add'), where };
}

const mayChange = (a: SocietyAccess, s: { assignedToId: string | null }) =>
  !a.scope.member.viewOnly && (a.mayManage || s.assignedToId === a.scope.member.id);

export interface SocietyRow {
  id: string;
  name: string;
  locality: string | null;
  builder: string | null;
  wings: number;
  possessionOn: Date | null;
  dateMissing: boolean;
  priority: Priority;
  priorityByHand: boolean;
  heat: Heat | null;
  heatByHand: boolean;
  calls: AutoHeat;
  assignedToId: string | null;
  assignedTo: string | null;
  leads: number;
  lastNote: { body: string; at: Date } | null;
}

const nameOf = (u: { name: string | null; email: string | null; phone: string | null } | null | undefined) =>
  u?.name?.trim() || u?.email?.split('@')[0] || u?.phone || 'Someone';

/** The calls behind each society's heat, in one read. */
async function callsBySociety(studioId: string, ids: readonly string[], now: Date) {
  const out = new Map<string, { clientId: string; at: Date; meta: unknown }[]>();
  if (ids.length === 0) return out;
  const since = new Date(now.getTime() - HEAT_WINDOW_DAYS * 86_400_000);
  const events = await prisma.studioClientEvent.findMany({
    where: { studioId, kind: 'CONTACTED', createdAt: { gte: since }, client: { societyId: { in: [...ids] }, deletedAt: null } },
    select: { clientId: true, createdAt: true, meta: true, client: { select: { societyId: true } } },
  });
  for (const e of events) {
    const sid = e.client.societyId;
    if (!sid) continue;
    const list = out.get(sid) ?? [];
    list.push({ clientId: e.clientId, at: e.createdAt, meta: e.meta });
    out.set(sid, list);
  }
  return out;
}

export interface SocietyFilters {
  q?: string;
  priority?: Priority | null;
  heat?: Heat | 'NONE' | null;
  owner?: string | null;
  locality?: string | null;
}

/** Every society this member sees, worked out and sorted (P1 first). */
export async function listSocieties(access: SocietyAccess, filters: SocietyFilters = {}, now = new Date()): Promise<SocietyRow[]> {
  await syncLeadSocieties(access.scope.studioId);
  const q = filters.q?.trim();
  const rows = await prisma.studioSociety.findMany({
    where: {
      AND: [
        access.where,
        q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { locality: { contains: q, mode: 'insensitive' } }] } : {},
        filters.owner === 'none' ? { assignedToId: null } : filters.owner ? { assignedToId: filters.owner } : {},
        filters.locality ? { locality: { equals: filters.locality, mode: 'insensitive' } } : {},
      ],
    },
    select: {
      id: true,
      name: true,
      locality: true,
      builder: true,
      assignedToId: true,
      assignedTo: { select: { user: { select: { name: true, email: true, phone: true } } } },
      priorityOverride: true,
      heatOverride: true,
      heatOverrideAt: true,
      wings: { select: { possessionOn: true } },
      notes: { select: { body: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      _count: { select: { clients: { where: { deletedAt: null } } } },
    },
    take: 2000,
  });
  const calls = await callsBySociety(access.scope.studioId, rows.map((r) => r.id), now);
  const out: SocietyRow[] = rows.map((r) => {
    const auto = priorityFor(r.wings, now);
    const p = effectivePriority(auto.priority, r.priorityOverride);
    const h = heatFor(calls.get(r.id) ?? [], now);
    const eh = effectiveHeat(h.heat, r.heatOverride, r.heatOverrideAt, now);
    return {
      id: r.id,
      name: r.name,
      locality: r.locality,
      builder: r.builder,
      wings: r.wings.length,
      possessionOn: auto.possessionOn,
      dateMissing: auto.dateMissing,
      priority: p.priority,
      priorityByHand: p.byHand,
      heat: eh.heat,
      heatByHand: eh.byHand,
      calls: h,
      assignedToId: r.assignedToId,
      assignedTo: r.assignedTo ? nameOf(r.assignedTo.user) : null,
      leads: r._count.clients,
      lastNote: r.notes[0] ? { body: r.notes[0].body, at: r.notes[0].createdAt } : null,
    };
  });
  return out
    .filter((r) => !filters.priority || r.priority === filters.priority)
    .filter((r) => !filters.heat || (filters.heat === 'NONE' ? r.heat === null : r.heat === filters.heat))
    .sort((a, b) => compareSocieties(a, b, now));
}

/** The people a society can be given to: active members who work leads. */
export async function societyPeople(studioId: string): Promise<{ id: string; name: string }[]> {
  const rows = await prisma.studioMember.findMany({
    where: { studioId, status: 'ACTIVE', role: { in: ['OWNER', 'PM', 'SALES'] } },
    select: { id: true, user: { select: { name: true, email: true, phone: true } } },
  });
  return rows.map((r) => ({ id: r.id, name: nameOf(r.user) })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function societyLocalities(access: SocietyAccess): Promise<string[]> {
  const rows = await prisma.studioSociety.findMany({ where: { ...access.where, studioId: access.scope.studioId, locality: { not: null } }, select: { locality: true }, distinct: ['locality'] });
  return rows.map((r) => r.locality!).filter(Boolean).sort();
}

/** One society with its wings, notes and the leads this member sees in it. */
export async function getSociety(access: SocietyAccess, id: string, now = new Date()) {
  await syncLeadSocieties(access.scope.studioId);
  const s = await prisma.studioSociety.findFirst({
    where: { AND: [access.where, { id }] },
    include: {
      assignedTo: { select: { id: true, user: { select: { name: true, email: true, phone: true } } } },
      wings: { orderBy: { name: 'asc' }, include: { _count: { select: { clients: { where: { deletedAt: null } } } } } },
      notes: { orderBy: { createdAt: 'desc' }, take: 200 },
    },
  });
  if (!s) return null;
  const leads = await prisma.studioClient.findMany({
    where: { AND: [access.scope.leads, { studioId: access.scope.studioId, societyId: s.id, deletedAt: null }] },
    select: {
      id: true,
      name: true,
      phone: true,
      wingId: true,
      stage: { select: { name: true } },
      assignedTo: { select: { user: { select: { name: true, email: true, phone: true } } } },
      events: { where: { kind: 'CONTACTED' }, orderBy: { createdAt: 'desc' }, take: 1, select: { summary: true, createdAt: true } },
    },
    orderBy: { name: 'asc' },
    take: 1000,
  });
  const calls = await callsBySociety(access.scope.studioId, [s.id], now);
  const auto = priorityFor(s.wings, now);
  const p = effectivePriority(auto.priority, s.priorityOverride);
  const h = heatFor(calls.get(s.id) ?? [], now);
  const eh = effectiveHeat(h.heat, s.heatOverride, s.heatOverrideAt, now);
  return {
    id: s.id,
    name: s.name,
    locality: s.locality,
    builder: s.builder,
    sourceSheet: s.sourceSheet,
    sourceImportedAt: s.sourceImportedAt,
    assignedToId: s.assignedToId,
    assignedTo: s.assignedTo ? nameOf(s.assignedTo.user) : null,
    priority: p.priority,
    priorityByHand: p.byHand,
    priorityReason: p.byHand ? s.priorityReason : null,
    autoPriority: auto,
    heat: eh.heat,
    heatByHand: eh.byHand,
    heatReason: eh.byHand ? s.heatReason : null,
    calls: h,
    mayChange: mayChange(access, s),
    wings: s.wings.map((w) => ({ id: w.id, name: w.name, flats: w.flats, possessionOn: w.possessionOn, leads: w._count.clients })),
    notes: s.notes.map((n) => ({ id: n.id, body: n.body, at: n.createdAt, by: n.authorName ?? 'Someone' })),
    leads: leads.map((l) => ({
      id: l.id,
      name: l.name,
      phone: l.phone,
      wingId: l.wingId,
      stage: l.stage.name,
      owner: l.assignedTo ? nameOf(l.assignedTo.user) : null,
      lastCall: l.events[0] ? { summary: l.events[0].summary, at: l.events[0].createdAt } : null,
    })),
  };
}

export type SocietyDetail = NonNullable<Awaited<ReturnType<typeof getSociety>>>;

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const clean = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);

async function authorName(memberId: string): Promise<string> {
  const row = await prisma.studioMember.findUnique({ where: { id: memberId }, select: { user: { select: { name: true, email: true, phone: true } } } });
  return nameOf(row?.user);
}

/**
 * Link the studio's leads whose typed society matches by key and have no
 * link yet. Returns how many were linked. Runs after a society is created or
 * renamed, and after an import.
 */
export async function linkLeadsByName(studioId: string, society: { id: string; key: string }): Promise<number> {
  const candidates = await prisma.studioClient.findMany({
    where: { studioId, societyId: null, deletedAt: null, society: { not: null } },
    select: { id: true, society: true },
  });
  const ids = candidates.filter((c) => c.society && societyKey(c.society) === society.key).map((c) => c.id);
  if (ids.length === 0) return 0;
  const r = await prisma.studioClient.updateMany({ where: { id: { in: ids }, studioId }, data: { societyId: society.id } });
  return r.count;
}

/**
 * Keep every lead's society link in step with its typed society: a lead
 * typed with a society on the list is linked to it; one whose typed society
 * changed to another on the list moves (and loses its wing); one typed with
 * no society on the list, or none at all, is unlinked. Run when the
 * Societies list is opened, so a lead edited anywhere (the board, the lead
 * page, an import, a merge) is counted right without each of those paths
 * having to know about societies.
 */
export async function syncLeadSocieties(studioId: string): Promise<number> {
  const societies = await prisma.studioSociety.findMany({ where: { studioId }, select: { id: true, key: true } });
  if (societies.length === 0) return 0;
  const byKey = new Map(societies.map((s) => [s.key, s.id]));
  const leads = await prisma.studioClient.findMany({
    where: { studioId, deletedAt: null, OR: [{ society: { not: null } }, { societyId: { not: null } }] },
    select: { id: true, society: true, societyId: true },
  });
  const moves = new Map<string, string[]>();
  for (const l of leads) {
    const want = l.society ? (byKey.get(societyKey(l.society)) ?? null) : null;
    if (want === l.societyId) continue;
    const k = want ?? '';
    moves.set(k, [...(moves.get(k) ?? []), l.id]);
  }
  let n = 0;
  for (const [target, ids] of moves) {
    for (let i = 0; i < ids.length; i += 1000) {
      const r = await prisma.studioClient.updateMany({ where: { studioId, id: { in: ids.slice(i, i + 1000) } }, data: { societyId: target || null, wingId: null } });
      n += r.count;
    }
  }
  return n;
}

export async function createSociety(
  access: SocietyAccess,
  input: { name: unknown; locality?: unknown; builder?: unknown; wings?: unknown; possession?: Date | null },
): Promise<Result<{ id: string; linked: number }>> {
  if (access.scope.member.viewOnly || !access.mayAdd) return { ok: false, error: 'You can’t add societies.' };
  const name = clean(input.name, 120);
  if (!name) return { ok: false, error: 'Give the society a name.' };
  const key = societyKey(name);
  if (!key) return { ok: false, error: 'Give the society a name with letters or numbers in it.' };
  const studioId = access.scope.studioId;
  const exists = await prisma.studioSociety.findUnique({ where: { studioId_key: { studioId, key } }, select: { id: true } });
  if (exists) return { ok: false, error: 'That society is already on the list.' };
  const wingNames = [...new Set(clean(input.wings, 400).split(/[,;\n]/).map((w) => w.trim()).filter(Boolean))].slice(0, 60);
  const s = await prisma.studioSociety.create({
    data: {
      studioId,
      name,
      key,
      locality: clean(input.locality, 80) || null,
      builder: clean(input.builder, 80) || null,
      /* A salesperson who adds one owns it; an admin gives it out after. */
      assignedToId: access.scope.member.id,
      wings: { create: (wingNames.length ? wingNames : ['Main']).map((w) => ({ name: w.slice(0, 40), possessionOn: input.possession ?? null })) },
    },
    select: { id: true, key: true },
  });
  const linked = await linkLeadsByName(studioId, s);
  return { ok: true, id: s.id, linked };
}

const NOT_YOURS = 'That society isn’t on your list.';

async function loadForChange(access: SocietyAccess, id: string) {
  return prisma.studioSociety.findFirst({ where: { AND: [access.where, { id, studioId: access.scope.studioId }] }, select: { id: true, key: true, assignedToId: true } });
}

export async function updateSociety(
  access: SocietyAccess,
  id: string,
  input: { name?: unknown; locality?: unknown; builder?: unknown },
): Promise<Result<{ linked: number }>> {
  const found = await loadForChange(access, id);
  if (!found) return { ok: false, error: NOT_YOURS };
  if (!mayChange(access, found)) return { ok: false, error: 'Only the society’s owner or an admin can change this.' };
  const name = clean(input.name, 120);
  if (!name) return { ok: false, error: 'Give the society a name.' };
  const key = societyKey(name);
  const clash = await prisma.studioSociety.findFirst({ where: { studioId: access.scope.studioId, key, NOT: { id } }, select: { id: true } });
  if (clash) return { ok: false, error: 'Another society already has that name.' };
  await prisma.studioSociety.updateMany({
    where: { id, studioId: access.scope.studioId },
    data: { name, key, locality: clean(input.locality, 80) || null, builder: clean(input.builder, 80) || null },
  });
  const linked = key !== found.key ? await linkLeadsByName(access.scope.studioId, { id, key }) : 0;
  return { ok: true, linked };
}

export async function setSocietyOwner(access: SocietyAccess, id: string, memberId: string | null): Promise<Result> {
  const found = await loadForChange(access, id);
  if (!found) return { ok: false, error: NOT_YOURS };
  if (access.scope.member.viewOnly || !access.mayManage) return { ok: false, error: 'Only an admin or a sales head can change who owns a society.' };
  if (memberId) {
    const ok = await prisma.studioMember.findFirst({ where: { id: memberId, studioId: access.scope.studioId, status: 'ACTIVE' }, select: { id: true } });
    if (!ok) return { ok: false, error: 'Pick someone in your team.' };
  }
  await prisma.studioSociety.updateMany({ where: { id, studioId: access.scope.studioId }, data: { assignedToId: memberId } });
  return { ok: true };
}

export async function setSocietyPriority(access: SocietyAccess, id: string, priority: Priority | null, reason: unknown): Promise<Result> {
  const found = await loadForChange(access, id);
  if (!found) return { ok: false, error: NOT_YOURS };
  if (!mayChange(access, found)) return { ok: false, error: 'Only the society’s owner or an admin can set this.' };
  const why = clean(reason, 200);
  if (priority && !why) return { ok: false, error: 'Say in a line why, so the team knows.' };
  await prisma.studioSociety.updateMany({ where: { id, studioId: access.scope.studioId }, data: { priorityOverride: priority, priorityReason: priority ? why : null } });
  return { ok: true };
}

export async function setSocietyHeat(access: SocietyAccess, id: string, heat: Heat | null, reason: unknown): Promise<Result> {
  const found = await loadForChange(access, id);
  if (!found) return { ok: false, error: NOT_YOURS };
  if (!mayChange(access, found)) return { ok: false, error: 'Only the society’s owner or an admin can set this.' };
  const why = clean(reason, 200);
  if (heat && !why) return { ok: false, error: 'Say in a line why, so the team knows.' };
  await prisma.studioSociety.updateMany({
    where: { id, studioId: access.scope.studioId },
    data: { heatOverride: heat, heatReason: heat ? why : null, heatOverrideAt: heat ? new Date() : null },
  });
  return { ok: true };
}

export async function addSocietyNote(access: SocietyAccess, id: string, body: unknown): Promise<Result> {
  if (access.scope.member.viewOnly) return { ok: false, error: 'You are viewing as someone else.' };
  const found = await loadForChange(access, id);
  if (!found) return { ok: false, error: NOT_YOURS };
  const text = clean(body, 4000);
  if (!text) return { ok: false, error: 'Write the note first.' };
  const me = access.scope.member.id;
  await prisma.studioSocietyNote.create({ data: { societyId: id, authorId: me, authorName: await authorName(me), body: text } });
  await prisma.studioSociety.updateMany({ where: { id, studioId: access.scope.studioId }, data: { updatedAt: new Date() } });
  return { ok: true };
}

/** Add a wing, or change one (name, flats, possession). */
export async function saveWing(
  access: SocietyAccess,
  societyId: string,
  input: { wingId?: string | null; name: unknown; flats?: unknown; possession: Date | null },
): Promise<Result> {
  if (access.scope.member.viewOnly) return { ok: false, error: 'You are viewing as someone else.' };
  const found = await loadForChange(access, societyId);
  if (!found) return { ok: false, error: NOT_YOURS };
  const name = clean(input.name, 40);
  if (!name) return { ok: false, error: 'Name the wing, e.g. A or Tower 3.' };
  const flatsN = Number(input.flats);
  const flats = Number.isInteger(flatsN) && flatsN > 0 && flatsN < 5000 ? flatsN : null;
  const clash = await prisma.studioSocietyWing.findFirst({ where: { societyId, name, ...(input.wingId ? { NOT: { id: input.wingId } } : {}) }, select: { id: true } });
  if (clash) return { ok: false, error: 'This society already has a wing with that name.' };
  if (input.wingId) {
    const r = await prisma.studioSocietyWing.updateMany({ where: { id: input.wingId, societyId }, data: { name, flats, possessionOn: input.possession } });
    if (r.count === 0) return { ok: false, error: 'That wing isn’t in this society.' };
  } else {
    await prisma.studioSocietyWing.create({ data: { societyId, name, flats, possessionOn: input.possession } });
  }
  /* A changed possession date puts a hand-set priority back to automatic (the plan). */
  await prisma.studioSociety.updateMany({ where: { id: societyId, studioId: access.scope.studioId }, data: { priorityOverride: null, priorityReason: null } });
  return { ok: true };
}

/** Put a lead (one this member may edit) in a wing of this society, or no wing. */
export async function setLeadWing(access: SocietyAccess, societyId: string, clientId: string, wingId: string | null): Promise<Result> {
  if (access.scope.member.viewOnly || !can(access.scope.member, 'lead.edit', { assigned: true })) return { ok: false, error: 'You can’t change this lead.' };
  const found = await loadForChange(access, societyId);
  if (!found) return { ok: false, error: NOT_YOURS };
  if (wingId) {
    const w = await prisma.studioSocietyWing.findFirst({ where: { id: wingId, societyId }, select: { id: true } });
    if (!w) return { ok: false, error: 'That wing isn’t in this society.' };
  }
  const r = await prisma.studioClient.updateMany({
    where: { AND: [access.scope.leads, { id: clientId, studioId: access.scope.studioId, societyId, deletedAt: null }] },
    data: { wingId },
  });
  return r.count ? { ok: true } : { ok: false, error: 'That lead isn’t yours to change.' };
}

/** The society names this studio has, for the lead form's suggestions. */
export async function societyNames(studioId: string): Promise<string[]> {
  const rows = await prisma.studioSociety.findMany({ where: { studioId }, select: { name: true }, orderBy: { name: 'asc' }, take: 2000 });
  return rows.map((r) => r.name);
}

/**
 * A lead's society link from its typed society: the studio's society with
 * the same key, or none. Used when a lead is added or its society edited.
 */
export async function societyIdFor(studioId: string, typed: string | null | undefined): Promise<string | null> {
  const key = typed ? societyKey(typed) : '';
  if (!key) return null;
  const s = await prisma.studioSociety.findUnique({ where: { studioId_key: { studioId, key } }, select: { id: true } });
  return s?.id ?? null;
}

export type SocietyAssignMode = 'one' | 'split' | 'first';

/**
 * Give a society's leads out (owner, 11 Nov 2026), three ways:
 * - `one`: every lead to one person, who also becomes the society's owner;
 * - `split`: dealt out equally between two or more people;
 * - `first`: the first N (100, 200, 300, or any number) to one person.
 * `only` = 'unassigned' takes only leads nobody has yet; 'all' takes every
 * lead in the society. The order is wing, then the order they came in (the
 * sheet's order), so "the first 100" is the top of the sheet. Goes through
 * the Leads app's own bulk assign and split, so the same rights apply, each
 * lead's history says who gave it, and the person is told.
 */
export async function assignSocietyLeads(
  access: SocietyAccess,
  societyId: string,
  input: { mode: SocietyAssignMode; memberIds: string[]; count?: number | null; only: 'unassigned' | 'all' },
): Promise<Result<{ message: string }>> {
  if (access.scope.member.viewOnly || !access.mayManage) return { ok: false, error: 'Only an admin or a sales head can give leads out.' };
  const found = await loadForChange(access, societyId);
  if (!found) return { ok: false, error: NOT_YOURS };
  const people = [...new Set(input.memberIds.filter((m) => typeof m === 'string' && m))];
  if (input.mode === 'split' ? people.length < 2 : people.length !== 1) {
    return { ok: false, error: input.mode === 'split' ? 'Pick at least two people to split between.' : 'Pick who gets them.' };
  }
  const count = input.mode === 'first' ? Math.floor(Number(input.count)) : null;
  if (input.mode === 'first' && !(count && count > 0 && count <= 30000)) return { ok: false, error: 'How many? Pick 100, 200, 300 or type a number.' };
  const rows = await prisma.studioClient.findMany({
    where: {
      AND: [access.scope.leads, { studioId: access.scope.studioId, societyId, deletedAt: null }, input.only === 'unassigned' ? { assignedToId: null } : {}],
    },
    select: { id: true, wing: { select: { name: true } } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 30000,
  });
  const ordered = rows
    .map((r, i) => ({ id: r.id, wing: r.wing?.name ?? '￿', i }))
    .sort((a, b) => a.wing.localeCompare(b.wing, 'en', { numeric: true }) || a.i - b.i)
    .map((r) => r.id);
  const ids = count ? ordered.slice(0, count) : ordered;
  if (ids.length === 0) return { ok: false, error: input.only === 'unassigned' ? 'Every lead in this society already has someone.' : 'This society has no leads you can give out.' };
  const r = input.mode === 'split' ? await bulkSplit({ ids }, people) : await bulkAssign({ ids }, people[0]!);
  if (!r.ok) return r;
  if (input.mode === 'one') {
    await prisma.studioSociety.updateMany({ where: { id: societyId, studioId: access.scope.studioId }, data: { assignedToId: people[0]! } });
  }
  return { ok: true, message: r.message };
}

export interface SocietyImportResult {
  societiesNew: number;
  societiesSeen: number;
  wings: number;
  leadsNew: number;
  leadsLinked: number;
  /** Phones already on a lead someone else works, or deleted: left as they are. */
  leadsLeft: number;
  /** What happened to the new leads' owner, in a sentence; null when nothing to say. */
  assigned: string | null;
}

/**
 * Write an agreed society sheet (society-import.ts `planSocietyImport`):
 * societies and wings are created or updated (a possession month in the
 * sheet replaces the wing's; a blank leaves it), owners become leads given
 * to the society's owner, and a phone that is already a lead this person
 * works is linked to the society and wing instead of added twice.
 */
export async function importSocietySheet(access: SocietyAccess, payload: SocietyImportPayload): Promise<Result<SocietyImportResult>> {
  const me = access.scope.member;
  if (me.viewOnly || !access.mayImport) return { ok: false, error: 'Your role does not include importing leads.' };
  const studioId = access.scope.studioId;
  const groups = Array.isArray(payload?.societies) ? payload.societies.slice(0, 200) : [];
  const owners = groups.reduce((n, g) => n + (Array.isArray(g.owners) ? g.owners.length : 0), 0);
  if (groups.length === 0) return { ok: false, error: 'Nothing to import.' };
  if (owners > 5000) return { ok: false, error: 'That is more than five thousand owners. Split the sheet.' };
  let ownerId: string | null = me.id;
  if (payload.ownerId && payload.ownerId !== me.id) {
    if (!access.mayManage) return { ok: false, error: 'Only an admin or a sales head can give societies to someone else.' };
    const ok = await prisma.studioMember.findFirst({ where: { id: payload.ownerId, studioId, status: 'ACTIVE' }, select: { id: true } });
    if (!ok) return { ok: false, error: 'Pick someone in your team.' };
    ownerId = ok.id;
  }
  /* Who gets the new leads (owner, 11 Nov 2026): someone who gives leads out
     picks a salesperson or nobody yet; anyone else's import is their own. */
  const leadsTo = access.mayManage ? (payload.leadsTo === undefined ? ownerId : payload.leadsTo || null) : me.id;
  const newIds: string[] = [];
  const stageId = await intakeStageId();
  if (!stageId) return { ok: false, error: 'Your pipeline has no intake column. Settings → Pipeline.' };
  const sheet = clean(payload.sheet, 120) || 'a society sheet';
  const now = new Date();
  const out: SocietyImportResult = { societiesNew: 0, societiesSeen: 0, wings: 0, leadsNew: 0, leadsLinked: 0, leadsLeft: 0, assigned: null };
  const by = { id: me.id, name: await authorName(me.id) };

  try {
    for (const g of groups) {
      const name = clean(g.name, 120);
      const key = societyKey(name);
      if (!key) continue;
      let society = await prisma.studioSociety.findUnique({ where: { studioId_key: { studioId, key } }, select: { id: true, name: true, assignedToId: true } });
      if (society) {
        out.societiesSeen++;
        await prisma.studioSociety.updateMany({ where: { id: society.id, studioId }, data: { sourceSheet: sheet, sourceImportedAt: now } });
      } else {
        society = await prisma.studioSociety.create({
          data: { studioId, name, key, locality: clean(g.locality, 80) || null, assignedToId: ownerId, sourceSheet: sheet, sourceImportedAt: now },
          select: { id: true, name: true, assignedToId: true },
        });
        out.societiesNew++;
      }
      const wingIds = new Map<string, string>();
      for (const w of (Array.isArray(g.wings) ? g.wings : []).slice(0, 100)) {
        const wn = clean(w.name, 40) || 'Main';
        const pos = w.possession ? parsePossession(w.possession) : null;
        const row = await prisma.studioSocietyWing.upsert({
          where: { societyId_name: { societyId: society.id, name: wn } },
          create: { societyId: society.id, name: wn, possessionOn: pos },
          update: pos ? { possessionOn: pos } : {},
          select: { id: true },
        });
        wingIds.set(wn, row.id);
        out.wings++;
      }

      const list = (Array.isArray(g.owners) ? g.owners : []).map((o) => ({
        name: clean(o.name, 120) || 'Flat owner',
        phone: o.phone ? normalisePhone(String(o.phone)) : null,
        flat: clean(o.flat, 20) || null,
        wingId: wingIds.get(clean(o.wing, 40) || 'Main') ?? null,
      }));
      const phones = list.map((o) => o.phone).filter((p): p is string => !!p);
      const existing = new Map<string, { id: string; deletedAt: Date | null }>();
      for (let i = 0; i < phones.length; i += 1000) {
        const rows = await prisma.studioClient.findMany({ where: { studioId, phone: { in: phones.slice(i, i + 1000) } }, select: { id: true, phone: true, deletedAt: true } });
        for (const r of rows) if (r.phone) existing.set(r.phone, { id: r.id, deletedAt: r.deletedAt });
      }
      const mine = new Set<string>();
      const existingIds = [...existing.values()].filter((e) => !e.deletedAt).map((e) => e.id);
      for (let i = 0; i < existingIds.length; i += 1000) {
        const rows = await prisma.studioClient.findMany({ where: { AND: [access.scope.leads, { id: { in: existingIds.slice(i, i + 1000) } }] }, select: { id: true } });
        for (const r of rows) mine.add(r.id);
      }
      const fresh: typeof list = [];
      for (const o of list) {
        const e = o.phone ? existing.get(o.phone) : undefined;
        if (!e) {
          fresh.push(o);
        } else if (!e.deletedAt && mine.has(e.id)) {
          await prisma.studioClient.update({ where: { id: e.id }, data: { society: society.name, societyId: society.id, wingId: o.wingId } });
          out.leadsLinked++;
        } else {
          out.leadsLeft++;
        }
      }
      for (let i = 0; i < fresh.length; i += 500) {
        const made = await prisma.studioClient.createManyAndReturn({
          data: fresh.slice(i, i + 500).map((o) => ({
            studioId,
            stageId,
            name: o.name,
            phone: o.phone,
            society: society.name,
            societyId: society.id,
            wingId: o.wingId,
            notes: o.flat ? `Flat ${o.flat}` : null,
            source: 'OTHER' as const,
            sourceNote: `Imported from ${sheet}`,
            /* Given out after, through the bulk assign (history line + the person is told). */
            assignedToId: access.mayManage ? null : me.id,
          })),
          skipDuplicates: true,
          select: { id: true },
        });
        out.leadsNew += made.length;
        newIds.push(...made.map((m) => m.id));
        await recordMany(
          made.map((m) => ({ studioId, clientId: m.id, kind: 'CREATED' as const, summary: `Imported from the society sheet ${sheet}` })),
          { by },
        );
      }
    }
    if (access.mayManage && leadsTo && newIds.length) {
      const r = await bulkAssign({ ids: newIds }, leadsTo);
      out.assigned = r.ok ? r.message : `The leads are in, but not given out: ${r.error} Give them out on the society page.`;
    } else if (access.mayManage && newIds.length) {
      out.assigned = 'Nobody has the new leads yet. Give them out on each society’s page.';
    }
    return { ok: true, ...out };
  } catch (error) {
    console.error('importSocietySheet', error);
    return { ok: false, error: 'The import stopped part-way. What was saved is kept; try the rest again.' };
  }
}

/**
 * The writes of the AxLeads import (docs/studio-os/AXLEADS-IMPORT.md).
 * `map.ts` decides everything; this reads what it needs to decide, and then
 * writes exactly the plan it returned.
 *
 * No `server-only` and no `@/lib/prisma`: it runs from a laptop script
 * (`scripts/import-axleads.ts`) against whatever DATABASE_URL the owner gives
 * it, so the client is passed in. It never sends anything to anybody — no
 * invite, no WhatsApp, no SMS, no email. People it adds are INVITED with no
 * message; the owner sends invites from Settings → Team when ready.
 *
 * ## Batches, and running it twice
 *
 * New cards are written 200 at a time, each batch in one transaction with
 * every history line of those leads, so a batch is all there or not at all.
 * Merges follow, in batches of their own. Every card carries the AxLeads id
 * (`importedFrom` + `externalId`, unique per studio) and every history line
 * its `externalId`, so a run that stopped halfway is finished by running it
 * again: what was written is read back as "already imported" and skipped.
 */

import { Prisma, type PrismaClient } from '@prisma/client';
import { normalisePhone } from '@/modules/studio/phone';
import { normalisePhone as clientPhone } from '@/modules/studio-practice/csv';
import type { AdColumns } from '@/modules/studio-intake/payloads';
import { checkReportsTo } from '@/modules/studio/sales-access';
import { builtInSalesRoleRows } from '@/modules/studio/sales-permissions';
import {
  IMPORTED_FROM,
  markerId,
  norm,
  planImport,
  teamPoolLabel,
  type AxExport,
  type Choices,
  type ClientPlan,
  type EventPlan,
  type ExistingClient,
  type ImportedRef,
  type LeadPlan,
  type MemberPlan,
  type MemberRef,
  type PersonRef,
  type Plan,
  type StudioContext,
  type UserRef,
} from './map';

const BATCH = 200;
const IN_CHUNK = 1000;
/** The externalId prefix of the line a re-run writes when it moves a card into the team pool; not "touched". */
export const POOL_LINE = 'axleads:pool:';

export interface ImportOutcome {
  plan: Plan;
  /** The roles file's problems (plan.salesTeam.problems): when there are any, a real run writes nothing. */
  blocked: string[];
  written: null | {
    members: number;
    membersRefused: { name: string; reason: string }[];
    fields: number;
    leadSources: number;
    created: number;
    merged: number;
    backfilled: number;
    events: number;
    /** Sales side (owner, 22 Oct 2026). */
    salesRolesMade: string[];
    salesRolesSet: number;
    reportsToSet: number;
    salesRefused: { name: string; reason: string }[];
    poolMoves: number;
  };
}

/** The ad columns (22 Oct 2026) as Prisma data: only what AxLeads knew, `utm` as JSON. */
function adData(a: AdColumns | null): Partial<Record<Exclude<keyof AdColumns, 'utm'>, string>> & { utm?: Prisma.InputJsonValue } {
  if (!a) return {};
  const { utm, ...rest } = a;
  const out: Partial<Record<Exclude<keyof AdColumns, 'utm'>, string>> & { utm?: Prisma.InputJsonValue } = {};
  for (const [k, v] of Object.entries(rest) as [Exclude<keyof AdColumns, 'utm'>, string | null][]) if (v !== null) out[k] = v;
  if (utm) out.utm = utm;
  return out;
}

function chunks<T>(rows: readonly T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += n) out.push(rows.slice(i, i + n));
  return out;
}

/** Everything `planImport` needs from the studio. Reads only. */
export async function loadContext(db: PrismaClient, studioId: string, ax: AxExport): Promise<StudioContext> {
  const [stages, fields, leadSources, members] = await Promise.all([
    db.studioStage.findMany({ where: { studioId }, select: { id: true, name: true, kind: true, isIntake: true, sortOrder: true } }),
    db.studioField.findMany({ where: { studioId }, orderBy: { sortOrder: 'asc' }, select: { key: true, label: true, type: true, options: true } }),
    db.studioLeadSource.findMany({ where: { studioId }, select: { id: true, name: true } }),
    db.studioMember.findMany({ where: { studioId }, select: { id: true, role: true, status: true, salesRoleId: true, reportsToId: true, user: { select: { name: true, phone: true, email: true } } } }),
  ]);
  const salesRoles = await db.studioSalesRole.findMany({ where: { studioId }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, name: true, system: true, permissions: true } });

  // Users behind the AxLeads members' numbers and addresses, for the Team rules.
  const phones = [...new Set(ax.members.map((m) => normalisePhone(m.phone ?? '')).filter((p): p is string => !!p))];
  const emails = [...new Set(ax.members.map((m) => (m.email ?? '').trim().toLowerCase()).filter(Boolean))];
  const userSelect = { id: true, role: true, deletedAt: true, phone: true, email: true, studioMember: { select: { studioId: true } } } as const;
  const users = await db.user.findMany({ where: { OR: [{ phone: { in: phones } }, { email: { in: emails, mode: 'insensitive' } }] }, select: userSelect });
  const ref = (u: (typeof users)[number]): UserRef => ({ id: u.id, role: u.role, deleted: u.deletedAt !== null, studioId: u.studioMember?.studioId ?? null });
  const usersByPhone = new Map(users.filter((u) => u.phone).map((u) => [u.phone!, ref(u)]));
  const usersByEmail = new Map(users.filter((u) => u.email).map((u) => [u.email!.toLowerCase(), ref(u)]));

  // Cards already on the board with the numbers in the file.
  const leadPhones = [...new Set(ax.leads.map((l) => clientPhone(l.phone ?? l.contact?.phone ?? '')).filter((p): p is string => !!p))];
  const existingByPhone = new Map<string, ExistingClient>();
  for (const part of chunks(leadPhones, IN_CHUNK)) {
    const rows = await db.studioClient.findMany({
      where: { studioId, phone: { in: part }, deletedAt: null, isDemo: false },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, phone: true, assignedToId: true, email: true, locality: true, society: true, config: true, carpetSqft: true, budgetPaise: true, notes: true, tags: true, leadgenId: true, campaignId: true, gclid: true, adPlatform: true },
    });
    for (const r of rows) {
      if (!r.phone || existingByPhone.has(r.phone)) continue;
      const { leadgenId, campaignId, gclid, adPlatform, ...rest } = r;
      /* A card that already has an ad keeps it: a merge does not replace it (22 Oct 2026). */
      existingByPhone.set(r.phone, { ...rest, budgetPaise: r.budgetPaise === null ? null : Number(r.budgetPaise), attributed: Boolean(leadgenId || campaignId || gclid || adPlatform) });
    }
  }

  // What an earlier run already wrote: a card with the id, or the marker line of a merge.
  const imported = new Map<string, ImportedRef>();
  const ids = ax.leads.map((l) => l.id);
  for (const part of chunks(ids, IN_CHUNK)) {
    const cards = await db.studioClient.findMany({ where: { studioId, importedFrom: IMPORTED_FROM, externalId: { in: part } }, select: { id: true, externalId: true, assignedToId: true, poolTeamId: true } });
    for (const c of cards) imported.set(c.externalId!, { clientId: c.id, assignedToId: c.assignedToId, poolTeamId: c.poolTeamId, fromImport: true, touched: true });
    const markers = await db.studioClientEvent.findMany({ where: { studioId, externalId: { in: part.map(markerId) } }, select: { externalId: true, clientId: true, createdAt: true, client: { select: { assignedToId: true, poolTeamId: true } } } });
    const markedAt = new Map<string, Date>();
    for (const m of markers) {
      const axId = m.externalId!.slice(markerId('').length);
      markedAt.set(m.clientId, m.createdAt);
      if (!imported.has(axId)) imported.set(axId, { clientId: m.clientId, assignedToId: m.client.assignedToId, poolTeamId: m.client.poolTeamId, fromImport: false, touched: true });
    }
    /* "Touched since the import" (owner, 22 Oct 2026): any history line later
       than the card's import line, except the team-pool line a re-run writes.
       Asked only for cards still nobody's; a card with no import line reads
       as touched, so it is never moved. */
    const open = cards.filter((c) => !c.assignedToId && markedAt.has(c.id)).map((c) => c.id);
    for (const ids2 of chunks(open, IN_CHUNK)) {
      const latest = await db.studioClientEvent.groupBy({
        by: ['clientId'],
        where: { studioId, clientId: { in: ids2 }, OR: [{ externalId: null }, { NOT: { externalId: { startsWith: POOL_LINE } } }] },
        _max: { createdAt: true },
      });
      const last = new Map(latest.map((g) => [g.clientId, g._max.createdAt]));
      const asked = new Set(ids2);
      for (const c of cards) {
        if (!asked.has(c.id)) continue;
        const l = last.get(c.id);
        imported.get(c.externalId!)!.touched = !!l && l.getTime() > markedAt.get(c.id)!.getTime();
      }
    }
  }

  return {
    studioId,
    stages,
    fields,
    leadSources,
    members: members.map((m) => ({ id: m.id, role: m.role, status: m.status, name: m.user.name || m.user.email || m.user.phone || 'Someone', phone: m.user.phone, email: m.user.email, salesRoleId: m.salesRoleId, reportsToId: m.reportsToId })),
    usersByPhone,
    usersByEmail,
    existingByPhone,
    imported,
    salesRoles,
  };
}

/**
 * Plan, and — unless `dryRun` — write. Returns the plan either way, so the
 * runner prints the same report for both.
 */
export async function runImport(db: PrismaClient, input: { studioId: string; ax: AxExport; choices: Choices; dryRun: boolean; now?: Date }): Promise<ImportOutcome> {
  const now = input.now ?? new Date();
  const ctx = await loadContext(db, input.studioId, input.ax);
  const plan = planImport(input.ax, ctx, input.choices, { now });
  const blocked = plan.salesTeam.problems;
  /* A roles file that asks for what cannot be done writes nothing at all —
     not the leads either: a half-applied team (Khushi with no boss, the pool
     leads in the wrong pool) is harder to put right than a re-run. */
  if (input.dryRun || blocked.length) return { plan, blocked, written: null };

  const studioId = input.studioId;
  const owner = await db.studioMember.findFirst({ where: { studioId, role: 'OWNER', status: 'ACTIVE' }, orderBy: { createdAt: 'asc' }, select: { id: true } });
  const team = plan.salesTeam;
  const BY = 'scripts/import-axleads.ts';

  // 0. Sales roles (owner, 22 Oct 2026): the built-ins this studio may predate,
  //    with the same rows provision.ts and the Roles tab write, then the file's own.
  const salesRolesMade: string[] = [];
  if (team.uses) {
    await db.studioSalesRole.createMany({ data: builtInSalesRoleRows(studioId), skipDuplicates: true });
    for (const r of team.rolesToCreate) {
      const count = await db.studioSalesRole.count({ where: { studioId } });
      const made = await db.studioSalesRole.createManyAndReturn({
        data: [{ studioId, name: r.name, description: `Made by the AxLeads import: ${r.from}${r.added.length ? ` plus ${r.added.join(', ')}` : ''}.`, permissions: r.permissions as Prisma.InputJsonValue, sortOrder: 10 + count }],
        skipDuplicates: true,
        select: { id: true },
      });
      if (!made[0]) continue; // made a moment ago under that name: used as it is
      salesRolesMade.push(r.name);
      await db.auditLog.create({ data: { actorId: null, action: 'studio.salesRole.create', entityType: 'StudioSalesRole', entityId: made[0].id, after: { name: r.name, permissions: r.permissions, from: r.from, by: BY } } });
    }
  }
  const roleRows = team.uses ? await db.studioSalesRole.findMany({ where: { studioId }, select: { id: true, name: true } }) : [];
  const roleId = (name: string): string | null => roleRows.find((r) => norm(r.name) === norm(name))?.id ?? null;
  const lineOf = new Map(team.lines.map((l) => [l.axUserId, l]));

  // 1. People. One transaction each, like Settings → Team; a clash refuses that person only.
  const newMember = new Map<string, string>(); // AxLeads user id → our member id
  const membersRefused: { name: string; reason: string }[] = [];
  let salesRolesSet = 0;
  for (const m of plan.members.filter((p): p is Extract<MemberPlan, { kind: 'create' }> => p.kind === 'create')) {
    /* Their sales role goes on with them; never on anyone but a salesperson. */
    const line = lineOf.get(m.ax.userId);
    const salesRoleId = m.role === 'SALES' && line?.salesRole ? roleId(line.salesRole.name) : null;
    try {
      const id = await db.$transaction(async (tx) => {
        /* A login that already exists keeps its name: the roles file's `name` names a new one only. */
        const userId = m.reuseUserId ?? (await tx.user.create({ data: { phone: m.phone, name: m.name, email: m.email, role: 'STUDIO' }, select: { id: true } })).id;
        const member = await tx.studioMember.create({
          data: {
            studioId,
            userId,
            role: m.role,
            /* INVITED until they first sign in. No invite is sent and none is
               recorded as sent (invitedAt stays empty): the owner sends it
               from Settings → Team when they are ready. */
            status: 'INVITED',
            isOwner: m.role === 'OWNER',
            invitedById: owner?.id ?? null,
            salesRoleId,
          },
          select: { id: true },
        });
        await tx.auditLog.create({
          data: { actorId: null, action: 'studio.member.import', entityType: 'StudioMember', entityId: member.id, after: { role: m.role, from: 'axleads', axleadsUserId: m.ax.userId, inviteSent: false, salesRoleId } },
        });
        return member.id;
      });
      newMember.set(m.ax.userId, id);
      if (salesRoleId) salesRolesSet += 1;
    } catch (error) {
      const code = (error as { code?: string }).code;
      membersRefused.push({ name: m.name, reason: code === 'P2002' ? 'That number or member was just added elsewhere.' : String((error as Error).message ?? error).slice(0, 200) });
    }
  }
  const memberId = (ref: PersonRef['member']): string | null => (!ref ? null : ref.kind === 'existing' ? ref.id : newMember.get(ref.axUserId) ?? null);

  // 1b. People already on the team: their sales role only when the file names one, and only if it changes.
  const salesRefused: { name: string; reason: string }[] = [];
  for (const line of team.lines) {
    if (line.member.kind !== 'existing' || !line.salesRole || line.salesRole.change === 'same') continue;
    const to = roleId(line.salesRole.name);
    if (!to) {
      salesRefused.push({ name: line.who, reason: `the role "${line.salesRole.name}" was not found` });
      continue;
    }
    const id = line.member.id;
    const before = ctx.members.find((s) => s.id === id)?.salesRoleId ?? null;
    const r = await db.studioMember.updateMany({ where: { id: line.member.id, studioId, role: 'SALES' }, data: { salesRoleId: to } });
    if (!r.count) {
      salesRefused.push({ name: line.who, reason: 'no longer a salesperson on this team' });
      continue;
    }
    salesRolesSet += 1;
    await db.auditLog.create({ data: { actorId: null, action: 'studio.member.salesRole', entityType: 'StudioMember', entityId: line.member.id, after: { from: before, to, by: BY } } });
  }

  // 1c. Reporting lines, after everyone exists: the tree read and written in one
  //     serializable transaction, each line checked like Settings → Team does.
  let reportsToSet = 0;
  const wanted = team.lines.filter((l) => l.reportsTo && l.reportsTo.change !== 'same');
  if (wanted.length) {
    const done = await db.$transaction(
      async (tx) => {
        const tree = await tx.studioMember.findMany({ where: { studioId }, select: { id: true, studioId: true, role: true, reportsToId: true } });
        const changed: { id: string; from: string | null; to: string | null }[] = [];
        for (const line of wanted) {
          const me = memberId(line.member);
          const boss = memberId(line.reportsTo!.to as MemberRef);
          if (!me || !boss) {
            salesRefused.push({ name: line.who, reason: `reports to ${line.reportsTo!.name}: ${!me ? 'they' : 'that person'} could not be added` });
            continue;
          }
          const check = checkReportsTo(me, boss, tree);
          if (!check.ok) {
            salesRefused.push({ name: line.who, reason: `reports to ${line.reportsTo!.name}: ${check.error}` });
            continue;
          }
          const row = tree.find((t) => t.id === me)!;
          if (row.reportsToId === check.reportsToId) continue;
          await tx.studioMember.updateMany({ where: { id: me, studioId, role: 'SALES' }, data: { reportsToId: check.reportsToId } });
          changed.push({ id: me, from: row.reportsToId, to: check.reportsToId });
          row.reportsToId = check.reportsToId;
        }
        return changed;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000 },
    );
    reportsToSet = done.length;
    for (const c of done) await db.auditLog.create({ data: { actorId: null, action: 'studio.member.reportsTo', entityType: 'StudioMember', entityId: c.id, after: { from: c.from, to: c.to, by: BY } } });
  }
  const byOf = (by: PersonRef | null) => {
    if (!by) return { actor: 'SYSTEM' as const, byId: null, byName: null };
    return { actor: 'MEMBER' as const, byId: memberId(by.member), byName: by.name };
  };

  // 2. The studio's fields and source names this import needs.
  let fields = 0;
  if (plan.fieldsToCreate.length) {
    const last = await db.studioField.aggregate({ where: { studioId }, _max: { sortOrder: true } });
    const start = (last._max.sortOrder ?? -1) + 1;
    const r = await db.studioField.createMany({
      data: plan.fieldsToCreate.map((f, i) => ({ studioId, key: f.key, label: f.label, type: f.type, options: f.options, groupBy: f.groupBy, sortOrder: start + i })),
      skipDuplicates: true,
    });
    fields = r.count;
  }
  let leadSources = 0;
  if (plan.leadSourcesToCreate.length) {
    const r = await db.studioLeadSource.createMany({ data: plan.leadSourcesToCreate.map((name) => ({ studioId, name })), skipDuplicates: true });
    leadSources = r.count;
  }
  const sources = await db.studioLeadSource.findMany({ where: { studioId }, select: { id: true, name: true } });
  const sourceId = new Map(sources.map((s) => [s.name.toLowerCase(), s.id]));

  const eventRow = (clientId: string, e: EventPlan): Prisma.StudioClientEventCreateManyInput => ({
    studioId,
    clientId,
    kind: e.kind,
    ...byOf(e.by),
    summary: e.summary,
    meta: e.meta as Prisma.InputJsonValue,
    externalId: e.externalId,
    createdAt: e.createdAt,
  });
  const clientRow = (axId: string, c: ClientPlan): Prisma.StudioClientCreateManyInput => ({
    studioId,
    stageId: c.stageId,
    name: c.name,
    phone: c.phone,
    email: c.email,
    society: c.society,
    locality: c.locality,
    city: c.city,
    config: c.config,
    carpetSqft: c.carpetSqft,
    budgetPaise: c.budgetPaise === null ? null : BigInt(c.budgetPaise),
    source: c.source,
    leadSourceId: c.ownSource ? sourceId.get(c.ownSource.toLowerCase()) ?? null : null,
    sourceNote: c.sourceNote,
    lostReason: c.lostReason,
    lostNote: c.lostNote,
    fields: c.fields,
    notes: c.notes,
    nextAction: c.nextAction,
    nextActionOn: c.nextActionOn,
    assignedToId: memberId(c.assignee),
    /* Nobody's: the roles file's team pool when it named one (22 Oct 2026), else the studio pool. */
    poolTeamId: c.assignee ? null : memberId(c.poolTeam),
    lastContactedAt: c.lastContactedAt,
    tags: c.tags,
    createdAt: c.createdAt,
    deletedAt: c.deletedAt,
    importedFrom: IMPORTED_FROM,
    externalId: axId,
    ...adData(c.ads),
  });

  // 3. New cards, with their history.
  const creates = plan.leads.filter((l): l is Extract<LeadPlan, { action: 'create' }> => l.action === 'create');
  const cardOf = new Map<string, string>(); // AxLeads lead id → our client id
  let created = 0;
  let events = 0;
  for (const batch of chunks(creates, BATCH)) {
    const r = await db.$transaction(
      async (tx) => {
        const made = await tx.studioClient.createManyAndReturn({ data: batch.map((l) => clientRow(l.axId, l.client)), skipDuplicates: true, select: { id: true, externalId: true } });
        const ids = new Map(made.map((m) => [m.externalId!, m.id]));
        const rows = batch.flatMap((l) => (ids.has(l.axId) ? l.events.map((e) => eventRow(ids.get(l.axId)!, e)) : []));
        let n = 0;
        for (const part of chunks(rows, 2000)) n += (await tx.studioClientEvent.createMany({ data: part, skipDuplicates: true })).count;
        return { ids, n };
      },
      { timeout: 120_000, maxWait: 30_000 },
    );
    for (const [ax, id] of r.ids) cardOf.set(ax, id);
    created += r.ids.size;
    events += r.n;
  }

  // 4. Merges: history appended, blanks filled. A file merge whose card was not written this run (it already existed) is looked up.
  const merges = plan.leads.filter((l): l is Extract<LeadPlan, { action: 'merge-existing' | 'merge-file' }> => l.action === 'merge-existing' || l.action === 'merge-file');
  let merged = 0;
  for (const batch of chunks(merges, BATCH)) {
    const n = await db.$transaction(
      async (tx) => {
        let lines = 0;
        for (const l of batch) {
          const clientId = l.action === 'merge-existing' ? l.clientId : cardOf.get(l.intoAxId);
          if (!clientId) continue;
          if (l.action === 'merge-existing') {
            const f = l.fill;
            const assignedToId = f.assignee ? memberId(f.assignee) : undefined;
            await tx.studioClient.update({
              where: { id: clientId },
              data: {
                ...(f.email ? { email: f.email } : {}),
                ...(f.locality ? { locality: f.locality } : {}),
                ...(f.society ? { society: f.society } : {}),
                ...(f.config ? { config: f.config } : {}),
                ...(f.carpetSqft != null ? { carpetSqft: f.carpetSqft } : {}),
                ...(f.budgetPaise != null ? { budgetPaise: BigInt(f.budgetPaise) } : {}),
                ...(assignedToId ? { assignedToId } : {}),
                ...(f.tags ? { tags: f.tags } : {}),
                ...(f.notes !== undefined ? { notes: f.notes } : {}),
                ...adData(f.ads ?? null),
              },
            });
          }
          lines += (await tx.studioClientEvent.createMany({ data: l.events.map((e) => eventRow(clientId, e)), skipDuplicates: true })).count;
        }
        return lines;
      },
      { timeout: 120_000, maxWait: 30_000 },
    );
    merged += batch.length;
    events += n;
  }

  // 5. A second run: leads still in the pool whose person has since been matched.
  let backfilled = 0;
  for (const l of plan.leads) {
    if (l.action !== 'already' || !l.backfill) continue;
    const to = memberId(l.backfill);
    if (!to) continue;
    const r = await db.studioClient.updateMany({ where: { id: l.clientId, studioId, assignedToId: null }, data: { assignedToId: to } });
    if (r.count) {
      backfilled += 1;
      const name = await db.studioMember.findUnique({ where: { id: to }, select: { user: { select: { name: true } } } });
      await db.studioClientEvent.create({ data: { studioId, clientId: l.clientId, kind: 'ASSIGNED', actor: 'SYSTEM', summary: `Given to ${name?.user.name ?? 'their person'} (from AxLeads, on a second import)`, meta: { toMemberId: to, axleads: { backfill: true } } } });
    }
  }

  // 6. A re-run with poolTeam: imported cards still nobody's and untouched since, into the team pool.
  let poolMoves = 0;
  const head = team.poolTeam ? memberId(team.poolTeam.member) : null;
  if (head) {
    const headName = team.poolTeam!.name;
    for (const l of plan.leads) {
      if (l.action !== 'already' || !l.pool) continue;
      const r = await db.studioClient.updateMany({ where: { id: l.clientId, studioId, assignedToId: null }, data: { poolTeamId: head } });
      if (!r.count) continue;
      poolMoves += 1;
      await db.studioClientEvent.create({
        data: {
          studioId,
          clientId: l.clientId,
          kind: 'IMPORTED',
          actor: 'SYSTEM',
          summary: `Moved to ${teamPoolLabel(headName)} (AxLeads import, a second run)`,
          meta: { poolTeamId: head, axleads: { poolMove: true } },
          /* Not "touched": loadContext leaves lines with this prefix out, so a later run can still move it. */
          externalId: `${POOL_LINE}${l.clientId}:${now.getTime()}`,
        },
      });
    }
  }

  const written = { members: newMember.size, membersRefused, fields, leadSources, created, merged, backfilled, events, salesRolesMade, salesRolesSet, reportsToSet, salesRefused, poolMoves };
  await db.auditLog.create({
    data: {
      /* Nobody signed in: the owner ran a script with database access. The
         row says what ran rather than crediting a person it cannot prove. */
      actorId: null,
      action: 'studio.import.axleads',
      entityType: 'Studio',
      entityId: studioId,
      after: {
        by: 'scripts/import-axleads.ts',
        tenant: input.ax.tenant.slug,
        exportedAt: input.ax.exportedAt,
        leadsInFile: plan.report.leadsInFile,
        already: plan.report.already,
        ...written,
        membersRefused: membersRefused.length + plan.members.filter((m) => m.kind === 'refused').length,
        salesRefused: salesRefused.length,
        poolTeamId: head,
        perPool: plan.report.perPool,
      },
    },
  });
  return { plan, blocked, written };
}

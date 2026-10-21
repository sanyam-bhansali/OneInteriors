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

import type { Prisma, PrismaClient } from '@prisma/client';
import { normalisePhone } from '@/modules/studio/phone';
import { normalisePhone as clientPhone } from '@/modules/studio-practice/csv';
import { IMPORTED_FROM, markerId, planImport, type AxExport, type Choices, type ClientPlan, type EventPlan, type ExistingClient, type LeadPlan, type MemberPlan, type PersonRef, type Plan, type StudioContext, type UserRef } from './map';

const BATCH = 200;
const IN_CHUNK = 1000;

export interface ImportOutcome {
  plan: Plan;
  written: null | {
    members: number;
    membersRefused: { name: string; reason: string }[];
    fields: number;
    leadSources: number;
    created: number;
    merged: number;
    backfilled: number;
    events: number;
  };
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
    db.studioMember.findMany({ where: { studioId }, select: { id: true, role: true, status: true, user: { select: { name: true, phone: true, email: true } } } }),
  ]);

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
      select: { id: true, name: true, phone: true, assignedToId: true, email: true, locality: true, society: true, config: true, carpetSqft: true, budgetPaise: true, notes: true, tags: true },
    });
    for (const r of rows) {
      if (!r.phone || existingByPhone.has(r.phone)) continue;
      existingByPhone.set(r.phone, { ...r, budgetPaise: r.budgetPaise === null ? null : Number(r.budgetPaise) });
    }
  }

  // What an earlier run already wrote: a card with the id, or the marker line of a merge.
  const imported = new Map<string, { clientId: string; assignedToId: string | null }>();
  const ids = ax.leads.map((l) => l.id);
  for (const part of chunks(ids, IN_CHUNK)) {
    const cards = await db.studioClient.findMany({ where: { studioId, importedFrom: IMPORTED_FROM, externalId: { in: part } }, select: { id: true, externalId: true, assignedToId: true } });
    for (const c of cards) imported.set(c.externalId!, { clientId: c.id, assignedToId: c.assignedToId });
    const markers = await db.studioClientEvent.findMany({ where: { studioId, externalId: { in: part.map(markerId) } }, select: { externalId: true, clientId: true, client: { select: { assignedToId: true } } } });
    for (const m of markers) {
      const axId = m.externalId!.slice(markerId('').length);
      if (!imported.has(axId)) imported.set(axId, { clientId: m.clientId, assignedToId: m.client.assignedToId });
    }
  }

  return {
    studioId,
    stages,
    fields,
    leadSources,
    members: members.map((m) => ({ id: m.id, role: m.role, status: m.status, name: m.user.name || m.user.email || m.user.phone || 'Someone', phone: m.user.phone, email: m.user.email })),
    usersByPhone,
    usersByEmail,
    existingByPhone,
    imported,
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
  if (input.dryRun) return { plan, written: null };

  const studioId = input.studioId;
  const owner = await db.studioMember.findFirst({ where: { studioId, role: 'OWNER', status: 'ACTIVE' }, orderBy: { createdAt: 'asc' }, select: { id: true } });

  // 1. People. One transaction each, like Settings → Team; a clash refuses that person only.
  const newMember = new Map<string, string>(); // AxLeads user id → our member id
  const membersRefused: { name: string; reason: string }[] = [];
  for (const m of plan.members.filter((p): p is Extract<MemberPlan, { kind: 'create' }> => p.kind === 'create')) {
    try {
      const id = await db.$transaction(async (tx) => {
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
          },
          select: { id: true },
        });
        await tx.auditLog.create({
          data: { actorId: null, action: 'studio.member.import', entityType: 'StudioMember', entityId: member.id, after: { role: m.role, from: 'axleads', axleadsUserId: m.ax.userId, inviteSent: false } },
        });
        return member.id;
      });
      newMember.set(m.ax.userId, id);
    } catch (error) {
      const code = (error as { code?: string }).code;
      membersRefused.push({ name: m.name, reason: code === 'P2002' ? 'That number or member was just added elsewhere.' : String((error as Error).message ?? error).slice(0, 200) });
    }
  }
  const memberId = (ref: PersonRef['member']): string | null => (!ref ? null : ref.kind === 'existing' ? ref.id : newMember.get(ref.axUserId) ?? null);
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
    lastContactedAt: c.lastContactedAt,
    tags: c.tags,
    createdAt: c.createdAt,
    deletedAt: c.deletedAt,
    importedFrom: IMPORTED_FROM,
    externalId: axId,
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

  const written = { members: newMember.size, membersRefused, fields, leadSources, created, merged, backfilled, events };
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
      },
    },
  });
  return { plan, written };
}

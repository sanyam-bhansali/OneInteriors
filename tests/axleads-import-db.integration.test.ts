import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

/**
 * The AxLeads import against the LOCAL throwaway test database only (PGlite
 * on 127.0.0.1:54329; docs/studio-os/AXLEADS-IMPORT.md). Skipped in the
 * normal suite. Needs migration 20261021110000_axleads_import applied there.
 * Run on its own, never beside another DB script:
 *
 *   AXLEADS_IMPORT_TEST_DB=1 DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54329/postgres?sslmode=disable&connection_limit=1&pgbouncer=true' \
 *     npx vitest run tests/axleads-import-db.integration.test.ts
 *
 * Imports the FAKE export (tests/fixtures/axleads-export.fake.json) into the
 * seeded Hauspire studio with fresh ids and random numbers each run, so it
 * can be run again: dry run writes nothing, the real run writes the cards,
 * history and one invited member, a second run writes nothing, and nothing
 * is ever sent.
 */

const RUN = process.env.AXLEADS_IMPORT_TEST_DB === '1';
const URL_OK = (process.env.DATABASE_URL ?? '').includes('127.0.0.1:54329');
if (RUN && !URL_OK) throw new Error('Test database only: DATABASE_URL must point at 127.0.0.1:54329.');

const sent = vi.hoisted(() => ({ count: 0 }));
vi.mock('@/modules/messaging/sender', () => ({
  send: async () => {
    sent.count += 1;
    return { delivered: false, via: 'none' };
  },
}));

const SLUG = 'hauspire-luxury-design-studio';
const TAG = String(Date.now()).slice(-8);
const rnd = () => `90${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;

/** The fixture with this run's own ids and numbers (the owner's number stays: it is the seeded fake owner). */
function fixture(): unknown {
  let text = readFileSync(join(__dirname, 'fixtures/axleads-export.fake.json'), 'utf8');
  text = text.split('00000000-0000-4000-').join(`${TAG}-0000-4000-`);
  const lead1 = rnd();
  const swap: Record<string, string> = { '9000000101': lead1, '9000000102': rnd(), '9000000105': rnd(), '9000000106': rnd(), '9000000107': rnd(), '9000000011': rnd(), '9000000013': rnd() };
  text = text.replace(/90000 00105/g, '9000000105');
  for (const [from, to] of Object.entries(swap)) text = text.split(from).join(to);
  return JSON.parse(text);
}

let prisma: PrismaClient | null = null;
afterAll(async () => {
  await prisma?.$disconnect();
});

describe.skipIf(!RUN)('AxLeads import (test database)', () => {
  const raw = fixture();

  it('dry run writes nothing; the real run writes; a second run writes nothing', async () => {
    const { PrismaClient: Client } = await import('@prisma/client');
    prisma = new Client();
    const { parseChoices, parseExport, IMPORTED_FROM, markerId } = await import('@/modules/studio-import-axleads/map');
    const { runImport } = await import('@/modules/studio-import-axleads/import');
    const studio = await prisma.studio.findUniqueOrThrow({ where: { slug: SLUG }, select: { id: true } });
    const parsed = parseExport(raw);
    if (!parsed.ok) throw new Error(parsed.error);
    const choices = parseChoices(undefined);
    if (!choices.ok) throw new Error(choices.error);
    const ax = parsed.data;
    const ids = ax.leads.map((l) => l.id);

    const counts = async () => ({
      clients: await prisma!.studioClient.count({ where: { studioId: studio.id } }),
      events: await prisma!.studioClientEvent.count({ where: { studioId: studio.id } }),
      members: await prisma!.studioMember.count({ where: { studioId: studio.id } }),
      audits: await prisma!.auditLog.count({ where: { action: 'studio.import.axleads', entityId: studio.id } }),
    });

    const before = await counts();
    const dry = await runImport(prisma, { studioId: studio.id, ax, choices: choices.choices, dryRun: true });
    expect(dry.written).toBeNull();
    expect(dry.plan.report).toMatchObject({ leadsInFile: 7, create: 6, mergeFile: 1, already: 0 });
    expect(await counts()).toEqual(before);

    const real = await runImport(prisma, { studioId: studio.id, ax, choices: choices.choices, dryRun: false });
    expect(real.written).toMatchObject({ created: 6, merged: 1, members: 1 });
    const after = await counts();
    expect(after.clients - before.clients).toBe(6);
    expect(after.members - before.members).toBe(1);
    expect(after.audits - before.audits).toBe(1);

    const cards = await prisma.studioClient.findMany({
      where: { studioId: studio.id, importedFrom: IMPORTED_FROM, externalId: { in: ids } },
      select: { externalId: true, name: true, stage: { select: { name: true, kind: true } }, lostReason: true, deletedAt: true, assignedTo: { select: { status: true, role: true } }, createdAt: true, notes: true, _count: { select: { events: true } } },
    });
    expect(cards).toHaveLength(6);
    const one = cards.find((c) => c.name === 'Test Lead 1')!;
    expect(one.stage.name).toBe('Calling 1');
    expect(one.assignedTo).toEqual({ status: 'INVITED', role: 'SALES' });
    expect(one.createdAt.toISOString()).toBe('2026-03-01T04:00:00.000Z');
    expect(one.notes).toMatch(/Merged from AxLeads: Test Lead 3/);
    expect(cards.find((c) => c.name === 'Test Lead Two')).toMatchObject({ stage: { kind: 'LOST' }, lostReason: 'NOT_SERIOUS' });
    expect(cards.find((c) => c.name === 'lead4')?.deletedAt).not.toBeNull();

    // Original times on the history; the merged lead's marker line on lead 1's card.
    const call = await prisma.studioClientEvent.findFirst({ where: { studioId: studio.id, externalId: `axleads:${ax.leads[0]!.activities[3]!.id}` }, select: { kind: true, createdAt: true, byName: true } });
    expect(call).toMatchObject({ kind: 'CONTACTED', byName: 'Test Agent A' });
    expect(call?.createdAt.toISOString()).toBe('2026-03-02T06:00:00.000Z');
    expect(await prisma.studioClientEvent.count({ where: { studioId: studio.id, externalId: markerId(ax.leads[2]!.id) } })).toBe(1);

    // The member was added without an invite.
    const member = await prisma.studioMember.findFirst({ where: { studioId: studio.id, user: { phone: `+91${ax.members[1]!.phone!.slice(-10)}` } }, select: { status: true, invitedAt: true } });
    expect(member).toEqual({ status: 'INVITED', invitedAt: null });

    const again = await runImport(prisma, { studioId: studio.id, ax, choices: choices.choices, dryRun: false });
    expect(again.plan.report).toMatchObject({ create: 0, mergeFile: 0, mergeExisting: 0, already: 7 });
    expect(again.written).toMatchObject({ created: 0, merged: 0, members: 0, events: 0 });
    const last = await counts();
    expect(last.clients).toBe(after.clients);
    expect(last.events).toBe(after.events);

    expect(sent.count).toBe(0);
  }, 120_000);
});

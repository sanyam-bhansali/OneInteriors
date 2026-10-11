import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The Plan tab's writes (modules/project/plan-edit.ts) against a mocked
 * Prisma and session, through the real access layer (studio/access.ts):
 * a reason is required to move a date, date changes are only ever created,
 * one move writes its rows with one `at` and its note only once, a late
 * decision becomes customer delay, and the brief's table holds — owner and
 * assigned PM move dates, a supervisor ticks but never moves a date, an
 * unassigned PM cannot even see the project. The step tracker: steps move
 * with their stage, only the owner or PM edits or unticks them, a ticked
 * step is never removed, and a stage settles on its in-scope steps.
 *
 * Studio s1: owner, PM and supervisor (both assigned to p1, not p2).
 */

type Role = 'OWNER' | 'PM' | 'SUPERVISOR' | 'ACCOUNTS';

const db = vi.hoisted(() => {
  const members: Record<string, { id: string; studioId: string; userId: string; role: Role; status: 'ACTIVE' }> = {
    'u-owner': { id: 'm-owner', studioId: 's1', userId: 'u-owner', role: 'OWNER', status: 'ACTIVE' },
    'u-pm': { id: 'm-pm', studioId: 's1', userId: 'u-pm', role: 'PM', status: 'ACTIVE' },
    'u-sup': { id: 'm-sup', studioId: 's1', userId: 'u-sup', role: 'SUPERVISOR', status: 'ACTIVE' },
    'u-acc': { id: 'm-acc', studioId: 's1', userId: 'u-acc', role: 'ACCOUNTS', status: 'ACTIVE' },
  };
  const assigned = new Set(['p1:m-pm', 'p1:m-sup']);
  const D = (s: string) => new Date(`${s}T00:00:00Z`);
  type Item = {
    id: string;
    label: string;
    room: string;
    doneAt: Date | null;
    inScope: boolean;
    weightBp: number;
    donePhotoId: string | null;
    plannedOn: Date | null;
    sortOrder: number;
    stageId?: string;
  };
  const state = {
    stages: [] as { id: string; kind: string; name: string; plannedStart: Date; plannedEnd: Date; actualEnd: Date | null; items: Item[] }[],
    photos: 0,
    doneStages: [] as string[],
  };
  const item = (id: string, label: string, doneAt: Date | null, more: Partial<Item> = {}): Item => ({
    id,
    label,
    room: 'Execution stage 2A',
    doneAt,
    inScope: true,
    weightBp: 1000,
    donePhotoId: null,
    plannedOn: null,
    sortOrder: 0,
    ...more,
  });
  const reset = () => {
    state.stages = [
      { id: 'carp', kind: 'CARPENTRY', name: 'Carpentry', plannedStart: D('2026-10-05'), plannedEnd: D('2026-10-31'), actualEnd: null, items: [
        item('i1', 'Carcass complete with hardware', D('2026-10-08'), { plannedOn: D('2026-10-20'), sortOrder: 0 }),
        item('i2', 'Shutters delivered', null, { plannedOn: D('2026-10-31'), sortOrder: 1 }),
      ] },
      { id: 'finish', kind: 'FINISH', name: 'Painting', plannedStart: D('2026-11-01'), plannedEnd: D('2026-11-20'), actualEnd: null, items: [] },
      { id: 'hand', kind: 'HANDOVER', name: 'Handover', plannedStart: D('2026-11-20'), plannedEnd: D('2026-11-25'), actualEnd: null, items: [] },
    ];
    state.photos = 0;
    state.doneStages = [];
  };
  reset();
  const calls: { op: string; args: unknown }[] = [];
  const rec = (op: string, fn: (args: never) => unknown) =>
    vi.fn(async (args: never) => {
      calls.push({ op, args });
      return fn(args);
    });
  let n = 0;
  const client: Record<string, unknown> = {
    studioMember: { findUnique: rec('studioMember.findUnique', (a: { where: { userId: string } }) => members[a.where.userId] ?? null) },
    studioProjectMember: {
      findUnique: rec('studioProjectMember.findUnique', (a: { where: { homeProjectId_memberId: { homeProjectId: string; memberId: string } } }) => {
        const k = a.where.homeProjectId_memberId;
        return assigned.has(`${k.homeProjectId}:${k.memberId}`) ? { id: 'spm' } : null;
      }),
    },
    homeProject: {
      findUnique: rec('homeProject.findUnique', (a: { where: { id: string } }) =>
        ['p1', 'p2'].includes(a.where.id) ? { introduction: { studioId: 's1' }, doneStages: state.doneStages } : null,
      ),
      update: rec('homeProject.update', (a: { data: { doneStages: string[] } }) => {
        state.doneStages = a.data.doneStages;
        return {};
      }),
    },
    homeProjectStage: {
      findMany: rec('homeProjectStage.findMany', () => state.stages.map(({ items: _items, ...s }) => s)),
      findFirst: rec('homeProjectStage.findFirst', (a: { where: { id: string } }) => state.stages.find((s) => s.id === a.where.id) ?? null),
      update: rec('homeProjectStage.update', (a: { where: { id: string }; data: { actualEnd?: Date | null } }) => {
        const s = state.stages.find((x) => x.id === a.where.id)!;
        if ('actualEnd' in a.data) s.actualEnd = a.data.actualEnd ?? null;
        return {};
      }),
    },
    homeProjectDateChange: { create: rec('homeProjectDateChange.create', () => ({ id: `dc${++n}` })) },
    homeDecision: { findFirst: rec('homeDecision.findFirst', (a: { where: { id: string } }) => (a.where.id === 'd1' ? { id: 'd1' } : null)) },
    homeChecklistItem: {
      findMany: rec('homeChecklistItem.findMany', (a: { where: { stageId?: string; stage?: { projectId: string } } }) =>
        state.stages
          .filter((s) => !a.where.stageId || s.id === a.where.stageId)
          .flatMap((s) => s.items.map((i) => ({ ...i, stageId: s.id })))
          .filter((i) => !a.where.stageId || i.plannedOn !== null),
      ),
      update: rec('homeChecklistItem.update', (a: { where: { id: string }; data: Partial<Item> }) => {
        for (const s of state.stages) for (const i of s.items) if (i.id === a.where.id) Object.assign(i, a.data);
        return {};
      }),
      create: rec('homeChecklistItem.create', (a: { data: Item & { stageId: string } }) => {
        const s = state.stages.find((x) => x.id === a.data.stageId)!;
        const made = { ...a.data, id: `new${++n}`, doneAt: null, donePhotoId: null };
        s.items.push(made);
        return { id: made.id };
      }),
      delete: rec('homeChecklistItem.delete', (a: { where: { id: string } }) => {
        for (const s of state.stages) s.items = s.items.filter((i) => i.id !== a.where.id);
        return {};
      }),
    },
    homeSiteLog: { findMany: rec('homeSiteLog.findMany', () => (state.photos ? [{ stageId: 'carp', _count: { photos: state.photos } }] : [])) },
    homeProjectUpdate: { findMany: rec('homeProjectUpdate.findMany', () => []) },
    homeProjectEvent: { create: rec('homeProjectEvent.create', () => ({ id: `ev${++n}` })) },
  };
  client.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(client));
  return { client, calls, state, reset };
});
vi.mock('@/lib/prisma', () => ({ prisma: db.client }));

const session = vi.hoisted(() => ({ user: null as null | { id: string; role: 'STUDIO' } }));
vi.mock('@/modules/auth/session', () => ({
  getCurrentUser: vi.fn(async () => session.user),
  hasRole: (user: { role: string } | null) => !!user,
}));

import { addStep, markStageDone, moveDate, removeStep, renameStage, renameStep, reweightStep, scopeStep, untickStep } from '@/modules/project/plan-edit';
import { settleStageAfterTicks } from '@/modules/project/stage-settle';

const as = (userId: string) => {
  session.user = { id: userId, role: 'STUDIO' };
};
const ops = (op: string) => db.calls.filter((c) => c.op === op);
const writes = () => db.calls.filter((c) => /\.(create|update|delete|upsert)/.test(c.op));
const NOT_YOURS = { ok: false, error: 'That project is not one of yours.' };
const NOT_YOUR_ROLE = { ok: false, error: 'Your role in the studio does not include that. Ask your studio owner.' };
const NOW = new Date('2026-10-11T06:30:00Z');

beforeEach(() => {
  vi.stubEnv('DATABASE_URL', 'postgres://test');
  db.calls.length = 0;
  db.reset();
  session.user = null;
});

describe('moving a date', () => {
  const move = { projectId: 'p1', stageId: 'carp', field: 'PLANNED_END' as const, to: '2026-11-05', reason: 'SUPPLIER', shiftLater: true, note: 'Laminate held at the depot' };

  it('needs a reason, and writes nothing without one', async () => {
    as('u-pm');
    for (const reason of [undefined, '', 'LATE']) {
      const r = await moveDate({ ...move, reason }, NOW);
      expect(r).toEqual({ ok: false, error: expect.stringMatching(/Pick why the date is moving/) });
    }
    expect(writes()).toEqual([]);
  });

  it('one transaction: new stage dates, append-only change rows with one `at`, the note once, one event', async () => {
    as('u-pm');
    const r = await moveDate(move, NOW);
    expect(r).toMatchObject({ ok: true, message: expect.stringMatching(/Carpentry moved, with 2 later stages/) });
    const rows = ops('homeProjectDateChange.create').map((c) => (c.args as { data: Record<string, unknown> }).data);
    expect(rows.map((d) => [d.stageId, d.field, (d.fromDate as Date).toISOString().slice(0, 10), (d.toDate as Date).toISOString().slice(0, 10)])).toEqual([
      ['carp', 'PLANNED_END', '2026-10-31', '2026-11-05'],
      ['finish', 'PLANNED_START', '2026-11-01', '2026-11-06'],
      ['finish', 'PLANNED_END', '2026-11-20', '2026-11-25'],
      ['hand', 'PLANNED_START', '2026-11-20', '2026-11-25'],
      ['hand', 'HANDOVER', '2026-11-25', '2026-11-30'],
    ]);
    expect(new Set(rows.map((d) => (d.at as Date).getTime()))).toEqual(new Set([NOW.getTime()]));
    expect(rows.map((d) => d.note)).toEqual(['Laminate held at the depot', null, null, null, null]);
    expect(rows.every((d) => d.reason === 'SUPPLIER' && d.decisionId === null && d.byId === 'u-pm')).toBe(true);
    expect(ops('homeProjectStage.update')).toHaveLength(3);
    const events = ops('homeProjectEvent.create').map((c) => (c.args as { data: { type: string; refId: string; payload: Record<string, unknown> } }).data);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'date.moved', refId: 'dc1', payload: { stageId: 'carp', field: 'PLANNED_END', days: 5, rows: 5, customer: false } });
    // The PM's note never goes into the event payload.
    expect(JSON.stringify(events[0])).not.toContain('Laminate');
    // Never an update or delete of a date change.
    expect(db.calls.some((c) => /^homeProjectDateChange\.(update|delete|upsert)/.test(c.op))).toBe(false);
  });

  it('a late decision makes it the customer’s delay, whatever reason was picked', async () => {
    as('u-owner');
    await moveDate({ ...move, reason: 'STUDIO', decisionId: 'd1', shiftLater: false }, NOW);
    const d = (ops('homeProjectDateChange.create')[0]!.args as { data: Record<string, unknown> }).data;
    expect(d).toMatchObject({ reason: 'CUSTOMER_CHANGE', decisionId: 'd1' });
  });

  it('refuses a decision from another project, and a move the rules refuse', async () => {
    as('u-owner');
    expect(await moveDate({ ...move, decisionId: 'd-other' }, NOW)).toEqual({ ok: false, error: 'That decision is not on this project.' });
    expect(await moveDate({ ...move, to: '2026-10-31' }, NOW)).toEqual({ ok: false, error: 'That is already its end date.' });
    expect(writes()).toEqual([]);
  });

  it('owner and assigned PM may; a supervisor or accounts may not (their role); an unassigned PM cannot see it', async () => {
    as('u-owner');
    expect((await moveDate(move, NOW)).ok).toBe(true);
    as('u-pm');
    expect((await moveDate(move, NOW)).ok).toBe(true);
    db.calls.length = 0;
    as('u-sup');
    expect(await moveDate(move, NOW)).toEqual(NOT_YOUR_ROLE);
    as('u-acc'); // accounts sees the project for its payments, nothing else
    expect(await moveDate(move, NOW)).toEqual(NOT_YOUR_ROLE);
    as('u-pm');
    expect(await moveDate({ ...move, projectId: 'p2' }, NOW)).toEqual(NOT_YOURS);
    expect(writes()).toEqual([]);
  });

  it('caps the internal note', async () => {
    as('u-pm');
    expect((await moveDate({ ...move, note: 'x'.repeat(501) }, NOW)).ok).toBe(false);
  });

  it('moves the stage’s steps by the days its end moved, inside its new window', async () => {
    as('u-pm');
    await moveDate({ ...move, shiftLater: false }, NOW);
    const days = db.state.stages[0]!.items.map((i) => i.plannedOn!.toISOString().slice(0, 10));
    expect(days).toEqual(['2026-10-25', '2026-11-05']);
  });
});

const types = () => ops('homeProjectEvent.create').map((c) => (c.args as { data: { type: string } }).data.type);

describe('settling a stage on its steps', () => {
  const actor = { type: 'STUDIO' as const, id: 'u-sup' };

  it('finishes when the last in-scope step is ticked, its photo meeting the photo gate', async () => {
    db.state.stages[0]!.items[0]!.donePhotoId = 'ph1';
    db.state.stages[0]!.items[1]!.doneAt = NOW;
    db.state.stages[0]!.items[1]!.donePhotoId = 'ph2';
    expect(await settleStageAfterTicks(db.client as never, 'p1', 'carp', actor, NOW)).toBe('mark-done');
    expect(db.state.stages[0]!.actualEnd).toEqual(NOW);
    expect(db.state.doneStages).toEqual(['PRODUCTION', 'INSTALL']);
    expect(types()).toEqual(['stage.done']);
  });

  it('ignores a step not in scope', async () => {
    db.state.stages[0]!.items[0]!.donePhotoId = 'ph1';
    db.state.stages[0]!.items[1]!.inScope = false;
    expect(await settleStageAfterTicks(db.client as never, 'p1', 'carp', actor, NOW)).toBe('mark-done');
  });

  it('does not finish without any photo (an older tick, no site photo)', async () => {
    db.state.stages[0]!.items[1]!.doneAt = NOW;
    expect(await settleStageAfterTicks(db.client as never, 'p1', 'carp', actor, NOW)).toBe('keep');
    expect(db.state.stages[0]!.actualEnd).toBeNull();
  });
});

describe('unticking a step', () => {
  it('owner or PM only: a correction; never a supervisor or accounts', async () => {
    as('u-sup');
    expect(await untickStep('p1', 'i1', NOW)).toEqual(NOT_YOUR_ROLE);
    as('u-acc');
    expect(await untickStep('p1', 'i1', NOW)).toEqual(NOT_YOUR_ROLE);
    expect(writes()).toEqual([]);
  });

  it('reopens a finished stage, clears the step’s photo link and keeps the photo', async () => {
    as('u-pm');
    db.state.stages[0]!.actualEnd = new Date('2026-10-10T00:00:00Z');
    db.state.stages[0]!.items[0]!.donePhotoId = 'ph1';
    db.state.stages[0]!.items[1]!.doneAt = new Date('2026-10-10T00:00:00Z');
    db.state.doneStages = ['DESIGN', 'PRODUCTION', 'INSTALL'];
    const r = await untickStep('p1', 'i1', NOW);
    expect(r).toMatchObject({ ok: true, message: expect.stringMatching(/photo stays in the site log.*open again/) });
    expect(db.state.stages[0]!.items[0]).toMatchObject({ doneAt: null, donePhotoId: null });
    expect(db.state.stages[0]!.actualEnd).toBeNull();
    expect(db.state.doneStages).toEqual(['DESIGN']);
    expect(types()).toEqual(['checklist.unticked', 'stage.reopened']);
    expect(db.calls.some((c) => /^homeSiteLogPhoto\./.test(c.op))).toBe(false);
  });

  it('refuses a step of another project', async () => {
    as('u-pm');
    expect(await untickStep('p1', 'nope', NOW)).toEqual({ ok: false, error: expect.stringMatching(/not on this plan/) });
  });
});

describe('editing steps', () => {
  it('owner or PM; never a supervisor', async () => {
    as('u-sup');
    expect(await renameStep('p1', 'i2', 'Shutters fixed')).toEqual(NOT_YOUR_ROLE);
    expect(await reweightStep('p1', 'i2', 500)).toEqual(NOT_YOUR_ROLE);
    expect(await scopeStep('p1', 'i2', false, NOW)).toEqual(NOT_YOUR_ROLE);
    expect(await addStep('p1', { stageId: 'carp', group: 'Execution stage 2A', label: 'Loft', weightBp: 100 }, NOW)).toEqual(NOT_YOUR_ROLE);
    expect(await removeStep('p1', 'i2', NOW)).toEqual(NOT_YOUR_ROLE);
    expect(writes()).toEqual([]);
  });

  it('renames and re-weights, each with its event', async () => {
    as('u-pm');
    expect(await renameStep('p1', 'i2', '  Shutters   fixed ')).toEqual({ ok: true, message: expect.stringMatching(/Renamed to “Shutters fixed”/) });
    expect(db.state.stages[0]!.items[1]!.label).toBe('Shutters fixed');
    expect((await renameStep('p1', 'i2', 'x')).ok).toBe(false);
    expect(await reweightStep('p1', 'i2', 450)).toEqual({ ok: true, message: expect.stringMatching(/4.5%/) });
    expect(db.state.stages[0]!.items[1]!.weightBp).toBe(450);
    expect((await reweightStep('p1', 'i2', 10_001)).ok).toBe(false);
    expect(types()).toEqual(['step.renamed', 'step.reweighted']);
  });

  it('marks a step not in scope, which finishes a stage whose other steps are ticked', async () => {
    as('u-owner');
    db.state.stages[0]!.items[0]!.donePhotoId = 'ph1';
    const r = await scopeStep('p1', 'i2', false, NOW);
    expect(r).toMatchObject({ ok: true, message: expect.stringMatching(/not in scope.*stage now shows done/) });
    expect(db.state.stages[0]!.items[1]!.inScope).toBe(false);
    expect(db.state.stages[0]!.actualEnd).toEqual(NOW);
    expect(types()).toEqual(['step.scoped', 'stage.done']);
  });

  it('never takes a ticked step out of scope, and never the last step in scope', async () => {
    as('u-owner');
    expect(await scopeStep('p1', 'i1', false, NOW)).toEqual({ ok: false, error: expect.stringMatching(/ticked/) });
    db.state.stages[0]!.items[0]!.inScope = false;
    db.state.stages[0]!.items[0]!.doneAt = null;
    expect(await scopeStep('p1', 'i2', false, NOW)).toEqual({ ok: false, error: expect.stringMatching(/at least one step/) });
  });

  it('adds a step inside its group, after the group’s last step', async () => {
    as('u-pm');
    const r = await addStep('p1', { stageId: 'carp', group: 'Execution stage 2A', label: 'Loft shutters fixed', weightBp: 150 }, NOW);
    expect(r).toMatchObject({ ok: true, message: expect.stringMatching(/Added “Loft shutters fixed”/) });
    const made = db.state.stages[0]!.items.find((i) => i.label === 'Loft shutters fixed')!;
    expect(made).toMatchObject({ room: 'Execution stage 2A', weightBp: 150, inScope: true, sortOrder: 2 });
    expect(made.plannedOn).toEqual(db.state.stages[0]!.items[1]!.plannedOn);
    expect(types()).toContain('step.added');
  });

  it('removes an open step, never a ticked one', async () => {
    as('u-pm');
    expect(await removeStep('p1', 'i1', NOW)).toEqual({ ok: false, error: expect.stringMatching(/ticked, so it stays/) });
    expect(await removeStep('p1', 'i2', NOW)).toMatchObject({ ok: true });
    expect(db.state.stages[0]!.items.map((i) => i.id)).toEqual(['i1']);
    expect(types()).toContain('step.removed');
  });
});

describe('stages done', () => {
  it('marking a stage done by hand needs a photo and nothing left open', async () => {

    as('u-sup');
    expect(await markStageDone('p1', 'finish', true, NOW)).toEqual({ ok: false, error: expect.stringMatching(/site photo/) });
    expect(await markStageDone('p1', 'carp', true, NOW)).toEqual({ ok: false, error: expect.stringMatching(/1 step is still open/) });
    expect(ops('homeProjectStage.update')).toEqual([]);
  });
});

describe('renaming a stage', () => {
  it('owner or PM; never a supervisor; a name is required', async () => {
    as('u-sup');
    expect(await renameStage('p1', 'carp', 'Woodwork')).toEqual(NOT_YOUR_ROLE);
    as('u-owner');
    expect((await renameStage('p1', 'carp', ' ')).ok).toBe(false);
    expect(await renameStage('p1', 'carp', 'Woodwork')).toEqual({ ok: true, message: 'Renamed to Woodwork. The customer sees the new name.' });
    expect(ops('homeProjectEvent.create').map((c) => (c.args as { data: { type: string } }).data.type)).toEqual(['stage.renamed']);
  });
});

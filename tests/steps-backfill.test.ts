import { describe, expect, it } from 'vitest';
import { stepsFromTemplate, type StepsBackfillDb } from '@/modules/portal/steps-backfill';
import { templateFor } from '@/modules/project/step-template';

/**
 * Moving existing projects to Hauspire's steps (scripts/studio/steps-from-template.ts):
 * a dry run writes nothing, generated items are replaced by the template's
 * steps with days inside each stage's current window, a stage already done
 * gets its steps ticked with no photo (BACKFILL), and a project already on
 * steps is left alone.
 */

const D = (s: string) => new Date(`${s}T00:00:00Z`);
type OldItem = { id: string; weightBp: number; doneAt: Date | null; doneSiteLogId: string | null };
type FakeProject = { id: string; stages: { id: string; kind: string; plannedStart: Date; plannedEnd: Date; actualEnd: Date | null; items: OldItem[] }[] };
type Created = { stageId: string; label: string; weightBp: number; plannedOn: Date; doneAt: Date | null; doneSource: string | null };

function fakeDb() {
  const projects: FakeProject[] = [
    {
      id: 'old',
      stages: [
        { id: 'd', kind: 'DESIGN', plannedStart: D('2026-09-01'), plannedEnd: D('2026-09-10'), actualEnd: D('2026-09-09'), items: [{ id: 'x1', weightBp: 0, doneAt: D('2026-09-09'), doneSiteLogId: null }] },
        { id: 'c', kind: 'CIVIL', plannedStart: D('2026-09-10'), plannedEnd: D('2026-09-30'), actualEnd: null, items: [{ id: 'x2', weightBp: 0, doneAt: D('2026-09-20'), doneSiteLogId: 'log1' }, { id: 'x3', weightBp: 0, doneAt: null, doneSiteLogId: null }] },
        { id: 'k', kind: 'CARPENTRY', plannedStart: D('2026-09-30'), plannedEnd: D('2026-11-01'), actualEnd: null, items: [] },
        { id: 'f', kind: 'FINISH', plannedStart: D('2026-11-01'), plannedEnd: D('2026-11-10'), actualEnd: null, items: [] },
        { id: 'h', kind: 'HANDOVER', plannedStart: D('2026-11-10'), plannedEnd: D('2026-11-15'), actualEnd: null, items: [] },
      ],
    },
    { id: 'new', stages: [{ id: 'n1', kind: 'DESIGN', plannedStart: D('2026-09-01'), plannedEnd: D('2026-09-10'), actualEnd: null, items: [{ id: 'y1', weightBp: 200, doneAt: null, doneSiteLogId: null }] }] },
  ];
  const created: Created[] = [];
  const deleted: string[] = [];
  const tx = {
    homeChecklistItem: {
      count: async ({ where }: { where: { stage: { projectId: string } } }) =>
        projects.find((p) => p.id === where.stage.projectId)!.stages.flatMap((s) => s.items).filter((i) => i.weightBp > 0).length,
      deleteMany: async ({ where }: { where: { stage: { projectId: string } } }) => {
        deleted.push(where.stage.projectId);
        return { count: 0 };
      },
      createMany: async ({ data }: { data: Created[] }) => {
        created.push(...data);
        return { count: data.length };
      },
    },
  };
  const db = {
    homeProject: { findMany: async () => projects },
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as StepsBackfillDb;
  return { db, created, deleted };
}

describe('steps from the template', () => {
  it('a dry run says what it would change and writes nothing', async () => {
    const f = fakeDb();
    const lines = await stepsFromTemplate(f.db, { apply: false });
    expect(lines).toEqual([{ projectId: 'old', oldItems: 3, tickedFromPosts: 1, steps: 44, tickedSteps: 1, written: false }]);
    expect(f.created).toEqual([]);
    expect(f.deleted).toEqual([]);
  });

  it('replaces the generated items with the template’s steps, ticking a done stage’s without a photo', async () => {
    const f = fakeDb();
    const lines = await stepsFromTemplate(f.db, { apply: true });
    expect(lines.map((l) => [l.projectId, l.written])).toEqual([['old', true]]);
    expect(f.deleted).toEqual(['old']);
    expect(f.created.filter((c) => c.stageId === 'c').map((c) => c.label)).toEqual(templateFor('CIVIL').map((t) => t.label));
    expect(f.created.reduce((a, c) => a + c.weightBp, 0)).toBe(10_000);
    expect(f.created.filter((c) => c.stageId === 'd')).toEqual([expect.objectContaining({ doneAt: D('2026-09-09'), doneSource: 'BACKFILL' })]);
    expect(f.created.filter((c) => c.stageId !== 'd').every((c) => c.doneAt === null && c.doneSource === null)).toBe(true);
    // Inside the stage's current window.
    const civil = f.created.filter((c) => c.stageId === 'c').map((c) => c.plannedOn.getTime());
    expect(Math.min(...civil)).toBe(D('2026-09-10').getTime());
    expect(Math.max(...civil)).toBe(D('2026-09-30').getTime());
  });
});

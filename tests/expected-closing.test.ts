import { describe, expect, it } from 'vitest';
import { closingList, closingRow, isInTime, mayFlagCarcass, maySeeClosing, targetDay, type ClosingInput, type ClosingRow } from '@/modules/studio/expected-closing';
import { PROJECT_EVENT_TYPES } from '@/modules/project/events';

/** Expected closing and the on-site carcass flag (owner, 13 Nov 2026). */

const D = (s: string) => new Date(s);
const NOW = D('2026-11-13T06:00:00Z');
const EVERY_DAY = { workingDays: [1, 2, 3, 4, 5, 6, 7], holidays: [] };

function input(over: Partial<ClosingInput> = {}): ClosingInput {
  return {
    id: 'p1',
    client: 'Ankita',
    home: 'Ivy Towers · Baner · 2 BHK',
    phase: 'EXECUTION',
    designer: 'Meera',
    category: 'Premium',
    onHold: false,
    onSiteCarcass: false,
    calendar: EVERY_DAY,
    dateChanges: [],
    planStages: [
      { id: 's1', kind: 'DESIGN', name: 'Design', plannedStart: D('2026-10-01T00:00:00Z'), plannedEnd: D('2026-10-20T00:00:00Z'), actualEnd: D('2026-10-20T00:00:00Z') },
      { id: 's2', kind: 'CARPENTRY', name: 'Carpentry', plannedStart: D('2026-10-21T00:00:00Z'), plannedEnd: D('2026-11-20T00:00:00Z'), actualEnd: null },
      { id: 's3', kind: 'HANDOVER', name: 'Handover', plannedStart: D('2026-12-20T00:00:00Z'), plannedEnd: D('2026-12-20T00:00:00Z'), actualEnd: null },
    ],
    ...over,
  };
}

const row = (over: Partial<ClosingRow>): ClosingRow => ({
  id: 'x',
  client: 'A',
  home: 'h',
  phase: 'DESIGN',
  phaseLabel: 'Design',
  designer: null,
  category: null,
  expectedOn: null,
  plannedOn: null,
  lateDays: 0,
  onHold: false,
  onSiteCarcass: false,
  ...over,
});

describe('targetDay', () => {
  it('defaults to 31 Dec of the current year', () => {
    expect(targetDay(undefined, '2026-11-13')).toBe('2026-12-31');
    expect(targetDay('', '2027-02-01')).toBe('2027-12-31');
  });
  it('takes ?by= when it is a real day, else the default', () => {
    expect(targetDay('2027-03-31', '2026-11-13')).toBe('2027-03-31');
    expect(targetDay('2026-02-30', '2026-11-13')).toBe('2026-12-31');
    expect(targetDay('next friday', '2026-11-13')).toBe('2026-12-31');
  });
});

describe('closingRow', () => {
  it('on time: the expected close is the handover as planned', () => {
    const r = closingRow(input(), NOW)!;
    expect(r.expectedOn).toBe('2026-12-20');
    expect(r.plannedOn).toBe('2026-12-20');
    expect(r.lateDays).toBe(0);
    expect(r.phaseLabel).toBe('Execution');
  });

  it('a stage running past its end pushes the expected close out, and counts as late', () => {
    const stages = input().planStages!.map((s) => (s.id === 's2' ? { ...s, plannedEnd: D('2026-11-10T00:00:00Z') } : s));
    const r = closingRow(input({ planStages: stages }), NOW)!;
    expect(r.expectedOn! > '2026-12-20').toBe(true);
    expect(r.plannedOn).toBe('2026-12-20');
    expect(r.lateDays).toBeGreaterThan(0);
  });

  it('a moved handover keeps the first plan for "days late"', () => {
    const stages = input().planStages!.map((s) => (s.id === 's3' ? { ...s, plannedEnd: D('2027-01-05T00:00:00Z') } : s));
    const r = closingRow(
      input({
        planStages: stages,
        dateChanges: [{ stageId: 's3', field: 'PLANNED_END', fromDate: D('2026-12-20T00:00:00Z'), toDate: D('2027-01-05T00:00:00Z'), reason: 'SUPPLIER', decisionId: null, at: D('2026-11-01T00:00:00Z') }],
      }),
      NOW,
    )!;
    expect(r.expectedOn).toBe('2027-01-05');
    expect(r.plannedOn).toBe('2026-12-20');
    expect(r.lateDays).toBe(16);
  });

  it('on hold is never late', () => {
    const stages = input().planStages!.map((s) => (s.id === 's2' ? { ...s, plannedEnd: D('2026-11-01T00:00:00Z') } : s));
    const r = closingRow(input({ planStages: stages, onHold: true }), NOW)!;
    expect(r.lateDays).toBe(0);
    expect(r.onHold).toBe(true);
  });

  it('no plan: no expected day', () => {
    const r = closingRow(input({ planStages: [] }), NOW)!;
    expect(r.expectedOn).toBeNull();
    expect(r.lateDays).toBe(0);
  });

  it('handed over: not running, left out', () => {
    const stages = input().planStages!.map((s) => ({ ...s, actualEnd: s.actualEnd ?? D('2026-11-12T00:00:00Z') }));
    expect(closingRow(input({ planStages: stages }), NOW)).toBeNull();
  });

  it('carries the on-site carcass flag', () => {
    expect(closingRow(input({ onSiteCarcass: true }), NOW)!.onSiteCarcass).toBe(true);
  });
});

describe('closingList', () => {
  it('earliest first, no plan last, and "N of M close by" the target day', () => {
    const l = closingList(
      [
        row({ id: 'late', client: 'Z', expectedOn: '2027-01-10' }),
        row({ id: 'none', client: 'A', expectedOn: null }),
        row({ id: 'early', client: 'M', expectedOn: '2026-11-30' }),
        row({ id: 'edge', client: 'B', expectedOn: '2026-12-31' }),
      ],
      '2026-12-31',
    );
    expect(l.rows.map((r) => r.id)).toEqual(['early', 'edge', 'late', 'none']);
    expect(l.inTime).toBe(2);
    expect(l.after).toBe(2);
    expect(l.by).toBe('2026-12-31');
  });
  it('same day: by client', () => {
    const l = closingList([row({ id: '2', client: 'Ravi', expectedOn: '2026-12-01' }), row({ id: '1', client: 'Anu', expectedOn: '2026-12-01' })], '2026-12-31');
    expect(l.rows.map((r) => r.id)).toEqual(['1', '2']);
  });
  it('no plan is never in time', () => {
    expect(isInTime({ expectedOn: null }, '2026-12-31')).toBe(false);
  });
});

describe('who sees the list and sets the flag', () => {
  const m = (role: string, extra: Record<string, unknown> = {}) => ({ role, status: 'ACTIVE', ...extra }) as Parameters<typeof maySeeClosing>[0];
  it('owner, design head and PM', () => {
    expect(maySeeClosing(m('OWNER'))).toBe(true);
    expect(maySeeClosing(m('DESIGNER', { designHead: true }))).toBe(true);
    expect(maySeeClosing(m('PM'))).toBe(true);
  });
  it('not a designer, salesperson, supervisor or accounts', () => {
    for (const r of ['DESIGNER', 'SALES', 'SUPERVISOR', 'ACCOUNTS']) expect(maySeeClosing(m(r))).toBe(false);
  });
  it('not without the full software', () => {
    expect(maySeeClosing(m('OWNER', { fullSoftware: false }))).toBe(false);
  });
  it('developer view-as reads the list but never sets the flag', () => {
    expect(mayFlagCarcass(m('OWNER'))).toBe(true);
    expect(mayFlagCarcass(m('OWNER', { viewOnly: true }))).toBe(false);
  });
  it('toggling writes a project event', () => {
    expect(PROJECT_EVENT_TYPES).toContain('project.carcass_set');
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { overallDelay, type RuleChange, type RuleStage } from '@/modules/project/project-rules';
import { executionStartDay } from '@/modules/project/execution-plan';
import { designThenSheet, executionFrom, executionStepDays, planSpanDays, stepsFor, templateStages } from '@/modules/portal/quote-to-plan';
import { EXECUTION_DAYS, executionSheetDays, templateFor } from '@/modules/project/step-template';
import { dayToDb, istDay, isoWeekday, type StudioCalendar } from '@/modules/project/working-days';

/* Owner, 21 Nov 2026: "Execution timeline is not proper". Execution got whatever was left of 60 days after design
   (often under three weeks, some stages 0 days). It now follows Hauspire's execution sheet from the day design ends. */
const MONDAY_OFF: StudioCalendar = { workingDays: [2, 3, 4, 5, 6, 7], holidays: new Set() };
const day = (d: Date) => istDay(d);

describe('the execution sheet', () => {
  it('civil 20, carpentry 67, finishing 14, handover 9: 110 days', () => {
    expect(executionSheetDays()).toEqual([
      { kind: 'CIVIL', days: 20 },
      { kind: 'CARPENTRY', days: 67 },
      { kind: 'FINISH', days: 14 },
      { kind: 'HANDOVER', days: 9 },
    ]);
    expect(EXECUTION_DAYS).toBe(110);
  });
});

describe('stage dates: design, then the sheet', () => {
  it('execution starts the day design ends and runs the sheet back to back, whatever the design length', () => {
    for (const designDays of [10, 43, 99]) {
      const s = designThenSheet(dayToDb('2026-11-17'), designDays);
      expect(s.map((x) => x.kind)).toEqual(['DESIGN', 'CIVIL', 'CARPENTRY', 'FINISH', 'HANDOVER']);
      for (let i = 1; i < s.length; i++) expect(day(s[i]!.plannedStart)).toBe(day(s[i - 1]!.plannedEnd));
      expect(planSpanDays(dayToDb('2026-11-17'), s)).toBe(designDays + EXECUTION_DAYS);
    }
  });

  it('with Monday off, every stage starts and ends on a working day', () => {
    const s = designThenSheet(dayToDb('2026-11-16'), 43, MONDAY_OFF);
    for (const x of s) {
      expect(isoWeekday(day(x.plannedStart))).not.toBe(1);
      expect(isoWeekday(day(x.plannedEnd))).not.toBe(1);
    }
  });

  it('a signed project with design steps is planned this way (no more squeezed execution)', () => {
    const stages = templateStages(dayToDb('2026-11-17'), 60, { template: null, bhk: 4, payments: [] });
    const exec = stages.filter((s) => s.kind !== 'DESIGN');
    const days = exec.map((s) => (s.plannedEnd.getTime() - s.plannedStart.getTime()) / 86_400_000);
    expect(days).toEqual([20, 67, 14, 9]);
  });

  it('re-planning a running project: execution from its design end', () => {
    const e = executionFrom('2027-01-16');
    expect(e[0]).toEqual({ kind: 'CIVIL', start: '2027-01-16', end: '2027-02-05' });
    expect(e.at(-1)!.end).toBe('2027-05-06');
  });
});

describe('step days', () => {
  it('in order, inside the stage, and never on the weekly off', () => {
    const s = designThenSheet(dayToDb('2026-11-16'), 43, MONDAY_OFF).find((x) => x.kind === 'CARPENTRY')!;
    const steps = stepsFor('CARPENTRY', s.plannedStart, s.plannedEnd, MONDAY_OFF);
    expect(steps.map((x) => x.label)).toEqual(templateFor('CARPENTRY').map((t) => t.label));
    let prev = '';
    for (const x of steps) {
      const d = day(x.plannedOn!);
      expect(d >= day(s.plannedStart) && d <= day(s.plannedEnd)).toBe(true);
      expect(isoWeekday(d)).not.toBe(1);
      expect(d >= prev).toBe(true);
      prev = d;
    }
  });

  it('a step that would land on the weekly off moves to the next working day, never past the stage end', () => {
    // 2026-11-23 is a Monday.
    expect(executionStepDays(['2026-07-17', '2026-07-18'], { start: '2026-11-22', end: '2026-11-24' }, MONDAY_OFF)).toEqual(['2026-11-22', '2026-11-24']);
  });
});

/* Owner, 21 Nov 2026: "execution timeline should calculate and give handover date only after the design phase is completed". */
describe('the handover is given only once design is complete', () => {
  const stages: RuleStage[] = [
    { id: 'design', kind: 'DESIGN', name: 'Design', plannedStart: '2026-09-01', plannedEnd: '2026-09-15', actualEnd: '2026-09-15' },
    { id: 'civil', kind: 'CIVIL', name: 'Civil', plannedStart: '2026-09-15', plannedEnd: '2026-10-05', actualEnd: null },
    { id: 'carp', kind: 'CARPENTRY', name: 'Carpentry', plannedStart: '2026-10-05', plannedEnd: '2026-12-11', actualEnd: null },
    { id: 'finish', kind: 'FINISH', name: 'Finishing', plannedStart: '2026-12-11', plannedEnd: '2026-12-25', actualEnd: null },
    { id: 'hand', kind: 'HANDOVER', name: 'Handover', plannedStart: '2026-12-25', plannedEnd: '2027-01-03', actualEnd: null },
  ];
  const designMove: RuleChange = { stageId: 'hand', field: 'HANDOVER', from: '2026-11-01', to: '2027-01-03', reason: 'STUDIO', decisionId: null, at: new Date('2026-09-10T06:00:00Z') };

  it('while in design there is no handover date and nothing is late', () => {
    expect(overallDelay(stages, [designMove], '2026-09-12', MONDAY_OFF, null)).toMatchObject({ plannedHandover: null, forecastHandover: null, lateDays: 0 });
  });

  it('once planned, the handover counts from that plan: a move made during design does not make it late', () => {
    const o = overallDelay(stages, [designMove], '2026-09-20', MONDAY_OFF, new Date('2026-09-15T06:00:00Z'));
    expect(o.plannedHandover).toBe('2027-01-03');
    expect(o.lateDays).toBe(0);
  });

  it('execution starts today, or after the last pre-execution step still open', () => {
    expect(executionStartDay('2026-11-21', [])).toBe('2026-11-21');
    expect(executionStartDay('2026-11-21', ['2026-11-25', '2026-11-19'])).toBe('2026-11-25');
  });

  it('leaving the design phase plans execution, in the same transaction', () => {
    const lifecycle = readFileSync('src/modules/project/lifecycle.ts', 'utf8');
    expect(lifecycle).toMatch(/if \(p\.phase === 'DESIGN'\) await planExecutionAfterDesign\(db, projectId, now\);/);
    const plan = readFileSync('src/modules/project/execution-plan.ts', 'utf8');
    expect(plan).toMatch(/executionPlannedAt: now/);
    expect(plan).toMatch(/executionFrom\(start, cal\)/);
  });

  it('the client app says "After design" until then; projects past design count as planned', () => {
    expect(readFileSync('src/app/app/project/page.tsx', 'utf8')).toMatch(/handoverKnown === false \? 'After design'/);
    expect(readFileSync('prisma/migrations/20261121180000_execution_planned_at/migration.sql', 'utf8')).toMatch(/WHERE "phase" <> 'DESIGN'/);
  });
});

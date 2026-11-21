import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { overallDelay, type RuleChange, type RuleStage } from '@/modules/project/project-rules';
import { executionStartDay } from '@/modules/project/execution-plan';
import { designThenSheet, executionFrom, executionStepDays, planSpanDays, stepsFor, templateStages } from '@/modules/portal/quote-to-plan';
import { EXECUTION_DAYS, STEP_TEMPLATE, executionDaysFor, executionSheetDays, executionStageDays, executionStepOffset, templateFor } from '@/modules/project/step-template';
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

/* Owner, 21 Nov 2026: "2 Bhk - 45 Days, 3 Bhk 60 Days, 4 Bhk 75 Days Essential increase premium by 20 % and luxe by 40%". */
describe('execution days by flat size and category', () => {
  it('Essential 45 / 60 / 75; Premium 20% more; Luxe 40% more', () => {
    expect([2, 3, 4].map((b) => executionDaysFor(b, 'ESSENTIAL'))).toEqual([45, 60, 75]);
    expect([2, 3, 4].map((b) => executionDaysFor(b, 'PREMIUM'))).toEqual([54, 72, 90]);
    expect([2, 3, 4].map((b) => executionDaysFor(b, 'LUXURY'))).toEqual([63, 84, 105]);
  });

  it('1 BHK is 30 (Essential); bigger than 4 BHK is a 4 BHK; unknown size a 2 BHK; no category Premium', () => {
    expect(executionDaysFor(1, 'ESSENTIAL')).toBe(30);
    expect(executionDaysFor(5, 'ESSENTIAL')).toBe(75);
    expect(executionDaysFor(null, 'ESSENTIAL')).toBe(45);
    expect(executionDaysFor(3, null)).toBe(72);
  });

  it("split as Hauspire's client trackers split it, adding up exactly", () => {
    for (const total of [30, 45, 54, 60, 63, 72, 75, 84, 90, 105]) {
      const parts = executionStageDays(total);
      expect(parts.map((p) => p.kind)).toEqual(['CIVIL', 'CARPENTRY', 'FINISH', 'HANDOVER']);
      expect(parts.reduce((a, p) => a + p.days, 0)).toBe(total);
      expect(parts.every((p) => p.days >= 1)).toBe(true);
    }
    // The trackers' own three templates, exactly.
    expect(executionStageDays(45).map((p) => p.days)).toEqual([11, 17, 7, 10]);
    expect(executionStageDays(60).map((p) => p.days)).toEqual([11, 24, 12, 13]);
    expect(executionStageDays(70).map((p) => p.days)).toEqual([15, 25, 16, 14]);
    // A 4 BHK Essential: the 70-day tracker, stretched.
    expect(executionStageDays(75).map((p) => p.days)).toEqual([16, 27, 17, 15]);
  });

  it("each step on its tracker day: the 60-day tracker's carcass on carpentry's 8th day, handover on the last", () => {
    expect(executionStepOffset('CARPENTRY', 'Carcass complete with hardware', 60)).toBe(7);
    expect(executionStepOffset('FINISH', 'Painting complete', 60)).toBe(7);
    expect(executionStepOffset('HANDOVER', 'Provisional handover', 60)).toBe(13);
    expect(executionStepOffset('HANDOVER', 'Provisional handover', 75)).toBe(15);
    expect(executionStepOffset('CIVIL', 'A step the studio added', 60)).toBeNull();
    // Every execution step in the template has its tracker day.
    for (const t of STEP_TEMPLATE.filter((s) => s.kind !== 'DESIGN')) expect(executionStepOffset(t.kind as 'CIVIL', t.label, 60)).not.toBeNull();
  });
});

describe('stage dates: design, then execution', () => {
  it('execution starts the day design ends and runs back to back, whatever the design length', () => {
    for (const designDays of [10, 43, 99]) {
      const s = designThenSheet(dayToDb('2026-11-17'), designDays, null, 60);
      expect(s.map((x) => x.kind)).toEqual(['DESIGN', 'CIVIL', 'CARPENTRY', 'FINISH', 'HANDOVER']);
      for (let i = 1; i < s.length; i++) expect(day(s[i]!.plannedStart)).toBe(day(s[i - 1]!.plannedEnd));
      expect(planSpanDays(dayToDb('2026-11-17'), s)).toBe(designDays + 60);
    }
  });

  it('with Monday off, every stage starts and ends on a working day', () => {
    const s = designThenSheet(dayToDb('2026-11-16'), 43, MONDAY_OFF);
    for (const x of s) {
      expect(isoWeekday(day(x.plannedStart))).not.toBe(1);
      expect(isoWeekday(day(x.plannedEnd))).not.toBe(1);
    }
  });

  it('a signed project with design steps gets its size and category days (no more squeezed execution)', () => {
    const stages = templateStages(dayToDb('2026-11-17'), 60, { template: null, bhk: 4, category: 'LUXURY', payments: [] });
    const exec = stages.filter((s) => s.kind !== 'DESIGN');
    const days = exec.map((s) => (s.plannedEnd.getTime() - s.plannedStart.getTime()) / 86_400_000);
    expect(days.reduce((a, b) => a + b, 0)).toBe(105);
    expect(days).toEqual(executionStageDays(105).map((p) => p.days));
  });

  it('planning from a design end: execution for the given days', () => {
    const e = executionFrom('2027-01-16', null, 60);
    expect(e[0]).toEqual({ kind: 'CIVIL', start: '2027-01-16', end: '2027-01-27' });
    expect(e[1]).toEqual({ kind: 'CARPENTRY', start: '2027-01-27', end: '2027-02-20' });
    expect(e.at(-1)!.end).toBe('2027-03-17');
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
    expect(plan).toMatch(/executionReplan\(exec, start, cal, days\)/);
  });

  it('no handover date and nothing to move on execution until the project exits design (owner, 21 Nov 2026)', () => {
    const tab = readFileSync('src/app/studio/projects/[id]/PlanTab.tsx', 'utf8');
    expect(tab).toMatch(/const undated = !plan\.executionPlanned && s\.kind !== 'DESIGN';/);
    expect(tab).toMatch(/plan\.canEdit && s\.state !== 'done' && !undated/);
    expect(tab).toMatch(/plan\.executionPlanned \|\| s\.kind === 'DESIGN'/);
    const edit = readFileSync('src/modules/project/plan-edit.ts', 'utf8');
    expect(edit).toMatch(/if \(p && p\.executionPlannedAt === null\) return \{ ok: false, error: EXECUTION_UNDATED \};/);
    expect(readFileSync('src/app/studio/projects/[id]/DesignPanel.tsx', 'utf8')).not.toMatch(/and handover move/);
  });

  it('the client app says "After design" until then; projects past design count as planned', () => {
    expect(readFileSync('src/app/app/project/page.tsx', 'utf8')).toMatch(/handoverKnown === false \? 'After design'/);
    expect(readFileSync('prisma/migrations/20261121180000_execution_planned_at/migration.sql', 'utf8')).toMatch(/WHERE "phase" <> 'DESIGN'/);
  });
});

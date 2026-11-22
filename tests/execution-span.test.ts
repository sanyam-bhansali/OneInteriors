import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { executionSpan } from '@/modules/project/execution-span';
import type { StudioCalendar } from '@/modules/project/working-days';

/* Owner, 22 Nov 2026: "in execution tab it should show execution start date and handover date and working days taken for completing this project". */
const CAL: StudioCalendar = { workingDays: [2, 3, 4, 5, 6, 7], holidays: new Set(['2026-12-25']) }; // Monday off, Christmas
const STAGES = [
  { kind: 'DESIGN', plannedStart: '2026-11-01', plannedEnd: '2026-11-30' },
  { kind: 'CIVIL', plannedStart: '2026-12-01', plannedEnd: '2026-12-15' },
  { kind: 'HANDOVER', plannedStart: '2026-12-16', plannedEnd: '2026-12-31' },
];

describe('the execution span', () => {
  it('first execution stage start to the last stage end; working days skip Mondays and holidays', () => {
    // 1–31 Dec 2026: 31 days, 4 Mondays (7, 14, 21, 28), Christmas → 26.
    expect(executionSpan(STAGES, { planned: true, handedOverOn: null }, CAL)).toEqual({ startOn: '2026-12-01', handoverOn: '2026-12-31', handedOver: false, workingDays: 26 });
  });

  it('handed over: the day it was, and the days it actually took', () => {
    expect(executionSpan(STAGES, { planned: true, handedOverOn: '2026-12-10' }, CAL)).toMatchObject({ handoverOn: '2026-12-10', handedOver: true, workingDays: 9 });
  });

  it('nothing until the execution is planned, or with no execution stage', () => {
    expect(executionSpan(STAGES, { planned: false, handedOverOn: null }, CAL)).toBeNull();
    expect(executionSpan([STAGES[0]!], { planned: true, handedOverOn: null }, CAL)).toBeNull();
  });

  it('shows on the Execution tab cards', () => {
    const tabs = readFileSync('src/app/studio/design/LifecycleTabs.tsx', 'utf8');
    expect(tabs).toContain("tab === 'execution' && c.execution");
    expect(tabs).toContain('data-testid="life-card-exec-days"');
  });
});

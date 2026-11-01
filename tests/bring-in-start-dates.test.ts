import { describe, expect, it } from 'vitest';
import { doneBeforeJoiningAt, lateDays, shiftDays, shifted, startDayFrom } from '@/modules/studio-bring-in/start-dates';
import { readSheet } from '@/modules/studio-bring-in/sheet-rules';

/** Hauspire's running projects on their real start dates (owner, 1 Nov 2026). */

const TODAY = '2026-11-01';

describe('the sheet’s start dates', () => {
  it('reads "28-Dec" as last December, "11-May" as this May', () => {
    expect(startDayFrom('28-Dec', TODAY)).toBe('2025-12-28');
    expect(startDayFrom('11-May', TODAY)).toBe('2026-05-11');
    expect(startDayFrom('03-Sep', TODAY)).toBe('2026-09-03');
    expect(startDayFrom('27-Oct', TODAY)).toBe('2026-10-27');
    expect(startDayFrom('1 Nov', TODAY)).toBe('2026-11-01');
  });

  it('takes a year when it is written, and refuses what is not a day', () => {
    expect(startDayFrom('03-Sep-2025', TODAY)).toBe('2025-09-03');
    expect(startDayFrom('2026-02-01', TODAY)).toBe('2026-02-01');
    expect(startDayFrom('31-Feb', TODAY)).toBeNull();
    expect(startDayFrom('', TODAY)).toBeNull();
    expect(startDayFrom('soon', TODAY)).toBeNull();
  });

  it('the sheet’s Date column comes through on each row', () => {
    const csv = 'Ongoing projects design ,,,,,,\nClient ,Designer ,Stage ,Quotation formate ,Quote no,,Date\nMonica Mam,Gunjan,Revised quotation,old,XL-MONICA,,28-Dec\n';
    const r = readSheet(csv);
    expect(r.ok && r.rows[0]).toMatchObject({ client: 'Monica Mam', quoteNo: 'XL-MONICA', date: '28-Dec' });
  });
});

describe('moving the plan to the real start', () => {
  it('moves by the days between the two starts', () => {
    expect(shiftDays('2026-10-01', '2026-09-03')).toBe(-28);
    expect(shifted(new Date('2026-10-20T00:00:00Z'), -28).toISOString().slice(0, 10)).toBe('2026-09-22');
  });

  it('dates a step done before joining on its new planned day, never after the project came in', () => {
    const came = new Date('2026-10-31T10:00:00Z');
    expect(doneBeforeJoiningAt(new Date('2026-09-10T00:00:00Z'), new Date('2026-10-08T00:00:00Z'), came, -28).toISOString().slice(0, 10)).toBe('2026-09-10');
    expect(doneBeforeJoiningAt(new Date('2026-11-20T00:00:00Z'), new Date('2026-10-30T00:00:00Z'), came, 21)).toEqual(came);
    expect(doneBeforeJoiningAt(null, new Date('2026-10-08T00:00:00Z'), came, -7).toISOString().slice(0, 10)).toBe('2026-10-01');
  });

  it('the step it is at is late by the days since its planned day', () => {
    expect(lateDays('2026-10-04', TODAY)).toBe(28);
    expect(lateDays('2026-11-05', TODAY)).toBe(0);
    expect(lateDays(null, TODAY)).toBe(0);
  });
});

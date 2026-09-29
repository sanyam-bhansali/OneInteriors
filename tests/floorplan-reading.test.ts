import { describe, it, expect } from 'vitest';
import {
  FLOOR_PLAN_PROMPT,
  extractJson,
  kitchenRunFrom,
  normalisePlan,
} from '@/modules/floorplan/reading';

/**
 * Reading a floor plan: the Hauspire software's reader, carried over with
 * the faults listed in docs/QUOTATION-ENGINE-INTEGRATION.md §3 fixed.
 */

const PLAN = {
  bedrooms: 3,
  hasStudy: true,
  bathrooms: 2,
  carpetAreaSqft: null,
  kitchen: { widthFt: 10, depthFt: 8, shape: 'l' },
  confidence: 'high',
  rooms: [
    { name: 'Master Bedroom', widthFt: 12, depthFt: 11 },
    { name: 'Kids Bedroom', widthFt: 10, depthFt: 10 },
    { name: 'Guest Bedroom', widthFt: 10, depthFt: 10 },
    { name: 'Study', widthFt: 8, depthFt: 7 },
    { name: 'Living/Dining', widthFt: 20, depthFt: 11 },
    { name: 'Kitchen', widthFt: 10, depthFt: 8 },
    { name: 'Toilet', widthFt: 7, depthFt: 5 },
    { name: 'Toilet', widthFt: 7, depthFt: 5 },
    { name: 'Balcony', widthFt: 10, depthFt: 4 },
  ],
};

describe('the prompt', () => {
  // Their prompt counted "3 bedrooms + a study" as a 4 BHK, then added a
  // study as well — the study was priced twice.
  it('never asks for a study to be counted as a bedroom', () => {
    expect(FLOOR_PLAN_PROMPT).toContain('A study or office is NOT a bedroom');
    expect(FLOOR_PLAN_PROMPT).toContain('carpetAreaSqft');
  });
});

describe('extractJson', () => {
  it('finds the object inside prose, with braces inside strings', () => {
    const text = 'Here you go: {"a":"has } brace","b":{"c":1}} and more {"x":2}';
    expect(extractJson(text)).toBe('{"a":"has } brace","b":{"c":1}}');
  });

  it('returns null when there is no complete object', () => {
    expect(extractJson('no json here')).toBeNull();
    expect(extractJson('{"a": 1')).toBeNull();
  });
});

describe('normalisePlan', () => {
  it('reads a 3 BHK with a study as three bedrooms and a study', () => {
    const r = normalisePlan(PLAN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.reading.bedrooms).toBe(3);
    expect(r.reading.hasStudy).toBe(true);
    expect(r.reading.bathrooms).toBe(2);
  });

  it('keeps repeated rooms rather than letting one overwrite the other', () => {
    const r = normalisePlan(PLAN);
    if (!r.ok) throw new Error('unreadable');
    expect(r.reading.rooms.filter((x) => x.code === 'TOILET')).toHaveLength(2);
  });

  it('adds up the carpet area when it is not printed, leaves balconies out, and says so', () => {
    const r = normalisePlan(PLAN);
    if (!r.ok) throw new Error('unreadable');
    expect(r.reading.carpetAreaSource).toBe('computed');
    // 132+100+100+56+220+80+35+35 = 758 sq ft; the 40 sq ft balcony is excluded.
    expect(r.reading.carpetAreaSqft).toBe(758);
    expect(r.reading.needsConfirming.join(' ')).toMatch(/added up from the room sizes/);
  });

  it('prefers a printed carpet area', () => {
    const r = normalisePlan({ ...PLAN, carpetAreaSqft: 1180 });
    if (!r.ok) throw new Error('unreadable');
    expect(r.reading.carpetAreaSqft).toBe(1180);
    expect(r.reading.carpetAreaSource).toBe('printed');
  });

  // The Hauspire app only checked dimensions on its OCR fallback; a misread
  // from the model went straight into the quote.
  it('drops a room with an impossible size, and says it did', () => {
    const r = normalisePlan({
      ...PLAN,
      rooms: [...PLAN.rooms, { name: 'Bedroom', widthFt: 90, depthFt: 10 }],
    });
    if (!r.ok) throw new Error('unreadable');
    expect(r.reading.rooms).toHaveLength(PLAN.rooms.length);
    expect(r.reading.needsConfirming.join(' ')).toMatch(/1 room had a size we could not read/);
  });

  it('reads the kitchen run from its sides, and refuses an implausible kitchen', () => {
    const r = normalisePlan(PLAN);
    if (!r.ok) throw new Error('unreadable');
    expect(r.reading.kitchenRunMm).toBe(kitchenRunFrom(3048, 2438, 'l'));

    const huge = normalisePlan({ ...PLAN, kitchen: { widthFt: 25, depthFt: 8, shape: 'l' } });
    if (!huge.ok) throw new Error('unreadable');
    expect(huge.reading.kitchenRunMm).toBeNull();
    expect(huge.reading.needsConfirming.join(' ')).toMatch(/could not read the kitchen/);
  });

  it('asks for every number to be checked on a low-confidence read', () => {
    const r = normalisePlan({ ...PLAN, confidence: 'low' });
    if (!r.ok) throw new Error('unreadable');
    expect(r.reading.needsConfirming[0]).toMatch(/hard to read/);
  });

  it('refuses something that is not a floor plan', () => {
    expect(normalisePlan({ bedrooms: 0, rooms: [] })).toEqual({ ok: false, reason: 'no-rooms' });
    expect(normalisePlan('nonsense')).toEqual({ ok: false, reason: 'unreadable' });
  });
});

describe('kitchenRunFrom', () => {
  it('follows the counter by shape', () => {
    expect(kitchenRunFrom(3000, 2400, 'straight')).toBe(3000);
    expect(kitchenRunFrom(3000, 2400, 'parallel')).toBe(6000);
    expect(kitchenRunFrom(3000, 2400, 'l')).toBe(4500);
    expect(kitchenRunFrom(3000, 2400, null)).toBe(4500);
    expect(kitchenRunFrom(3000, 2400, 'u')).toBe(6000);
  });

  it('stays within what a kitchen can be', () => {
    expect(kitchenRunFrom(4600, 4600, 'parallel')).toBe(9000);
  });
});

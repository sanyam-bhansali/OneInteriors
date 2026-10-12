import { describe, expect, it } from 'vitest';
import {
  bhkOf,
  checkDesignTemplate,
  DESIGN_DAYS,
  designDaysFor,
  designerDaysFor,
  HAUSPIRE_DESIGN,
  readDesignTemplate,
} from '@/modules/studio-design/template';

/** Studio OS Phase 2 (docs/studio-os/PHASE-2-DESIGN.md §2): the studio's design steps, Hauspire's by default. */

describe('Hauspire’s design steps', () => {
  it('are the 19 steps of their tracker, in order, from allocation to handover to execution', () => {
    expect(HAUSPIRE_DESIGN).toHaveLength(19);
    expect(HAUSPIRE_DESIGN[0]!.label).toMatch(/Project allocation/);
    expect(HAUSPIRE_DESIGN.at(-1)!.label).toBe('Handover to execution');
  });

  it('take 24 days for a 2 BHK, the first step on day 0', () => {
    expect(HAUSPIRE_DESIGN[0]!.days).toBe(0);
    expect(HAUSPIRE_DESIGN.reduce((a, s) => a + s.days, 0)).toBe(DESIGN_DAYS[2]);
  });

  it('lock the FD meeting on the design advance and the BOQ on the design closure', () => {
    expect(HAUSPIRE_DESIGN.filter((s) => s.gate).map((s) => [s.label, s.gate])).toEqual([
      ['First draft (FD) meeting', 'design advance'],
      ['BOQ', 'design closure'],
    ]);
  });

  it('need a file for the BOQ, the working drawings, the electrical drawing and the final documents', () => {
    expect(HAUSPIRE_DESIGN.filter((s) => s.needsDocument).map((s) => s.label)).toEqual([
      'BOQ',
      'Working drawings: false ceiling',
      'Manual and factory work split, material list',
      'Working drawings: factory',
      'Electrical drawing and quotation',
      'Final documentation for handover',
    ]);
  });

  it('pass their own checks', () => {
    expect(checkDesignTemplate(HAUSPIRE_DESIGN)).toEqual({ ok: true, steps: HAUSPIRE_DESIGN });
  });
});

describe('a studio’s own design steps', () => {
  const good = [{ label: 'Kick-off call', responsible: 'DESIGNER', needsDocument: false, gate: '', days: 0, weight: 1 }];

  it('take a name, who, days and a weight; an empty gate is no gate; weight defaults to 1', () => {
    expect(checkDesignTemplate(good)).toEqual({ ok: true, steps: [{ label: 'Kick-off call', responsible: 'DESIGNER', needsDocument: false, gate: null, days: 0, weight: 1 }] });
    expect(checkDesignTemplate([{ label: 'Layout', responsible: 'CLIENT', days: 3 }])).toMatchObject({ ok: true, steps: [{ weight: 1, gate: null }] });
  });

  it('refuse in plain words', () => {
    expect(checkDesignTemplate([])).toEqual({ ok: false, error: 'Add at least one design step.' });
    expect(checkDesignTemplate([{ ...good[0], label: ' ' }])).toEqual({ ok: false, error: 'Give step 1 a name.' });
    expect(checkDesignTemplate([{ ...good[0], responsible: 'BOSS' }])).toEqual({ ok: false, error: 'Pick who does step 1.' });
    expect(checkDesignTemplate([{ ...good[0], days: 31 }])).toMatchObject({ ok: false });
    expect(checkDesignTemplate([{ ...good[0], days: 1.5 }])).toMatchObject({ ok: false });
    expect(checkDesignTemplate([{ ...good[0], weight: 0 }])).toMatchObject({ ok: false });
    expect(checkDesignTemplate(Array.from({ length: 41 }, () => good[0]))).toMatchObject({ ok: false });
  });

  it('read as Hauspire’s when nothing usable is stored', () => {
    expect(readDesignTemplate(null)).toEqual(HAUSPIRE_DESIGN);
    expect(readDesignTemplate([{ label: 'x' }])).toEqual(HAUSPIRE_DESIGN);
    expect(readDesignTemplate(good)).toHaveLength(1);
  });
});

describe('flat sizes', () => {
  it('read a brief’s property type as 1–4 (a villa counts as 4), else nothing', () => {
    expect(['BHK_1', 'BHK_2', 'BHK_3', 'BHK_4_PLUS', 'VILLA', 'OTHER', null].map(bhkOf)).toEqual([1, 2, 3, 4, 4, null, null]);
  });

  it('set design’s days (14 / 24 / 27 / 29) and the designer-days (a 2 BHK when unknown)', () => {
    expect([1, 2, 3, 4, 6].map(designDaysFor)).toEqual([14, 24, 27, 29, 29]);
    expect(designDaysFor(null)).toBeNull();
    expect([1, 2, 3, 4, null].map(designerDaysFor)).toEqual([14, 20, 27, 32, 20]);
  });
});

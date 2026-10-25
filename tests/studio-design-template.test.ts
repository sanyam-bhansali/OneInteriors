import { describe, expect, it } from 'vitest';
import {
  bhkOf,
  checkDesignTemplate,
  DESIGN_GROUP,
  designerDaysFor,
  designLengthFor,
  HAUSPIRE_DESIGN,
  PRE_EXECUTION_GROUP,
  readDesignTemplate,
  scaledGaps,
  scaledEffort,
  sizeFactor,
} from '@/modules/studio-design/template';

/** The design process (owner and Hauspire's design team, 24 Oct 2026; docs/studio-os/DESIGN-PROCESS-PLAN.md §1). */

const design = HAUSPIRE_DESIGN.filter((s) => s.group === DESIGN_GROUP);
const pre = HAUSPIRE_DESIGN.filter((s) => s.group === PRE_EXECUTION_GROUP);

describe('Hauspire’s design process', () => {
  it('is 19 design steps then 7 pre-execution steps, from allocation to material procurement', () => {
    expect(design).toHaveLength(19);
    expect(pre).toHaveLength(7);
    expect(HAUSPIRE_DESIGN[0]!.label).toBe('Project allocation + mood board');
    expect(design.at(-1)!.label).toBe('Working drawings final');
    expect(pre[0]!.label).toBe('Site validation');
    expect(HAUSPIRE_DESIGN.at(-1)!.label).toBe('Material procurement & vendor alignment');
  });

  it('takes 28 days and 72 hours of design for a 2 BHK, and 15 days of pre-execution', () => {
    expect(design.reduce((a, s) => a + s.days, 0)).toBe(28);
    expect(design.reduce((a, s) => a + s.effortMin, 0)).toBe(72 * 60);
    expect(pre.reduce((a, s) => a + s.days, 0)).toBe(15);
    expect(HAUSPIRE_DESIGN[0]!.days).toBe(0);
  });

  it('locks the first draft on the design advance and the electrician visit on the design closure', () => {
    expect(HAUSPIRE_DESIGN.filter((s) => s.gate).map((s) => [s.label, s.gate])).toEqual([
      ['First draft (3D)', 'design advance'],
      ['Site visit with electrician & carpenter', 'design closure'],
    ]);
  });

  it('gives the client their approval steps, with no effort, ticked by the app where it can', () => {
    const client = HAUSPIRE_DESIGN.filter((s) => s.responsible === 'CLIENT');
    expect(client.map((s) => [s.label, s.approval])).toEqual([
      ['2D approval', 'LAYOUT_2D'],
      ['Final 3D approval', 'RENDER_3D'],
      ['Final design approval', 'DESIGN_FINAL'],
      ['Working drawings approval', 'WORKING'],
      ['Post-validation approval', 'WORKING'],
      ['Agreement signed', null],
    ]);
    expect(client.every((s) => s.effortMin === 0)).toBe(true);
  });

  it('gives pre-execution to the PM, the designer supporting', () => {
    expect(pre.map((s) => s.responsible)).toEqual(['PM', 'DESIGNER', 'CLIENT', 'DESIGNER', 'CLIENT', 'PM', 'PM']);
  });

  it('drops the BOQ and the factory work split', () => {
    expect(HAUSPIRE_DESIGN.some((s) => /BOQ|factory work split/i.test(s.label))).toBe(false);
  });

  it('seeds the requirement form as a task under the first step', () => {
    expect(HAUSPIRE_DESIGN[0]!.tasks).toEqual(['Send the requirement form with the mood board']);
  });

  it('passes its own checks', () => {
    expect(checkDesignTemplate(HAUSPIRE_DESIGN)).toEqual({ ok: true, steps: HAUSPIRE_DESIGN });
  });
});

describe('a studio’s own design steps', () => {
  const good = [{ label: 'Kick-off call', responsible: 'DESIGNER', needsDocument: false, gate: '', days: 0, effortMin: 90 }];

  it('take a name, who, days and effort; an empty gate is no gate; design, no approval, no tasks by default', () => {
    expect(checkDesignTemplate(good)).toEqual({
      ok: true,
      steps: [{ label: 'Kick-off call', responsible: 'DESIGNER', needsDocument: false, gate: null, days: 0, effortMin: 90, group: 'Design', approval: null, tasks: [], milestone: false }],
    });
  });

  it('read a template saved before effort existed: an hour per weight point', () => {
    expect(checkDesignTemplate([{ label: 'Layout', responsible: 'CLIENT', days: 3, weight: 3 }])).toMatchObject({ ok: true, steps: [{ effortMin: 180, gate: null, group: 'Design' }] });
    expect(checkDesignTemplate([{ label: 'Layout', responsible: 'DESIGNER', days: 3 }])).toMatchObject({ ok: true, steps: [{ effortMin: 60 }] });
  });

  it('refuse in plain words', () => {
    expect(checkDesignTemplate([])).toEqual({ ok: false, error: 'Add at least one design step.' });
    expect(checkDesignTemplate([{ ...good[0], label: ' ' }])).toEqual({ ok: false, error: 'Give step 1 a name.' });
    expect(checkDesignTemplate([{ ...good[0], responsible: 'BOSS' }])).toEqual({ ok: false, error: 'Pick who does step 1.' });
    expect(checkDesignTemplate([{ ...good[0], days: 31 }])).toMatchObject({ ok: false });
    expect(checkDesignTemplate([{ ...good[0], days: 1.5 }])).toMatchObject({ ok: false });
    expect(checkDesignTemplate([{ ...good[0], effortMin: -1 }])).toMatchObject({ ok: false });
    expect(checkDesignTemplate([{ ...good[0], effortMin: 41 * 60 }])).toMatchObject({ ok: false });
    expect(checkDesignTemplate([{ ...good[0], approval: 'LAYOUT_2D' }])).toEqual({ ok: false, error: 'Step 1 is approved by the client in the app, so the client does it.' });
    expect(checkDesignTemplate([{ ...good[0], group: 'Pre-execution' }, good[0]])).toEqual({ ok: false, error: 'Keep the pre-execution steps after the design steps.' });
    expect(checkDesignTemplate([{ ...good[0], tasks: Array.from({ length: 11 }, (_, i) => `Task ${i}`) }])).toMatchObject({ ok: false });
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

  it('scale days and effort: 1 BHK ×0.8, 2 BHK ×1, 3 BHK ×1.2, 4 BHK ×1.4, a 2 BHK when unknown', () => {
    expect([1, 2, 3, 4, 6, null].map(sizeFactor)).toEqual([0.8, 1, 1.2, 1.4, 1.4, 1]);
    expect([1, 2, 3, 4].map((b) => scaledGaps([5], b))).toEqual([[4], [5], [6], [7]]);
    // The running total is scaled, so five 1-day steps of a 3 BHK take 6 days, not 10, and a same-day step stays the same day.
    expect(scaledGaps([1, 1, 1, 1, 1], 3)).toEqual([1, 1, 2, 1, 1]);
    expect(scaledGaps([0, 2, 0, 3], 4)).toEqual([0, 3, 0, 4]);
    expect(scaledEffort(16 * 60, 3)).toBe(1152);
  });

  it('make design as long as its steps’ days', () => {
    expect([1, 2, 3, 4].map((b) => designLengthFor(HAUSPIRE_DESIGN, b))).toEqual([34, 43, 52, 60]);
    expect(designLengthFor([{ days: 0 }], 2)).toBe(1);
  });

  it('keep the designer-days for the load (a 2 BHK when unknown)', () => {
    expect([1, 2, 3, 4, null].map(designerDaysFor)).toEqual([14, 20, 27, 32, 20]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  KIND_NAMES,
  STANDARD_PAYMENTS,
  carryDone,
  kindWeights,
  paymentSchedule,
  quoteToPlan,
  stageDates,
  stageForLine,
  trackerToPlan,
  type PlanQuoteLine,
} from '@/modules/portal/quote-to-plan';
import { STEP_TEMPLATE, templateFor } from '@/modules/project/step-template';
import { HAUSPIRE_DESIGN } from '@/modules/studio-design/template';
import { STARTER_CATALOGUE } from '@/modules/studio-quote/starter-catalogue';
import { computeTotals } from '@/modules/studio-quote/pricing';
import { PLAN_KINDS } from '@/modules/portal/tracker';

const START = new Date('2026-11-01T00:00:00Z');
const DAY = 86_400_000;
const day = (d: Date) => d.toISOString().slice(0, 10);

let n = 0;
const line = (room: string, product: string, code: 'MODULAR' | 'ONSITE', details: string | null = null): PlanQuoteLine => ({
  id: `l${++n}`,
  room,
  product,
  code,
  details,
});

const LINES: PlanQuoteLine[] = [
  line('Kitchen', 'Base cabinets', 'MODULAR', 'Carcass, shutters, hardware'),
  line('Kitchen', 'Countertop', 'ONSITE', 'Stone, cut, edged and fitted.'),
  line('Kitchen', 'Dado and backsplash tiling', 'ONSITE'),
  line('Bedroom 1', 'Wardrobe', 'MODULAR'),
  line('Bedroom 1', 'Wardrobe', 'MODULAR'),
  line('Living', 'False ceiling — designer', 'ONSITE', 'Cove, drops or profile lighting.'),
  line('Living', 'Painting — putty, primer and two coats', 'ONSITE'),
  line('Whole home', 'Electrical points', 'ONSITE'),
  line('Whole home', 'Site supervision and project management', 'ONSITE'),
  line('Whole home', '3D design and drawings', 'ONSITE'),
  line('Whole home', 'Deep cleaning', 'ONSITE'),
];

const SIGNED = [
  { label: 'Booking', pct: 10, amountPaise: 0 },
  { label: 'Design closure', pct: 40, amountPaise: 0 },
  { label: 'Dispatch', pct: 40, amountPaise: 0 },
  { label: 'Handover', pct: 10, amountPaise: 0 },
];

describe('stageForLine: which stage a line’s work belongs to', () => {
  it('puts every factory-made line in carpentry, whatever it is called', () => {
    for (const p of STARTER_CATALOGUE.filter((p) => p.code === 'MODULAR')) {
      expect(stageForLine({ product: p.name, code: 'MODULAR' }), p.name).toBe('CARPENTRY');
    }
  });

  it('reads on-site lines by name', () => {
    const on = (product: string) => stageForLine({ product, code: 'ONSITE' });
    expect(on('Civil breaking and making')).toBe('CIVIL');
    expect(on('Electrical points')).toBe('CIVIL');
    expect(on('Plumbing points')).toBe('CIVIL');
    expect(on('Sink, tap and plumbing fittings')).toBe('CIVIL');
    expect(on('False ceiling — plain')).toBe('CIVIL');
    expect(on('False ceiling — designer')).toBe('CIVIL'); // "designer" is not design work
    expect(on('Dado and backsplash tiling')).toBe('CIVIL');
    expect(on('Safety door')).toBe('CIVIL');
    expect(on('Painting — texture or accent wall')).toBe('FINISH');
    expect(on('PU polish on woodwork')).toBe('FINISH'); // polish beats wood
    expect(on('Mirror, edge polished')).toBe('FINISH');
    expect(on('Glass partition')).toBe('FINISH');
    expect(on('Wallpaper')).toBe('FINISH');
    expect(on('Curtains and blinds')).toBe('FINISH');
    expect(on('Sofa and upholstery')).toBe('FINISH');
    expect(on('Countertop')).toBe('CARPENTRY');
    expect(on('Loose ply panelling')).toBe('CARPENTRY');
    expect(on('3D design')).toBe('DESIGN');
    expect(on('Working drawings')).toBe('DESIGN');
    expect(on('Deep cleaning')).toBe('HANDOVER');
  });

  it('gives a service line no stage, so no item and no material', () => {
    expect(stageForLine({ product: 'Site supervision and project management', code: 'ONSITE' })).toBeNull();
    expect(stageForLine({ product: 'Transport and cartage', code: 'ONSITE' })).toBeNull();
    expect(stageForLine({ product: 'Design fee', code: 'ONSITE' })).toBeNull();
  });

  it('puts unnamed site work in civil', () => {
    expect(stageForLine({ product: 'Miscellaneous site work', code: 'ONSITE' })).toBe('CIVIL');
  });

  it('places every starter product somewhere sensible (service lines aside)', () => {
    const none = STARTER_CATALOGUE.filter((p) => stageForLine({ product: p.name, code: p.code }) === null).map((p) => p.name);
    expect(none).toEqual(['Site supervision and project management']);
  });
});

describe('stage dates', () => {
  it('weights the kinds by the old tracker’s shares, summing to 100', () => {
    expect(kindWeights()).toEqual([20, 20, 45, 10, 5]);
  });

  it('runs the five stages back to back and ends exactly on handover', () => {
    for (const days of [1, 7, 45, 100, 113]) {
      const d = stageDates(START, days);
      expect(d.map((s) => s.kind)).toEqual([...PLAN_KINDS]);
      expect(d[0]!.plannedStart.getTime()).toBe(START.getTime());
      for (let i = 1; i < d.length; i++) expect(d[i]!.plannedStart.getTime()).toBe(d[i - 1]!.plannedEnd.getTime());
      expect(d[4]!.plannedEnd.getTime()).toBe(START.getTime() + days * DAY);
    }
  });

  it('splits 100 days 20 / 20 / 45 / 10 / 5', () => {
    const d = stageDates(START, 100);
    expect(d.map((s) => day(s.plannedEnd))).toEqual(['2026-11-21', '2026-12-11', '2027-01-25', '2027-02-04', '2027-02-09']);
  });
});

describe('quoteToPlan', () => {
  const plan = quoteToPlan({ lines: LINES, startOn: START, totalDays: 100, contractPaise: 12_34_567_89, stages: SIGNED });

  it('makes the five stages, in order, with default names and nothing done', () => {
    expect(plan.stages.map((s) => s.kind)).toEqual([...PLAN_KINDS]);
    expect(plan.stages.map((s) => s.name)).toEqual(PLAN_KINDS.map((k) => KIND_NAMES[k]));
    expect(plan.stages.map((s) => s.sortOrder)).toEqual([0, 1, 2, 3, 4]);
    expect(plan.stages.every((s) => s.actualEnd === null)).toBe(true);
  });

  it('gives every execution stage Hauspire’s steps for its kind, in order, grouped, weighted and in scope — never the quote’s lines', () => {
    for (const s of plan.stages.filter((x) => x.kind !== 'DESIGN')) {
      const t = templateFor(s.kind);
      expect(s.items.map((i) => i.label)).toEqual(t.map((x) => x.label));
      expect(s.items.map((i) => i.room)).toEqual(t.map((x) => x.group));
      expect(s.items.map((i) => i.weightBp)).toEqual(t.map((x) => x.weightBp));
      expect(s.items.map((i) => i.sortOrder)).toEqual(s.items.map((_, i) => i));
      expect(s.items.every((i) => i.inScope && i.quoteLineId === null && !i.doneAt)).toBe(true);
    }
    expect(plan.stages.flatMap((s) => s.items).reduce((a, i) => a + i.weightBp, 0)).toBe(10_000);
    expect(plan.stages.flatMap((s) => s.items).length).toBe(STEP_TEMPLATE.length - 1 + HAUSPIRE_DESIGN.length);
  });

  it('gives the DESIGN stage the design steps (Studio OS Phase 2), sharing the 2% design always had', () => {
    const design = plan.stages[0]!;
    expect(design.items.map((i) => i.label)).toEqual(HAUSPIRE_DESIGN.map((t) => t.label));
    expect(design.items.reduce((a, i) => a + i.weightBp, 0)).toBe(templateFor('DESIGN').reduce((a, t) => a + t.weightBp, 0));
    expect(design.items.map((i) => i.responsible)).toEqual(HAUSPIRE_DESIGN.map((t) => t.responsible));
    expect(design.items.filter((i) => i.needsDocument).map((i) => i.label)).toEqual(HAUSPIRE_DESIGN.filter((t) => t.needsDocument).map((t) => t.label));
    // These signed stages have a design closure (index 1) but no design advance: only the BOQ is gated.
    expect(design.items.filter((i) => i.gatePayment !== null).map((i) => [i.label, i.gatePayment])).toEqual([['BOQ', 1]]);
  });

  it('plans each step’s day inside its stage’s window, first on its start and last on its end', () => {
    for (const s of plan.stages) {
      const days = s.items.map((i) => i.plannedOn!.getTime());
      expect(days).toEqual([...days].sort((a, b) => a - b));
      expect(Math.min(...days)).toBeGreaterThanOrEqual(s.plannedStart.getTime());
      expect(Math.max(...days)).toBe(s.plannedEnd.getTime());
      if (s.items.length > 1) expect(days[0]).toBe(s.plannedStart.getTime());
    }
    // Design ends with the handover to execution on its last day.
    expect(day(plan.stages[0]!.items.at(-1)!.plannedOn!)).toBe('2026-11-21');
  });

  it('with the flat size, design lasts that size’s days and the steps are linked; gates match the payment names', () => {
    const hauspire = [
      { label: 'Booking advance', pct: null, amountPaise: 25_000_00 },
      { label: 'Design advance', pct: 5, amountPaise: 1 },
      { label: 'Design closure', pct: 10, amountPaise: 1 },
      { label: 'Material procurement', pct: 40, amountPaise: 1 },
      { label: 'Material dispatch', pct: 40, amountPaise: 1 },
      { label: 'Project handover', pct: 5, amountPaise: 1 },
    ];
    for (const [bhk, days] of [
      [1, 14],
      [2, 24],
      [3, 27],
      [4, 29],
    ] as const) {
      const p = quoteToPlan({ lines: [], startOn: START, totalDays: 100, contractPaise: 10_00_000_00, stages: hauspire, design: { bhk } });
      const d = p.stages[0]!;
      expect((d.plannedEnd.getTime() - d.plannedStart.getTime()) / DAY).toBe(days);
      expect(p.stages.at(-1)!.plannedEnd.getTime()).toBe(START.getTime() + 100 * DAY);
      const by = (label: string) => d.items.find((i) => i.label === label)!;
      expect(by('First draft (FD) meeting').gatePayment).toBe(1);
      expect(by('BOQ').gatePayment).toBe(2);
      expect(by('Mood board shared').gatePayment).toBeNull();
    }
    // A 2 BHK is Hauspire's own days: each step is the previous one plus its gap.
    const two = quoteToPlan({ lines: [], startOn: START, totalDays: 100, contractPaise: 0, stages: [], design: { bhk: 2 } }).stages[0]!;
    let at = START.getTime();
    two.items.forEach((it, i) => {
      at += HAUSPIRE_DESIGN[i]!.days * DAY;
      expect(it.plannedOn!.getTime()).toBe(at);
    });
  });

  it('builds the same steps from an empty quote', () => {
    const p = quoteToPlan({ lines: [], startOn: START, totalDays: 30, contractPaise: 0, stages: [] });
    expect(p.stages.map((s) => s.items.length)).toEqual([HAUSPIRE_DESIGN.length, 8, 22, 6, 7]);
    expect(p.materials).toEqual([]);
    expect(p.payments).toEqual([]);
  });

  it('lists materials for civil, carpentry and finishing lines only, with the details as spec', () => {
    expect(plan.materials.map((m) => m.item)).toEqual([
      'Base cabinets',
      'Countertop',
      'Dado and backsplash tiling',
      'Wardrobe',
      'Wardrobe',
      'False ceiling — designer',
      'Painting — putty, primer and two coats',
      'Electrical points',
    ]);
    expect(plan.materials[0]).toEqual({ room: 'Kitchen', item: 'Base cabinets', spec: 'Carcass, shutters, hardware', quoteLineId: LINES[0]!.id, sortOrder: 0 });
    expect(plan.materials[2]!.spec).toBeNull();
  });


  it('builds the payment schedule from the signed stages, summing exactly to the contract', () => {
    expect(plan.payments.map((p) => p.label)).toEqual(['Booking', 'Design closure', 'Dispatch', 'Handover']);
    expect(plan.payments.reduce((a, p) => a + p.amountPaise, 0)).toBe(12_34_567_89);
  });
});

describe('paymentSchedule always sums to the contract', () => {
  const sum = (xs: { amountPaise: number }[]) => xs.reduce((a, x) => a + x.amountPaise, 0);

  it('by percentages, for awkward totals', () => {
    for (const total of [1, 7, 99, 100_01, 33_33_333, 18_40_000_00, 9_99_99_999]) {
      const p = paymentSchedule(total, [
        { label: 'A', pct: 33, amountPaise: 0 },
        { label: 'B', pct: 33, amountPaise: 0 },
        { label: 'C', pct: 34, amountPaise: 0 },
      ]);
      expect(sum(p), String(total)).toBe(total);
      expect(p.every((x) => Number.isInteger(x.amountPaise))).toBe(true);
    }
  });

  it('by percentages that do not add to 100', () => {
    const p = paymentSchedule(10_00_000, [
      { label: 'A', pct: 15, amountPaise: 0 },
      { label: 'B', pct: 50, amountPaise: 0 },
    ]);
    expect(sum(p)).toBe(10_00_000);
  });

  it('by amounts when a stage was signed as an amount (a booking advance), keeping them as signed', () => {
    const signed = [
      { label: 'Booking advance', pct: null, amountPaise: 50_000_00 },
      { label: 'Design first draft', pct: null, amountPaise: 1_23_456_78 },
      { label: 'Handover', pct: null, amountPaise: 3_00_000_01 },
    ];
    const total = sum(signed);
    const p = paymentSchedule(total, signed);
    expect(p).toEqual(signed);
  });

  it('matches what the quote showed, for a studio’s own schedule', () => {
    const phases = [
      { label: 'Booking', pct: 10 },
      { label: 'Design', pct: 30 },
      { label: 'Carpentry', pct: 45 },
      { label: 'Handover', pct: 15 },
    ];
    const totals = computeTotals([{ unit: 'UNIT', code: 'MODULAR', ratePaise: 0, amountPaise: 7_77_777_77 }], { feeBps: 700, discountBps: 500, gstBps: 1800, phases });
    const signed = totals.stages.map((s) => ({ label: s.label, pct: s.pct ?? null, amountPaise: s.amountPaise }));
    expect(paymentSchedule(totals.totalPaise, signed)).toEqual(signed);
  });

  it('matches what the quote showed, for the standard stages after an advance', () => {
    const totals = computeTotals([{ unit: 'UNIT', code: 'ONSITE', ratePaise: 0, amountPaise: 12_34_567_89 }], { feeBps: 0, discountBps: 0, bookingAdvancePaise: 25_000_00, gstBps: 1800 });
    const signed = totals.stages.map((s) => ({ label: s.label, pct: s.pct ?? null, amountPaise: s.amountPaise }));
    const p = paymentSchedule(totals.totalPaise, signed);
    expect(p).toEqual(signed);
    expect(sum(p)).toBe(totals.totalPaise);
  });

  it('falls back to 40 / 40 / 20 when nothing was signed', () => {
    const p = paymentSchedule(18_40_001, []);
    expect(p.map((x) => x.label)).toEqual(STANDARD_PAYMENTS.map((x) => x.label));
    expect(p.map((x) => x.pct)).toEqual([40, 40, 20]);
    expect(sum(p)).toBe(18_40_001);
  });

  it('is empty when there is no contract', () => {
    expect(paymentSchedule(0, SIGNED)).toEqual([]);
    expect(paymentSchedule(-5, SIGNED)).toEqual([]);
  });
});

describe('carrying the old tracker across', () => {
  const now = new Date('2026-12-20T00:00:00Z');

  it('marks a kind done when every old stage it covers was, at its planned end or today, its steps ticked without a photo', () => {
    const stages = trackerToPlan({ startOn: START, totalDays: 100, doneStages: ['DESIGN', 'SITE', 'PRODUCTION'] }, now);
    expect(stages.map((s) => s.actualEnd && day(s.actualEnd))).toEqual(['2026-11-21', '2026-12-11', null, null, null]);
    expect(stages[0]!.items.every((i) => i.doneAt?.getTime() === stages[0]!.actualEnd!.getTime() && i.doneSource === 'BACKFILL')).toBe(true);
    expect(stages[1]!.items).toHaveLength(8);
    expect(stages[2]!.items.every((i) => !i.doneAt && !i.doneSource)).toBe(true);
  });


  it('never dates a done stage in the future', () => {
    const early = new Date('2026-11-05T00:00:00Z');
    const stages = trackerToPlan({ startOn: START, totalDays: 100, doneStages: ['DESIGN'] }, early);
    expect(stages[0]!.actualEnd!.getTime()).toBe(early.getTime());
  });

  it('needs both factory and installation for carpentry', () => {
    const plan = quoteToPlan({ lines: LINES, startOn: START, totalDays: 100, contractPaise: 1, stages: [] });
    expect(carryDone(plan.stages, ['PRODUCTION', 'INSTALL'], now)[2]!.actualEnd).not.toBeNull();
    expect(carryDone(plan.stages, ['INSTALL'], now)[2]!.actualEnd).toBeNull();
  });
});

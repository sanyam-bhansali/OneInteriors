import { describe, expect, it } from 'vitest';
import {
  KIND_NAMES,
  STANDARD_ITEM,
  STANDARD_PAYMENTS,
  WHOLE_HOME,
  carryDone,
  checklistByRoom,
  kindWeights,
  paymentSchedule,
  quoteToPlan,
  stageDates,
  stageForLine,
  trackerToPlan,
  type PlanQuoteLine,
} from '@/modules/portal/quote-to-plan';
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

  it('files each line’s item under its stage and room, pointing at the line', () => {
    const items = (k: string) => plan.stages.find((s) => s.kind === k)!.items.map((i) => `${i.room}: ${i.label}`);
    expect(items('DESIGN')).toEqual(['Whole home: 3D design and drawings']);
    expect(items('CIVIL')).toEqual(['Kitchen: Dado and backsplash tiling', 'Living: False ceiling — designer', 'Whole home: Electrical points']);
    expect(items('CARPENTRY')).toEqual(['Kitchen: Base cabinets', 'Kitchen: Countertop', 'Bedroom 1: Wardrobe', 'Bedroom 1: Wardrobe (2)']);
    expect(items('FINISH')).toEqual(['Living: Painting — putty, primer and two coats']);
    expect(items('HANDOVER')).toEqual(['Whole home: Deep cleaning']);
    const all = plan.stages.flatMap((s) => s.items);
    expect(all.find((i) => i.label === 'Base cabinets')!.quoteLineId).toBe(LINES[0]!.id);
    expect(all.some((i) => i.label.includes('supervision'))).toBe(false);
    for (const s of plan.stages) expect(s.items.map((i) => i.sortOrder)).toEqual(s.items.map((_, i) => i));
  });

  it('gives a stage no line fell in its one standard item', () => {
    const p = quoteToPlan({ lines: [line('Kitchen', 'Base cabinets', 'MODULAR')], startOn: START, totalDays: 45, contractPaise: 100_00, stages: [] });
    for (const s of p.stages.filter((s) => s.kind !== 'CARPENTRY')) {
      expect(s.items).toEqual([{ room: WHOLE_HOME, label: STANDARD_ITEM[s.kind], quoteLineId: null, sortOrder: 0 }]);
    }
  });

  it('builds a plan from an empty quote: five stages, one item each', () => {
    const p = quoteToPlan({ lines: [], startOn: START, totalDays: 30, contractPaise: 0, stages: [] });
    expect(p.stages.map((s) => s.items.length)).toEqual([1, 1, 1, 1, 1]);
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

  it('groups the checklist by room', () => {
    const rooms = checklistByRoom(plan.stages);
    expect(rooms.map((r) => r.room)).toEqual(['Whole home', 'Kitchen', 'Living', 'Bedroom 1']);
    expect(rooms.find((r) => r.room === 'Kitchen')!.items).toEqual([
      { kind: 'CIVIL', label: 'Dado and backsplash tiling' },
      { kind: 'CARPENTRY', label: 'Base cabinets' },
      { kind: 'CARPENTRY', label: 'Countertop' },
    ]);
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

  it('marks a kind done when every old stage it covers was, at its planned end or today, items ticked', () => {
    const stages = trackerToPlan({ startOn: START, totalDays: 100, doneStages: ['DESIGN', 'SITE', 'PRODUCTION'] }, now);
    expect(stages.map((s) => s.actualEnd && day(s.actualEnd))).toEqual(['2026-11-21', '2026-12-11', null, null, null]);
    expect(stages[0]!.items.every((i) => i.doneAt?.getTime() === stages[0]!.actualEnd!.getTime())).toBe(true);
    expect(stages[2]!.items.every((i) => !i.doneAt)).toBe(true);
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

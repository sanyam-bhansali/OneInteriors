import { describe, expect, it } from 'vitest';
import {
  EMPTY_ANSWERS,
  SHORT_DESIGN,
  SIMPLE_PAYMENTS,
  defaultTicks,
  parseAnswers,
  planSetup,
  quizPrompt,
  readQuizRecord,
  suggestedPipeline,
  type QuizAnswers,
  type StudioNow,
} from '@/modules/studio/setup-quiz';
import { HAUSPIRE_TEMPLATE, checkStages } from '@/modules/studio-sales/payment-template';
import { HAUSPIRE_DESIGN, checkDesignTemplate } from '@/modules/studio-design/template';
import { HAUSPIRE_PIPELINE } from '@/modules/studio-practice/pipeline-preset';

/**
 * "Set up your studio" (owner, 14 Oct 2026): answers in, settings changes
 * out (studio/setup-quiz.ts), never silently replacing what the studio set.
 */

const ans = (p: Partial<QuizAnswers>): QuizAnswers => ({ ...EMPTY_ANSWERS, ...p });
const DEFAULT_STAGES = [
  { id: 's1', name: 'New', kind: 'OPEN' as const, isIntake: true, sortOrder: 10 },
  { id: 's2', name: 'Contacted', kind: 'OPEN' as const, isIntake: false, sortOrder: 20 },
  { id: 's3', name: 'Won', kind: 'WON' as const, isIntake: false, sortOrder: 30 },
  { id: 's4', name: 'Lost', kind: 'LOST' as const, isIntake: false, sortOrder: 40 },
];
const fresh = (p: Partial<StudioNow> = {}): StudioNow => ({
  full: true,
  customSources: [],
  stages: DEFAULT_STAGES,
  paymentTemplate: null,
  designTemplate: null,
  branding: { discountBps: 0, feeBps: 700, gstBps: 0, validityDays: 30, materialSpec: [] },
  homeOrder: [],
  ...p,
});
const ids = (a: QuizAnswers, now = fresh()) => planSetup(a, now).changes.map((c) => c.id);

describe('reading answers', () => {
  it('drops what it cannot read and clamps numbers', () => {
    const a = parseAnswers({ team: { sales: 3, designers: -1, pms: 'x' }, sources: ['GOOGLE', 'NOPE', 'OTHER'], otherSource: '  Housing.com  ', discountPct: 80, validityDays: 45, bhk: 7, feeOn: 'yes', brands: { plywood: ' Century BWP ' } });
    expect(a.team).toEqual({ sales: 3, designers: 0, pms: 0, supervisors: 0, accounts: 0 });
    expect(a.sources).toEqual(['GOOGLE', 'OTHER']);
    expect(a.otherSource).toBe('Housing.com');
    expect(a.discountPct).toBeNull();
    expect(a.validityDays).toBe(45);
    expect(a.bhk).toBeNull();
    expect(a.feeOn).toBeNull();
    expect(a.brands.plywood).toBe('Century BWP');
    expect(parseAnswers(null)).toEqual(EMPTY_ANSWERS);
  });

  it('suggests the detailed pipeline from 50 leads a month', () => {
    expect(suggestedPipeline('UNDER_20')).toBe('SIMPLE');
    expect(suggestedPipeline('50_TO_150')).toBe('HAUSPIRE');
  });

  it('the home asks for the quiz until it is done or skipped; skipped leaves a card', () => {
    expect(quizPrompt(null)).toBe('quiz');
    expect(quizPrompt({ status: 'skipped', v: 1 })).toBe('card');
    expect(quizPrompt({ status: 'done', v: 1 })).toBeNull();
    expect(readQuizRecord({ status: 'nonsense' })).toBeNull();
  });
});

describe('the presets are valid settings', () => {
  it('the simpler payment schedule passes the payment stage checks', () => {
    expect(checkStages(SIMPLE_PAYMENTS)).toBeNull();
  });
  it('the shorter design steps pass the design checks and keep the milestones', () => {
    expect(checkDesignTemplate(SHORT_DESIGN).ok).toBe(true);
    expect(SHORT_DESIGN.length).toBeLessThan(HAUSPIRE_DESIGN.length);
    expect(SHORT_DESIGN.filter((s) => s.milestone).length).toBe(3);
  });
});

describe('what each answer changes', () => {
  it('no answers, no changes', () => {
    expect(planSetup(EMPTY_ANSWERS, fresh()).changes).toEqual([]);
  });

  it('lead sources: adds Google and the other name; ours (Meta, walk-in…) are already on every list; never twice', () => {
    expect(ids(ans({ sources: ['META', 'WALK_IN', 'REFERRAL', 'INSTAGRAM', 'ARCHITECT'] }))).toEqual([]);
    const plan = planSetup(ans({ sources: ['GOOGLE', 'OTHER'], otherSource: 'Housing.com' }), fresh({ customSources: ['google'] }));
    expect(plan.changes.map((c) => (c.kind === 'source' ? c.name : c.id))).toEqual(['Housing.com']);
  });

  it('pipeline: detailed applies the Hauspire preset (renaming marked); simple keeps theirs', () => {
    const plan = planSetup(ans({ pipeline: 'HAUSPIRE' }), fresh());
    const c = plan.changes.find((x) => x.id === 'pipeline')!;
    expect(c).toBeTruthy();
    expect(c.overwrites).toBe(true); /* Won → Converted is a rename */
    expect(ids(ans({ pipeline: 'SIMPLE' }))).toEqual([]);
    const already = HAUSPIRE_PIPELINE.map((p, i) => ({ id: `h${i}`, name: p.name, kind: p.kind, isIntake: p.isIntake === true, sortOrder: i }));
    expect(ids(ans({ pipeline: 'HAUSPIRE' }), fresh({ stages: already }))).toEqual([]);
  });

  it('payment stages: a factory keeps Hauspire’s six; carpenters or outsourced get the simpler five', () => {
    expect(ids(ans({ production: 'FACTORY' }))).toEqual([]);
    const plan = planSetup(ans({ production: 'CARPENTERS' }), fresh());
    const c = plan.changes.find((x) => x.id === 'payments');
    expect(c && c.kind === 'payments' ? c.stages : null).toEqual(SIMPLE_PAYMENTS);
    expect(c!.overwrites).toBe(false);
  });

  it('payment stages the studio set itself are never replaced unticked', () => {
    const own = [{ label: 'Advance', note: '', kind: 'PCT', pct: 50 }, { label: 'Rest', note: '', kind: 'PCT', pct: 50 }];
    const plan = planSetup(ans({ production: 'FACTORY' }), fresh({ paymentTemplate: own }));
    const c = plan.changes.find((x) => x.id === 'payments')!;
    expect(c.overwrites).toBe(true);
    expect(defaultTicks(plan)).not.toContain('payments');
    expect(c.kind === 'payments' ? c.stages : null).toEqual(HAUSPIRE_TEMPLATE);
  });

  it('design steps: in-house keeps Hauspire’s; otherwise the shorter set; only with the full software', () => {
    expect(ids(ans({ designInHouse: true }))).toEqual([]);
    const plan = planSetup(ans({ designInHouse: false }), fresh());
    const c = plan.changes.find((x) => x.id === 'design');
    expect(c && c.kind === 'design' ? c.steps : null).toEqual(SHORT_DESIGN);
    const off = planSetup(ans({ designInHouse: false }), fresh({ full: false }));
    expect(off.changes).toEqual([]);
    expect(off.kept.some((k) => k.startsWith('Design steps'))).toBe(true);
  });

  it('design: back to Hauspire’s resets a shorter set (steps null)', () => {
    const plan = planSetup(ans({ designInHouse: true }), fresh({ designTemplate: SHORT_DESIGN }));
    const c = plan.changes.find((x) => x.id === 'design');
    expect(c && c.kind === 'design' ? c.steps : 'missing').toBeNull();
    expect(c!.overwrites).toBe(false);
  });

  it('quotation defaults: discount, fee on/off, GST, validity — each only when it differs', () => {
    const plan = planSetup(ans({ discountPct: 8, feeOn: false, gstOn: true, validityDays: 15 }), fresh());
    expect(plan.changes.map((c) => c.id)).toEqual(['discount', 'fee', 'gst', 'validity']);
    const d = plan.changes[0]!;
    expect(d.kind === 'discount' ? d.bps : 0).toBe(800);
    expect(plan.changes.every((c) => !c.overwrites)).toBe(true);
    expect(ids(ans({ discountPct: 0, feeOn: true, gstOn: false, validityDays: 30 }))).toEqual([]);
  });

  it('a discount the studio set itself is shown and starts unticked', () => {
    const plan = planSetup(ans({ discountPct: 8 }), fresh({ branding: { discountBps: 1200, feeBps: 700, gstBps: 0, validityDays: 30, materialSpec: [] } }));
    expect(plan.changes[0]!.overwrites).toBe(true);
    expect(plan.changes[0]!.detail).toContain('Was 12%');
    expect(defaultTicks(plan)).toEqual([]);
  });

  it('brands: rows added to the material specification; a row of theirs replaced only with a tick', () => {
    const add = planSetup(ans({ brands: { ...EMPTY_ANSWERS.brands, plywood: 'Century BWP 710', hardware: 'Hettich' } }), fresh());
    const c = add.changes.find((x) => x.id === 'materials')!;
    expect(c.kind === 'materials' ? c.rows : null).toEqual([
      { item: 'Plywood', spec: 'Century BWP 710' },
      { item: 'Hardware', spec: 'Hettich' },
    ]);
    expect(c.overwrites).toBe(false);
    const theirs = fresh({ branding: { discountBps: 0, feeBps: 700, gstBps: 0, validityDays: 30, materialSpec: [{ item: 'Plywood', spec: 'Greenply' }, { item: 'Glass', spec: 'Saint-Gobain' }] } });
    const rep = planSetup(ans({ brands: { ...EMPTY_ANSWERS.brands, plywood: 'Century' } }), theirs).changes[0]!;
    expect(rep.overwrites).toBe(true);
    expect(rep.kind === 'materials' ? rep.rows : null).toEqual([{ item: 'Plywood', spec: 'Century' }, { item: 'Glass', spec: 'Saint-Gobain' }]);
  });

  it('team: a sales-led studio puts leads first on the owner’s home; the team itself is only saved without the full software', () => {
    const plan = planSetup(ans({ team: { sales: 2, designers: 0, pms: 0, supervisors: 0, accounts: 0 } }), fresh({ full: false }));
    const c = plan.changes.find((x) => x.id === 'home');
    expect(c && c.kind === 'home' ? c.order : null).toEqual(['clients', 'quotes', 'today', 'calendar', 'rates']);
    expect(plan.kept.some((k) => k.startsWith('Your team'))).toBe(true);
    const pm = planSetup(ans({ team: { sales: 1, designers: 2, pms: 1, supervisors: 2, accounts: 1 } }), fresh());
    const h = pm.changes.find((x) => x.id === 'home');
    expect(h && h.kind === 'home' ? h.order : null).toEqual(['today', 'projects', 'site', 'clients', 'quotes']);
    const own = planSetup(ans({ team: { sales: 2, designers: 0, pms: 0, supervisors: 0, accounts: 0 } }), fresh({ homeOrder: ['calendar'] }));
    expect(own.changes.find((x) => x.id === 'home')!.overwrites).toBe(true);
  });

  it('size, flat and civil work are saved without changing a setting', () => {
    const plan = planSetup(ans({ projectSize: '10_TO_20L', bhk: 3, civil: true }), fresh());
    expect(plan.changes).toEqual([]);
    expect(plan.kept.length).toBe(1);
  });
});

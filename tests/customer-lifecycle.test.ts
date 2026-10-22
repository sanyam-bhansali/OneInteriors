import { describe, expect, it } from 'vitest';
import { customerLifecycle, type LifecycleInput } from '@/modules/portal/lifecycle-view';
import { lifecycleLines, lifecycleWords } from '@/modules/app/lifecycle-words';
import { lifecycleWords as mobileWords } from '../mobile/src/lib/strings/lifecycle';
import type { CustomerDesign } from '@/modules/studio-design/customer-view';
import type { CustomerPayments } from '@/modules/portal/money-locker-view';
import type { CustomerTracker } from '@/modules/portal/tracker-view';

/**
 * The customer's "where is my project" (owner, 13 Oct 2026): current step,
 * next step, and the one thing that unlocks it — or nothing needed — in
 * every phase. The no-leak half is in tests/customer-projection.test.ts.
 */

const design = (over: Partial<CustomerDesign> = {}): CustomerDesign => ({
  designer: 'Neha',
  pct: 20,
  done: false,
  closedOn: null,
  steps: [
    { label: 'Site visit and measurement', done: true, doneOn: '2026-10-02', plannedOn: null, yours: false, waitingFor: null, moved: null },
    { label: 'First 3D and renders', done: false, doneOn: null, plannedOn: '2026-10-15', yours: false, waitingFor: null, moved: null },
    { label: 'Design closure', done: false, doneOn: null, plannedOn: '2026-10-20', yours: false, waitingFor: null, moved: null },
  ],
  next: null,
  waitingFor: null,
  yourStep: null,
  moodBoard: { shared: false, sharedOn: null, note: null },
  visits: [],
  measurements: [],
  drawings: [],
  changes: null,
  ...over,
});

const payments = (stages: { label: string; amountPaise: number; paidPaise: number; dueOn?: string | null }[], entries: CustomerPayments['entries'] = []): CustomerPayments => ({
  signedPaise: stages.reduce((a, s) => a + s.amountPaise, 0),
  changesPaise: 0,
  totalPaise: stages.reduce((a, s) => a + s.amountPaise, 0),
  paidPaise: stages.reduce((a, s) => a + s.paidPaise, 0),
  waitingPaise: 0,
  balancePaise: 0,
  stages: stages.map((s, index) => ({ index, label: s.label, amountPaise: s.amountPaise, changesPaise: 0, paidPaise: s.paidPaise, waitingPaise: 0, state: s.paidPaise >= s.amountPaise ? 'paid' : 'due', dueOn: s.dueOn ?? null })),
  entries,
});

const tracker = (now: string): CustomerTracker =>
  ({
    progressPct: 40,
    stages: [
      { key: 'DESIGN', kind: 'DESIGN', label: 'Design', state: 'done' },
      { key: 'SITE', kind: 'CIVIL', label: 'POP and civil', state: now === 'civil' ? 'now' : 'done' },
      { key: 'INSTALL', kind: 'CARPENTRY', label: 'Carpentry', state: now === 'carpentry' ? 'now' : 'next' },
      { key: 'HANDOVER', kind: 'HANDOVER', label: 'Handover', state: 'later' },
    ],
    current: null,
    moves: [],
    overall: { plannedHandover: null, forecastHandover: null, handedOver: false, lateDays: 0, earlyDays: 0, customerDays: 0, studioDays: 0 },
  }) as unknown as CustomerTracker;

const input = (over: Partial<LifecycleInput>): LifecycleInput => ({
  phase: 'DESIGN',
  role: 'owner',
  today: '2026-10-13',
  warrantyEndsOn: null,
  design: design(),
  tracker: tracker('civil'),
  payments: payments([{ label: 'Booking', amountPaise: 25_000_00, paidPaise: 25_000_00 }, { label: 'Design advance', amountPaise: 50_000_00, paidPaise: 0 }]),
  snags: [],
  decisions: [],
  ...over,
});

describe('in design', () => {
  it('shows the next starred milestone now and the one after next, nothing needed while the studio designs', () => {
    const l = customerLifecycle(input({}));
    expect(l).toMatchObject({ phase: 'design', current: { kind: 'design', label: 'First 3D and renders' }, next: { kind: 'design', label: 'Design closure' }, blocker: null, studioDoing: 'design' });
  });

  it('asks for the payment the design waits on, with what is open on it', () => {
    const l = customerLifecycle(input({ design: design({ waitingFor: 'Design advance' }) }));
    expect(l.blocker).toEqual({ kind: 'pay', label: 'Design advance', amountPaise: 50_000_00, count: null });
    const words = lifecycleLines(l, 'en', { studio: 'Hauspire', money: (p) => `₹${p / 100}`, date: (d) => d, today: '2026-10-13' });
    expect(words.blocker).toBe('Pay the Design advance ₹50000');
  });

  it('asks the client to answer a drawing, or to do their own step', () => {
    const drawing = { id: 'd1', kind: 'RENDER_3D', kindLabel: '3D render', room: 'Living', title: '3D render, Living', version: 1, state: 'waiting', answeredOn: null, comment: null } as CustomerDesign['drawings'][number];
    expect(customerLifecycle(input({ design: design({ drawings: [drawing] }) })).blocker).toMatchObject({ kind: 'answer_drawing', label: '3D render, Living', count: 1 });
    expect(customerLifecycle(input({ design: design({ yourStep: 'Approve the layout' }) })).blocker).toMatchObject({ kind: 'your_step', label: 'Approve the layout' });
  });

  it('points at the first site stage once the last milestone is done', () => {
    const all = design({ steps: design().steps.map((s) => ({ ...s, done: true })) });
    expect(customerLifecycle(input({ design: all }))).toMatchObject({ current: { kind: 'design_done' }, next: { kind: 'stage', label: 'POP and civil' } });
  });
});

describe('on site', () => {
  it('shows the stage under way and the next one, then the closure after the last', () => {
    expect(customerLifecycle(input({ phase: 'EXECUTION', tracker: tracker('civil') }))).toMatchObject({ current: { kind: 'stage', label: 'POP and civil' }, next: { kind: 'stage', label: 'Carpentry' }, studioDoing: 'site' });
    const last = tracker('none');
    (last.stages as { state: string }[]).forEach((s, i) => (s.state = i === 3 ? 'now' : 'done'));
    expect(customerLifecycle(input({ phase: 'EXECUTION', tracker: last })).next).toEqual({ kind: 'closure', label: null });
  });

  it('asks for a payment past its due day, and for a confirmation of a recorded one', () => {
    const p = payments([{ label: 'Material procurement', amountPaise: 4_00_000_00, paidPaise: 0, dueOn: '2026-10-10' }]);
    expect(customerLifecycle(input({ phase: 'EXECUTION', payments: p })).blocker).toMatchObject({ kind: 'pay', label: 'Material procurement', amountPaise: 4_00_000_00 });
    const entry = { id: 'e1', stageIndex: 0, stage: 'Booking', amountPaise: 1, receivedOn: '2026-10-01', mode: null, status: 'waiting', receiptDocumentId: null, canAnswer: true } as CustomerPayments['entries'][number];
    const paid = payments([{ label: 'Booking', amountPaise: 100, paidPaise: 100 }], [entry]);
    expect(customerLifecycle(input({ phase: 'EXECUTION', payments: paid })).blocker).toMatchObject({ kind: 'confirm_payment', count: 1 });
  });
});

describe('closure, snags, warranty', () => {
  it('nothing needed while the studio works out the final account', () => {
    expect(customerLifecycle(input({ phase: 'CLOSURE' }))).toMatchObject({ current: { kind: 'closure' }, next: { kind: 'snags' }, blocker: null, studioDoing: 'closure' });
  });

  it('asks to confirm fixed snags first, then the final payment, then the sign-off', () => {
    const fixed = { status: 'FIXED' as const, progress: { state: 'fixed', canAnswer: true } };
    const due = payments([{ label: 'Handover', amountPaise: 60_000_00, paidPaise: 0 }]);
    expect(customerLifecycle(input({ phase: 'SNAGS', snags: [fixed], payments: due })).blocker).toMatchObject({ kind: 'confirm_snag', count: 1 });
    const words = lifecycleLines(customerLifecycle(input({ phase: 'SNAGS', snags: [fixed, fixed] })), 'en', { studio: 'S', money: String, date: String, today: '2026-10-13' });
    expect(words.blocker).toBe('Confirm 2 snags are fixed');
    const signOff = customerLifecycle(input({ phase: 'SNAGS', snags: [{ status: 'FIXED', progress: { state: 'closed', canAnswer: false } }], payments: due }));
    expect(signOff).toMatchObject({ blocker: { kind: 'sign_off' }, canSignOff: true, openSnags: 0 });
  });

  it('family never sign off', () => {
    expect(customerLifecycle(input({ phase: 'SNAGS', role: 'family' })).canSignOff).toBe(false);
  });

  it('says the warranty’s end, and the final payment if any is left', () => {
    const due = payments([{ label: 'Handover', amountPaise: 60_000_00, paidPaise: 10_000_00 }]);
    const l = customerLifecycle(input({ phase: 'WARRANTY', warrantyEndsOn: '2027-10-12', payments: due }));
    expect(l).toMatchObject({ phase: 'warranty', warrantyEndsOn: '2027-10-12', blocker: { kind: 'pay', amountPaise: 50_000_00 } });
    const words = lifecycleLines(l, 'hi', { studio: 'S', money: (p) => `₹${p / 100}`, date: (d) => d, today: '2026-10-13' });
    expect(words.warranty).toBe('2027-10-12 तक वारंटी में');
    expect(words.blocker).toBe('अंतिम भुगतान करें ₹50000');
  });
});

describe('the words', () => {
  it('exist in English, Hindi and Marathi, and the phone app has the same', () => {
    for (const [k, e] of Object.entries(lifecycleWords)) for (const lang of ['en', 'hi', 'mr'] as const) expect(e[lang].length, `${k}.${lang}`).toBeGreaterThan(0);
    expect(mobileWords).toEqual(lifecycleWords);
  });
});

describe('change orders and sign-off (15 Oct 2026)', () => {
  const exec = (over: Partial<LifecycleInput>) => input({ phase: 'EXECUTION', tracker: tracker('carpentry'), payments: payments([{ label: 'Booking', amountPaise: 100, paidPaise: 100 }]), ...over });

  it('asks to approve extra work the studio sent, naming it', () => {
    const l = customerLifecycle(exec({ extras: [{ state: 'waiting', title: 'Loft in bedroom 2', duePaise: 0 }] }));
    expect(l.blocker).toMatchObject({ kind: 'approve_extra', label: 'Loft in bedroom 2', count: 1 });
    expect(lifecycleLines(l, 'en', { studio: 'S', money: (p) => `Rs ${p / 100}`, date: (d) => d, today: '2026-10-15' }).blocker).toBe('Approve the extra work: Loft in bedroom 2');
  });

  it('then asks to pay what is due on approved extra work', () => {
    const l = customerLifecycle(exec({ extras: [{ state: 'approved', title: 'Loft', duePaise: 12_000_00 }, { state: 'paid', title: 'Shelf', duePaise: 0 }] }));
    expect(l.blocker).toMatchObject({ kind: 'pay_extra', amountPaise: 12_000_00 });
    expect(lifecycleLines(l, 'en', { studio: 'S', money: (p) => `Rs ${p / 100}`, date: (d) => d, today: '2026-10-15' }).blocker).toBe('Pay Rs 12000 for the extra work');
  });

  it('asks to sign the design final when the studio asked, and nothing once signed', () => {
    expect(customerLifecycle(exec({ signoffs: [{ kind: 'DESIGN_FINAL', state: 'waiting' }] })).blocker?.kind).toBe('sign_design_final');
    expect(customerLifecycle(exec({ signoffs: [{ kind: 'SALES_FINAL', state: 'waiting' }] })).blocker?.kind).toBe('sign_sales_final');
    expect(customerLifecycle(exec({ signoffs: [{ kind: 'DESIGN_FINAL', state: 'signed' }] })).blocker).toBeNull();
  });

  it('says nothing for declined or released extra work', () => {
    expect(customerLifecycle(exec({ extras: [{ state: 'declined', title: 'Loft', duePaise: 0 }, { state: 'released', title: 'Shelf', duePaise: 0 }] })).blocker).toBeNull();
  });
});

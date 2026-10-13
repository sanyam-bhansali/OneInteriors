import { describe, expect, it } from 'vitest';
import { lifecycleCard, type CardInput, type CardStep } from '@/modules/project/lifecycle-card';

/** The designer's dashboard card (owner, 13 Oct 2026): now, next, what blocks it (client or studio) and late days. */

const step = (label: string, over: Partial<CardStep> = {}): CardStep => ({ label, done: false, inScope: true, plannedOn: null, responsible: 'DESIGNER', lockedBy: null, ...over });
const base = (over: Partial<CardInput>): CardInput => ({
  phase: 'DESIGN',
  today: '2026-10-13',
  designSteps: [],
  execSteps: [],
  drawingsWaiting: 0,
  openSnags: 0,
  snagsWithClient: 0,
  warrantyOpen: 0,
  closureSaved: false,
  warrantyEndsOn: null,
  ...over,
});

describe('the dashboard card', () => {
  it('design: the first open step, the next, a payment the client owes, and days late', () => {
    const c = lifecycleCard(base({ designSteps: [step('Site visit', { done: true }), step('First draft meeting', { lockedBy: 'Design advance', plannedOn: '2026-10-10' }), step('Design changes')] }));
    expect(c).toEqual({ current: 'First draft meeting', next: 'Design changes', blocker: { side: 'client', text: 'Client to pay the Design advance' }, lateDays: 3 });
  });

  it('design: the client’s drawing answer, their own step, else the studio', () => {
    expect(lifecycleCard(base({ designSteps: [step('3D')], drawingsWaiting: 2 })).blocker).toEqual({ side: 'client', text: 'Client to answer 2 drawings' });
    expect(lifecycleCard(base({ designSteps: [step('Approve layout', { responsible: 'CLIENT' })] })).blocker?.side).toBe('client');
    expect(lifecycleCard(base({ designSteps: [step('BOQ', { responsible: 'ACCOUNTS' })] })).blocker).toEqual({ side: 'studio', text: 'Accounts to do it' });
    expect(lifecycleCard(base({ designSteps: [step('BOQ', { done: true })] })).next).toBe('Design sign-off');
  });

  it('execution: the step under way with its stage, ending at the closure', () => {
    const c = lifecycleCard(base({ phase: 'EXECUTION', execSteps: [step('POP framing', { responsible: null, stage: 'POP and civil', done: true }), step('Provisional handover', { responsible: null, stage: 'Handover' })] }));
    expect(c).toMatchObject({ current: 'Provisional handover (Handover)', next: 'Project closure', blocker: { side: 'studio' } });
  });

  it('closure, snags and warranty', () => {
    expect(lifecycleCard(base({ phase: 'CLOSURE' })).blocker).toEqual({ side: 'studio', text: 'Work out the final account' });
    expect(lifecycleCard(base({ phase: 'SNAGS', openSnags: 2, snagsWithClient: 1 })).blocker).toEqual({ side: 'studio', text: 'Fix 1 open snag' });
    expect(lifecycleCard(base({ phase: 'SNAGS', openSnags: 1, snagsWithClient: 1 })).blocker).toEqual({ side: 'client', text: 'Client to confirm 1 fixed snag' });
    expect(lifecycleCard(base({ phase: 'SNAGS' })).blocker).toEqual({ side: 'client', text: 'Client to sign off the handover in the app' });
    const w = lifecycleCard(base({ phase: 'WARRANTY', warrantyEndsOn: '2027-10-12', warrantyOpen: 1 }));
    expect(w.current).toBe('In warranty until 12 Oct 2027');
    expect(w.blocker).toEqual({ side: 'studio', text: 'Fix 1 warranty snag' });
  });
});

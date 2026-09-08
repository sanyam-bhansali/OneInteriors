import { describe, it, expect } from 'vitest';
import {
  assessSteps,
  onboardingProgress,
  readyForReview,
  ONBOARDING_STEPS,
  MIN_PORTFOLIO_PROJECTS,
  MIN_ABOUT_LENGTH,
  type OnboardingSnapshot,
} from '@/modules/studio/onboarding-steps';

const COMPLETE: OnboardingSnapshot = {
  about: 'x'.repeat(MIN_ABOUT_LENGTH),
  localities: ['kharadi'],
  minProjectPaise: 60_000_000n,
  maxProjectPaise: 200_000_000n,
  yearsActive: 7,
  teamSize: 8,
  gstin: '27AAPFU0939F1ZV',
  portfolioCount: MIN_PORTFOLIO_PROJECTS,
  submittedForReview: false,
};

function snapshot(overrides: Partial<OnboardingSnapshot> = {}): OnboardingSnapshot {
  return { ...COMPLETE, ...overrides };
}

function step(s: OnboardingSnapshot, name: string) {
  return assessSteps(s).find((x) => x.step === name)!;
}

describe('assessSteps — profile', () => {
  it('is done when everything is filled in', () => {
    expect(step(COMPLETE, 'profile').done).toBe(true);
  });

  it('rejects a description shorter than the minimum', () => {
    const s = snapshot({ about: 'x'.repeat(MIN_ABOUT_LENGTH - 1) });
    expect(step(s, 'profile').done).toBe(false);
  });

  it('does not count whitespace as a description', () => {
    const s = snapshot({ about: ' '.repeat(200) });
    expect(step(s, 'profile').done).toBe(false);
  });

  it('needs at least one locality', () => {
    expect(step(snapshot({ localities: [] }), 'profile').done).toBe(false);
  });

  it('needs both ends of the project range, not just one', () => {
    expect(step(snapshot({ maxProjectPaise: null }), 'profile').done).toBe(false);
    expect(step(snapshot({ minProjectPaise: null }), 'profile').done).toBe(false);
  });

  it('names what is missing in the studio’s language', () => {
    const missing = step(snapshot({ localities: [], teamSize: null }), 'profile').missing;
    expect(missing).toContain('the areas you work in');
    expect(missing).toContain('team size');
  });
});

describe('assessSteps — registration', () => {
  it('needs a GSTIN or an explicit note', () => {
    expect(step(snapshot({ gstin: null }), 'registration').done).toBe(false);
  });

  it('is done once a GSTIN is recorded', () => {
    expect(step(COMPLETE, 'registration').done).toBe(true);
  });
});

describe('assessSteps — portfolio', () => {
  it(`needs ${MIN_PORTFOLIO_PROJECTS} projects`, () => {
    expect(step(snapshot({ portfolioCount: MIN_PORTFOLIO_PROJECTS - 1 }), 'portfolio').done).toBe(false);
    expect(step(snapshot({ portfolioCount: MIN_PORTFOLIO_PROJECTS }), 'portfolio').done).toBe(true);
  });

  it('counts down, and gets the singular right at one short', () => {
    const one = step(snapshot({ portfolioCount: MIN_PORTFOLIO_PROJECTS - 1 }), 'portfolio');
    expect(one.missing[0]).toBe('1 more completed project');

    const two = step(snapshot({ portfolioCount: MIN_PORTFOLIO_PROJECTS - 2 }), 'portfolio');
    expect(two.missing[0]).toBe('2 more completed projects');
  });

  it('does not complain when they add extras', () => {
    expect(step(snapshot({ portfolioCount: 12 }), 'portfolio').done).toBe(true);
  });
});

describe('readyForReview', () => {
  it('is true when the three data steps are done, before submitting', () => {
    expect(readyForReview(COMPLETE)).toBe(true);
  });

  it('is false if any earlier step is incomplete', () => {
    expect(readyForReview(snapshot({ gstin: null }))).toBe(false);
    expect(readyForReview(snapshot({ portfolioCount: 0 }))).toBe(false);
    expect(readyForReview(snapshot({ about: null }))).toBe(false);
  });

  // Submitting must not be able to paper over a gap that appeared afterwards.
  it('ignores submittedForReview', () => {
    expect(readyForReview(snapshot({ gstin: null, submittedForReview: true }))).toBe(false);
  });
});

describe('onboardingProgress', () => {
  it('is only complete once the studio has actually sent it to us', () => {
    expect(onboardingProgress(COMPLETE).complete).toBe(false);
    expect(onboardingProgress(snapshot({ submittedForReview: true })).complete).toBe(true);
  });

  it('counts done steps out of the full list', () => {
    const p = onboardingProgress(snapshot({ portfolioCount: 0, gstin: null }));
    expect(p.total).toBe(ONBOARDING_STEPS.length);
    expect(p.done).toBe(1); // profile only
  });

  /**
   * The load-bearing property of this whole module: completion is derived from
   * the data, so clearing a field must immediately un-complete its step even
   * for a studio that already submitted. A stored flag would leave the
   * checklist claiming a step was finished when the profile says otherwise.
   */
  it('un-completes a step when its data is cleared after submission', () => {
    const submitted = snapshot({ submittedForReview: true });
    expect(onboardingProgress(submitted).complete).toBe(true);

    const cleared = { ...submitted, about: null };
    expect(step(cleared, 'profile').done).toBe(false);
    expect(onboardingProgress(cleared).complete).toBe(false);
  });
});

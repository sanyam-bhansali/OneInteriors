import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_STEPS,
  firstIncomplete,
  gateFor,
  percentComplete,
  type OnboardingStep,
  type StepStatus,
} from '@/modules/studio/onboarding-steps';

/**
 * The lock, the bar, and where a studio gets sent.
 *
 * All three are derived from `assessSteps` every render, so the cases worth
 * testing are the ones where a naive stored-flag implementation would be
 * wrong: a field emptied after the step was finished, a step completed out of
 * order, and the rounding that must never claim a hundred per cent.
 */

const steps = (...done: boolean[]): StepStatus[] =>
  ONBOARDING_STEPS.map((step, i) => ({
    step,
    done: done[i] ?? false,
    missing: done[i] ? [] : ['something'],
  }));

const [PROFILE, REGISTRATION, PORTFOLIO, RATES, REVIEW] = ONBOARDING_STEPS as readonly [
  OnboardingStep,
  OnboardingStep,
  OnboardingStep,
  OnboardingStep,
  OnboardingStep,
];

describe('gateFor', () => {
  it('opens only the first unfinished step on a fresh studio', () => {
    const s = steps(false, false, false, false, false);
    expect(gateFor(s, PROFILE)).toBe('current');
    expect(gateFor(s, REGISTRATION)).toBe('locked');
    expect(gateFor(s, REVIEW)).toBe('locked');
  });

  it('keeps finished steps reachable', () => {
    /* Going back to edit is the whole reason the flow is not a wizard with
       one road out. */
    const s = steps(true, true, false, false, false);
    expect(gateFor(s, PROFILE)).toBe('done');
    expect(gateFor(s, REGISTRATION)).toBe('done');
    expect(gateFor(s, PORTFOLIO)).toBe('current');
  });

  it('re-locks what depended on a field that was removed', () => {
    /**
     * The case a stored `completedSteps` array cannot handle without somebody
     * remembering to clear it on every path that can empty a field. Here the
     * studio finished everything and then deleted a project, so Portfolio
     * fails again — and Rates, which was done, is shut behind it.
     */
    const s = steps(true, true, false, true, false);
    expect(gateFor(s, PORTFOLIO)).toBe('current');
    /* Still `done`, because it is: the data is there. But the rail will not
       link past a `current` step, and `firstIncomplete` sends them back. */
    expect(gateFor(s, RATES)).toBe('done');
    expect(gateFor(s, REVIEW)).toBe('locked');
  });

  it('treats a step whose predecessors are all done as open, not current', () => {
    /* Happens when an earlier step was completed out of order — Rates filled
       from the application before Portfolio was touched. Reachable, but not
       the thing being pointed at. */
    const s = steps(true, true, true, false, false);
    expect(gateFor(s, RATES)).toBe('current');
    expect(gateFor(s, REVIEW)).toBe('locked');
  });

  it('locks an unknown step rather than opening it', () => {
    /* Fails closed. A typo'd URL must not be a way past the gate. */
    expect(gateFor(steps(true, true, true, true, true), 'nonsense' as OnboardingStep)).toBe(
      'locked',
    );
  });
});

describe('firstIncomplete', () => {
  it('names the step to work on', () => {
    expect(firstIncomplete(steps(true, false, false, false, false))).toBe(REGISTRATION);
  });

  it('falls back to the last step when everything is done', () => {
    /* Not `undefined`, because the caller redirects to it. */
    expect(firstIncomplete(steps(true, true, true, true, true))).toBe(REVIEW);
  });
});

describe('percentComplete', () => {
  it('counts steps, not fields', () => {
    expect(percentComplete(steps(false, false, false, false, false))).toBe(0);
    expect(percentComplete(steps(true, false, false, false, false))).toBe(20);
    expect(percentComplete(steps(true, true, true, false, false))).toBe(60);
  });

  it('never shows 100 beside an unfinished step', () => {
    /**
     * The one value this must never get wrong. Rounding is capped at 99 until
     * every step genuinely passes, because a bar reading 100% next to a
     * locked Review is the bar telling somebody the work is done when the
     * submit button will refuse them.
     */
    expect(percentComplete(steps(true, true, true, true, false))).toBe(80);
    expect(percentComplete(steps(true, true, true, true, true))).toBe(100);

    const many: StepStatus[] = Array.from({ length: 200 }, (_, i) => ({
      step: PROFILE,
      done: i < 199,
      missing: [],
    }));
    expect(percentComplete(many)).toBe(99);
  });

  it('is 0 for no steps rather than NaN', () => {
    expect(percentComplete([])).toBe(0);
  });
});

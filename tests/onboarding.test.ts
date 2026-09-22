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
  gstinNotApplicable: false,
  addressLine: '301 Skyview, Baner Road',
  pincode: '411045',
  portfolioCount: MIN_PORTFOLIO_PROJECTS,
  portfolioShortfallNote: null,
  missingRates: [],
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

  /**
   * The half of the rule that was never implemented.
   *
   * The step's own comment has always said it "completes on a decision rather
   * than on a value" — but the code tested only the value, and there was no
   * field anywhere that could hold the decision. A proprietorship below the GST
   * threshold could finish every other step and then find the submit button
   * permanently disabled, with no ops control to let them through either. This
   * test is the one that would have caught it.
   */
  it('is done when the studio has told us it has no registration', () => {
    const declared = snapshot({ gstin: null, gstinNotApplicable: true });
    expect(step(declared, 'registration').done).toBe(true);
    expect(step(declared, 'registration').missing).toEqual([]);
  });

  it('lets a studio with no registration reach review', () => {
    expect(readyForReview(snapshot({ gstin: null, gstinNotApplicable: true }))).toBe(true);
  });

  it('still refuses silence — neither a number nor a declaration', () => {
    const silent = snapshot({ gstin: null, gstinNotApplicable: false });
    expect(step(silent, 'registration').done).toBe(false);
    expect(step(silent, 'registration').missing[0]).toContain('note that you do not have one');
  });

  /**
   * The address is required and the uploaded document is not.
   *
   * Worth asserting rather than assuming, because the pair is easy to get
   * backwards: the certificate feels like the important one, and making it
   * compulsory would stop a studio who has everything else and cannot find
   * the PDF at nine in the evening. A GSTIN says a registration exists; the
   * address is the only field that says where to go and look.
   */
  it('needs an address as well as the registration answer', () => {
    const noAddress = snapshot({ addressLine: null });
    expect(step(noAddress, 'registration').done).toBe(false);
    expect(step(noAddress, 'registration').missing).toContain('your studio address');

    const noPincode = snapshot({ pincode: null });
    expect(step(noPincode, 'registration').done).toBe(false);
    expect(step(noPincode, 'registration').missing).toContain('a pincode');
  });

  it('treats whitespace as absent', () => {
    /* A space is what a studio leaves behind when they clear a field, and
       `!null` and `!' '` are not the same test. */
    expect(step(snapshot({ addressLine: '   ' }), 'registration').done).toBe(false);
  });
});

describe('assessSteps — rates', () => {
  it('is done when every core rate is entered', () => {
    expect(step(COMPLETE, 'rates').done).toBe(true);
  });

  // A studio with no rate card produces no quote, and the quote is the only
  // route from a match to a conversation — so an incomplete card is not a
  // cosmetic gap, it makes the studio unshowable.
  it('is not done while core rates are missing', () => {
    const s = snapshot({ missingRates: ['painting', 'electrical'] });
    expect(step(s, 'rates').done).toBe(false);
    expect(step(s, 'rates').missing[0]).toBe('2 rates still to enter');
  });

  it('gets the singular right at one missing', () => {
    expect(step(snapshot({ missingRates: ['painting'] }), 'rates').missing[0]).toBe(
      '1 rate still to enter',
    );
  });

  it('blocks review until rates are in', () => {
    expect(readyForReview(snapshot({ missingRates: ['painting'] }))).toBe(false);
  });
});

describe('assessSteps — portfolio', () => {
  it(`needs ${MIN_PORTFOLIO_PROJECTS} projects`, () => {
    expect(step(snapshot({ portfolioCount: MIN_PORTFOLIO_PROJECTS - 1 }), 'portfolio').done).toBe(false);
    expect(step(snapshot({ portfolioCount: MIN_PORTFOLIO_PROJECTS }), 'portfolio').done).toBe(true);
  });

  it('counts down, and gets the singular right at one short', () => {
    const one = step(snapshot({ portfolioCount: MIN_PORTFOLIO_PROJECTS - 1 }), 'portfolio');
    expect(one.missing[0]).toBe('1 more completed project, or a note about what else you have');

    const two = step(snapshot({ portfolioCount: MIN_PORTFOLIO_PROJECTS - 2 }), 'portfolio');
    expect(two.missing[0]).toBe('2 more completed projects, or a note about what else you have');
  });

  it('does not complain when they add extras', () => {
    expect(step(snapshot({ portfolioCount: 12 }), 'portfolio').done).toBe(true);
  });
});

/**
 * The escape hatch.
 *
 * These exist because the failure they prevent is not a crash — it is a young
 * practice sitting on a greyed-out submit button after we approved them, which
 * nothing would have alerted us to.
 */
describe('assessSteps — portfolio shortfall', () => {
  const note = 'Two finished, a third handing over in November, and a Wakad site you can visit.';

  it('lets a short studio through once it has explained what it does have', () => {
    const s = snapshot({ portfolioCount: 1, portfolioShortfallNote: note });
    expect(step(s, 'portfolio').done).toBe(true);
    expect(readyForReview(s)).toBe(true);
  });

  it('still needs at least one project — a note alone is not a portfolio', () => {
    const s = snapshot({ portfolioCount: 0, portfolioShortfallNote: note });
    expect(step(s, 'portfolio').done).toBe(false);
    expect(step(s, 'portfolio').missing[0]).toBe('at least one project');
  });

  it('rejects a note too short to route a verifier anywhere', () => {
    expect(
      step(snapshot({ portfolioCount: 2, portfolioShortfallNote: 'soon' }), 'portfolio').done,
    ).toBe(false);
  });

  it('is not fooled by whitespace', () => {
    expect(
      step(snapshot({ portfolioCount: 2, portfolioShortfallNote: '   '.repeat(40) }), 'portfolio')
        .done,
    ).toBe(false);
  });

  it('changes nothing for a studio that has its three', () => {
    // The hatch must not become a second, quieter route to the same place for
    // somebody who never needed it.
    const s = snapshot({ portfolioCount: MIN_PORTFOLIO_PROJECTS, portfolioShortfallNote: null });
    expect(step(s, 'portfolio').done).toBe(true);
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
    expect(p.done).toBe(2); // profile and rates
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

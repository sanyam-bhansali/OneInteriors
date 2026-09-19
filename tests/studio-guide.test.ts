import { describe, expect, it } from 'vitest';
import {
  GUIDES,
  progressFor,
  completedCount,
  allDone,
  nextStep,
  shouldOpen,
  parseGuideState,
  EMPTY_GUIDE_STATE,
  type StudioFacts,
} from '@/modules/studio/guide';
import { STUDIO_FEATURES, isLive, COMING_SOON } from '@/modules/studio/features';

const EMPTY: StudioFacts = {
  clientCount: 0,
  clientsWithFollowUp: 0,
  clientsMovedOn: 0,
  hasBranding: false,
  pricedProducts: 0,
  quoteCount: 0,
  quotesWithLines: 0,
};

const facts = (over: Partial<StudioFacts> = {}): StudioFacts => ({ ...EMPTY, ...over });

describe('the guides themselves', () => {
  it('gives every guide exactly three steps', () => {
    // Three is what somebody will do before deciding they have the idea.
    for (const guide of Object.values(GUIDES)) {
      expect(guide.steps, guide.id).toHaveLength(3);
    }
  });

  it('keeps every step title short enough to scan', () => {
    for (const guide of Object.values(GUIDES)) {
      for (const step of guide.steps) {
        expect(step.title.split(/\s+/).length, `${guide.id}/${step.id}`).toBeLessThanOrEqual(9);
      }
    }
  });

  it('gives every step a reason, not a description of the UI', () => {
    for (const guide of Object.values(GUIDES)) {
      for (const step of guide.steps) {
        expect(step.why.length, `${guide.id}/${step.id}`).toBeGreaterThan(25);
      }
    }
  });

  it('uses unique step ids within a guide', () => {
    for (const guide of Object.values(GUIDES)) {
      const ids = guide.steps.map((s) => s.id);
      expect(new Set(ids).size, guide.id).toBe(ids.length);
    }
  });

  it('gives a cta to every step that sends you elsewhere', () => {
    for (const guide of Object.values(GUIDES)) {
      for (const step of guide.steps) {
        if (!step.href) continue;
        expect(step.cta, `${guide.id}/${step.id} has an href and no label`).toBeTruthy();
      }
    }
  });
});

describe('progress is derived, never declared', () => {
  /**
   * The rule the whole guide rests on: a step is done when the studio has
   * done the thing. There is no "mark as complete" anywhere in the product,
   * so a checklist can never claim something that is not true.
   */
  it('shows nothing done for a studio with nothing', () => {
    expect(completedCount(progressFor('leads', EMPTY))).toBe(0);
    expect(completedCount(progressFor('quotations', EMPTY))).toBe(0);
  });

  it('ticks leads steps off their own counts', () => {
    expect(completedCount(progressFor('leads', facts({ clientCount: 1 })))).toBe(1);
    expect(
      completedCount(progressFor('leads', facts({ clientCount: 1, clientsWithFollowUp: 1 }))),
    ).toBe(2);
    expect(
      allDone(
        progressFor(
          'leads',
          facts({ clientCount: 3, clientsWithFollowUp: 1, clientsMovedOn: 1 }),
        ),
      ),
    ).toBe(true);
  });

  it('does not count an empty quotation as having built one', () => {
    // Pressing New and walking away must not tick the last step.
    const started = facts({ hasBranding: true, pricedProducts: 2, quoteCount: 1 });
    expect(allDone(progressFor('quotations', started))).toBe(false);

    const written = { ...started, quotesWithLines: 1 };
    expect(allDone(progressFor('quotations', written))).toBe(true);
  });

  it('needs a real rate, not just a catalogue', () => {
    // The starter catalogue ships with every rate at zero, so a product count
    // alone would tick a step nobody has done.
    expect(completedCount(progressFor('quotations', facts({ hasBranding: true })))).toBe(1);
  });
});

describe('nextStep', () => {
  it('points at the first thing NOT done, not the first in order', () => {
    // Somebody who priced the catalogue before filling in their details
    // should be sent to the details, not back to the catalogue.
    const step = nextStep('quotations', facts({ pricedProducts: 5 }));
    expect(step?.id).toBe('branding');
  });

  it('skips past what is already done', () => {
    const step = nextStep('quotations', facts({ hasBranding: true, pricedProducts: 5 }));
    expect(step?.id).toBe('quote');
  });

  it('is null once everything is done', () => {
    const done = facts({ hasBranding: true, pricedProducts: 1, quotesWithLines: 1 });
    expect(nextStep('quotations', done)).toBeNull();
  });
});

describe('shouldOpen', () => {
  it('opens for a studio that has done nothing', () => {
    expect(shouldOpen('leads', EMPTY_GUIDE_STATE, EMPTY)).toBe(true);
  });

  it('stays shut once skipped', () => {
    expect(shouldOpen('leads', { dismissed: ['leads'], seen: [] }, EMPTY)).toBe(false);
  });

  it('stops opening for good once every step is done', () => {
    // A finished checklist that keeps greeting you is clutter.
    const done = facts({ clientCount: 1, clientsWithFollowUp: 1, clientsMovedOn: 1 });
    expect(shouldOpen('leads', EMPTY_GUIDE_STATE, done)).toBe(false);
  });

  it('keeps the two guides independent', () => {
    const state = { dismissed: ['leads' as const], seen: [] };
    expect(shouldOpen('leads', state, EMPTY)).toBe(false);
    expect(shouldOpen('quotations', state, EMPTY)).toBe(true);
  });
});

describe('parseGuideState', () => {
  it('survives null, rubbish and the wrong shape', () => {
    // A loose JSON column edited by successive versions of the module. A tour
    // must never crash the dashboard it sits on.
    expect(parseGuideState(null)).toEqual(EMPTY_GUIDE_STATE);
    expect(parseGuideState('nonsense')).toEqual(EMPTY_GUIDE_STATE);
    expect(parseGuideState(42)).toEqual(EMPTY_GUIDE_STATE);
    expect(parseGuideState({})).toEqual(EMPTY_GUIDE_STATE);
    expect(parseGuideState({ dismissed: 'leads' })).toEqual(EMPTY_GUIDE_STATE);
  });

  it('drops guide ids that no longer exist', () => {
    const state = parseGuideState({ dismissed: ['leads', 'retired-tour'], seen: ['vendors'] });
    expect(state.dismissed).toEqual(['leads']);
    expect(state.seen).toEqual([]);
  });
});

describe('the pilot feature set', () => {
  it('keeps the two pillars and their prerequisites open', () => {
    // A quotation cannot exist without branding and a priced product, so
    // gating either of those stops the builder working.
    expect(isLive('leads')).toBe(true);
    expect(isLive('quotations')).toBe(true);
    expect(isLive('products')).toBe(true);
    expect(isLive('settings')).toBe(true);
  });

  it('gates the four that are not in the pilot', () => {
    expect(isLive('projects')).toBe(false);
    expect(isLive('vendors')).toBe(false);
    expect(isLive('calendar')).toBe(false);
    expect(isLive('listing')).toBe(false);
  });

  it('writes a coming-soon entry for every gated feature', () => {
    // A gated route with no copy renders an empty page.
    for (const [name, live] of Object.entries(STUDIO_FEATURES)) {
      if (live) continue;
      expect(COMING_SOON, name).toHaveProperty(name);
    }
  });

  it('says what each gated feature will do, in its own words', () => {
    // "Coming soon" alone tells nobody whether to wait or find another tool.
    for (const [name, copy] of Object.entries(COMING_SOON)) {
      expect(copy.title.length, name).toBeGreaterThan(4);
      expect(copy.what.length, name).toBeGreaterThan(40);
    }
  });
});

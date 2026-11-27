import { describe, it, expect } from 'vitest';
import { mayRemoveMark, showsOurMark, tierMayRemoveMark, markToggleState } from '@/modules/studio-quote/mark';

/**
 * Who sees our mark on a studio's quotation.
 *
 * Worth testing properly because both directions are commercially real: a
 * paying studio who still carries our mark has not got what they bought, and
 * a lapsed one who does not is getting it free. Neither is visible from any
 * screen we look at — it shows up on a document sent to somebody else's
 * client.
 */

describe('tierMayRemoveMark', () => {
  it('opens on Premium and above', () => {
    expect(tierMayRemoveMark('PREMIUM')).toBe(true);
    expect(tierMayRemoveMark('LUXURY')).toBe(true);
  });

  it('is closed on Essential and on nothing at all', () => {
    expect(tierMayRemoveMark('ESSENTIAL')).toBe(false);
    expect(tierMayRemoveMark(null)).toBe(false);
    expect(tierMayRemoveMark(undefined)).toBe(false);
    /* A tier that does not exist yet is not entitled. Failing closed is the
       safe direction for a paid feature. */
    expect(tierMayRemoveMark('ENTERPRISE')).toBe(false);
  });
});

describe('showsOurMark', () => {
  it('shows it when nobody asked for it to go', () => {
    expect(showsOurMark({ tier: 'PREMIUM', hideRequested: false })).toBe(true);
    expect(showsOurMark({ tier: null, hideRequested: false })).toBe(true);
  });

  it('removes it only when the wish and the right agree', () => {
    expect(showsOurMark({ tier: 'PREMIUM', hideRequested: true })).toBe(false);
    expect(showsOurMark({ tier: 'ESSENTIAL', hideRequested: true })).toBe(true);
  });

  /**
   * The case the two-column design exists for.
   *
   * A studio upgrades, turns the mark off, then lapses. With one boolean,
   * something would have to rewrite their settings on downgrade — and the
   * thing that remembers is the thing that will one day forget, leaving them
   * white-labelled for free indefinitely. Here the mark returns on its own.
   */
  it('restores the mark on downgrade without touching their preference', () => {
    const wish = { hideRequested: true };
    expect(showsOurMark({ ...wish, tier: 'PREMIUM' })).toBe(false);
    expect(showsOurMark({ ...wish, tier: 'ESSENTIAL' })).toBe(true);
    /* And returns their choice when they come back, with nothing re-entered. */
    expect(showsOurMark({ ...wish, tier: 'LUXURY' })).toBe(false);
  });
});

describe('markToggleState', () => {
  it('tells an unentitled studio what it costs rather than hiding the control', () => {
    const state = markToggleState({ tier: 'ESSENTIAL', hideRequested: false });
    expect(state.entitled).toBe(false);
    expect(state.note).toContain('Pro and Max');
  });

  it('keeps showing an unentitled studio their own stored preference', () => {
    /* They asked for it while they were paying. The switch should still read
       as they left it, or an upgrade looks like it did nothing. */
    expect(markToggleState({ tier: 'ESSENTIAL', hideRequested: true }).on).toBe(true);
  });

  it('describes where the mark sits, for somebody deciding', () => {
    const state = markToggleState({ tier: 'PREMIUM', hideRequested: false });
    expect(state.entitled).toBe(true);
    expect(state.note).toContain('footer');
  });
});

describe('the CRM plans and our mark (owner, 24 Nov 2026)', () => {
  it('Pro and Max may take the line off; Free keeps it', () => {
    expect(mayRemoveMark({ tier: null, plan: 'PRO' })).toBe(true);
    expect(mayRemoveMark({ tier: null, plan: 'MAX' })).toBe(true);
    expect(mayRemoveMark({ tier: null, plan: 'FREE' })).toBe(false);
    expect(mayRemoveMark({ tier: null, plan: null })).toBe(false);
  });

  it('a marketplace tier that includes it still counts on Free', () => {
    expect(mayRemoveMark({ tier: 'PREMIUM', plan: 'FREE' })).toBe(true);
  });

  it('the wish is honoured only while entitled, so a downgrade to Free brings the line back', () => {
    const wish = { tier: null, hideRequested: true };
    expect(showsOurMark({ ...wish, plan: 'PRO' })).toBe(false);
    expect(showsOurMark({ ...wish, plan: 'FREE' })).toBe(true);
    expect(showsOurMark({ tier: null, plan: 'MAX', hideRequested: false })).toBe(true);
  });

  it('the toggle on Free says which plans include it', () => {
    const s = markToggleState({ tier: null, plan: 'FREE', hideRequested: false });
    expect(s.entitled).toBe(false);
    expect(s.note).toMatch(/Pro and Max/);
    expect(markToggleState({ tier: null, plan: 'PRO', hideRequested: false }).entitled).toBe(true);
  });
});

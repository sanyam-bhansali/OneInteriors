import { describe, it, expect } from 'vitest';
import { standingOf, crmIsOpen, receivesBriefs } from '@/modules/studio/standing';

/**
 * When the software opens, and when customers can reach a studio.
 *
 * These are two different lines and the whole arrangement depends on them
 * staying apart. The CRM opens on submission, because a studio running their
 * own practice on our software needs no opinion from us. Briefs open on
 * approval, because a brief is us vouching for somebody — and vouching for a
 * studio nobody has checked is the one thing this product cannot do.
 */

const setting = { status: 'ONBOARDING', submittedForReview: false };
const withUs = { status: 'ONBOARDING', submittedForReview: true };
const listed = { status: 'ACTIVE', submittedForReview: true };

describe('standingOf', () => {
  it('reads the three normal states', () => {
    expect(standingOf(setting)).toBe('SETTING_UP');
    expect(standingOf(withUs)).toBe('WITH_US');
    expect(standingOf(listed)).toBe('LISTED');
  });

  it('treats an active studio as listed even if the flag was never set', () => {
    /* Ops can activate a studio they onboarded by hand. Status is the
       authority; the flag is only about who pressed submit. */
    expect(standingOf({ status: 'ACTIVE', submittedForReview: false })).toBe('LISTED');
  });

  it('does not hand a suspended studio a standing of its own', () => {
    /**
     * Deliberate. A suspended studio is under investigation and a removed one
     * is off the roster; neither should be quietly given a working CRM by a
     * function whose job is describing onboarding. If those states need
     * treatment they get it explicitly, from something that knows what a
     * suspension is.
     */
    expect(standingOf({ status: 'SUSPENDED', submittedForReview: true })).toBe('SETTING_UP');
    expect(standingOf({ status: 'REMOVED', submittedForReview: true })).toBe('SETTING_UP');
  });
});

describe('crmIsOpen', () => {
  it('opens on submission, not on approval', () => {
    /* The change this module exists for. A studio used to wait a week for
       the software while we called their clients. */
    expect(crmIsOpen(setting)).toBe(false);
    expect(crmIsOpen(withUs)).toBe(true);
    expect(crmIsOpen(listed)).toBe(true);
  });

  it('stays shut for a suspended studio', () => {
    expect(crmIsOpen({ status: 'SUSPENDED', submittedForReview: true })).toBe(false);
  });
});

describe('receivesBriefs', () => {
  it('only ever on approval', () => {
    /**
     * The line the whole arrangement rests on. A studio using the CRM while
     * we verify them is running their own practice on our software. A studio
     * receiving briefs before we have called their clients is us vouching
     * for somebody we have not checked.
     */
    expect(receivesBriefs(setting)).toBe(false);
    expect(receivesBriefs(withUs)).toBe(false);
    expect(receivesBriefs(listed)).toBe(true);
  });

  it('is never true wherever the CRM is shut', () => {
    for (const s of [setting, { status: 'SUSPENDED', submittedForReview: true }]) {
      expect(receivesBriefs(s)).toBe(false);
    }
  });
});

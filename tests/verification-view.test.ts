import { describe, expect, it } from 'vitest';
import {
  verificationView,
  formatCheckDate,
  ALL_CHECK_TYPES,
} from '@/modules/studio/verification-view';
import { CHECK_LABELS, type VerificationCheck } from '@/modules/studio/types';
import { CHECKS, CHECK_COUNT } from '@/components/landing/checks';

const check = (over: Partial<VerificationCheck> & Pick<VerificationCheck, 'type'>): VerificationCheck => ({
  result: 'PASS',
  source: 'GST portal',
  checkedAt: '2026-08-30',
  detail: null,
  ...over,
});

describe('the panel cannot invent a verification', () => {
  /**
   * The whole reason this module exists. A trust panel is a brief that pulls
   * hard toward a wall of green ticks, and on a page arguing that somebody
   * actually rang the past clients, a tick nobody earned is the product
   * failing at the thing it sells.
   */
  it('shows nothing verified for a studio with no checks', () => {
    const view = verificationView([]);
    expect(view.passed).toBe(0);
    expect(view.total).toBe(CHECK_COUNT);
    expect(view.pending).toBe(CHECK_COUNT);
    expect(view.lastChecked).toBeNull();
  });

  it('never invents a source or a date', () => {
    const view = verificationView([]);
    for (const section of view.sections) {
      for (const c of section.checks) {
        expect(c.source, c.type).toBeNull();
        expect(c.checkedAt, c.type).toBeNull();
        expect(c.passed, c.type).toBe(false);
      }
    }
  });

  it('counts only PASS as verified', () => {
    // PENDING, FAIL, EXPIRED and NOT_APPLICABLE are four different things and
    // none of them is "verified".
    const view = verificationView([
      check({ type: 'PAN_NAME_MATCH', result: 'PASS' }),
      check({ type: 'AADHAAR_KYC', result: 'PENDING' }),
      check({ type: 'ADDRESS_VISIT', result: 'FAIL' }),
      check({ type: 'CONTACT_REACHABLE', result: 'EXPIRED' }),
      check({ type: 'CODE_OF_CONDUCT', result: 'NOT_APPLICABLE' }),
    ]);
    expect(view.passed).toBe(1);
  });

  it('keeps a failed check visible rather than folding it into pending', () => {
    // A studio that failed a check and a studio nobody has checked are
    // different facts, and the customer is the one who needs to tell them
    // apart.
    const view = verificationView([check({ type: 'LITIGATION_SEARCH', result: 'FAIL' })]);
    expect(view.failed).toBe(1);
    expect(view.pending).toBe(CHECK_COUNT - 1);
  });

  it('treats an expired check as needing rework, not as verified', () => {
    const view = verificationView([check({ type: 'GSTIN_ACTIVE', result: 'EXPIRED' })]);
    expect(view.passed).toBe(0);
    expect(view.failed).toBe(1);
  });
});

describe('the count matches the rest of the product', () => {
  it('covers every check the landing page claims', () => {
    // The landing page's "fifteen mandatory checks" and this panel must never
    // be able to disagree — the panel would either contradict the claim or
    // quietly shrink it.
    expect(ALL_CHECK_TYPES).toHaveLength(CHECK_COUNT);
    expect(new Set(ALL_CHECK_TYPES)).toEqual(new Set(CHECKS.map((c) => c.type)));
  });

  it('uses the shared labels rather than its own wording', () => {
    const view = verificationView([]);
    for (const section of view.sections) {
      for (const c of section.checks) {
        expect(c.title).toBe(CHECK_LABELS[c.type]);
      }
    }
  });

  it('puts every check in exactly one section', () => {
    const seen = ALL_CHECK_TYPES;
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('gives every check a plain-language explanation', () => {
    const view = verificationView([]);
    for (const section of view.sections) {
      for (const c of section.checks) {
        expect(c.detail.length, c.type).toBeGreaterThan(25);
      }
    }
  });
});

describe('lastChecked', () => {
  it('is the most recent real date, not today', () => {
    const view = verificationView([
      check({ type: 'PAN_NAME_MATCH', checkedAt: '2026-06-01' }),
      check({ type: 'GSTIN_ACTIVE', checkedAt: '2026-08-30' }),
      check({ type: 'UDYAM', checkedAt: '2026-07-14' }),
    ]);
    expect(view.lastChecked).toBe('2026-08-30');
  });

  it('is null when nothing has been checked', () => {
    expect(verificationView([]).lastChecked).toBeNull();
  });
});

describe('formatCheckDate', () => {
  it('formats a real date', () => {
    expect(formatCheckDate('2026-08-30')).toContain('2026');
    expect(formatCheckDate('2026-08-30')).toContain('Aug');
  });

  it('returns null rather than a stand-in', () => {
    expect(formatCheckDate(null)).toBeNull();
    expect(formatCheckDate('not a date')).toBeNull();
  });
});

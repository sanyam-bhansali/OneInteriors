import { describe, it, expect } from 'vitest';
import {
  POLICY_VERSION,
  DEFAULT_GRANTED,
  QUIZ_PURPOSES,
  CONSENT_PURPOSES,
  PURPOSE_NOTICE,
  isBlocking,
  mayContact,
  needsRefresh,
  type ConsentRecord,
} from '@/modules/consent/policy';

function record(over: Partial<ConsentRecord> = {}): ConsentRecord {
  return {
    purpose: 'MARKETING_EMAIL',
    granted: true,
    policyVersion: POLICY_VERSION,
    withdrawnAt: null,
    ...over,
  };
}

/**
 * These are not style preferences. Each one is a requirement of the DPDP Act
 * 2023 that a normal-looking implementation gets wrong, and every campaign to
 * the 20,000 imported records depends on them holding.
 */
describe('DPDP requirements', () => {
  it('grants nothing by default — a pre-ticked box is not an affirmative action', () => {
    for (const purpose of CONSENT_PURPOSES) {
      expect(DEFAULT_GRANTED[purpose]).toBe(false);
    }
  });

  it('makes only data processing blocking — consent must be unconditional', () => {
    expect(isBlocking('DATA_PROCESSING')).toBe(true);
    expect(isBlocking('MARKETING_EMAIL')).toBe(false);
    expect(isBlocking('MARKETING_WHATSAPP')).toBe(false);
    expect(isBlocking('MARKETING_SMS')).toBe(false);
  });

  it('keeps each channel a separate purpose — one tick cannot cover three', () => {
    expect(QUIZ_PURPOSES).toContain('MARKETING_EMAIL');
    expect(QUIZ_PURPOSES).toContain('MARKETING_WHATSAPP');
    expect(new Set(QUIZ_PURPOSES).size).toBe(QUIZ_PURPOSES.length);
  });

  it('has a written notice for every purpose — consent must be informed', () => {
    for (const purpose of CONSENT_PURPOSES) {
      expect(PURPOSE_NOTICE[purpose].label.length).toBeGreaterThan(10);
      expect(PURPOSE_NOTICE[purpose].detail.length).toBeGreaterThan(20);
    }
  });
});

describe('mayContact', () => {
  it('refuses when there is no record at all — silence is not consent', () => {
    expect(mayContact([], 'MARKETING_EMAIL')).toBe(false);
  });

  it('allows a live, current grant', () => {
    expect(mayContact([record()], 'MARKETING_EMAIL')).toBe(true);
  });

  it('refuses an explicit no', () => {
    expect(mayContact([record({ granted: false })], 'MARKETING_EMAIL')).toBe(false);
  });

  it('refuses after withdrawal', () => {
    expect(mayContact([record({ withdrawnAt: new Date() })], 'MARKETING_EMAIL')).toBe(false);
  });

  it('refuses consent given against an older policy', () => {
    expect(mayContact([record({ policyVersion: '2025-01-01' })], 'MARKETING_EMAIL')).toBe(false);
  });

  it('does not let consent for one channel authorise another', () => {
    expect(mayContact([record({ purpose: 'MARKETING_EMAIL' })], 'MARKETING_WHATSAPP')).toBe(false);
  });

  // The row order is the history. A later decision has to win, or someone who
  // opted out keeps receiving mail because an old yes is still on file.
  it('takes the most recent decision when there are several', () => {
    const history = [record({ granted: true }), record({ granted: false })];
    expect(mayContact(history, 'MARKETING_EMAIL')).toBe(false);

    const reversed = [record({ granted: false }), record({ granted: true })];
    expect(mayContact(reversed, 'MARKETING_EMAIL')).toBe(true);
  });

  it('ignores other purposes when picking the latest', () => {
    const history = [
      record({ purpose: 'MARKETING_EMAIL', granted: true }),
      record({ purpose: 'MARKETING_WHATSAPP', granted: false }),
    ];
    expect(mayContact(history, 'MARKETING_EMAIL')).toBe(true);
  });
});

describe('needsRefresh', () => {
  it('names purposes agreed against a superseded notice', () => {
    const stale = needsRefresh([record({ policyVersion: '2025-01-01' })]);
    expect(stale).toEqual(['MARKETING_EMAIL']);
  });

  it('ignores current, withdrawn and refused records', () => {
    expect(
      needsRefresh([
        record(),
        record({ policyVersion: '2025-01-01', withdrawnAt: new Date() }),
        record({ policyVersion: '2025-01-01', granted: false }),
      ]),
    ).toEqual([]);
  });
});

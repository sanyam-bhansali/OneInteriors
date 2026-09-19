import { describe, expect, it } from 'vitest';
import { studioProof, CHECK_CHIPS } from '@/modules/studio/proof';
import { CHECK_LABELS, type CheckResult, type CheckType, type VerificationCheck } from '@/modules/studio/types';

const check = (type: CheckType, result: CheckResult = 'PASS'): VerificationCheck => ({
  type,
  result,
  source: 'Our team',
  checkedAt: '2026-08-30',
  detail: null,
});

const ALL = Object.keys(CHECK_LABELS) as CheckType[];

describe('studioProof', () => {
  it('shows nothing when nothing has passed', () => {
    const proof = studioProof([check('GSTIN_ACTIVE', 'PENDING'), check('UDYAM', 'EXPIRED')]);
    expect(proof.left).toEqual([]);
    expect(proof.right).toEqual([]);
    expect(proof.passed).toBe(0);
    // A pending check is not a check we are holding back — it is not a check.
    expect(proof.more).toBe(0);
  });

  it('never ticks anything that did not pass', () => {
    const proof = studioProof([
      check('SITE_INSPECTION', 'PASS'),
      check('CLIENT_REFERENCE', 'FAIL'),
      check('LABOUR_INSURANCE', 'EXPIRED'),
      check('WARRANTY_TERMS', 'NOT_APPLICABLE'),
    ]);
    const shown = [...proof.left, ...proof.right].map((c) => c.type);
    expect(shown).toEqual(['SITE_INSPECTION']);
    expect(proof.passed).toBe(1);
  });

  it('leads with what a homeowner weighs, not with our paperwork', () => {
    const proof = studioProof(ALL.map((t) => check(t)));
    const first = [proof.left[0]!.type, proof.right[0]!.type];
    expect(first).toEqual(['SITE_INSPECTION', 'CLIENT_REFERENCE']);
    // PAN and Aadhaar start our file and end this list.
    const shown = [...proof.left, ...proof.right].map((c) => c.type);
    expect(shown).not.toContain('PAN_NAME_MATCH');
    expect(shown).not.toContain('CONTACT_REACHABLE');
  });

  it('deals alternately, so the two columns stay balanced', () => {
    const proof = studioProof(ALL.map((t) => check(t)));
    expect(proof.left).toHaveLength(3);
    expect(proof.right).toHaveLength(3);
    expect(Math.abs(proof.left.length - proof.right.length)).toBeLessThanOrEqual(1);
  });

  it('balances an odd number too, with the extra on the left', () => {
    const proof = studioProof(
      ['SITE_INSPECTION', 'CLIENT_REFERENCE', 'LABOUR_INSURANCE'].map((t) => check(t as CheckType)),
    );
    expect(proof.left.map((c) => c.type)).toEqual(['SITE_INSPECTION', 'LABOUR_INSURANCE']);
    expect(proof.right.map((c) => c.type)).toEqual(['CLIENT_REFERENCE']);
    expect(proof.more).toBe(0);
  });

  it('counts the rest rather than hiding them', () => {
    const proof = studioProof(ALL.map((t) => check(t)));
    expect(proof.passed).toBe(15);
    expect(proof.left.length + proof.right.length + proof.more).toBe(15);
    expect(proof.more).toBe(9);
  });

  it('carries the long name and the source alongside the short one', () => {
    const proof = studioProof([check('GST_FILING_HISTORY')]);
    const chip = proof.left[0]!;
    expect(chip.text).toBe('12 months of GST');
    expect(chip.label).toBe(CHECK_LABELS.GST_FILING_HISTORY);
    expect(chip.source).toBe('Our team');
  });
});

describe('the chip vocabulary', () => {
  it('has a short form for every check type', () => {
    // A CheckType added without a line here would fall back to the full label
    // and overflow a 12rem column. The compiler catches a missing key; this
    // catches a key added as an empty string or left as the long name.
    for (const type of ALL) {
      expect(CHECK_CHIPS[type], type).toBeTruthy();
      expect(CHECK_CHIPS[type].length, `${type} is too long for the chip`).toBeLessThanOrEqual(20);
    }
  });
});

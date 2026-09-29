import { describe, it, expect } from 'vitest';
import { BENEFITS, benefitsPass, stageOf } from '@/modules/portal/benefits';

describe('the benefits pass', () => {
  it('never shows a benefit whose terms are not written', () => {
    const shown = benefitsPass('HANDOVER').map((b) => b.id);
    for (const b of BENEFITS.filter((x) => x.terms === null)) expect(shown).not.toContain(b.id);
  });

  it('says what unlocks each one, available first', () => {
    const pass = benefitsPass('START');
    expect(pass[0]!.state).toBe('available');
    const discount = pass.find((b) => b.id === 'curated-discount')!;
    expect(discount.state).toBe('unlocks');
    expect(discount.when).toBe('when you sign with a studio through us');
  });

  it('opens up as the customer moves along', () => {
    expect(benefitsPass('SIGNED').every((b) => b.state === 'available')).toBe(true);
  });

  it('turns on a benefit the moment its terms are written', () => {
    const withTerms = BENEFITS.map((b) => (b.id === 'referral' ? { ...b, terms: 'Refer a friend…' } : b));
    expect(benefitsPass('START', withTerms).some((b) => b.id === 'referral')).toBe(true);
  });

  it('reads the stage from facts we hold', () => {
    expect(stageOf({ briefDone: true, callBooked: false, introduced: false, signed: false })).toBe('BRIEF_DONE');
    expect(stageOf({ briefDone: true, callBooked: true, introduced: true, signed: false })).toBe('INTRODUCED');
  });
});

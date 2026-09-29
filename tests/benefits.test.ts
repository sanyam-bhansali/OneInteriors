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
    expect(benefitsPass('SIGNED').filter((b) => b.state === 'unlocks').map((b) => b.id)).toEqual(['cinematic-shoot', 'onehamper']);
    expect(benefitsPass('HANDOVER').every((b) => b.state === 'available')).toBe(true);
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

describe('the owner’s terms, 30 Sep 2026', () => {
  it('shows every benefit, each with its terms', () => {
    expect(BENEFITS.every((b) => b.terms)).toBe(true);
    expect(benefitsPass('HANDOVER')).toHaveLength(BENEFITS.length);
  });

  it('offers the cab once a studio meeting is set up, not before', () => {
    const cab = (stage: Parameters<typeof benefitsPass>[0]) => benefitsPass(stage).find((b) => b.id === 'free-cab')!;
    expect(cab('CALL_BOOKED').state).toBe('unlocks');
    expect(cab('INTRODUCED').state).toBe('available');
  });

  it('reaches handover only when the tracker says so', () => {
    expect(stageOf({ briefDone: true, callBooked: true, introduced: true, signed: true })).toBe('SIGNED');
    expect(stageOf({ briefDone: true, callBooked: true, introduced: true, signed: true, handedOver: true })).toBe('HANDOVER');
  });
});

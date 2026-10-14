import { describe, expect, it } from 'vitest';
import { CALL_MENU, attemptLine, cleanMinutes, cleanReactions, pickedUpOutcome, reactionLine } from '@/modules/studio-practice/call-log';
import { isCallOutcome } from '@/modules/studio-practice/event-copy';

describe('Log call, AxLeads style', () => {
  it('lists AxLeads’ six results, and every one but Picked up is one of our outcomes', () => {
    expect(CALL_MENU.map((m) => m.label)).toEqual(['Picked up', 'No answer', 'Busy', 'Switched off', 'Voicemail', 'Wrong number']);
    for (const m of CALL_MENU) if (m.id !== 'picked_up') expect(isCallOutcome(m.id)).toBe(true);
  });

  it('keeps only known reactions, once, in the list’s order', () => {
    expect(cleanReactions(['not_interested', 'interested', 'interested', 'hack', 3])).toEqual(['interested', 'not_interested']);
    expect(cleanReactions('interested')).toEqual([]);
  });

  it('turns what they said into our outcome, so the follow-up rules still apply', () => {
    expect(pickedUpOutcome([])).toBe('spoke');
    expect(pickedUpOutcome(['interested', 'wants_visit'])).toBe('spoke');
    expect(pickedUpOutcome(['call_back'])).toBe('busy');
    expect(pickedUpOutcome(['call_back', 'not_interested'])).toBe('not_interested');
  });

  it('accepts sensible call lengths only', () => {
    expect(cleanMinutes('6')).toBe(6);
    expect(cleanMinutes(2.4)).toBe(2);
    expect(cleanMinutes('')).toBeNull();
    expect(cleanMinutes(0)).toBeNull();
    expect(cleanMinutes(9999)).toBeNull();
    expect(cleanMinutes('abc')).toBeNull();
  });

  it('writes a readable timeline line and counts this call as the next attempt', () => {
    expect(reactionLine(['interested', 'wants_visit'], 6)).toBe('Interested, Wants a site visit · 6 min');
    expect(reactionLine([], 4)).toBe('4 min');
    expect(reactionLine([], null)).toBe('');
    expect(attemptLine(1)).toBe('Logs the call · attempt 2');
    expect(attemptLine(0)).toBe('Logs the call · attempt 1');
  });
});

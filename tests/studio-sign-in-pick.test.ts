import { describe, expect, it } from 'vitest';
import { asPicked, codeDigits, defaultVia, roleMismatch, stepDots } from '@/app/studio-sign-in/pick';

describe('the role picked on the studio sign-in', () => {
  it('accepts only the five doors', () => {
    expect(asPicked('SALES')).toBe('SALES');
    expect(asPicked('SUPERVISOR')).toBe('SUPERVISOR');
    expect(asPicked('ACCOUNTS')).toBeNull();
    expect(asPicked('owner')).toBeNull();
    expect(asPicked(undefined)).toBeNull();
    expect(asPicked({ role: 'OWNER' })).toBeNull();
  });

  it('is a mismatch when the team list says otherwise', () => {
    expect(roleMismatch('SALES', 'SALES')).toBe(false);
    expect(roleMismatch('DESIGNER', 'SALES')).toBe(true);
    expect(roleMismatch('OWNER', 'PM')).toBe(true);
    expect(roleMismatch('PM', 'PM')).toBe(false);
  });

  it('an accounts member has no card, so every card is a mismatch', () => {
    for (const p of ['SALES', 'DESIGNER', 'PM', 'OWNER'] as const) expect(roleMismatch(p, 'ACCOUNTS')).toBe(true);
  });

  it('no pick and the site door are never a mismatch', () => {
    expect(roleMismatch(null, 'OWNER')).toBe(false);
    expect(roleMismatch('SUPERVISOR', 'SUPERVISOR')).toBe(false);
    expect(roleMismatch('SUPERVISOR', 'OWNER')).toBe(false);
  });

  it('a supervisor who picks a card hears their real role', () => {
    expect(roleMismatch('SALES', 'SUPERVISOR')).toBe(true);
  });

  it('offers email first only to the owner', () => {
    expect(defaultVia('OWNER')).toBe('email');
    expect(defaultVia('SALES')).toBe('phone');
    expect(defaultVia('SUPERVISOR')).toBe('phone');
    expect(defaultVia(null)).toBe('phone');
  });

  it('lights the step dots as in the design', () => {
    expect(stepDots('role')).toEqual(['on', '', '']);
    expect(stepDots('contact')).toEqual(['done', 'on', '']);
    expect(stepDots('code')).toEqual(['done', 'done', 'on']);
    expect(stepDots('done')).toEqual(['done', 'done', 'done']);
  });

  it('keeps six digits of a pasted code', () => {
    expect(codeDigits('48 17 26')).toBe('481726');
    expect(codeDigits('Your code is 123456789')).toBe('123456');
    expect(codeDigits('')).toBe('');
  });
});

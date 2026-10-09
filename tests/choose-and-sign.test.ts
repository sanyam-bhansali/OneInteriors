import { describe, expect, it } from 'vitest';
import { canTransition } from '@/modules/studio/appointment-rules';

describe('choose & sign: the customer answering a visit', () => {
  it('may confirm or decline a time the studio proposed', () => {
    expect(canTransition('PROPOSED', 'CONFIRMED', 'CUSTOMER')).toBe(true);
    expect(canTransition('PROPOSED', 'CANCELLED', 'CUSTOMER')).toBe(true);
  });

  it('may not record whether a visit happened', () => {
    expect(canTransition('CONFIRMED', 'COMPLETED', 'CUSTOMER')).toBe(false);
    expect(canTransition('CONFIRMED', 'NO_SHOW', 'CUSTOMER')).toBe(false);
  });

  it('may not undo a confirmed visit from the app', () => {
    expect(canTransition('CONFIRMED', 'CANCELLED', 'CUSTOMER')).toBe(false);
  });

  it('leaves studio and ops rules as they were', () => {
    expect(canTransition('CONFIRMED', 'NO_SHOW', 'STUDIO')).toBe(false);
    expect(canTransition('CONFIRMED', 'NO_SHOW', 'OPS')).toBe(true);
  });
});

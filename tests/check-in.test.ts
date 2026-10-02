import { describe, it, expect } from 'vitest';
import { checkCheckIn, checkInDue, communicationRating } from '@/modules/studio/check-in';

const NOW = new Date('2026-10-10T10:00:00Z');
const meeting = (over: Partial<{ kind: string; status: string; startsAt: Date }> = {}) => ({
  kind: 'FIRST_MEETING',
  status: 'CONFIRMED',
  startsAt: new Date('2026-10-05T05:30:00Z'),
  ...over,
});

describe('check-in', () => {
  it('is due once the first meeting has happened, and only once', () => {
    expect(checkInDue([meeting()], false, NOW)).toBe(true);
    expect(checkInDue([meeting()], true, NOW)).toBe(false);
    expect(checkInDue([meeting({ startsAt: new Date('2026-10-12T05:30:00Z') })], false, NOW)).toBe(false);
    expect(checkInDue([meeting({ status: 'CANCELLED' })], false, NOW)).toBe(false);
    expect(checkInDue([meeting({ kind: 'SITE_VISIT' })], false, NOW)).toBe(false);
  });

  it('becomes a rating only with three or more', () => {
    expect(communicationRating([5, 4])).toBeNull();
    expect(communicationRating([5, 4, 3])).toBe(4);
    expect(communicationRating([5, 5, 4, 4])).toBe(4.5);
  });

  it('checks the answers', () => {
    expect(checkCheckIn({ matched: 'YES', communication: 4, note: '' })).toEqual({});
    expect(Object.keys(checkCheckIn({ matched: 'MAYBE', communication: 9, note: '' })).sort()).toEqual(['communication', 'matched']);
  });
});

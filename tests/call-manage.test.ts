import { describe, it, expect } from 'vitest';
import { changeState, cleanToken, newManageToken } from '@/modules/consultation/manage';

const NOW = new Date('2026-10-03T05:00:00Z');
const at = (mins: number) => new Date(NOW.getTime() + mins * 60_000);

describe('moving or cancelling a booked call', () => {
  it('is open until an hour before', () => {
    expect(changeState({ status: 'scheduled', scheduledFor: at(120) }, NOW)).toBe('open');
    expect(changeState({ status: 'scheduled', scheduledFor: at(30) }, NOW)).toBe('too-late');
    expect(changeState({ status: 'scheduled', scheduledFor: at(-5) }, NOW)).toBe('past');
  });

  it('is closed once the call is not a live booking', () => {
    expect(changeState({ status: 'cancelled', scheduledFor: at(120) }, NOW)).toBe('closed');
    expect(changeState({ status: 'requested', scheduledFor: null }, NOW)).toBe('closed');
  });

  it('uses unguessable tokens and refuses anything else in the URL', () => {
    const t = newManageToken();
    expect(cleanToken(t)).toBe(t);
    expect(cleanToken('short')).toBeNull();
    expect(cleanToken(`${t.slice(0, 31)}/`)).toBeNull();
  });
});

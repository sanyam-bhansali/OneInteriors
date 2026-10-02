import { describe, it, expect } from 'vitest';
import {
  cleanCode,
  cleanExtras,
  makeCode,
  positionOf,
  publicStats,
  unlocksFor,
  type QueueRow,
} from '@/modules/waitlist/queue';

const row = (code: string, joined: number, referrals = 0, answered = false): QueueRow => ({ code, joined, referrals, answered });

describe('the waitlist queue', () => {
  it('starts in joining order', () => {
    const rows = [row('AAAAAAA', 1), row('BBBBBBB', 2), row('CCCCCCC', 3)];
    expect(positionOf('CCCCCCC', rows)).toBe(3);
  });

  it('moves you up 25 places a friend, and 20 for answering', () => {
    const rows = Array.from({ length: 60 }, (_, i) => row(`C${String(i).padStart(6, '0')}`, i + 1));
    rows[49] = row('C000049', 50, 1);
    expect(positionOf('C000049', rows)).toBe(25);
    rows[49] = row('C000049', 50, 1, true);
    expect(positionOf('C000049', rows)).toBe(5);
  });

  it('makes and checks codes that are safe to read aloud', () => {
    const code = makeCode(new Uint8Array([0, 1, 2, 3, 4, 5, 6]));
    expect(cleanCode(code.toLowerCase())).toBe(code);
    expect(cleanCode('O0I1ABC')).toBeNull();
    expect(cleanCode(42)).toBeNull();
  });
});

describe('what referrals unlock', () => {
  it('gives the free call to the first thousand, and to anyone with three friends', () => {
    expect(unlocksFor(10, 0, 0).freeCall).toBe(true);
    expect(unlocksFor(1500, 2, 0).freeCall).toBe(false);
    expect(unlocksFor(1500, 3, 0)).toMatchObject({ freeCall: true, freeCallReason: 'referrals' });
  });

  it('gives the cab at five friends, or to a whole society at twenty-five', () => {
    expect(unlocksFor(1500, 5, 0).cab).toBe(true);
    expect(unlocksFor(1500, 0, 25)).toMatchObject({ cab: true, cabReason: 'society', priority: true });
  });

  it('names the next rung', () => {
    expect(unlocksFor(1500, 0, 0).next).toEqual({ friends: 1, unlocks: 'move up 25 places' });
    expect(unlocksFor(1500, 1, 0).next?.friends).toBe(2);
    expect(unlocksFor(10, 1, 0).next).toEqual({ friends: 4, unlocks: 'a free cab to the studio' });
  });
});

describe('what the page may say', () => {
  it('hides the count below a hundred, and counts the free calls down', () => {
    expect(publicStats(3)).toEqual({ total: null, launchAt: 2000, freeCallsLeft: 997 });
    expect(publicStats(140).total).toBe(140);
    expect(publicStats(1200).freeCallsLeft).toBe(0);
  });

  it('keeps only answers it knows', () => {
    expect(cleanExtras({ possession: 'HAVE_KEYS', bhk: '3', society: '  Gera <b>WOJ</b> ' })).toEqual({
      possession: 'HAVE_KEYS',
      bhk: '3',
      society: 'Gera bWOJ/b',
    });
    expect(cleanExtras({ possession: 'SOON', bhk: '7' })).toEqual({ possession: null, bhk: null, society: null });
  });
});

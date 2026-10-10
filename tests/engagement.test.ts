import { describe, expect, it } from 'vitest';
import { COINS, expiresOn, istDay, streakAwardRef, streakOf } from '@/modules/engagement/coin-rules';
import { isHit, mondayOf } from '@/modules/engagement/challenge';

describe('Home Coins rules', () => {
  it('pays what the owner set', () => {
    expect(COINS.QUIZ.coins).toBe(100);
    expect(COINS.SIGNED.coins).toBe(1000);
    expect(COINS.DAILY_UPDATE.coins).toBe(10);
    expect(COINS.REFERRAL_SIGNED.coins).toBe(5000);
    expect(COINS.SOCIETY_CIRCLE.coins).toBe(10000);
  });

  it('counts a streak ending today or yesterday', () => {
    const days = ['2026-10-09', '2026-10-08', '2026-10-07', '2026-10-05'];
    expect(streakOf(days, '2026-10-09')).toBe(3);
    expect(streakOf(days, '2026-10-10')).toBe(3);
    expect(streakOf(days, '2026-10-11')).toBe(0);
  });

  it('pays the streak bonus on every seventh day in a row', () => {
    const week = ['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'];
    expect(streakAwardRef(week, '2026-10-09')).toBe('streak:2026-10-09');
    expect(streakAwardRef(week.slice(1), '2026-10-09')).toBeNull();
  });

  it('dates days in IST', () => {
    expect(istDay(new Date('2026-10-09T20:00:00Z'))).toBe('2026-10-10');
  });

  it('lapses twelve months after handover', () => {
    expect(expiresOn(new Date('2026-12-14T00:00:00Z')).toISOString().slice(0, 10)).toBe('2027-12-14');
  });
});

describe('spot the mistake', () => {
  it('is right only inside the marked circle', () => {
    const c = { x: 0.5, y: 0.5, radius: 0.1 };
    expect(isHit(c, 0.55, 0.52)).toBe(true);
    expect(isHit(c, 0.8, 0.5)).toBe(false);
    expect(isHit(c, Number.NaN, 0.5)).toBe(false);
  });

  it('runs from Monday, IST', () => {
    // Thursday 9 Oct 2026 → Monday 5 Oct.
    expect(mondayOf(new Date('2026-10-09T10:00:00Z')).toISOString().slice(0, 10)).toBe('2026-10-05');
    // Sunday night 11 Oct 23:00 IST is still that week.
    expect(mondayOf(new Date('2026-10-11T17:30:00Z')).toISOString().slice(0, 10)).toBe('2026-10-05');
  });
});

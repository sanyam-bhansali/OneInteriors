import { describe, it, expect } from 'vitest';
import {
  FULL_HOME_DAYS,
  monthLabel,
  monthOf,
  possessionAnswered,
  possessionPhrase,
  readyWindow,
} from '@/modules/brief/possession';

/**
 * Q9 asks about possession instead of a move-in date (29 Sep 2026). The old
 * question promised to flag a date that was too tight and nothing did; these
 * rules are what the new one is allowed to say.
 */

const TODAY = new Date(Date.UTC(2026, 8, 29)); // 29 Sep 2026

describe('possessionAnswered', () => {
  it('accepts keys in hand, and not sure, on their own', () => {
    expect(possessionAnswered({ possessionStatus: 'HAVE_KEYS', possessionOn: null })).toBe(true);
    expect(possessionAnswered({ possessionStatus: 'NOT_SURE', possessionOn: null })).toBe(true);
  });

  it('needs the month when they are expecting possession', () => {
    expect(possessionAnswered({ possessionStatus: 'EXPECTED', possessionOn: null })).toBe(false);
    expect(possessionAnswered({ possessionStatus: 'EXPECTED', possessionOn: '2027-01' })).toBe(true);
  });

  it('is unanswered until they choose', () => {
    expect(possessionAnswered({ possessionStatus: null, possessionOn: '2027-01-01' })).toBe(false);
  });
});

describe('possessionPhrase', () => {
  it('says each answer plainly', () => {
    expect(possessionPhrase({ possessionStatus: 'HAVE_KEYS', possessionOn: null, moveInBy: null })).toBe(
      'Has the keys',
    );
    expect(
      possessionPhrase({ possessionStatus: 'EXPECTED', possessionOn: '2027-01-01', moveInBy: null }),
    ).toBe('Possession expected January 2027');
    expect(possessionPhrase({ possessionStatus: 'NOT_SURE', possessionOn: null, moveInBy: null })).toBe(
      'Possession date not known yet',
    );
  });

  // Briefs written before 29 Sep carry a move-in date and no status. They
  // still reach studios, so they still have to say something.
  it('reads an older brief by its move-in date', () => {
    expect(
      possessionPhrase({ possessionStatus: null, possessionOn: null, moveInBy: '2027-03-01' }),
    ).toBe('Wants to move in by March 2027');
    expect(possessionPhrase({ possessionStatus: null, possessionOn: null, moveInBy: null })).toBeNull();
  });
});

describe('readyWindow', () => {
  it('counts a full home from the keys', () => {
    const w = readyWindow('EXPECTED', '2027-01-01', 'FULL_HOME', TODAY)!;
    const jan = monthOf('2027-01')!.getTime();
    expect(w.from.getTime() - jan).toBe(FULL_HOME_DAYS.min * 86_400_000);
    expect(w.to.getTime() - jan).toBe(FULL_HOME_DAYS.max * 86_400_000);
  });

  it('counts from today when they already have the keys, or the month has passed', () => {
    const keys = readyWindow('HAVE_KEYS', null, 'FULL_HOME', TODAY)!;
    const past = readyWindow('EXPECTED', '2026-05-01', 'FULL_HOME', TODAY)!;
    expect(keys.from.getTime()).toBe(TODAY.getTime() + FULL_HOME_DAYS.min * 86_400_000);
    expect(past.from.getTime()).toBe(keys.from.getTime());
  });

  // The only duration we have evidence for is a full home's. A kitchen window
  // would be a number we made up.
  it('gives no window for any other scope, or with nothing to count from', () => {
    expect(readyWindow('HAVE_KEYS', null, 'KITCHEN_WARDROBE', TODAY)).toBeNull();
    expect(readyWindow('HAVE_KEYS', null, 'SINGLE_ROOM', TODAY)).toBeNull();
    expect(readyWindow('HAVE_KEYS', null, 'RENOVATION', TODAY)).toBeNull();
    expect(readyWindow('NOT_SURE', null, 'FULL_HOME', TODAY)).toBeNull();
    expect(readyWindow('EXPECTED', null, 'FULL_HOME', TODAY)).toBeNull();
  });
});

describe('month parsing', () => {
  it('reads the month input and a full date alike, and refuses junk', () => {
    expect(monthLabel('2026-12')).toBe('December 2026');
    expect(monthLabel('2026-12-01')).toBe('December 2026');
    expect(monthOf('2026-13')).toBeNull();
    expect(monthOf('December')).toBeNull();
    expect(monthOf(null)).toBeNull();
  });
});

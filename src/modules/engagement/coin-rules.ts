/**
 * Home Coins rules (owner, 9 Oct 2026). Pure, and tested.
 *
 * 1 coin = ₹1 with partner brands. Coins cannot be spent on the studio's
 * bill or cashed out, and expire 12 months after handover. Spending opens
 * once partner brands are signed; until then the wallet only earns.
 */

export type CoinKind =
  | 'QUIZ'
  | 'SIGNED'
  | 'DAILY_UPDATE'
  | 'STREAK_7'
  | 'DECISION_ON_TIME'
  | 'SNAG_PHOTO'
  | 'CHALLENGE'
  | 'SHARE_MILESTONE'
  | 'FAMILY_JOINED'
  | 'REFERRAL_SIGNED'
  | 'SOCIETY_CIRCLE';

export const COINS: Record<CoinKind, { coins: number; label: string }> = {
  QUIZ: { coins: 100, label: 'Finished the quiz' },
  SIGNED: { coins: 1000, label: 'Welcome to your project' },
  DAILY_UPDATE: { coins: 10, label: 'Opened the site update' },
  STREAK_7: { coins: 100, label: '7-day streak' },
  DECISION_ON_TIME: { coins: 200, label: 'Decided before the due date' },
  SNAG_PHOTO: { coins: 50, label: 'Reported a snag with a photo' },
  CHALLENGE: { coins: 50, label: 'Spot the mistake' },
  SHARE_MILESTONE: { coins: 25, label: 'Shared a milestone' },
  FAMILY_JOINED: { coins: 100, label: 'A family member joined' },
  REFERRAL_SIGNED: { coins: 5000, label: 'A friend you invited signed' },
  SOCIETY_CIRCLE: { coins: 10000, label: 'Society circle bonus' },
};

/** Milestone shares that earn, in all. */
export const MAX_SHARES = 5;
/** Flats in one society that complete a circle. */
export const CIRCLE_SIZE = 3;
export const STREAK_DAYS = 7;

/** The ways to earn, in the order the wallet lists them. */
export const WAYS_TO_EARN: CoinKind[] = ['DAILY_UPDATE', 'STREAK_7', 'DECISION_ON_TIME', 'SNAG_PHOTO', 'CHALLENGE', 'SHARE_MILESTONE', 'FAMILY_JOINED', 'REFERRAL_SIGNED'];

/** "2026-10-09" in IST, the day a daily award is counted against. */
export function istDay(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/**
 * How many days in a row, ending today or yesterday, have a daily award.
 * A streak survives until the end of the day after its last award.
 */
export function streakOf(days: string[], today: string): number {
  const set = new Set(days);
  const prev = (day: string) => {
    const d = new Date(`${day}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  };
  let cursor = set.has(today) ? today : prev(today);
  let n = 0;
  while (set.has(cursor)) {
    n += 1;
    cursor = prev(cursor);
  }
  return n;
}

/** The streak award's ref when a streak reaches a multiple of seven today, else null. */
export function streakAwardRef(days: string[], today: string): string | null {
  const n = streakOf(days, today);
  return days.includes(today) && n > 0 && n % STREAK_DAYS === 0 ? `streak:${today}` : null;
}

/** Twelve months after handover, as a date — when unspent coins lapse. */
export function expiresOn(handover: Date): Date {
  const d = new Date(handover);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d;
}

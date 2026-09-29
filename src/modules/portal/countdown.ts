/**
 * "Keys in 84 days" — the possession countdown on "Your home" (build queue
 * item 17), with the plan laid against it: when design should start so work
 * can begin the week the keys arrive, and when the home could be ready.
 *
 * Pure, and tested.
 */

import type { Brief } from '@/modules/brief/types';
import { monthOf, readyWindow } from '@/modules/brief/possession';

const DAY = 86_400_000;
/** Design and approvals before work starts: about four weeks. */
export const DESIGN_WEEKS = 4;

export interface Countdown {
  /** "Keys in 84 days", "You have the keys", "Keys this month". */
  headline: string;
  /** The plan, as short dated lines. */
  plan: string[];
}

const month = (d: Date) => d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function countdownFor(
  brief: Pick<Brief, 'possessionStatus' | 'possessionOn' | 'scope'>,
  today = new Date(),
): Countdown | null {
  if (brief.possessionStatus === 'HAVE_KEYS') {
    const ready = readyWindow('HAVE_KEYS', null, brief.scope, today);
    return {
      headline: 'You have the keys',
      plan: [
        'Design can start as soon as you pick a studio',
        ...(ready ? [`Ready between ${month(ready.from)} and ${month(ready.to)}, for a full home`] : []),
      ],
    };
  }
  if (brief.possessionStatus !== 'EXPECTED') return null;
  const keys = monthOf(brief.possessionOn);
  if (!keys) return null;
  const days = Math.ceil((keys.getTime() - today.getTime()) / DAY);
  const designFrom = new Date(keys.getTime() - DESIGN_WEEKS * 7 * DAY);
  const ready = readyWindow('EXPECTED', brief.possessionOn, brief.scope, today);
  return {
    headline: days > 31 ? `Keys in ${days} days` : days > 0 ? 'Keys this month' : 'Keys any day now',
    plan: [
      designFrom > today
        ? `Start design by ${month(designFrom)}, so work can begin when you get the keys`
        : 'Start design now, so work can begin when you get the keys',
      `Keys expected in ${month(keys)}`,
      ...(ready ? [`Ready between ${month(ready.from)} and ${month(ready.to)}, for a full home`] : []),
    ],
  };
}

/**
 * When to call again — the quick choices (AxLeads, owner 12 Oct 2026). Pure,
 * tested in tests/studio-leads-axleads.test.ts. India time, whatever the
 * server's clock says.
 *
 * - **Later today**: 5:30 pm; after 3:30 pm, two hours from now.
 * - **Tomorrow** (the default): the next working day (Monday to Saturday)
 *   at 3:30 pm.
 * - **Pick a date & time**: the person's own.
 *
 * The call outcomes use the same clock: Busy is two hours from now,
 * Switched off is Tomorrow, Voicemail is 4 pm today (or Later today once it
 * is past 4).
 */

import { addDays, istDay, istMinutesOfDay, istTime, isoWeekday } from '@/modules/project/working-days';

export type QuickWhen = 'later-today' | 'tomorrow' | 'pick';
/** How an outcome's next call is timed. */
export type CallClock = 'in2h' | 'later-today' | 'tomorrow' | 'today-16';

export const QUICK_LABELS: Record<QuickWhen, string> = {
  'later-today': 'Later today',
  tomorrow: 'Tomorrow',
  pick: 'Pick a date & time',
};

export const QUICK_DEFAULT: QuickWhen = 'tomorrow';

const H = 3_600_000;

/** The next working day (Mon–Sat) after `day`. */
export function nextWorkingDay(day: string): string {
  let d = addDays(day, 1);
  while (isoWeekday(d) === 7) d = addDays(d, 1);
  return d;
}

/** 5:30 pm IST today; from 3:30 pm on, two hours from now. */
export function laterToday(now: Date): Date {
  return istMinutesOfDay(now) < 15 * 60 + 30 ? istTime(istDay(now), '17:30') : new Date(now.getTime() + 2 * H);
}

/** The next working day (Mon–Sat) at 3:30 pm IST. */
export function tomorrowCall(now: Date): Date {
  return istTime(nextWorkingDay(istDay(now)), '15:30');
}

/** When an outcome's next call falls. Always after `now`. */
export function clockAt(clock: CallClock, now: Date): Date {
  switch (clock) {
    case 'in2h':
      return new Date(now.getTime() + 2 * H);
    case 'later-today':
      return laterToday(now);
    case 'tomorrow':
      return tomorrowCall(now);
    case 'today-16':
      return istMinutesOfDay(now) < 16 * 60 ? istTime(istDay(now), '16:00') : laterToday(now);
  }
}

/** A quick choice's instant (null for "pick"). */
export function quickAt(q: QuickWhen, now: Date): Date | null {
  if (q === 'later-today') return laterToday(now);
  if (q === 'tomorrow') return tomorrowCall(now);
  return null;
}

/** The instant as the day and time inputs show it, in India. */
export function istInputs(at: Date): { day: string; time: string } {
  const iso = new Date(at.getTime() + 330 * 60_000).toISOString();
  return { day: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/** "Today 5:30 pm", "Tue 13 Oct, 3:30 pm" — for the button that says what it will set. */
export function whenLabel(at: Date, now: Date): string {
  const { day, time } = istInputs(at);
  const [h, m] = time.split(':').map(Number) as [number, number];
  const clock = `${h % 12 === 0 ? 12 : h % 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
  const today = istDay(now);
  if (day === today) return `Today ${clock}`;
  if (day === addDays(today, 1)) return `Tomorrow ${clock}`;
  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][isoWeekday(day) - 1];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${wd} ${Number(day.slice(8, 10))} ${months[Number(day.slice(5, 7)) - 1]}, ${clock}`;
}

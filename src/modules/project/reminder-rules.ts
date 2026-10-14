/**
 * Which daily-update reminder is due for a project at a given moment, and
 * the studio's update score — both computed from the site log against the
 * studio's working days. Pure (tests/reminder-rules.test.ts); the cron
 * (`/api/cron/site-reminders`) and the office screens read it. Nothing here
 * is stored: a sent reminder is a `HomeProjectEvent` with a dedupe key, and
 * the score is recomputed from `HomeSiteLog` every time.
 *
 * The brief (§6, Phase 2), times in IST:
 *
 * - 18:00 on a working day with no post → the assigned supervisor.
 * - 21:00 still nothing → flagged for the PM and the owner (the office's
 *   "Needs attention today" already shows "No update yet today") and the
 *   customer sees "No update from the studio today".
 * - A second missed working day in a row → the owner, and the score drops.
 * - Assured projects (owner's promise): a missed day also goes to One
 *   Interiors ops, who call the studio.
 *
 * "A post" is any UPDATE or NOBODY for the day: saying honestly that nobody
 * came is an update. A day off in the studio's calendar needs no post.
 */

import { addDays, daysBetween, istDay, istMinutesOfDay, isWorkingDay, previousWorkingDay, type StudioCalendar } from './working-days';

export const REMIND_AT = '18:00';
export const FLAG_AT = '21:00';
const REMIND_MIN = 18 * 60;
const FLAG_MIN = 21 * 60;

export type ReminderKind = 'supervisor' | 'flag' | 'owner' | 'ops';

export interface DueReminder {
  kind: ReminderKind;
  /** The IST day it is about. */
  day: string;
}

export interface ReminderInput {
  now: Date;
  calendar: StudioCalendar;
  /** Days ('YYYY-MM-DD') with an UPDATE or NOBODY post. */
  postedDays: ReadonlySet<string>;
  /**
   * The first day reminders apply: the project's site work has started.
   * Earlier days are never "missed".
   */
  activeSince: string;
  /** False once handed over, or while the project is only in design: nobody is expected on site. */
  active: boolean;
  plan: 'BASIC' | 'ASSURED';
}

/** Whether a working day counts as missed by `now`: no post, and 21:00 has passed (or the day is over). */
export function isMissed(day: string, input: Pick<ReminderInput, 'now' | 'calendar' | 'postedDays' | 'activeSince'>): boolean {
  if (daysBetween(input.activeSince, day) < 0 || !isWorkingDay(day, input.calendar) || input.postedDays.has(day)) return false;
  const today = istDay(input.now);
  const ago = daysBetween(day, today);
  if (ago < 0) return false;
  return ago > 0 || istMinutesOfDay(input.now) >= FLAG_MIN;
}

/**
 * The reminders due now for today. Running the cron again (or late) is
 * harmless: each one is sent once per project, day and kind
 * (`reminderKey`, written with `recordEventOnce`).
 */
export function remindersDue(input: ReminderInput): DueReminder[] {
  const day = istDay(input.now);
  if (!input.active) return [];
  if (daysBetween(input.activeSince, day) < 0) return [];
  if (!isWorkingDay(day, input.calendar) || input.postedDays.has(day)) return [];
  const minutes = istMinutesOfDay(input.now);
  const out: DueReminder[] = [];
  if (minutes >= REMIND_MIN) out.push({ kind: 'supervisor', day });
  if (minutes >= FLAG_MIN) {
    out.push({ kind: 'flag', day });
    if (input.plan === 'ASSURED') out.push({ kind: 'ops', day });
    const before = previousWorkingDay(day, input.calendar);
    if (before && isMissed(before, input)) out.push({ kind: 'owner', day });
  }
  return out;
}

/** The dedupe key for one reminder: 'reminder|<project>|<day>|<kind>'. */
export const reminderParts = (projectId: string, r: DueReminder): [string, string, string, string] => ['reminder', projectId, r.day, r.kind];

/** Working days from `from` to `to` (inclusive) that count as missed by `now`. Newest first. */
export function missedDays(from: string, to: string, input: Pick<ReminderInput, 'now' | 'calendar' | 'postedDays' | 'activeSince'>): string[] {
  const out: string[] = [];
  if (daysBetween(from, to) < 0) return out;
  for (let d = to; daysBetween(from, d) >= 0; d = addDays(d, -1)) if (isMissed(d, input)) out.push(d);
  return out;
}

export interface UpdateScore {
  /** Working days that needed a post (today only once 21:00 has passed). */
  due: number;
  /** Of those, the days with a post. */
  posted: number;
  /** posted / due, as a whole percent; null when nothing was due yet. */
  pct: number | null;
  /** Missed days in a row up to the latest due day. */
  streakMissed: number;
}

/**
 * How reliably the studio posts: over the last `window` calendar days (from
 * `activeSince` at the earliest), the share of working days with a post.
 * A day posted late from an offline phone counts for the day it was taken.
 */
export function updateScore(input: Pick<ReminderInput, 'now' | 'calendar' | 'postedDays' | 'activeSince'>, window = 30): UpdateScore {
  const today = istDay(input.now);
  const start = addDays(today, -(window - 1));
  const from = daysBetween(start, input.activeSince) > 0 ? input.activeSince : start;
  let due = 0;
  let posted = 0;
  let streakMissed = 0;
  let streakOpen = true;
  for (let d = today; daysBetween(from, d) >= 0; d = addDays(d, -1)) {
    if (!isWorkingDay(d, input.calendar)) continue;
    const isDue = d !== today || istMinutesOfDay(input.now) >= FLAG_MIN || input.postedDays.has(d);
    if (!isDue) continue;
    due += 1;
    if (input.postedDays.has(d)) {
      posted += 1;
      streakOpen = false;
    } else if (streakOpen) {
      streakMissed += 1;
    }
  }
  return { due, posted, pct: due ? Math.round((posted * 100) / due) : null, streakMissed };
}

/** Several projects' scores as one studio score. */
export function combineScores(scores: readonly UpdateScore[]): UpdateScore {
  const due = scores.reduce((a, s) => a + s.due, 0);
  const posted = scores.reduce((a, s) => a + s.posted, 0);
  return { due, posted, pct: due ? Math.round((posted * 100) / due) : null, streakMissed: Math.max(0, ...scores.map((s) => s.streakMissed)) };
}

/**
 * The first day site mode could be used. A project that was running before
 * it existed is not "missing" the days before it: those had no daily post to
 * miss (ops posted the occasional update by hand).
 */
export const SITE_MODE_FROM = '2026-10-12';

/**
 * The first day a post is expected: the day after design was marked done
 * when the plan has a design stage, else the project's start day. A first
 * post before that day moves it earlier (the site started early).
 */
export function activeSinceOf(p: {
  startOn: Date;
  stages: readonly { kind: string; actualEnd: Date | null }[];
  firstPostDay?: string | null;
}): string {
  const design = p.stages.find((s) => s.kind === 'DESIGN');
  let since = design?.actualEnd ? addDays(istDay(design.actualEnd), 1) : istDay(p.startOn);
  if (daysBetween(since, SITE_MODE_FROM) > 0) since = SITE_MODE_FROM;
  if (p.firstPostDay && daysBetween(p.firstPostDay, since) > 0) since = p.firstPostDay;
  return since;
}

/**
 * Whether a project needs a daily post at all: started, not handed over, and
 * past design (nobody works on site while drawings are made). `stages` is the
 * plan built at signing; a project without one is active once started.
 */
export function needsDailyPost(p: {
  startOn: Date;
  now: Date;
  stages: readonly { kind: string; actualEnd: Date | null }[];
  doneStages?: readonly string[];
}): boolean {
  if (daysBetween(istDay(p.startOn), istDay(p.now)) < 0) return false;
  if (p.stages.length === 0) return !(p.doneStages ?? []).includes('HANDOVER');
  const current = p.stages.find((s) => s.actualEnd === null);
  return current !== undefined && current.kind !== 'DESIGN';
}

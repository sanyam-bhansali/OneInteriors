/**
 * Real 30-minute slots for the expert call — pick one and it is booked
 * (plan §9). No "when suits you?" box, and no waiting for a call-back to fix
 * a time.
 *
 * Built from each expert's weekly hours (set by ops), less their blocked
 * days, less what is already booked, in India Standard Time — the only
 * calendar the customer and the expert share. The database refuses a double
 * booking outright (unique on expert + start); this module decides what to
 * offer.
 *
 * Pure, and tested.
 */

export const SLOT_MINS = 30;
/** How far ahead we offer. */
export const DAYS_AHEAD = 10;
/** No slot sooner than this — the expert needs time to read the brief. */
export const LEAD_MINS = 180;

const IST_OFFSET_MIN = 330;
const MIN = 60_000;
const DAY = 86_400_000;

export interface WeeklyHours {
  expertUserId: string;
  /** 0 = Sunday … 6 = Saturday, in IST. */
  weekday: number;
  /** Minutes after IST midnight. */
  startMin: number;
  endMin: number;
}

export interface Slot {
  /** ISO instant, UTC. */
  startsAt: string;
  /** The experts free at this time; the booking takes the first. */
  experts: string[];
}

/** The IST calendar date (YYYY-MM-DD) of an instant. */
export function istDate(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MIN * MIN).toISOString().slice(0, 10);
}

/** The instant at `minutes` after IST midnight on an IST date. */
export function istInstant(date: string, minutes: number): Date {
  return new Date(Date.parse(`${date}T00:00:00Z`) - IST_OFFSET_MIN * MIN + minutes * MIN);
}

function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function checkHours(h: { weekday: number; startMin: number; endMin: number }): string | null {
  if (!Number.isInteger(h.weekday) || h.weekday < 0 || h.weekday > 6) return 'Pick a day of the week.';
  if (!Number.isInteger(h.startMin) || !Number.isInteger(h.endMin)) return 'Whole minutes, please.';
  if (h.startMin < 7 * 60 || h.endMin > 22 * 60) return 'Between 7 am and 10 pm.';
  if (h.endMin - h.startMin < SLOT_MINS) return 'At least one half-hour.';
  if (h.startMin % SLOT_MINS !== 0 || h.endMin % SLOT_MINS !== 0) return 'On the hour or the half-hour.';
  return null;
}

/**
 * Every open slot from `now` for `days` IST days: the union across experts,
 * each slot listing who is free for it.
 */
export function openSlots({
  hours,
  blocked,
  booked,
  now,
  days = DAYS_AHEAD,
}: {
  hours: WeeklyHours[];
  /** expertUserId → IST dates they are away. */
  blocked: Map<string, Set<string>>;
  /** expertUserId → ISO starts already booked. */
  booked: Map<string, Set<string>>;
  now: Date;
  days?: number;
}): Slot[] {
  const earliest = now.getTime() + LEAD_MINS * MIN;
  const bySlot = new Map<string, string[]>();
  const today = istDate(now);
  for (let d = 0; d < days; d++) {
    const date = istDate(new Date(Date.parse(`${today}T12:00:00Z`) + d * DAY));
    const weekday = weekdayOf(date);
    for (const h of hours) {
      if (h.weekday !== weekday || checkHours(h)) continue;
      if (blocked.get(h.expertUserId)?.has(date)) continue;
      for (let m = h.startMin; m + SLOT_MINS <= h.endMin; m += SLOT_MINS) {
        const at = istInstant(date, m);
        if (at.getTime() < earliest) continue;
        const iso = at.toISOString();
        if (booked.get(h.expertUserId)?.has(iso)) continue;
        const list = bySlot.get(iso) ?? [];
        if (!list.includes(h.expertUserId)) list.push(h.expertUserId);
        bySlot.set(iso, list);
      }
    }
  }
  return [...bySlot.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([startsAt, experts]) => ({ startsAt, experts: experts.sort() }));
}

/** "Saturday 4 October · 11:30 am" — for the slot grid and the confirmation. */
export function slotLabel(iso: string): { day: string; time: string } {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' }),
    time: d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }),
  };
}

// ── The calendar invite ────────────────────────────────────────

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** An RFC 5545 invite for one call — what the confirmation email carries. */
export function icsFor({
  uid,
  startsAt,
  durationMins = SLOT_MINS,
  title,
  description,
  now = new Date(),
  sequence = 0,
  cancelled = false,
}: {
  uid: string;
  startsAt: string;
  durationMins?: number;
  title: string;
  description: string;
  /**
   * Bumped on every change, so a calendar that already holds this call
   * updates the entry (same UID) instead of adding a second one.
   */
  sequence?: number;
  /** A cancellation removes the entry from their calendar. */
  cancelled?: boolean;
  now?: Date;
}): string {
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMins * MIN);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//One Interiors//Expert call//EN',
    `METHOD:${cancelled ? 'CANCEL' : 'REQUEST'}`,
    'BEGIN:VEVENT',
    `UID:${uid}@oneinteriors.in`,
    `DTSTAMP:${icsDate(now)}`,
    `SEQUENCE:${sequence}`,
    ...(cancelled ? ['STATUS:CANCELLED'] : []),
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(title)}`,
    `DESCRIPTION:${icsText(description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

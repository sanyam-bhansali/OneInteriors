/**
 * What may happen to an appointment, and who may do it.
 *
 * The state machine lives here rather than inside the server module so it can
 * be exhaustively tested — a calendar with a wrong transition is not a visual
 * bug, it is somebody driving to Wakad for a meeting that was never confirmed.
 *
 * Pure and tested. No `server-only` — see CONTRIBUTING §9.5.
 */

export type AppointmentKindName = 'FIRST_MEETING' | 'SITE_VISIT' | 'FOLLOW_UP';
export type AppointmentStatusName =
  | 'PROPOSED'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'CANCELLED';
export type NoShowPartyName = 'CUSTOMER' | 'STUDIO';

/** Who is asking. Ops can do everything a studio can, and more. */
export type Actor = 'STUDIO' | 'OPS';

export const KIND_LABELS: Record<AppointmentKindName, string> = {
  FIRST_MEETING: 'First meeting',
  SITE_VISIT: 'Site visit',
  FOLLOW_UP: 'Follow-up',
};

export const STATUS_LABELS: Record<AppointmentStatusName, string> = {
  PROPOSED: 'Time proposed',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Done',
  NO_SHOW: 'Nobody came',
  CANCELLED: 'Cancelled',
};

/**
 * Which transitions exist at all, regardless of who is asking.
 *
 * `COMPLETED`, `NO_SHOW` and `CANCELLED` are terminal. An appointment that
 * happened is a record; editing it afterwards is how a delivery history stops
 * being evidence. A mistake is corrected by a new row, not by rewriting the old
 * one — the same rule the escrow and audit tables follow.
 */
const TRANSITIONS: Record<AppointmentStatusName, AppointmentStatusName[]> = {
  PROPOSED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'NO_SHOW', 'CANCELLED'],
  COMPLETED: [],
  NO_SHOW: [],
  CANCELLED: [],
};

/**
 * What a STUDIO may do, as opposed to what is possible.
 *
 * The studio cannot mark a no-show. That fact ends up in their own delivery
 * record, both sides will have a view of what happened, and letting one party
 * write the other's absence into a permanent record is how a marketplace
 * acquires a reputation for being unfair. It goes to ops.
 */
const STUDIO_MAY: AppointmentStatusName[] = ['CONFIRMED', 'COMPLETED', 'CANCELLED'];

export function canTransition(
  from: AppointmentStatusName,
  to: AppointmentStatusName,
  actor: Actor,
): boolean {
  if (!TRANSITIONS[from].includes(to)) return false;
  if (actor === 'OPS') return true;
  return STUDIO_MAY.includes(to);
}

export function isTerminal(status: AppointmentStatusName): boolean {
  return TRANSITIONS[status].length === 0;
}

/**
 * Refuse a no-show without a named party.
 *
 * `noShowBy` is nullable in the schema because it is null for every other
 * status, which means the type system cannot enforce the one case where it
 * matters. "Nobody came" with nobody named is a row that helps no one and will
 * be argued about later.
 */
export function validateTransition(
  to: AppointmentStatusName,
  noShowBy: NoShowPartyName | null,
): { ok: true } | { ok: false; error: string } {
  if (to === 'NO_SHOW' && noShowBy === null) {
    return { ok: false, error: 'Say who did not turn up. A no-show with nobody named settles nothing.' };
  }
  if (to !== 'NO_SHOW' && noShowBy !== null) {
    return { ok: false, error: 'Only a no-show carries a missing party.' };
  }
  return { ok: true };
}

export interface AppointmentLike {
  startsAt: Date;
  durationMins: number;
  status: AppointmentStatusName;
}

/** Has this appointment's slot passed? */
export function hasPassed(appointment: AppointmentLike, now: Date = new Date()): boolean {
  const end = appointment.startsAt.getTime() + appointment.durationMins * 60_000;
  return end < now.getTime();
}

/**
 * Appointments that are over but still say they are coming up.
 *
 * Surfaced as a nudge, never acted on automatically — see the schema note on
 * `noShowBy`. A missed appointment has too many innocent explanations for a
 * cron job to judge, and the wrong judgement lands in a studio's permanent
 * record.
 */
export function needsOutcome<T extends AppointmentLike>(appointments: T[], now: Date = new Date()): T[] {
  return appointments.filter(
    (a) => (a.status === 'CONFIRMED' || a.status === 'PROPOSED') && hasPassed(a, now),
  );
}

export function upcoming<T extends AppointmentLike>(appointments: T[], now: Date = new Date()): T[] {
  return appointments
    .filter((a) => !isTerminal(a.status) && !hasPassed(a, now))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/**
 * IST, always.
 *
 * The database stores UTC. Pune is the only city and it is tempting to let the
 * server's locale decide — but the server is in Mumbai on Vercel and a
 * developer's laptop is not, so a date rendered without an explicit zone shows
 * two different days to two different people looking at the same row.
 */
const IST = 'Asia/Kolkata';

export function formatSlot(startsAt: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: IST,
  }).format(startsAt);
}

export function formatDayKey(startsAt: Date): string {
  // en-CA gives ISO-shaped output, which sorts and groups correctly.
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: IST,
  }).format(startsAt);
}

export function formatDayLabel(startsAt: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: IST,
  }).format(startsAt);
}

/** Group into days, in chronological order, for an agenda list. */
export function groupByDay<T extends { startsAt: Date }>(
  appointments: T[],
): { key: string; label: string; items: T[] }[] {
  const days = new Map<string, { key: string; label: string; items: T[] }>();

  for (const appointment of [...appointments].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  )) {
    const key = formatDayKey(appointment.startsAt);
    const existing = days.get(key);
    if (existing) existing.items.push(appointment);
    else days.set(key, { key, label: formatDayLabel(appointment.startsAt), items: [appointment] });
  }

  return [...days.values()];
}

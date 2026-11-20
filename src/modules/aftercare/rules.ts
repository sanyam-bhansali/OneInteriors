/**
 * After the handover: the client's Warranty claim and Service request
 * (owner, 20 Nov 2026; docs/studio-os/AFTERCARE.md). Pure, and tested
 * (tests/aftercare.test.ts). The database and the calls out are in
 * store.ts, reader.ts and razorpay.ts.
 *
 * ## The payment gate, first, for both
 *
 * The client can always open both options. The moment they submit either
 * one, the project must be 100% paid: the ledger's balance (payment-ledger.ts)
 * is total minus paid, and anything above zero, even ₹1, refuses with
 * "Please clear your payments first" and the amount. A payment the studio
 * recorded that the client has not confirmed yet is not paid (the ledger's
 * rule), so it is pending too, and we say so.
 *
 * ## Warranty coverage is data
 *
 * What the warranty covers is a list of rules (`WarrantyCoverageRule` rows;
 * One Interiors' default list below, seeded by the migration, used when a
 * studio has none of its own). Each rule is an area — "Hinges, channels,
 * drawers…", "Wall paint and putty" — with examples for the photo reader,
 * whether it is covered, and the service category to send the client to
 * when it is not. Generally only modular (factory carpentry) is covered.
 * Adding or changing a rule is a row, not code.
 *
 * The client picks the area; the photo reader looks at the photos and the
 * words and picks the area it sees. The reader wins (a paint crack filed
 * under "modular" is still a paint crack); when it cannot answer, the
 * client's pick decides. Nobody rates a claim by hand.
 *
 * ## Service visits
 *
 * A category (carpentry, painting…) with the studio's fixed visiting charge
 * (Settings, set by the studio owner; no charge, not bookable). The client
 * picks a 2-hour slot from 5 days ahead, pays the charge online, and only
 * then is the visit booked. A slot is held for the client while they pay.
 */

import { formatINR, type Paise } from '@/lib/money';
import type { Ledger } from '@/modules/project/payment-ledger';
import { addDays, isDay } from '@/modules/project/working-days';

// ── The payment gate ───────────────────────────────────────────

export const CLEAR_PAYMENTS_FIRST = 'Please clear your payments first.';

export interface PaymentGate {
  cleared: boolean;
  /** Balance still owed; null when the project has no payment plan in the app. */
  pendingPaise: Paise | null;
  /** Of the pending amount: recorded by the studio, waiting for the client's confirmation. */
  waitingPaise: Paise;
  /** What the client reads when it is not cleared. */
  message: string | null;
}

/** Is 100% of the project paid? Balance > 0, even ₹1, is not. */
export function paymentGate(l: Ledger | null): PaymentGate {
  if (!l) {
    return {
      cleared: false,
      pendingPaise: null,
      waitingPaise: 0,
      message: `${CLEAR_PAYMENTS_FIRST} Your payment plan is not in the app yet, so we cannot see that it is cleared. Ask your studio to add it.`,
    };
  }
  const pending = Math.max(0, l.balancePaise);
  if (pending <= 0) return { cleared: true, pendingPaise: 0, waitingPaise: 0, message: null };
  const waiting = Math.min(pending, Math.max(0, l.waitingPaise));
  const tail =
    waiting > 0
      ? waiting >= pending
        ? ` Your studio has recorded it; confirm it under Payments if you have paid.`
        : ` ${formatINR(waiting)} of it is recorded by your studio and waits for you to confirm under Payments.`
      : '';
  return { cleared: false, pendingPaise: pending, waitingPaise: waiting, message: `${CLEAR_PAYMENTS_FIRST} ${formatINR(pending)} is pending.${tail}` };
}

// ── Service categories ─────────────────────────────────────────

export const SERVICE_CATEGORIES = ['CARPENTRY', 'PAINTING', 'ELECTRICAL', 'WALLPAPER', 'PLUMBING', 'CIVIL', 'OTHER'] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const SERVICE_LABEL: Record<ServiceCategory, string> = {
  CARPENTRY: 'Carpentry',
  PAINTING: 'Painting',
  ELECTRICAL: 'Electrical',
  WALLPAPER: 'Wallpaper',
  PLUMBING: 'Plumbing',
  CIVIL: 'False ceiling and tiles',
  OTHER: 'Something else',
};

export const isServiceCategory = (v: unknown): v is ServiceCategory => typeof v === 'string' && (SERVICE_CATEGORIES as readonly string[]).includes(v);

/** A visiting charge may be up to ₹1,00,000. */
export const SERVICE_CHARGE_MAX_PAISE = 100_000_00;

export type ServiceCharges = Partial<Record<ServiceCategory, Paise>>;

/** `Studio.serviceCharges` as stored ({ CARPENTRY: paise, … }); anything malformed is dropped, never guessed. */
export function readServiceCharges(raw: unknown): ServiceCharges {
  const out: ServiceCharges = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const c of SERVICE_CATEGORIES) {
    const v = (raw as Record<string, unknown>)[c];
    if (typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= SERVICE_CHARGE_MAX_PAISE) out[c] = v;
  }
  return out;
}

/** The owner's Settings form: rupees per category, blank = not offered. */
export function checkServiceChargesInput(raw: Record<string, unknown>): { ok: true; value: ServiceCharges } | { ok: false; error: string } {
  const out: ServiceCharges = {};
  for (const c of SERVICE_CATEGORIES) {
    const v = raw[c];
    const t = typeof v === 'string' ? v.trim().replace(/[₹,\s]/g, '') : typeof v === 'number' ? String(v) : '';
    if (t === '' || t === '0') continue;
    if (!/^\d{1,6}$/.test(t)) return { ok: false, error: `${SERVICE_LABEL[c]}: the visiting charge is a whole number of rupees.` };
    const paise = Number(t) * 100;
    if (paise > SERVICE_CHARGE_MAX_PAISE) return { ok: false, error: `${SERVICE_LABEL[c]}: a visiting charge can be up to ${formatINR(SERVICE_CHARGE_MAX_PAISE)}.` };
    out[c] = paise;
  }
  return { ok: true, value: out };
}

/** Visits one slot takes, per studio (Settings). */
export const SLOT_VISITS_DEFAULT = 2;
export const SLOT_VISITS_MAX = 20;

export function readSlotVisits(v: unknown): number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= SLOT_VISITS_MAX ? v : SLOT_VISITS_DEFAULT;
}

// ── Slots ──────────────────────────────────────────────────────

/** The owner (20 Nov 2026): the first day a client can book is today + 5. */
export const SLOT_LEAD_DAYS = 5;
/** Days shown from the first one. */
export const SLOT_DAYS_SHOWN = 7;
/** Every day of the week; four 2-hour slots. */
export const SLOT_STARTS = ['10:00', '12:00', '14:00', '16:00'] as const;
export type SlotStart = (typeof SLOT_STARTS)[number];

const SLOT_LABEL: Record<SlotStart, string> = {
  '10:00': '10 am – 12 pm',
  '12:00': '12 – 2 pm',
  '14:00': '2 – 4 pm',
  '16:00': '4 – 6 pm',
};

export const isSlotStart = (v: unknown): v is SlotStart => typeof v === 'string' && (SLOT_STARTS as readonly string[]).includes(v);
export const slotLabel = (start: string): string => (isSlotStart(start) ? SLOT_LABEL[start] : start);
export const slotKey = (day: string, start: string): string => `${day} ${start}`;

/**
 * The free service window (owner, 20 Nov 2026): for one month after the
 * handover sign-off, a service visit costs nothing, and only when 100% is paid
 * (the payment gate runs first on every booking). The same day next month
 * (the last day of a shorter month). It goes by the day the client books, not
 * the visit's day: the earliest slot is 5 days out, and a client who asks on
 * day 28 asked within the month.
 */
export function freeServiceUntil(handoverDay: string | null): string | null {
  if (!handoverDay || !isDay(handoverDay)) return null;
  const [y, m, d] = handoverDay.split('-').map(Number);
  const ny = m === 12 ? y! + 1 : y!;
  const nm = m === 12 ? 1 : m! + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d!, last)).padStart(2, '0')}`;
}

/** Is a visit booked on `today` (IST) free? */
export const bookingIsFree = (today: string, freeUntil: string | null): boolean => freeUntil !== null && today <= freeUntil;

/** How long a picked slot is held while the client pays. */
export const HOLD_MINUTES = 20;

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Tue 25 Nov" for "2026-11-25". */
export function slotDayLabel(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const wd = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return `${WEEKDAY[wd]} ${d} ${MONTH[m! - 1]}`;
}

export interface SlotDay {
  date: string;
  label: string;
  slots: { start: SlotStart; label: string; left: number }[];
}

/** The days a client can book from `today` (IST), with what is left in each slot. */
export function serviceSlotDays(today: string, visitsPerSlot: number, taken: ReadonlyMap<string, number>): SlotDay[] {
  const out: SlotDay[] = [];
  for (let i = 0; i < SLOT_DAYS_SHOWN; i++) {
    const date = addDays(today, SLOT_LEAD_DAYS + i);
    out.push({
      date,
      label: slotDayLabel(date),
      slots: SLOT_STARTS.map((start) => ({ start, label: SLOT_LABEL[start], left: Math.max(0, visitsPerSlot - (taken.get(slotKey(date, start)) ?? 0)) })),
    });
  }
  return out;
}

/** May this slot be booked from `today`? A reason when not. */
export function checkSlot(day: unknown, start: unknown, today: string): { ok: true; day: string; start: SlotStart } | { ok: false; error: string } {
  if (!isDay(day) || !isSlotStart(start)) return { ok: false, error: 'Pick a day and a time slot.' };
  const first = addDays(today, SLOT_LEAD_DAYS);
  const last = addDays(today, SLOT_LEAD_DAYS + SLOT_DAYS_SHOWN - 1);
  if (day < first) return { ok: false, error: `The earliest visit is ${slotDayLabel(first)}. Pick that day or later.` };
  if (day > last) return { ok: false, error: `Pick a day up to ${slotDayLabel(last)}.` };
  return { ok: true, day, start };
}

export type ServiceState = 'held' | 'booked' | 'expired' | 'cancelled';

/** A request's state now: a hold past its time has expired (read, never written). */
export function serviceState(status: string, holdUntil: Date, now: Date): ServiceState {
  if (status === 'BOOKED') return 'booked';
  if (status === 'CANCELLED') return 'cancelled';
  return holdUntil.getTime() > now.getTime() ? 'held' : 'expired';
}

export const SERVICE_DESCRIPTION_MAX = 500;
export const CLAIM_DESCRIPTION_MAX = 500;
export const CLAIM_PHOTOS_MAX = 4;

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

export function checkDescription(v: unknown, max: number): { ok: true; value: string } | { ok: false; error: string } {
  const t = clean(v, max);
  if (t.length < 5) return { ok: false, error: 'Say what is wrong, in a few words.' };
  return { ok: true, value: t };
}

// ── Warranty coverage ──────────────────────────────────────────

export interface CoverageRule {
  key: string;
  /** What the client reads when picking the area. */
  label: string;
  /** For the photo reader: what this area looks like. */
  examples: string;
  covered: boolean;
  /** Where to send the client when it is not covered. */
  serviceCategory: ServiceCategory | null;
  sortOrder: number;
}

/**
 * One Interiors' default list (owner, 20 Nov 2026: "generally only modular
 * issues are covered"). The migration seeds exactly these rows
 * (20261120120000_aftercare; a test keeps them equal); this copy is used
 * only when the table has no active rows.
 */
export const DEFAULT_COVERAGE_RULES: readonly CoverageRule[] = [
  {
    key: 'MODULAR_STRUCTURE',
    label: 'Modular furniture body: wardrobe, kitchen, vanity, TV unit, bed',
    examples: 'carcass or panel swelling from inside, sagging shelf, joints opening, a unit coming loose from the wall, a factory panel cracked',
    covered: true,
    serviceCategory: null,
    sortOrder: 10,
  },
  {
    key: 'MODULAR_HARDWARE',
    label: 'Hinges, channels, drawers, lift-ups and handles',
    examples: 'hinge broken or loose, drawer channel stuck or dropped, soft-close not working, lift-up or gas strut failing, handle loose, wardrobe sliding track',
    covered: true,
    serviceCategory: null,
    sortOrder: 20,
  },
  {
    key: 'MODULAR_SHUTTER_FINISH',
    label: 'Shutters, laminate and edge banding on modular furniture',
    examples: 'shutter warped or out of line, laminate or edge band peeling, acrylic or PU finish lifting, veneer coming off',
    covered: true,
    serviceCategory: null,
    sortOrder: 30,
  },
  { key: 'PAINTING', label: 'Wall paint and putty', examples: 'crack in wall paint, peeling or flaking paint, patches, dampness marks, touch-up', covered: false, serviceCategory: 'PAINTING', sortOrder: 100 },
  {
    key: 'ELECTRICAL',
    label: 'Lights, LEDs, switches and wiring',
    examples: 'LED strip or profile light not working, bulb, driver, switch, socket, fan, wiring',
    covered: false,
    serviceCategory: 'ELECTRICAL',
    sortOrder: 110,
  },
  { key: 'WALLPAPER', label: 'Wallpaper', examples: 'wallpaper peeling, bubbles, seams opening, stains', covered: false, serviceCategory: 'WALLPAPER', sortOrder: 120 },
  { key: 'PLUMBING', label: 'Taps, sinks and water', examples: 'leaking tap, sink drain blocked, water leak, dampness from a pipe', covered: false, serviceCategory: 'PLUMBING', sortOrder: 130 },
  {
    key: 'CEILING_CIVIL',
    label: 'False ceiling, tiles and civil work',
    examples: 'false ceiling crack, gypsum joint line, tile crack, grout, flooring',
    covered: false,
    serviceCategory: 'CIVIL',
    sortOrder: 140,
  },
  { key: 'GLASS_MIRROR', label: 'Glass and mirrors', examples: 'broken glass, cracked mirror, glass shutter broken', covered: false, serviceCategory: 'CARPENTRY', sortOrder: 150 },
  {
    key: 'DAMAGE_FROM_USE',
    label: 'Damage from use',
    examples: 'burn mark, scratches, dents, swelling from water spilled on the outside, broken by force, termites or pests',
    covered: false,
    serviceCategory: 'CARPENTRY',
    sortOrder: 160,
  },
  { key: 'APPLIANCE', label: 'Appliances: chimney, hob, oven, geyser', examples: 'chimney, hob, oven, dishwasher, geyser, any branded appliance', covered: false, serviceCategory: 'OTHER', sortOrder: 170 },
];

/** Rows from the table, cleaned; the default list when there are none. */
export function coverageRulesFrom(
  rows: readonly { key: string; label: string; examples: string; covered: boolean; serviceCategory: string | null; sortOrder: number; active?: boolean }[],
): CoverageRule[] {
  const live = rows
    .filter((r) => r.active !== false && r.key.trim() && r.label.trim())
    .map((r) => ({
      key: r.key.trim(),
      label: r.label.trim(),
      examples: r.examples.trim(),
      covered: r.covered,
      serviceCategory: isServiceCategory(r.serviceCategory) ? r.serviceCategory : null,
      sortOrder: r.sortOrder,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
  return live.length > 0 ? live : [...DEFAULT_COVERAGE_RULES];
}

export const NOT_COVERED = 'This is not covered under your warranty. Please raise a service request.';

/** The photo reader's answer, as reader.ts hands it over. */
export type ReaderAnswer = { ok: true; key: string; summary: string; reason: string } | { ok: false; why: string };

export interface CoverageDecision {
  rule: CoverageRule;
  covered: boolean;
  by: 'reader' | 'client';
}

/** The reader's area when it gave a known one, else the client's pick. Null: the client's pick is not a rule. */
export function decideCoverage(rules: readonly CoverageRule[], clientKey: unknown, reader: ReaderAnswer): CoverageDecision | null {
  if (reader.ok) {
    const seen = rules.find((r) => r.key === reader.key);
    if (seen) return { rule: seen, covered: seen.covered, by: 'reader' };
  }
  const picked = rules.find((r) => r.key === clientKey);
  return picked ? { rule: picked, covered: picked.covered, by: 'client' } : null;
}

/** The claim may be raised only during the warranty (the lifecycle's phase, read). */
export function warrantyOpen(phase: string): { ok: true } | { ok: false; error: string } {
  if (phase === 'WARRANTY') return { ok: true };
  if (phase === 'CLOSED') return { ok: false, error: 'Your warranty has ended. Please raise a service request.' };
  return { ok: false, error: 'Your warranty starts when you sign off the handover. Until then, raise problems under Snags.' };
}

// ── The photo reader's words ───────────────────────────────────

/** The instructions for the reader: the areas as data, and the reply it must give. */
export function readerPrompt(rules: readonly CoverageRule[], description: string, clientKey: string): string {
  const areas = rules.map((r) => `- ${r.key}: ${r.label}. Looks like: ${r.examples}.`).join('\n');
  return [
    'You check a home-interiors warranty claim. The photos show a problem in a finished flat in India; the client wrote a line about it.',
    'Decide which ONE area below the problem belongs to, from what the photos actually show (use the words only to understand them).',
    'If the photos show a problem in a different area than the client picked, choose the area the photos show.',
    '',
    'Areas:',
    areas,
    '',
    `The client picked: ${clientKey || '(nothing)'}`,
    `The client wrote: """${description.replace(/"""/g, '"')}"""`,
    '',
    'Reply with only a JSON object, no other text:',
    '{"area": "<one area key from the list>", "summary": "<what is wrong, at most 10 words, plain English, e.g. Kitchen drawer channel stuck>", "reason": "<one short sentence on what in the photos decided it>"}',
  ].join('\n');
}

/** The first {...} in a reply. */
function firstJson(text: string): string | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start >= 0 && end > start ? text.slice(start, end + 1) : null;
}

/** The reader's reply, checked against the rules: an unknown area is no answer. */
export function parseReaderReply(text: string, rules: readonly CoverageRule[]): ReaderAnswer {
  const found = firstJson(text);
  if (!found) return { ok: false, why: 'unreadable' };
  let v: unknown;
  try {
    v = JSON.parse(found);
  } catch {
    return { ok: false, why: 'unreadable' };
  }
  if (!v || typeof v !== 'object') return { ok: false, why: 'unreadable' };
  const o = v as Record<string, unknown>;
  const key = typeof o.area === 'string' ? o.area.trim().toUpperCase() : '';
  if (!rules.some((r) => r.key === key)) return { ok: false, why: 'unknown-area' };
  return { ok: true, key, summary: clean(o.summary, 80), reason: clean(o.reason, 200) };
}

/** The warranty snag's title: the reader's summary, else the client's first words. */
export function claimTitle(reader: ReaderAnswer, description: string): string {
  const s = reader.ok ? reader.summary : '';
  const t = s.length >= 3 ? s : description;
  return t.length > 80 ? `${t.slice(0, 79).trimEnd()}…` : t;
}

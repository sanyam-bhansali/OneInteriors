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
  /** What the client reads when it is not cleared. */
  message: string | null;
}

/** Is 100% of the project paid? Balance > 0, even ₹1, is not. */
export function paymentGate(l: Ledger | null): PaymentGate {
  if (!l) {
    return {
      cleared: false,
      pendingPaise: null,
      message: `${CLEAR_PAYMENTS_FIRST} Your payment plan is not in the app yet, so we cannot see that it is cleared. Ask your studio to add it.`,
    };
  }
  const pending = Math.max(0, l.balancePaise);
  if (pending <= 0) return { cleared: true, pendingPaise: 0, message: null };
  return { cleared: false, pendingPaise: pending, message: `${CLEAR_PAYMENTS_FIRST} ${formatINR(pending)} is pending.` };
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
 * The free service visit (owner, 20 Nov 2026; Hauspire's agreement, clause
 * 5.1: "one complimentary service visit within thirty days from the date of
 * Project handover"). One visit, booked within 30 days of the handover
 * sign-off, only when 100% is paid (the payment gate runs first on every
 * booking). It goes by the day the client books, not the visit's day: the
 * earliest slot is 5 days out, and a client who asks on day 28 asked in time.
 */
export const FREE_VISIT_DAYS = 30;

/** The last day a free visit may be booked; null before the handover sign-off. */
export function freeServiceUntil(handoverDay: string | null): string | null {
  if (!handoverDay || !isDay(handoverDay)) return null;
  return addDays(handoverDay, FREE_VISIT_DAYS);
}

/** Is a visit booked on `today` (IST) free? Within the 30 days, and the free visit not used yet. */
export const bookingIsFree = (today: string, freeUntil: string | null, freeVisitUsed = false): boolean => !freeVisitUsed && freeUntil !== null && today <= freeUntil;

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

/** How far ahead the studio may move a visit. */
export const STUDIO_MOVE_DAYS = 60;

/** The studio moves a visit: any slot from tomorrow, up to 60 days out. */
export function checkStudioSlot(day: unknown, start: unknown, today: string): { ok: true; day: string; start: SlotStart } | { ok: false; error: string } {
  if (!isDay(day) || !isSlotStart(start)) return { ok: false, error: 'Pick a day and a time slot.' };
  if (day <= today) return { ok: false, error: 'Pick a day from tomorrow.' };
  if (day > addDays(today, STUDIO_MOVE_DAYS)) return { ok: false, error: `Pick a day within the next ${STUDIO_MOVE_DAYS} days.` };
  return { ok: true, day, start };
}

export type ServiceState = 'held' | 'booked' | 'done' | 'expired' | 'cancelled';

/** A request's state now: a hold past its time has expired (read, never written). */
export function serviceState(status: string, holdUntil: Date, now: Date): ServiceState {
  if (status === 'BOOKED') return 'booked';
  if (status === 'DONE') return 'done';
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
  /** One more line for the client when it is not covered ("Hinges carry their manufacturer's warranty…"). */
  clientNote: string | null;
}

/**
 * The default list: Hauspire's Interior Design Services Agreement, clause 5
 * (owner, 20 Nov 2026). A 10-year limited warranty on modular woodwork,
 * covering only manufacturing defects in the core material and workmanship
 * under normal use (5.3); hardware is the manufacturer's warranty (5.2);
 * wear, misuse, water, damp, pests, loose screws, small alignments and
 * fading are excluded (5.3 a–d); electrical, paint, plumbing, ceilings,
 * tiles and decor were never in the modular scope (2.3). The migration seeds
 * exactly these rows (20261120120000_aftercare; a test keeps them equal);
 * this copy is used only when the table has no active rows.
 */
export const DEFAULT_COVERAGE_RULES: readonly CoverageRule[] = [
  {
    key: 'MODULAR_CORE',
    label: 'Modular woodwork: a defect in the board or the build',
    examples: 'a factory panel or carcass cracked, splitting or delaminating, a shelf sagging, joints opening, a unit coming loose from the wall, a shutter warped beyond adjustment, with no sign of water or misuse',
    covered: true,
    serviceCategory: null,
    sortOrder: 10,
    clientNote: null,
  },
  {
    key: 'MODULAR_FINISH',
    label: 'Laminate, edge banding or finish lifting on modular woodwork',
    examples: 'laminate or edge band peeling or bubbling, acrylic or PU finish lifting, veneer coming off, from workmanship and not from water, heat or a knock',
    covered: true,
    serviceCategory: null,
    sortOrder: 20,
    clientNote: null,
  },
  {
    key: 'MODULAR_HARDWARE',
    label: 'Hinges, channels, drawer slides, lift-ups and handles',
    examples: 'hinge broken, drawer channel or slide failed, soft-close not working, lift-up or gas strut failing, wardrobe sliding track, handle broken',
    covered: false,
    serviceCategory: 'CARPENTRY',
    sortOrder: 30,
    clientNote: "Hinges, channels and other hardware carry their manufacturer's warranty; your studio helps you claim it on the visit.",
  },
  {
    key: 'MINOR_ADJUSTMENT',
    label: 'Loose screws, doors or drawers slightly out of line',
    examples: 'loose screw, door or drawer slightly out of line or rubbing, handle loose, shutter gap uneven, an easy adjustment',
    covered: false,
    serviceCategory: 'CARPENTRY',
    sortOrder: 40,
    clientNote: 'Small adjustments are part of a service visit, not the warranty.',
  },
  {
    key: 'MOISTURE_PESTS',
    label: 'Swelling from water or damp, termites or pests',
    examples: 'board swollen near a sink, from a spill, seepage or damp wall, water marks, termites, borer holes, fungus',
    covered: false,
    serviceCategory: 'CARPENTRY',
    sortOrder: 50,
    clientNote: 'Damage from water, damp or pests is not covered by the warranty.',
  },
  {
    key: 'DAMAGE_FROM_USE',
    label: 'Damage from use, wear or fading',
    examples: 'burn mark, scratches, dents, chipped edge from a knock, broken by force, normal wear, colour fading or yellowing over time',
    covered: false,
    serviceCategory: 'CARPENTRY',
    sortOrder: 60,
    clientNote: null,
  },
  {
    key: 'PAINTING',
    label: 'Wall paint and putty',
    examples: 'crack in wall paint, peeling or flaking paint, patches, dampness marks, touch-up',
    covered: false,
    serviceCategory: 'PAINTING',
    sortOrder: 100,
    clientNote: null,
  },
  {
    key: 'ELECTRICAL',
    label: 'Lights, LEDs, switches and wiring',
    examples: 'LED strip or profile light not working, bulb, driver, switch, socket, fan, wiring',
    covered: false,
    serviceCategory: 'ELECTRICAL',
    sortOrder: 110,
    clientNote: null,
  },
  {
    key: 'WALLPAPER',
    label: 'Wallpaper',
    examples: 'wallpaper peeling, bubbles, seams opening, stains',
    covered: false,
    serviceCategory: 'WALLPAPER',
    sortOrder: 120,
    clientNote: null,
  },
  {
    key: 'PLUMBING',
    label: 'Taps, sinks and water',
    examples: 'leaking tap, sink drain blocked, water leak, dampness from a pipe',
    covered: false,
    serviceCategory: 'PLUMBING',
    sortOrder: 130,
    clientNote: null,
  },
  {
    key: 'CEILING_CIVIL',
    label: 'False ceiling, tiles and civil work',
    examples: 'false ceiling crack, gypsum joint line, tile crack, grout, flooring, wall panelling',
    covered: false,
    serviceCategory: 'CIVIL',
    sortOrder: 140,
    clientNote: null,
  },
  {
    key: 'GLASS_MIRROR',
    label: 'Glass and mirrors',
    examples: 'broken glass, cracked mirror, glass shutter broken',
    covered: false,
    serviceCategory: 'CARPENTRY',
    sortOrder: 150,
    clientNote: null,
  },
  {
    key: 'CURTAINS_DECOR',
    label: 'Curtains, blinds and decor',
    examples: 'curtain rod, blinds, loose decor, artwork, accessories',
    covered: false,
    serviceCategory: 'OTHER',
    sortOrder: 160,
    clientNote: null,
  },
  {
    key: 'APPLIANCE',
    label: 'Appliances: chimney, hob, oven, geyser',
    examples: 'chimney, hob, oven, dishwasher, geyser, any branded appliance',
    covered: false,
    serviceCategory: 'OTHER',
    sortOrder: 170,
    clientNote: "Appliances carry their brand's warranty.",
  },
];

/** Rows from the table, cleaned; the default list when there are none. */
export function coverageRulesFrom(
  rows: readonly { key: string; label: string; examples: string; covered: boolean; serviceCategory: string | null; sortOrder: number; clientNote?: string | null; active?: boolean }[],
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
      clientNote: r.clientNote?.trim() || null,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
  return live.length > 0 ? live : [...DEFAULT_COVERAGE_RULES];
}

export interface RuleInput {
  key: string;
  label: string;
  examples: string;
  covered: boolean;
  serviceCategory: ServiceCategory | null;
  sortOrder: number;
  clientNote: string | null;
  active: boolean;
}

/**
 * Ops' rule editor (/ops/warranty-rules): a rule as typed, checked. The key
 * is what the photo reader answers with, so it is short capitals; a rule
 * that is not covered must send the client somewhere.
 */
export function checkRuleInput(raw: Record<string, unknown>): { ok: true; value: RuleInput } | { ok: false; error: string } {
  const key = typeof raw.key === 'string' ? raw.key.trim().toUpperCase().replace(/[\s-]+/g, '_') : '';
  if (!/^[A-Z][A-Z0-9_]{2,39}$/.test(key)) return { ok: false, error: 'The key is 3 to 40 capital letters, digits or _, like MODULAR_CORE.' };
  const label = clean(raw.label, 120);
  if (label.length < 3) return { ok: false, error: 'Give the area a name the client reads.' };
  const examples = clean(raw.examples, 600);
  if (examples.length < 10) return { ok: false, error: 'Describe what it looks like, for the photo reader: a few examples.' };
  const covered = raw.covered === true || raw.covered === 'on' || raw.covered === 'true';
  const sc = typeof raw.serviceCategory === 'string' && raw.serviceCategory ? raw.serviceCategory : null;
  if (sc !== null && !isServiceCategory(sc)) return { ok: false, error: 'Pick a service category from the list.' };
  if (!covered && sc === null) return { ok: false, error: 'A rule that is not covered must say which service visit to book instead.' };
  const order = Number(typeof raw.sortOrder === 'string' ? raw.sortOrder.trim() : raw.sortOrder);
  if (!Number.isInteger(order) || order < 0 || order > 9999) return { ok: false, error: 'The order is a whole number from 0 to 9999.' };
  const note = clean(raw.clientNote, 300) || null;
  const active = !(raw.active === false || raw.active === 'false' || raw.active === 'off');
  return { ok: true, value: { key, label, examples, covered, serviceCategory: covered ? null : sc, sortOrder: order, clientNote: covered ? null : note, active } };
}

export const NOT_COVERED ='This is not covered under your warranty. Please raise a service request.';

/** The automatic reply: the owner's sentence, then the area's own line when it has one. */
export const notCoveredReply = (rule: CoverageRule): string => (rule.clientNote ? `${NOT_COVERED} ${rule.clientNote}` : NOT_COVERED);

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

/**
 * Reading a floor plan — the prompt, the parsing and the checks.
 *
 * ## Where this comes from
 *
 * The Hauspire quotation software reads plans with Claude, and the prompt and
 * the brace-balanced parser below are carried over from it. Its reading was
 * not carried over as-is: docs/QUOTATION-ENGINE-INTEGRATION.md §3 lists what
 * would have reached customers, and each is fixed here —
 *
 *  1. **Carpet area** is asked for; when the plan does not print it, it is
 *     the sum of the rooms, and says so.
 *  2. **A study is not a bedroom.** Their prompt counted "3 bedrooms + a
 *     study" as a 4 BHK and then added a study as well.
 *  3. **Room names map to ours** explicitly; repeats (two toilets) are kept.
 *  4. **Every dimension is checked** (600–12,000 mm a side; a kitchen side
 *     2,000–4,600 mm) — the Hauspire app only checked its OCR fallback.
 *  5. **Nothing is final until the customer confirms.** AI proposes; the
 *     reading comes back with what needs checking.
 *
 * Pure (no `server-only`), so every rule is tested. The call itself lives in
 * `read.ts`.
 */

export const FLOOR_PLAN_PROMPT = `You are reading an architectural floor plan of an apartment in India, for an interior-design quotation.
Return ONLY strict minified JSON, no prose, in exactly this shape:
{"bedrooms":number,"hasStudy":boolean,"bathrooms":number,"carpetAreaSqft":number|null,"kitchen":{"widthFt":number,"depthFt":number,"shape":"straight"|"l"|"u"|"parallel"|null}|null,"confidence":"high"|"medium"|"low","rooms":[{"name":string,"widthFt":number,"depthFt":number}]}
Rules:
- bedrooms = rooms labelled as bedrooms (master, kids, guest, parents, bedroom). A study or office is NOT a bedroom: report it only as hasStudy.
- bathrooms = rooms labelled toilet, bathroom, bath or W.C.
- carpetAreaSqft = the carpet area only if it is printed on the plan (not built-up or super built-up area). Otherwise null.
- Dimensions are usually printed like 10'0"X10'2" (feet and inches). Convert to decimal feet (10'6" is 10.5). If a dimension cannot be read, use 0.
- name must be one of: Kitchen, Master Bedroom, Bedroom, Kids Bedroom, Guest Bedroom, Parents Bedroom, Living, Dining, Living/Dining, Study, Toilet, Balcony, Utility, Foyer, Passage, Other.
- Include the kitchen both in "kitchen" and in "rooms". shape = how the counter runs, if you can tell.
- confidence = how clearly the plan's text and dimensions could be read (low for blurred, handwritten or cropped plans).`;

export type RoomCode =
  | 'KITCHEN'
  | 'BEDROOM'
  | 'LIVING'
  | 'DINING'
  | 'STUDY'
  | 'TOILET'
  | 'BALCONY'
  | 'UTILITY'
  | 'OTHER';

export interface PlanRoom {
  /** As the plan named it. */
  name: string;
  code: RoomCode;
  widthMm: number;
  depthMm: number;
}

export interface FloorPlanReading {
  /** Bedrooms only — a study is never counted. */
  bedrooms: number;
  hasStudy: boolean;
  bathrooms: number;
  carpetAreaSqft: number | null;
  /** Printed on the plan, or added up from the rooms. */
  carpetAreaSource: 'printed' | 'computed' | null;
  /** The platform run, in mm, when the kitchen could be read. */
  kitchenRunMm: number | null;
  confidence: 'high' | 'medium' | 'low';
  rooms: PlanRoom[];
  /** What the customer should look at before we price anything. */
  needsConfirming: string[];
}

export type ReadingResult =
  | { ok: true; reading: FloorPlanReading }
  | { ok: false; reason: string };

const MM_PER_FOOT = 304.8;
const SQFT_PER_SQMM = 1 / 92_903.04;

/** The first complete, brace-balanced JSON object in a string — safe with prose around it and braces inside strings. */
export function extractJson(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function roomCode(name: string): RoomCode {
  const n = name.toLowerCase();
  if (n.includes('kitchen')) return 'KITCHEN';
  if (n.includes('bed')) return 'BEDROOM';
  if (n.includes('study') || n.includes('office')) return 'STUDY';
  if (n.includes('toilet') || n.includes('bath') || n.includes('w.c') || n === 'wc') return 'TOILET';
  if (n.includes('balcony') || n.includes('terrace')) return 'BALCONY';
  if (n.includes('utility') || n.includes('wash')) return 'UTILITY';
  if (n.includes('dining') && !n.includes('living')) return 'DINING';
  if (n.includes('living') || n.includes('hall')) return 'LIVING';
  return 'OTHER';
}

/** Feet to mm, or null outside what a room side can be. */
function sideMm(feet: unknown, min = 600, max = 12_000): number | null {
  if (typeof feet !== 'number' || !Number.isFinite(feet) || feet <= 0) return null;
  const mm = Math.round(feet * MM_PER_FOOT);
  return mm >= min && mm <= max ? mm : null;
}

/**
 * The counter run, from the kitchen's sides and shape.
 *
 * An L-shape — the commonest in Pune flats, and the shape when we cannot
 * tell — is width + depth − 900 mm, the formula the Hauspire software
 * calibrated against its own quotes (the corner is counted once, less the
 * depth of the counter). A straight kitchen is its longer side; a parallel
 * one is two of them; a U adds the second depth.
 */
export function kitchenRunFrom(
  widthMm: number,
  depthMm: number,
  shape: 'straight' | 'l' | 'u' | 'parallel' | null,
): number {
  const long = Math.max(widthMm, depthMm);
  const short = Math.min(widthMm, depthMm);
  const run =
    shape === 'straight'
      ? long
      : shape === 'parallel'
        ? 2 * long
        : shape === 'u'
          ? long + 2 * short - 1800
          : long + short - 900;
  return Math.min(9000, Math.max(1500, Math.round(run)));
}

/** Turn what the model returned into a reading we are prepared to show. */
export function normalisePlan(raw: unknown): ReadingResult {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'unreadable' };
  const r = raw as Record<string, unknown>;
  const needsConfirming: string[] = [];

  const rooms: PlanRoom[] = [];
  let dropped = 0;
  for (const item of Array.isArray(r.rooms) ? r.rooms : []) {
    if (!item || typeof item !== 'object') continue;
    const room = item as Record<string, unknown>;
    const name = typeof room.name === 'string' ? room.name.slice(0, 40) : 'Room';
    const widthMm = sideMm(room.widthFt);
    const depthMm = sideMm(room.depthFt);
    if (widthMm === null || depthMm === null) {
      dropped += 1;
      continue;
    }
    rooms.push({ name, code: roomCode(name), widthMm, depthMm });
  }
  if (dropped > 0) {
    needsConfirming.push(
      `${dropped} room${dropped === 1 ? '' : 's'} had a size we could not read, and ${dropped === 1 ? 'is' : 'are'} left out of the area.`,
    );
  }

  const counted = (code: RoomCode) => rooms.filter((x) => x.code === code).length;
  const bedroomsSaid = typeof r.bedrooms === 'number' && Number.isInteger(r.bedrooms) ? r.bedrooms : null;
  const bedrooms = Math.max(0, Math.min(6, bedroomsSaid ?? counted('BEDROOM')));
  const bathroomsSaid = typeof r.bathrooms === 'number' && Number.isInteger(r.bathrooms) ? r.bathrooms : null;
  const bathrooms = Math.max(0, Math.min(6, bathroomsSaid ?? counted('TOILET')));
  const hasStudy = r.hasStudy === true || counted('STUDY') > 0;

  if (bedrooms === 0 && counted('KITCHEN') === 0 && rooms.length < 2) {
    return { ok: false, reason: 'no-rooms' };
  }

  // Carpet area: printed wins; otherwise the rooms, balconies excluded.
  let carpetAreaSqft: number | null = null;
  let carpetAreaSource: FloorPlanReading['carpetAreaSource'] = null;
  if (typeof r.carpetAreaSqft === 'number' && r.carpetAreaSqft >= 150 && r.carpetAreaSqft <= 20_000) {
    carpetAreaSqft = Math.round(r.carpetAreaSqft);
    carpetAreaSource = 'printed';
  } else if (rooms.length > 0) {
    const sum = rooms
      .filter((x) => x.code !== 'BALCONY')
      .reduce((t, x) => t + x.widthMm * x.depthMm * SQFT_PER_SQMM, 0);
    if (sum >= 150) {
      carpetAreaSqft = Math.round(sum);
      carpetAreaSource = 'computed';
      needsConfirming.push(
        'The carpet area is added up from the room sizes — passages and walls are not in it, so the real figure is usually a little more.',
      );
    }
  }
  if (carpetAreaSqft === null) needsConfirming.push('We could not find the carpet area — please type it in.');

  // The kitchen run, from the kitchen's own sides.
  let kitchenRunMm: number | null = null;
  const kitchen = r.kitchen && typeof r.kitchen === 'object' ? (r.kitchen as Record<string, unknown>) : null;
  const kw = kitchen ? sideMm(kitchen.widthFt, 2000, 4600) : null;
  const kd = kitchen ? sideMm(kitchen.depthFt, 2000, 4600) : null;
  if (kw !== null && kd !== null) {
    const shape = typeof kitchen!.shape === 'string' ? kitchen!.shape : null;
    kitchenRunMm = kitchenRunFrom(
      kw,
      kd,
      shape === 'straight' || shape === 'l' || shape === 'u' || shape === 'parallel' ? shape : null,
    );
  } else {
    needsConfirming.push(
      'We could not read the kitchen clearly, so its size is a standard one — measure the platform if you can.',
    );
  }

  const confidence =
    r.confidence === 'high' || r.confidence === 'medium' || r.confidence === 'low' ? r.confidence : 'low';
  if (confidence === 'low') needsConfirming.unshift('The plan was hard to read — please check every number below.');
  if (bedrooms === 0) needsConfirming.push('We found no bedrooms — check the number of bedrooms.');

  return {
    ok: true,
    reading: {
      bedrooms,
      hasStudy,
      bathrooms,
      carpetAreaSqft,
      carpetAreaSource,
      kitchenRunMm,
      confidence,
      rooms,
      needsConfirming,
    },
  };
}

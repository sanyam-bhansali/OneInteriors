/**
 * Reading a studio's own quotations, and turning them into rates.
 *
 * ## What this is for
 *
 * A studio joining the roster files around a hundred of its past quotations.
 * This module reads the line items out of them and derives one rate per
 * canonical catalogue item — the studio's own pricing, on our lines. After
 * that, every first quote we produce for them is our format at their numbers,
 * which is the only arrangement under which two studios can honestly be put
 * side by side.
 *
 * ## Pure, and deliberately not a file reader
 *
 * It takes rows that have already been pulled out of whatever the studio sent
 * — .xlsm, .xlsx, CSV, a PDF somebody retyped. `scripts/read-quotations.py`
 * does that extraction for the workbook format we have seen most; anything
 * else is a different adapter feeding the same function.
 *
 * That split is not tidiness. Everything that can go *wrong* here is in the
 * mapping and the arithmetic, not in the file format, so the part worth
 * testing is the part with no I/O in it. CONTRIBUTING §9.5.
 *
 * ## What the archive actually looks like
 *
 * Measured over 934 real quotations, 6,834 line items, 412 distinct product
 * spellings:
 *
 * - The same product is written a dozen ways. "Storage- Foyer Unit",
 *   "Storage- Foyer/Shoe Rack", "Console Unit/Shoe Rack" and "Storage- Shoe
 *   Rack" are one thing. Matching is on a normalised string against patterns,
 *   never on equality.
 * - **The room decides the meaning.** "Loft (Frame with Shutter)" is the most
 *   common line in the archive and it is a kitchen loft or a bedroom loft
 *   depending only on which block it sits in.
 * - Real quotes split what we bill as one line. A bed and its headboard are
 *   two rows; a dressing unit is a base and a mirror. They are summed before a
 *   rate is taken, so the canonical line's rate is what that studio actually
 *   charged for the whole thing.
 * - Plenty of lines are designer add-ons outside the standard scope — dry
 *   balcony storage, king beds, tall units. Those are **reported as unmapped
 *   rather than dropped silently**, because an item that keeps appearing is
 *   the catalogue telling us it is missing something.
 */

import type { Paise } from '@/lib/money';
import {
  ITEM,
  MIN_QUOTATIONS_FOR_RATES,
  type FiledRate,
  type Room,
  type StudioRates,
} from './catalogue';

// ── What an adapter hands us ────────────────────────────────────

export interface IngestedLine {
  /** Which quotation this came from. Used to group and to count coverage. */
  quotationId: string;
  /** The room block the line sat under, already normalised by the adapter. */
  room: Room | null;
  /** Exactly as the studio wrote it. */
  product: string;
  /** "MO-01" / "NM-01", when the sheet carried one. */
  workCode: string | null;
  widthMm: number | null;
  heightMm: number | null;
  amountPaise: Paise;
}

export interface IngestedQuotation {
  quotationId: string;
  /** 1–5, from the sheet or from the room blocks present. */
  bhk: number;
  /** ISO date, when the sheet carried one. */
  dated: string | null;
  lines: IngestedLine[];
}

// ── Mapping a studio's words onto our catalogue ─────────────────

/** Lowercase, collapse whitespace, drop the punctuation studios vary on. */
export function normalise(product: string): string {
  return product
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The alias table, built from what the archive actually contains.
 *
 * Order matters: the first pattern that matches wins, so the more specific
 * strings sit above the ones that would also catch them. "base cabinets
 * tandems" has to be tested before "base cabinets".
 *
 * `rooms` restricts a pattern to the blocks it is allowed to match in, which
 * is what lets one string ("loft") mean two different catalogue items.
 */
interface Alias {
  pattern: RegExp;
  code: string;
  rooms?: Room[];
}

const BEDROOMS: Room[] = ['MASTER_BEDROOM', 'SECOND_BEDROOM', 'THIRD_BEDROOM'];

const ALIASES: Alias[] = [
  // ── Kitchen ──
  { pattern: /base cabinets? tandems?|tandem/, code: 'kitchen_tandem', rooms: ['KITCHEN'] },
  { pattern: /^base cabinets?/, code: 'kitchen_base', rooms: ['KITCHEN'] },
  { pattern: /wall cabinets?/, code: 'kitchen_wall', rooms: ['KITCHEN'] },
  { pattern: /loft/, code: 'kitchen_loft', rooms: ['KITCHEN'] },

  // ── Bedrooms. The same words in three rooms, so the room decides. ──
  { pattern: /wardrobe/, code: 'master_wardrobe', rooms: ['MASTER_BEDROOM'] },
  { pattern: /loft/, code: 'master_loft', rooms: ['MASTER_BEDROOM'] },
  { pattern: /wardrobe/, code: 'second_wardrobe', rooms: ['SECOND_BEDROOM'] },
  { pattern: /loft/, code: 'second_loft', rooms: ['SECOND_BEDROOM'] },
  { pattern: /wardrobe/, code: 'third_wardrobe', rooms: ['THIRD_BEDROOM'] },
  { pattern: /loft/, code: 'third_loft', rooms: ['THIRD_BEDROOM'] },

  // A dressing unit, a workstation and a bed turn up in ANY bedroom — the
  // archive puts a dressing table in the kids' room and a workstation in the
  // master often enough that restricting them to one room lost 1,031 lines.
  // They fold into that room's line.
  { pattern: /dressing/, code: 'master_dressing', rooms: ['MASTER_BEDROOM'] },
  { pattern: /dressing/, code: 'second_workstation', rooms: ['SECOND_BEDROOM'] },
  { pattern: /dressing/, code: 'third_bed', rooms: ['THIRD_BEDROOM'] },
  { pattern: /workstation|study/, code: 'master_dressing', rooms: ['MASTER_BEDROOM'] },
  { pattern: /workstation|study/, code: 'second_workstation', rooms: ['SECOND_BEDROOM'] },
  { pattern: /workstation|study/, code: 'third_bed', rooms: ['THIRD_BEDROOM'] },
  { pattern: /bed|headboard/, code: 'master_bed', rooms: ['MASTER_BEDROOM'] },
  { pattern: /bed|headboard/, code: 'second_bed', rooms: ['SECOND_BEDROOM'] },
  { pattern: /bed|headboard/, code: 'third_bed', rooms: ['THIRD_BEDROOM'] },

  // Unlabelled bedroom furniture, when the sheet gave no room heading.
  { pattern: /wardrobe/, code: 'master_wardrobe', rooms: BEDROOMS },
  { pattern: /loft/, code: 'master_loft', rooms: BEDROOMS },

  // ── Named things that mean one thing wherever they appear. No room
  //    restriction: a mandir is a mandir whether the sheet filed it under
  //    Living, under Other Services, or under nothing at all. ──
  { pattern: /tv unit|t ?v ?unit/, code: 'tv_unit' },
  { pattern: /safety door/, code: 'safety_door' },
  { pattern: /mandir|temple/, code: 'mandir' },
  // `shoe rack|console` and NOT a bare `foyer`. Widening this to any
  // "foyer" pulled in "Storage- Foyer Unit" — a full-height storage unit,
  // not a console — and moved the derived rate from ₹1,910/sqft to
  // ₹5,756/sqft. A pattern that catches more lines is not a better pattern
  // if the extra lines are a different product.
  // `con?sole` catches the archive's "Cosole Unit/Cosidered with laminate"
  // as well as the correct spelling. A studio's typo is not a reason to lose
  // 27 lines of a rate.
  { pattern: /shoe rack|con?sole/, code: 'console_shoe' },

  // ── Not furniture. `electr` rather than `electric`: the archive contains
  //    "Electrcials" 91 times, and a typo in their sheet is not a reason to
  //    lose the rate. ──
  { pattern: /false ceiling|ceiling/, code: 'false_ceiling' },
  { pattern: /^paint|painting/, code: 'painting' },
  { pattern: /electr|wiring|switches/, code: 'electrical' },
  { pattern: /vanity/, code: 'vanity' },
];

/**
 * Which catalogue item a line is, or null.
 *
 * Null is a real answer and not a failure. Roughly a fifth of the archive is
 * designer add-ons beyond the standard scope, and forcing those onto the
 * nearest catalogue item would quietly inflate that item's rate.
 */
export function classify(product: string, room: Room | null): string | null {
  const text = normalise(product);
  for (const alias of ALIASES) {
    if (alias.rooms && (room === null || !alias.rooms.includes(room))) continue;
    if (alias.pattern.test(text)) return alias.code;
  }
  return null;
}

// ── Deriving a rate ─────────────────────────────────────────────

const MM_PER_FOOT = 304.8;

function sqft(widthMm: number, heightMm: number): number {
  return (widthMm / MM_PER_FOOT) * (heightMm / MM_PER_FOOT);
}

/**
 * Typical carpet area by configuration, for the handful of items the archive
 * prices as a lump sum per flat.
 *
 * False ceiling and painting are quoted "Paint- 2BHK, ₹45,000", never per
 * square foot. To hold a comparable rate we divide by the area a flat of that
 * size typically has — which is an assumption, is recorded as one in the
 * report, and is the reason those rates carry a wider spread than the
 * carpentry ones.
 */
const TYPICAL_CARPET: Record<number, number> = { 1: 550, 2: 850, 3: 1180, 4: 1600, 5: 2100 };

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

/**
 * One quotation's rate for one catalogue item.
 *
 * Lines are summed first, then divided once. A bed at ₹44,000 and its
 * headboard at ₹12,000 make one ₹56,000 line; a kitchen quoted as two runs
 * makes one rate over the combined area. Dividing each row separately and
 * averaging would weight a small row the same as a large one.
 */
function rateFromLines(code: string, lines: IngestedLine[], bhk: number): number | null {
  const item = ITEM[code];
  if (!item) return null;

  const amount = lines.reduce((t, l) => t + l.amountPaise, 0);
  if (amount <= 0) return null;

  switch (item.sizing) {
    case 'AREA': {
      const area = lines.reduce(
        (t, l) => t + (l.widthMm && l.heightMm ? sqft(l.widthMm, l.heightMm) : 0),
        0,
      );
      // A line with no dimensions cannot yield a per-sqft rate. Better no
      // rate than one divided by a guessed area.
      return area > 0 ? amount / area : null;
    }
    case 'UNIT':
      return amount;
    case 'PER_BATHROOM':
      return amount / Math.max(1, lines.length);
    case 'PER_SQFT_CARPET':
      return amount / (TYPICAL_CARPET[bhk] ?? TYPICAL_CARPET[2]!);
  }
}

// ── The report ──────────────────────────────────────────────────

export interface RateEvidence {
  code: string;
  ratePaise: Paise;
  fromQuotations: number;
  /**
   * The middle half of what this studio charged — the first and third
   * quartiles, not the extremes. A rate built on disagreement should be
   * visible as one, and a single typo should not be what makes it look that
   * way.
   */
  lowPaise: Paise;
  highPaise: Paise;
  /** True when the rate was derived through an assumption, not measured. */
  assumed: boolean;
}

export interface IngestReport {
  quotationsRead: number;
  linesRead: number;
  linesMapped: number;
  /** Product strings we could not place, commonest first. The catalogue's to-do list. */
  unmapped: { product: string; lines: number }[];
  /** Catalogue items no quotation priced. The studio cannot be quoted for these. */
  missing: string[];
  evidence: RateEvidence[];
  /** Blocking problems, in the words ops needs to act on. */
  problems: string[];
}

export interface IngestResult {
  rates: StudioRates;
  report: IngestReport;
}

/**
 * Turn a studio's filed quotations into rates.
 *
 * `filedOn` is the date the archive was read, and it lands on every rate. A
 * rate without a date is a rate nobody can tell is stale, and this market
 * moves — the same archive showed carpentry running about 20% above its own
 * multi-year median once older quotes were included.
 */
export function ingestQuotations(
  quotations: IngestedQuotation[],
  filedOn: string,
): IngestResult {
  const perCode = new Map<string, number[]>();
  const unmapped = new Map<string, number>();
  const assumedCodes = new Set<string>();

  let linesRead = 0;
  let linesMapped = 0;

  for (const quotation of quotations) {
    const grouped = new Map<string, IngestedLine[]>();

    for (const line of quotation.lines) {
      linesRead += 1;
      const code = classify(line.product, line.room);

      if (!code) {
        const key = normalise(line.product);
        unmapped.set(key, (unmapped.get(key) ?? 0) + 1);
        continue;
      }

      linesMapped += 1;
      const list = grouped.get(code) ?? [];
      list.push(line);
      grouped.set(code, list);
    }

    for (const [code, lines] of grouped) {
      const rate = rateFromLines(code, lines, quotation.bhk);
      if (rate === null || !Number.isFinite(rate) || rate <= 0) continue;

      if (ITEM[code]?.sizing === 'PER_SQFT_CARPET') assumedCodes.add(code);

      const list = perCode.get(code) ?? [];
      list.push(rate);
      perCode.set(code, list);
    }
  }

  const rates: StudioRates = {};
  const evidence: RateEvidence[] = [];

  for (const [code, values] of perCode) {
    // The median, not the mean. One quote where somebody typed an extra
    // zero should not move a rate, and in an archive this size there is
    // always one.
    const mid = median(values);
    const sorted = [...values].sort((a, b) => a - b);
    // The quartiles, not the extremes. One quote where somebody typed a
    // total into a rate cell put the mandir spread at ₹155–₹7,35,482, which
    // tells a reader nothing except that a typo exists. The middle half
    // says whether the studio actually prices this consistently.
    const q1 = sorted[Math.floor(sorted.length * 0.25)] ?? sorted[0]!;
    const q3 = sorted[Math.floor(sorted.length * 0.75)] ?? sorted[sorted.length - 1]!;

    rates[code] = {
      code,
      ratePaise: Math.round(mid),
      fromQuotations: values.length,
      filedOn,
    } satisfies FiledRate;

    evidence.push({
      code,
      ratePaise: Math.round(mid),
      fromQuotations: values.length,
      lowPaise: Math.round(q1),
      highPaise: Math.round(q3),
      assumed: assumedCodes.has(code),
    });
  }

  const missing = Object.keys(ITEM).filter((code) => rates[code] === undefined);

  const problems: string[] = [];
  if (quotations.length < MIN_QUOTATIONS_FOR_RATES) {
    problems.push(
      `Only ${quotations.length} quotations. We price from at least ${MIN_QUOTATIONS_FOR_RATES} — below that a median is one designer's mood rather than a rate.`,
    );
  }
  if (missing.length > 0) {
    problems.push(
      `${missing.length} catalogue items were never priced: ${missing.join(', ')}. Quotes for this studio will name them as not filed.`,
    );
  }
  for (const item of evidence) {
    if (item.fromQuotations < 5) {
      problems.push(
        `"${ITEM[item.code]?.label ?? item.code}" appears in only ${item.fromQuotations} quotations. Treat that rate as provisional.`,
      );
    }
  }

  return {
    rates,
    report: {
      quotationsRead: quotations.length,
      linesRead,
      linesMapped,
      unmapped: [...unmapped.entries()]
        .map(([product, lines]) => ({ product, lines }))
        .sort((a, b) => b.lines - a.lines),
      missing,
      evidence: evidence.sort((a, b) => b.fromQuotations - a.fromQuotations),
      problems,
    },
  };
}

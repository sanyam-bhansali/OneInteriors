/**
 * Building the first quote.
 *
 * Deterministic, pure, and with NO `server-only` — the same function runs on
 * the server to store a quote and in the browser to render it. Given the same
 * brief, kitchen run and rates it returns the same quote every time, which is
 * what lets us say "this is their pricing, not our estimate" and mean it.
 *
 * ## What it actually needs
 *
 * Two numbers: the **BHK** and the **kitchen platform run**. Everything else in
 * `catalogue.ts` is a standard size. That is not a shortcut — it is what four
 * real quotations priced against their floor plans showed: heights are fixed,
 * and the only width that meaningfully varies between flats is the kitchen.
 *
 * ## What it is honest about
 *
 * - Every line says whether its size was **measured or standard**.
 * - The kitchen run carries the widest doubt, so a quote built without a floor
 *   plan gets a visibly wider range and says which number is the guess.
 * - Anything the studio has not filed a rate for is **named, not dropped**.
 *
 * See `catalogue.ts` for why we own the line items and the studio owns only
 * the rates.
 */

import type { Paise } from '@/lib/money';
import {
  CATALOGUE,
  GST_BPS,
  MODULAR_DISCOUNT_BPS,
  PROFESSIONAL_FEE_BPS,
  ROOMS,
  ROOM_LABELS,
  type CatalogueItem,
  type Room,
  type StudioRates,
  type WorkCode,
} from './catalogue';

const MM_PER_FOOT = 304.8;

/** Face area in square feet, from millimetre dimensions. */
function sqft(widthMm: number, heightMm: number): number {
  return (widthMm / MM_PER_FOOT) * (heightMm / MM_PER_FOOT);
}

/**
 * The kitchen platform run we assume when nobody has told us.
 *
 * ## Why this is a ladder and not one number
 *
 * It was 4,400mm for every flat — the median of the calibration set (3410,
 * 3960, 4870, 5240), chosen as a median rather than a mean so one very large
 * kitchen could not push every standard quote up.
 *
 * One number across every configuration is wrong in both directions at once,
 * and the kitchen run moves the total more than anything else in the
 * catalogue. A 1 BHK priced on a 4,400mm platform is quoted a kitchen it does
 * not have room for; a 4 BHK on the same number is quoted short, which is the
 * direction that produces a cheerful first quote and an argument later.
 *
 * The ladder keeps 4,400 at 3 BHK, because that is the size the calibration
 * actually centres on and nothing measured should move when this changes. The
 * others step around it at the spacing the calibration flats show — roughly
 * 500mm a bedroom.
 *
 * Every one of these is still a guess, and the quote says so: a standard
 * kitchen widens the band to ±16% and the assumption is printed on the
 * document. The ladder makes the guess less wrong, not right.
 */
const STANDARD_RUN_BY_BHK: Record<number, number> = {
  1: 3300,
  2: 3900,
  3: 4400,
  4: 5000,
};

/** The 3 BHK figure, which is where the calibration set centres. */
export const STANDARD_KITCHEN_RUN_MM = STANDARD_RUN_BY_BHK[3]!;

/**
 * The run to assume for a flat of this size.
 *
 * Clamped rather than extrapolated at both ends. A 5 BHK is a house and a
 * standard kitchen is already the wrong tool for it; stepping the ladder on
 * would put a made-up 5,500mm platform on a document, which is a worse answer
 * than the largest one we have actually seen.
 */
export function standardKitchenRunMm(bhk: number): number {
  const rounded = Math.round(bhk);
  if (rounded <= 1) return STANDARD_RUN_BY_BHK[1]!;
  if (rounded >= 4) return STANDARD_RUN_BY_BHK[4]!;
  return STANDARD_RUN_BY_BHK[rounded]!;
}

export interface QuoteInput {
  /** 1–5. Decides which bedrooms are in scope. */
  bhk: number;
  carpetAreaSqft: number;
  bathrooms: number;
  /** From the floor plan, or from the customer, or absent. */
  kitchenRunMm: number | null;
  /** How we came by the kitchen run. Drives the variance and the wording. */
  runSource: 'floor_plan' | 'customer' | 'standard';
}

export interface QuoteLine {
  code: string;
  room: Room;
  label: string;
  work: WorkCode;
  /** "1800 × 2100 mm", "104 sq ft", "3 bathrooms". Always shown. */
  size: string;
  /** Square feet of face, units, or carpet sqft — whatever the rate is per. */
  quantity: number;
  unit: string;
  ratePaise: Paise;
  amountPaise: Paise;
  spec: string;
  /** False only for the kitchen items when a real run was supplied. */
  standard: boolean;
}

export interface FirstQuote {
  lines: QuoteLine[];
  /** Room order, for the document. */
  rooms: { room: Room; label: string; lines: QuoteLine[]; subtotalPaise: Paise }[];
  modularPaise: Paise;
  nonModularPaise: Paise;
  /** 15% off the modular half. Shown as a line, never as a promotion. */
  modularDiscountPaise: Paise;
  professionalFeePaise: Paise;
  gstPaise: Paise;
  totalPaise: Paise;
  /** The honest band. The midpoint never appears on its own. */
  lowPaise: Paise;
  highPaise: Paise;
  variancePct: number;
  /** Catalogue codes this studio has not filed a rate for. */
  notPriced: string[];
  /** Every assumption, in reading order, for the foot of the document. */
  assumptions: string[];
}

/** Which catalogue items a flat of this size includes. */
export function itemsFor(bhk: number): CatalogueItem[] {
  return CATALOGUE.filter((i) => (i.minBhk ?? 0) <= bhk);
}

/**
 * How wide the doubt is.
 *
 * A first quote is the standard scope priced properly, before anybody has
 * designed anything or stood in the flat. The band says so. A floor plan
 * removes the kitchen guess, which is the single largest source of error, so
 * it is worth four points — and no amount of paperwork gets below the floor,
 * because the remaining doubt is design decisions nobody has made yet.
 */
function variance(input: QuoteInput): number {
  if (input.runSource === 'floor_plan') return 0.1;
  if (input.runSource === 'customer') return 0.12;
  return 0.16;
}

export function buildFirstQuote(input: QuoteInput, rates: StudioRates): FirstQuote {
  const runMm = input.kitchenRunMm ?? standardKitchenRunMm(input.bhk);
  const measured = input.runSource !== 'standard';

  const lines: QuoteLine[] = [];
  const notPriced: string[] = [];

  for (const item of itemsFor(input.bhk)) {
    const filed = rates[item.code];
    if (!filed) {
      notPriced.push(item.code);
      continue;
    }

    let quantity: number;
    let unit: string;
    let size: string;
    let standard = true;

    switch (item.sizing) {
      case 'AREA': {
        const widthMm = item.fromKitchenRun ? runMm : (item.widthMm ?? 0);
        const heightMm = item.heightMm ?? 0;
        quantity = Math.round(sqft(widthMm, heightMm) * 10) / 10;
        unit = 'sq ft';
        size = `${Math.round(widthMm)} × ${heightMm} mm`;
        standard = !(item.fromKitchenRun && measured);
        break;
      }
      case 'UNIT':
        quantity = 1;
        unit = 'unit';
        size = 'Standard';
        break;
      case 'PER_SQFT_CARPET':
        quantity = input.carpetAreaSqft;
        unit = 'sq ft';
        size = `${input.carpetAreaSqft.toLocaleString('en-IN')} sq ft carpet`;
        break;
      case 'PER_BATHROOM':
        quantity = input.bathrooms;
        unit = 'bathroom';
        size = `${input.bathrooms} bathroom${input.bathrooms === 1 ? '' : 's'}`;
        break;
    }

    lines.push({
      code: item.code,
      room: item.room,
      label: item.label,
      work: item.work,
      size,
      quantity,
      unit,
      ratePaise: filed.ratePaise,
      amountPaise: Math.round(quantity * filed.ratePaise),
      // The studio's own description when they filed one, our canonical spec
      // when they did not. Two studios differing here is the whole point of
      // the comparison screen.
      spec: filed.spec ?? item.spec,
      standard,
    });
  }

  const sum = (ls: QuoteLine[]) => ls.reduce((t, l) => t + l.amountPaise, 0);

  const modularPaise = sum(lines.filter((l) => l.work === 'MO'));
  const nonModularPaise = sum(lines.filter((l) => l.work === 'NM'));

  // The order is load-bearing and matches the four calibration quotes exactly:
  // fee is charged on the whole of the work, and the modular discount comes
  // off afterwards. Discounting first and then charging 7% of the smaller
  // number lands about ₹9,000 low on a ₹9 L quote.
  const professionalFeePaise = Math.round(
    ((modularPaise + nonModularPaise) * PROFESSIONAL_FEE_BPS) / 10_000,
  );
  const modularDiscountPaise = Math.round((modularPaise * MODULAR_DISCOUNT_BPS) / 10_000);

  const beforeTax =
    modularPaise + nonModularPaise + professionalFeePaise - modularDiscountPaise;
  const gstPaise = Math.round((beforeTax * GST_BPS) / 10_000);
  const totalPaise = beforeTax + gstPaise;

  const variancePct = variance(input);

  const rooms = ROOMS.map((room) => {
    const roomLines = lines.filter((l) => l.room === room);
    return {
      room,
      label: ROOM_LABELS[room],
      lines: roomLines,
      subtotalPaise: sum(roomLines),
    };
  }).filter((r) => r.lines.length > 0);

  const assumptions: string[] = [];

  if (input.runSource === 'floor_plan') {
    assumptions.push(
      `Kitchen priced on a ${Math.round(runMm)}mm platform run read from your floor plan.`,
    );
  } else if (input.runSource === 'customer') {
    assumptions.push(`Kitchen priced on the ${Math.round(runMm)}mm platform run you gave us.`);
  } else {
    assumptions.push(
      `No floor plan yet, so the kitchen is priced on a standard ${runMm}mm platform run — what a ${input.bhk} BHK usually has. This is the number most likely to move.`,
    );
  }

  assumptions.push(
    'Every other size is the standard one for a flat this size. Heights are fixed; only widths change with your plan.',
    'This is the standard scope. Anything you add during design — a store unit, a bigger console, a second kitchen run — is priced on top.',
  );

  if (notPriced.length > 0) {
    assumptions.push(
      'Some items are not in this total because the studio has not filed a rate for them. They are listed at the foot of the quote.',
    );
  }

  return {
    lines,
    rooms,
    modularPaise,
    nonModularPaise,
    modularDiscountPaise,
    professionalFeePaise,
    gstPaise,
    totalPaise,
    lowPaise: Math.round(totalPaise * (1 - variancePct)),
    highPaise: Math.round(totalPaise * (1 + variancePct)),
    variancePct,
    notPriced,
    assumptions,
  };
}

/**
 * Where two quotes actually differ.
 *
 * Returns one row per catalogue item either studio priced, so the comparison
 * is line for line even when one of them did not quote something. A missing
 * line is the most interesting row on the page — it is usually the reason one
 * total is lower — and a comparison that silently dropped it would be doing
 * the thing this whole product exists to stop.
 */
export interface ComparisonRow {
  code: string;
  room: Room;
  label: string;
  spec: string;
  size: string;
  a: Paise | null;
  b: Paise | null;
  /** Positive when B is dearer. Null when either side did not price it. */
  deltaPaise: Paise | null;
}

export function compareQuotes(a: FirstQuote, b: FirstQuote): ComparisonRow[] {
  const codes = [...new Set([...a.lines, ...b.lines].map((l) => l.code))];
  const byCode = (q: FirstQuote, code: string) => q.lines.find((l) => l.code === code);

  return codes.map((code) => {
    const la = byCode(a, code);
    const lb = byCode(b, code);
    const ref = la ?? lb!;

    return {
      code,
      room: ref.room,
      label: ref.label,
      spec: ref.spec,
      size: ref.size,
      a: la?.amountPaise ?? null,
      b: lb?.amountPaise ?? null,
      deltaPaise: la && lb ? lb.amountPaise - la.amountPaise : null,
    };
  });
}

// ── Comparing any number of them ────────────────────────────────

export interface ComparedLine {
  code: string;
  room: Room;
  label: string;
  /** The size is OURS and identical down every column — that is the point. */
  size: string;
  /** Per studio, in the order given. `null` where a studio did not price it. */
  cells: {
    slug: string;
    amountPaise: Paise | null;
    /** THIS studio's words for the material. The only column that can differ. */
    spec: string | null;
  }[];
  /** Slugs holding the lowest priced amount. Plural when they tie. */
  cheapest: string[];
  /** Highest minus lowest, among those who priced it. Zero when one did. */
  spreadPaise: Paise;
  /** True when the studios did not all describe the same material. */
  materialsDiffer: boolean;
}

export interface Comparison {
  studios: { slug: string; name: string; quote: FirstQuote }[];
  rooms: { room: Room; label: string; lines: ComparedLine[] }[];
  /** The rows worth reading first: biggest money, or a material disagreement. */
  tellingRows: ComparedLine[];
}

/**
 * Put N quotes side by side, line for line.
 *
 * ## Why a row survives a studio not pricing it
 *
 * A missing line is usually the reason a total is lower, and a comparison that
 * dropped it would be doing precisely what the Problem section on the landing
 * page accuses everybody else of. So every catalogue item ANY studio priced
 * gets a row, and the studios who did not price it show a gap rather than a
 * zero — zero would read as free.
 *
 * ## Why `tellingRows` exists
 *
 * Twenty-three rows across four studios is ninety-two numbers, and a customer
 * who reads all of them carefully is a customer we have failed. The telling
 * rows are the handful where the money actually moves or where the studios
 * disagree about the material — which is the same short list an architect
 * would point at.
 */
export function compareMany(
  entries: { slug: string; name: string; quote: FirstQuote }[],
): Comparison {
  const codes: string[] = [];
  for (const entry of entries) {
    for (const line of entry.quote.lines) {
      if (!codes.includes(line.code)) codes.push(line.code);
    }
  }

  const lines: ComparedLine[] = codes.map((code) => {
    const found = entries.map((e) => ({
      entry: e,
      line: e.quote.lines.find((l) => l.code === code) ?? null,
    }));

    const priced = found.filter((f) => f.line !== null);
    const amounts = priced.map((f) => f.line!.amountPaise);
    const low = amounts.length > 0 ? Math.min(...amounts) : 0;
    const high = amounts.length > 0 ? Math.max(...amounts) : 0;

    const specs = new Set(priced.map((f) => f.line!.spec));
    const reference = priced[0]?.line ?? null;

    return {
      code,
      room: reference?.room ?? 'WHOLE_HOME',
      label: reference?.label ?? code,
      size: reference?.size ?? '',
      cells: found.map((f) => ({
        slug: f.entry.slug,
        amountPaise: f.line?.amountPaise ?? null,
        spec: f.line?.spec ?? null,
      })),
      // Only meaningful when more than one priced it.
      cheapest:
        priced.length > 1
          ? priced.filter((f) => f.line!.amountPaise === low).map((f) => f.entry.slug)
          : [],
      spreadPaise: priced.length > 1 ? high - low : 0,
      materialsDiffer: specs.size > 1,
    };
  });

  const rooms = ROOMS.map((room) => ({
    room,
    label: ROOM_LABELS[room],
    lines: lines.filter((l) => l.room === room),
  })).filter((r) => r.lines.length > 0);

  // Biggest money first, then anything where the materials disagree — a
  // ₹4,000 row where one studio quoted MDF is worth more attention than a
  // ₹40,000 row where everybody quoted the same board.
  const tellingRows = [...lines]
    .filter((l) => l.spreadPaise > 0 || l.materialsDiffer || l.cells.some((c) => c.amountPaise === null))
    .sort((a, b) => {
      if (a.materialsDiffer !== b.materialsDiffer) return a.materialsDiffer ? -1 : 1;
      return b.spreadPaise - a.spreadPaise;
    })
    .slice(0, 5);

  return { studios: entries, rooms, tellingRows };
}

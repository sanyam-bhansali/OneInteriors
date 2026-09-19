/**
 * The rates each studio is quoted on.
 *
 * ## Where these numbers come from
 *
 * The base figures below are **real**: the medians `ingestQuotations()`
 * derived from 934 actual quotations, 25,592 line items. They reproduce, to
 * the rupee in most cases, a calibration note written separately by hand
 * against the same archive — base cabinets ₹2,035/sqft, wardrobe ₹2,065, loft
 * ₹1,910, console ₹1,910, mandir ₹1,892, safety door ₹39,000.
 *
 * ## What is NOT real, and must be replaced
 *
 * The **per-studio variation** is a placeholder. Every listed studio is
 * supposed to file around a hundred of its own quotations, which
 * `scripts/read-quotations.py` and `ingest.ts` then turn into that studio's
 * rates. Until each one has, this file spreads the archive medians across the
 * roster with a deterministic per-slug factor so the product can be built and
 * reviewed end to end.
 *
 * That means **a quote shown today is priced on one studio's archive wearing
 * another studio's name.** It is close enough to be believable, which is
 * precisely what makes it dangerous, so:
 *
 *   - `ratesAreReal()` is false and the quote document says so on its face.
 *   - Nothing here may survive the first real ingestion. When a studio's own
 *     rates land, its entry disappears from the fallback below.
 *
 * Pure, and with NO `server-only` — the quote renders in the browser.
 */

import type { StudioRates } from '@/modules/quotation/catalogue';

/**
 * The archive medians, in paise.
 *
 * AREA items are per square foot of face; UNIT items are the whole thing;
 * false ceiling, painting and electrical are per square foot of carpet area
 * and were derived through an assumed typical area — which is why their
 * spread in the ingestion report is wider than the carpentry.
 */
const ARCHIVE_MEDIAN: Record<string, number> = {
  kitchen_base: 2_035_00,
  kitchen_wall: 2_523_00,
  kitchen_loft: 1_883_00,
  kitchen_tandem: 34_000_00,

  master_wardrobe: 2_065_00,
  master_loft: 1_910_00,
  master_dressing: 15_500_00,
  master_bed: 66_000_00,

  second_wardrobe: 2_065_00,
  second_loft: 1_910_00,
  second_workstation: 12_500_00,
  second_bed: 66_000_00,

  third_wardrobe: 2_065_00,
  third_loft: 1_910_00,
  third_bed: 72_500_00,

  tv_unit: 1_242_00,
  console_shoe: 1_910_00,
  mandir: 1_892_00,
  safety_door: 39_000_00,

  false_ceiling: 111_00,
  painting: 65_00,
  electrical: 59_00,
  vanity: 20_000_00,
};

/**
 * Whether the rates on screen are the studio's own.
 *
 * False until ingestion has run for real. The quote document reads this and
 * labels itself; nothing else in the product is allowed to decide quietly that
 * a placeholder is good enough.
 */
export function ratesAreReal(): boolean {
  return false;
}

/**
 * What produced a stored quote.
 *
 * Every row in `first_quotes` is priced on whatever this file held on the day
 * it was built. Right now that is one studio's archive medians wearing another
 * studio's name, and in a year nobody reading the table will remember that
 * unless the row says so. Bump this whenever the rate source changes —
 * `archive-median@1` → `filed@1` when ingestion runs for real — so a later
 * analysis can tell the placeholder period apart from the honest one instead
 * of averaging them together.
 */
export const RATES_VERSION = 'archive-median@1';

/**
 * A stable number in roughly [-1, 1] from a slug.
 *
 * Deterministic on purpose: the same studio must show the same rates on every
 * page load, or a customer who reloads sees their quote change and correctly
 * stops trusting it.
 */
function spread(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) % 100_000;
  }
  return (hash % 200) / 100 - 1;
}

/**
 * Rates for one studio.
 *
 * ±9% around the archive median. That band is not arbitrary: it is roughly the
 * interquartile spread the ingestion actually measured on the carpentry items
 * — base cabinets ₹2,003–₹2,540, wardrobe ₹2,065–₹2,581 — so two studios here
 * differ by about as much as two real studios do. A wider band would make the
 * comparison look more dramatic than the market is.
 */
/**
 * Three carcass conventions, because the comparison is meaningless without
 * them.
 *
 * Every studio is quoted on OUR line items, so the label and the size are
 * identical down every column. The only place two studios can visibly differ
 * on something other than price is the material — and that is exactly the
 * difference the landing page's ₹1.25 L gap turns out to be.
 *
 * In the real archive this comes from each studio's own Details column and is
 * filed by `ingestQuotations`. These three profiles stand in until it has run,
 * and they are drawn from what the archive actually contains: BWP ply with
 * laminate is the commonest by a distance, MDF appears at the cheaper end, and
 * the dearer quotes carry veneer and branded hardware.
 */
const CARCASS = [
  {
    board: '18mm BWP ply',
    finish: 'laminate shutter',
    hardware: 'soft-close hinges',
  },
  {
    board: '16mm MDF',
    finish: 'matt laminate shutter',
    hardware: 'standard hinges',
  },
  {
    board: '18mm BWP marine ply',
    finish: 'veneer shutter',
    hardware: 'branded soft-close · 10 yr',
  },
] as const;

/** Which items the carcass convention actually describes. */
const CARPENTRY = /wardrobe|loft|kitchen_base|kitchen_wall|tv_unit|console_shoe|mandir|vanity|dressing|workstation/;

export function filedRatesFor(slug: string, filedOn = '2026-09-18'): StudioRates {
  const factor = 1 + spread(slug) * 0.09;
  // Cheaper studios tend to the cheaper board, which is the whole reason a
  // total can be lower without the studio being better value.
  const profile =
    CARCASS[factor < 0.97 ? 1 : factor > 1.03 ? 2 : 0] ?? CARCASS[0];

  return Object.fromEntries(
    Object.entries(ARCHIVE_MEDIAN).map(([code, median]) => [
      code,
      {
        code,
        ratePaise: Math.round(median * factor),
        ...(CARPENTRY.test(code)
          ? { spec: `${profile.board} · ${profile.finish} · ${profile.hardware}` }
          : {}),
        // 104 is a plausible archive and is NOT a real count for this studio.
        // It exists so the quote can show provenance in the shape it will have
        // once ingestion is real; `ratesAreReal()` is what says it is not yet.
        fromQuotations: 104,
        filedOn,
      },
    ]),
  );
}

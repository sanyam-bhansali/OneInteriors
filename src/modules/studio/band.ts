/**
 * A studio's band — worked out from its prices, confirmed by a person.
 *
 * A studio does not choose its band and cannot buy one (requirements doc §1).
 * Two readings are taken and ops confirms one:
 *
 * 1. **From its rates.** The studio's live rates price one reference home —
 *    a standard 3 BHK of 1,250 sq ft, full home — on the same lines as every
 *    other studio, and the result per square foot, before GST (the basis the
 *    bands are stated on, `tiers.ts`), places it.
 * 2. **From its portfolio.** The median ₹/sq ft of its finished full-home
 *    projects that carry both a value and a carpet area. Only full homes:
 *    a kitchen's value over the whole flat's area would place every studio
 *    in Essential.
 *
 * When the two land in different bands, the proposal says so and ops decides
 * — a studio whose quotations say Essential and whose finished homes say
 * Premium is either quoting low to win work or photographing its best job,
 * and a person should know which before customers are sorted by it.
 *
 * Pure, and tested.
 */

import { buildFirstQuote } from '@/modules/quotation/first-quote';
import { FULL_HOME } from '@/modules/quotation/scope';
import { TIER, tierForPerSqft, type Tier } from '@/modules/quotation/tiers';
import type { StudioRates } from '@/modules/quotation/catalogue';
import { perSqftOf } from './portfolio-fields';

/** The home every studio is placed on. Same for all, so the bands compare. */
export const REFERENCE_HOME = { bhk: 3, carpetAreaSqft: 1250, bathrooms: 3 } as const;

/** Fewer finished full homes than this and the portfolio reading is not offered. */
export const MIN_PORTFOLIO_HOMES = 2;

export interface Reading {
  perSqft: number;
  tier: Tier;
}

/** The rates reading, or null when the rates cannot price a full home. */
export function bandFromRates(rates: StudioRates): Reading | null {
  if (Object.keys(rates).length === 0) return null;
  const quote = buildFirstQuote(
    { ...REFERENCE_HOME, kitchenRunMm: null, runSource: 'standard', scope: FULL_HOME },
    rates,
  );
  // A card missing lines prices a smaller home than the reference and would
  // place the studio a band too low. Better no reading than a wrong one.
  if (quote.notPriced.length > 0) return null;
  const perSqft = Math.round((quote.totalPaise - quote.gstPaise) / 100 / REFERENCE_HOME.carpetAreaSqft);
  return { perSqft, tier: tierForPerSqft(perSqft) };
}

interface ProjectLike {
  scope: string | null;
  valuePaise: number | null;
  carpetAreaSqft?: number | null;
}

/** The portfolio reading, with how many homes it rests on, or null. */
export function bandFromPortfolio(projects: ProjectLike[]): (Reading & { homes: number }) | null {
  const values = projects
    .filter((p) => p.scope === 'FULL_HOME')
    .map(perSqftOf)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  if (values.length < MIN_PORTFOLIO_HOMES) return null;
  const mid = values.length / 2;
  const perSqft = Math.round(values.length % 2 ? values[Math.floor(mid)]! : (values[mid - 1]! + values[mid]!) / 2);
  return { perSqft, tier: tierForPerSqft(perSqft), homes: values.length };
}

export interface BandProposal {
  fromRates: Reading | null;
  fromPortfolio: (Reading & { homes: number }) | null;
  /** What we suggest ops confirms: the rates reading, else the portfolio's. */
  proposed: Tier | null;
  /** The two readings disagree — say so beside the confirm button. */
  disagree: boolean;
  /** One line for ops, in plain words. */
  note: string;
}

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}/sq ft`;

export function proposeBand(rates: StudioRates, projects: ProjectLike[]): BandProposal {
  const fromRates = bandFromRates(rates);
  const fromPortfolio = bandFromPortfolio(projects);
  const proposed = fromRates?.tier ?? fromPortfolio?.tier ?? null;
  const disagree = Boolean(fromRates && fromPortfolio && fromRates.tier !== fromPortfolio.tier);

  let note: string;
  if (!fromRates && !fromPortfolio) {
    note = 'Nothing to place them on yet: no live rates that price a full home, and fewer than two finished full homes with a value and a carpet area.';
  } else if (disagree) {
    note = `Their rates say ${TIER[fromRates!.tier].label} (${rupees(fromRates!.perSqft)}); their finished homes say ${TIER[fromPortfolio!.tier].label} (${rupees(fromPortfolio!.perSqft)} across ${fromPortfolio!.homes}). Worth a call before confirming.`;
  } else if (fromRates && fromPortfolio) {
    note = `Rates and finished homes agree: ${TIER[fromRates.tier].label} (${rupees(fromRates.perSqft)} on rates, ${rupees(fromPortfolio.perSqft)} delivered).`;
  } else if (fromRates) {
    note = `From their rates: ${TIER[fromRates.tier].label}, ${rupees(fromRates.perSqft)} on a standard 3 BHK before GST. No finished full homes with a value and area to check it against.`;
  } else {
    note = `From ${fromPortfolio!.homes} finished full homes: ${TIER[fromPortfolio!.tier].label}, ${rupees(fromPortfolio!.perSqft)}. No live rates yet to check it against.`;
  }
  return { fromRates, fromPortfolio, proposed, disagree, note };
}

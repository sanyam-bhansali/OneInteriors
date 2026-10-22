import { describe, expect, it } from 'vitest';
import { computeTotals, lineAmount, pctOfRupees, QTY_SCALE, type QuoteLineInput } from '@/modules/studio-quote/pricing';
import { discountedPaise } from '@/modules/studio-quote/rooms';
import { scheduleAmounts, HAUSPIRE_TEMPLATE } from '@/modules/studio-sales/payment-template';
import { splitRupees } from '@/lib/money';
import {
  areaAmount,
  estimateKitchenRun,
  feetInchesToMm,
  oldComputeTotals,
  oldDiscounted,
  rftAmount,
  sqftAmount,
  unitAmount,
  type OldLine,
} from '@/modules/studio-quote/hauspire-calc';

/**
 * Old app against ours, to the paisa (owner, 22 Oct 2026: "same
 * functionality, everything exactly similar", calculations and rounding
 * included). `hauspire-calc.ts` is the old app's own code in rupees; every
 * figure `pricing.ts` gives in paise must be that figure × 100. The golden
 * values are the old code's answers for CALCULATIONS.md's own products and
 * sizes; the fake quotations are generated, never real clients.
 */

const P = (rupees: number) => Math.round(rupees * 100);
const area = (w: number, h: number, rate: number, code: 'MODULAR' | 'ONSITE' = 'MODULAR'): QuoteLineInput => ({ unit: 'AREA', code, ratePaise: P(rate), widthMm: w, heightMm: h });
const unit = (rate: number, qty = 1, code: 'MODULAR' | 'ONSITE' = 'ONSITE'): QuoteLineInput => ({ unit: 'UNIT', code, ratePaise: P(rate), qtyMilli: qty * QTY_SCALE });

describe('CALCULATIONS.md §2, line sizing: golden values from the old code', () => {
  it('W × H lines: round((W × H) / 92,903.04 × rate)', () => {
    // The first quote's kitchen run 3960 mm against the ProductMaster rates.
    expect(areaAmount(3960, 750, 2580)).toBe(82_480); // Base Cabinets
    expect(areaAmount(3960, 600, 2580)).toBe(65_984); // Wall Cabinets
    expect(areaAmount(3960, 600, 2000)).toBe(51_150); // Loft
    expect(areaAmount(1500, 2100, 2580)).toBe(87_478); // Premium Shutter wardrobe
    expect(areaAmount(1500, 2100, 1200)).toBe(40_688); // TV Unit
    expect(areaAmount(600, 1800, 2400)).toBe(27_900); // Mandir
    expect(areaAmount(1200, 900, 1910)).toBe(22_204); // Console Unit/Shoe Rack
    expect(areaAmount(600, 600, 2580)).toBe(9_998); // Vanity Unit
    expect(areaAmount(1200, 750, 2000)).toBe(19_375); // Workstation
    // And ours, the same figure in paise.
    expect(lineAmount(area(3960, 750, 2580))).toBe(8_248_000);
    expect(lineAmount(area(600, 600, 2580))).toBe(999_800);
    // 34.3904 sq ft × ₹1,750 = 60,183.71 → ₹60,184, never ₹60,183.71.
    expect(lineAmount(area(4260, 750, 1750))).toBe(6_018_400);
  });

  it('square feet, running feet and units', () => {
    expect(sqftAmount(1000, 26.5)).toBe(26_500);
    expect(lineAmount({ unit: 'SQFT', code: 'ONSITE', ratePaise: 2650, qtyMilli: 1_000_000 })).toBe(2_650_000);
    expect(rftAmount(12.5, 1200)).toBe(15_000);
    expect(lineAmount({ unit: 'RFT', code: 'MODULAR', ratePaise: 120_000, qtyMilli: 12_500 })).toBe(1_500_000);
    expect(unitAmount(3, 10_000)).toBe(30_000);
    expect(lineAmount(unit(10_000, 3))).toBe(3_000_000);
  });

  it('kitchen run: (W + D) − 900, feet and inches to mm', () => {
    expect(feetInchesToMm(10, 0) + feetInchesToMm(10, 2) - 900).toBe(5_247);
    expect(estimateKitchenRun(feetInchesToMm(7, 10), feetInchesToMm(7, 10))).toBe(3_876);
    expect(estimateKitchenRun(300, 300)).toBe(600);
  });
});

/** A fake 3 BHK first quote, built from CALCULATIONS.md's products at the run 3960 mm. */
const FAKE_3BHK: { wc: 'MO-01' | 'NM-01'; line: QuoteLineInput }[] = [
  { wc: 'MO-01', line: area(3960, 750, 2580) },
  { wc: 'NM-01', line: unit(10_000, 3) },
  { wc: 'NM-01', line: unit(12_000) },
  { wc: 'MO-01', line: area(3960, 600, 2580) },
  { wc: 'NM-01', line: unit(8_000) },
  { wc: 'MO-01', line: area(3960, 600, 2000) },
  ...[0, 1, 2].flatMap(() => [
    { wc: 'MO-01' as const, line: area(1500, 2100, 2580) },
    { wc: 'MO-01' as const, line: unit(54_000, 1, 'MODULAR') },
    { wc: 'NM-01' as const, line: unit(12_000) },
  ]),
  { wc: 'MO-01', line: area(1500, 600, 2000) },
  { wc: 'MO-01', line: unit(7_500, 1, 'MODULAR') },
  { wc: 'NM-01', line: unit(8_000) },
  { wc: 'NM-01', line: area(1500, 2100, 1200, 'ONSITE') },
  { wc: 'MO-01', line: area(1200, 900, 1910) },
  { wc: 'NM-01', line: unit(42_000) },
  { wc: 'NM-01', line: area(600, 1800, 2400, 'ONSITE') },
  { wc: 'MO-01', line: area(600, 600, 2580) },
  { wc: 'MO-01', line: area(600, 600, 2580) },
  { wc: 'NM-01', line: unit(55_000) },
  { wc: 'NM-01', line: unit(40_000) },
];

const oldLines = (rows: { wc: string; line: QuoteLineInput }[]): OldLine[] => rows.map((r) => ({ wc: r.wc, amount: lineAmount(r.line) / 100 }));

describe('CALCULATIONS.md §1 and §3: totals and payment stages, a fake 3 BHK', () => {
  const lines = FAKE_3BHK.map((r) => r.line);

  it('MO, NM, 7% fee, 15% modular discount, TPV: the old code’s figures', () => {
    const old = oldComputeTotals(oldLines(FAKE_3BHK));
    expect(old).toMatchObject({ mo: 693_123, nm: 299_588, fee: 69_490, subTotal: 1_062_201, discount: 103_968, tpv: 958_233 });
    const t = computeTotals(lines, { feeBps: 700, discountBps: 1500, bookingAdvancePaise: P(25_000) });
    expect(t.modularPaise).toBe(P(693_123));
    expect(t.onsitePaise).toBe(P(299_588));
    expect(t.feePaise).toBe(P(69_490));
    expect(t.subTotalPaise).toBe(P(1_062_201));
    expect(t.discountPaise).toBe(P(103_968));
    expect(t.beforeTaxPaise).toBe(P(958_233));
    expect(t.totalPaise).toBe(P(958_233));
  });

  it('the stages: ₹25,000, then 5 / 10 / 40 / 40 / 5% of the rest, each to the rupee', () => {
    const old = oldComputeTotals(oldLines(FAKE_3BHK));
    expect(old.stages.map((s) => s.amount)).toEqual([25_000, 46_662, 93_323, 373_293, 373_293, 46_662]);
    const t = computeTotals(lines, { feeBps: 700, discountBps: 1500, bookingAdvancePaise: P(25_000) });
    expect(t.stages.map((s) => s.amountPaise)).toEqual(old.stages.map((s) => P(s.amount)));
    expect(t.stages.map((s) => (s.pct ? `${s.label} (${s.pct}%)` : s.label))).toEqual(old.stages.map((s) => s.label));
    expect(t.stages.map((s) => s.detail)).toEqual(old.stages.map((s) => s.desc));
  });

  it('GST 18% after every discount; the stages then split the grand total', () => {
    const old = oldComputeTotals(oldLines(FAKE_3BHK), { gstOn: true });
    expect(old).toMatchObject({ gst: 172_482, grandTotal: 1_130_715 });
    expect(old.stages.map((s) => s.amount)).toEqual([25_000, 55_286, 110_572, 442_286, 442_286, 55_286]);
    const t = computeTotals(lines, { feeBps: 700, discountBps: 1500, gstBps: 1800, bookingAdvancePaise: P(25_000) });
    expect(t.gstPaise).toBe(P(172_482));
    expect(t.totalPaise).toBe(P(1_130_715));
    // The one deliberate difference: the old stages add up to ₹11,30,716, a
    // rupee over its own grand total; ours give the last stage the rest.
    expect(old.stages.reduce((a, s) => a + s.amount, 0)).toBe(1_130_716);
    expect(t.stages.map((s) => s.amountPaise)).toEqual([25_000, 55_286, 110_572, 442_286, 442_286, 55_285].map(P));
    expect(t.stages.reduce((a, s) => a + s.amountPaise, 0)).toBe(t.totalPaise);
  });

  it('fee off, a named on-spot discount, a 12.5% modular discount', () => {
    const opts = { modularPct: 0.125, onSpot: 15_000, feeOn: false };
    const old = oldComputeTotals(oldLines(FAKE_3BHK), opts);
    const t = computeTotals(lines, { feeBps: 0, discountBps: 1250, onSpotPaise: P(15_000), bookingAdvancePaise: P(25_000) });
    expect(t.feePaise).toBe(0);
    expect(t.discountPaise).toBe(P(old.discount));
    expect(t.beforeTaxPaise).toBe(P(old.tpv));
  });

  it('the PDF’s Discounted column: Math.round(amount × (1 − 15%)) on modular lines only', () => {
    expect(oldDiscounted({ wc: 'MO-01', amount: 1001 }, 0.15)).toBe(851);
    expect(discountedPaise(P(1001), 'MODULAR', 1500)).toBe(P(851));
    expect(discountedPaise(P(1001), 'ONSITE', 1500)).toBe(P(1001));
    expect(discountedPaise(P(82_480), 'MODULAR', 1500)).toBe(P(oldDiscounted({ wc: 'MO-01', amount: 82_480 }, 0.15)));
  });
});

/** A small seeded generator, so the fake quotations are the same on every run. */
function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('500 generated fake quotations: ours equals the old code to the paisa', () => {
  const rnd = prng(20261022);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
  const RATES = [2580, 2000, 1910, 1200, 2400, 850, 26.5, 75, 1750, 1337, 99.99, 2580.5];
  const UNITS = [7500, 8000, 10_000, 12_000, 14_000, 42_000, 54_000, 64_000, 35_000, 999];

  for (let q = 0; q < 500; q++) {
    const n = 1 + Math.floor(rnd() * 40);
    const rows: { wc: 'MO-01' | 'NM-01'; line: QuoteLineInput; old: number }[] = [];
    for (let i = 0; i < n; i++) {
      const wc = rnd() < 0.6 ? 'MO-01' : 'NM-01';
      const code = wc === 'MO-01' ? 'MODULAR' : 'ONSITE';
      const kind = pick(['AREA', 'SQFT', 'RFT', 'UNIT'] as const);
      if (kind === 'AREA') {
        const w = 300 + Math.floor(rnd() * 4000);
        const h = 300 + Math.floor(rnd() * 2400);
        const rate = pick(RATES);
        rows.push({ wc, line: { unit: 'AREA', code, ratePaise: P(rate), widthMm: w, heightMm: h }, old: areaAmount(w, h, rate) });
      } else if (kind === 'SQFT' || kind === 'RFT') {
        const qty = Math.round(rnd() * 150_000) / 1000;
        const rate = pick(RATES);
        rows.push({ wc, line: { unit: kind, code, ratePaise: P(rate), qtyMilli: Math.round(qty * 1000) }, old: kind === 'SQFT' ? sqftAmount(qty, rate) : rftAmount(qty, rate) });
      } else {
        const qty = 1 + Math.floor(rnd() * 5);
        const price = pick(UNITS);
        rows.push({ wc, line: { unit: 'UNIT', code, ratePaise: P(price), qtyMilli: qty * 1000 }, old: unitAmount(qty, price) });
      }
    }
    const modularPct = pick([0, 0.1, 0.12, 0.125, 0.15, 0.2]);
    const onSpot = pick([0, 0, 5000, 10_000, 25_000]);
    const feeOn = rnd() < 0.85;
    const gstOn = rnd() < 0.3;
    const old = oldComputeTotals(
      rows.map((r) => ({ wc: r.wc, amount: r.old })),
      { modularPct, onSpot, feeOn, gstOn },
    );
    const t = computeTotals(
      rows.map((r) => r.line),
      { feeBps: feeOn ? 700 : 0, discountBps: Math.round(modularPct * 10_000), onSpotPaise: P(onSpot), gstBps: gstOn ? 1800 : 0, bookingAdvancePaise: P(25_000) },
    );
    it(`quote ${q}: ${n} lines, totals identical`, () => {
      rows.forEach((r) => expect(lineAmount(r.line), 'a line').toBe(P(r.old)));
      expect([t.modularPaise, t.onsitePaise, t.feePaise, t.subTotalPaise, t.discountPaise, t.beforeTaxPaise, t.gstPaise, t.totalPaise]).toEqual(
        [old.mo, old.nm, old.fee, old.subTotal, old.discount, old.tpv, old.gst, old.grandTotal].map(P),
      );
      if (old.grandTotal > 25_000) {
        const ours = t.stages.map((s) => s.amountPaise);
        const theirs = old.stages.map((s) => P(s.amount));
        // Every stage but the last is the old figure; the last takes the rest, so ours add up exactly.
        expect(ours.slice(0, -1)).toEqual(theirs.slice(0, -1));
        expect(Math.abs(ours.at(-1)! - theirs.at(-1)!)).toBeLessThanOrEqual(200);
        expect(ours.reduce((a, b) => a + b, 0)).toBe(t.totalPaise);
      }
    });
  }
});

describe('the studio’s schedule (the PDF’s stages) rounds the same way', () => {
  it('Hauspire’s template on a whole-rupee contract gives the old app’s figures', () => {
    const r = scheduleAmounts(HAUSPIRE_TEMPLATE, P(958_233));
    expect(r.ok && r.stages.map((s) => s.amountPaise)).toEqual([25_000, 46_662, 93_323, 373_293, 373_293, 46_662].map(P));
  });

  it('splitRupees: whole rupees, the last takes the rest', () => {
    expect(splitRupees(P(1001), [1, 1, 1])).toEqual([P(334), P(334), P(333)]);
    expect(splitRupees(12_345, [1, 1])).toEqual([6_200, 6_145]);
  });

  it('pctOfRupees is Math.round(rupees × pct)', () => {
    expect(pctOfRupees(P(150), 700)).toBe(P(11)); // 10.5 → 11
    expect(pctOfRupees(P(81_750), 700)).toBe(P(5_723));
    expect(pctOfRupees(P(47_250), 1500)).toBe(P(7_088));
    expect(pctOfRupees(P(123), 0)).toBe(0);
  });
});

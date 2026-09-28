import { describe, it, expect } from 'vitest';
import {
  TIER,
  TIERS,
  perSqftLabel,
  tierForPerSqft,
  tierRangeFor,
  studioTierFrom,
  tiersForBudget,
} from '@/modules/quotation/tiers';
import { lakhsToPaise, paiseToLakhs } from '@/lib/money';

describe('tier definitions', () => {
  it('has bands that ascend without gaps', () => {
    expect(TIER.ESSENTIAL.perSqftTo).toBeGreaterThanOrEqual(TIER.PREMIUM.perSqftFrom - 1);
    expect(TIER.PREMIUM.perSqftTo).toBeGreaterThanOrEqual(TIER.LUXURY.perSqftFrom - 1);
    expect(TIER.ESSENTIAL.perSqftFrom).toBeLessThan(TIER.PREMIUM.perSqftFrom);
    expect(TIER.PREMIUM.perSqftFrom).toBeLessThan(TIER.LUXURY.perSqftFrom);
  });

  /**
   * A tier that suits everyone tells a customer nothing, and it is also how a
   * band gets stretched to cover work it cannot actually deliver.
   */
  it('says who each tier is not for, in terms of materials', () => {
    for (const tier of TIERS) {
      expect(TIER[tier].notFor.length).toBeGreaterThan(40);
      expect(TIER[tier].materials.length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('tierForPerSqft', () => {
  it('places a rate in the right band', () => {
    expect(tierForPerSqft(1400)).toBe('ESSENTIAL');
    expect(tierForPerSqft(2100)).toBe('PREMIUM');
    expect(tierForPerSqft(2800)).toBe('LUXURY');
  });

  it('puts a boundary figure in the higher band', () => {
    expect(tierForPerSqft(TIER.PREMIUM.perSqftFrom)).toBe('PREMIUM');
    expect(tierForPerSqft(TIER.LUXURY.perSqftFrom)).toBe('LUXURY');
  });

  // A studio cheaper than the band is legitimate. Telling a customer their
  // budget fits nothing would be both wrong and rude.
  it('does not fall off the bottom', () => {
    expect(tierForPerSqft(300)).toBe('ESSENTIAL');
    expect(tierForPerSqft(0)).toBe('ESSENTIAL');
  });
});

describe('tierRangeFor', () => {
  it('scales with the home', () => {
    const small = tierRangeFor('PREMIUM', 850);
    const large = tierRangeFor('PREMIUM', 1650);
    expect(large.lowPaise).toBeGreaterThan(small.lowPaise);
  });

  it('prices the bands set on 29 Sep: 1,200 / 1,800 / 2,500 per sq ft', () => {
    // A 1,000 sq ft home: Essential ₹12–18 L, Premium ₹18–25 L, Luxury from ₹25 L.
    const essential = tierRangeFor('ESSENTIAL', 1000);
    const premium = tierRangeFor('PREMIUM', 1000);
    const luxury = tierRangeFor('LUXURY', 1000);

    expect(paiseToLakhs(essential.lowPaise)).toBe(12);
    expect(paiseToLakhs(essential.highPaise!)).toBe(18);
    expect(paiseToLakhs(premium.lowPaise)).toBe(18);
    expect(paiseToLakhs(premium.highPaise!)).toBe(25);
    expect(paiseToLakhs(luxury.lowPaise)).toBe(25);
  });

  it('gives the top band a floor and no invented ceiling', () => {
    expect(TIER.LUXURY.perSqftTo).toBeNull();
    expect(tierRangeFor('LUXURY', 1150).highPaise).toBeNull();
    expect(perSqftLabel('LUXURY')).toBe('₹2,500 and up');
    expect(perSqftLabel('PREMIUM')).toBe('₹1,800–2,500');
  });

  it('always returns low below high where there is a high', () => {
    for (const tier of TIERS) {
      const range = tierRangeFor(tier, 1150);
      if (range.highPaise !== null) expect(range.lowPaise).toBeLessThan(range.highPaise);
    }
  });
});

/**
 * A studio's band is a CONSEQUENCE of its own prices. Not self-declared, not
 * set by ops, and not purchasable — which is why this function takes a quote
 * total and an area, and nothing else. There is deliberately no argument here
 * that a subscription could occupy.
 */
describe('studioTierFrom', () => {
  it('derives the band from what the studio actually charges', () => {
    const area = 1150;
    expect(studioTierFrom(lakhsToPaise(18), area)).toBe('ESSENTIAL'); // ≈ ₹1,565/sq ft
    expect(studioTierFrom(lakhsToPaise(25), area)).toBe('PREMIUM'); // ≈ ₹2,174/sq ft
    expect(studioTierFrom(lakhsToPaise(32), area)).toBe('LUXURY'); // ≈ ₹2,783/sq ft
  });

  it('survives a missing area rather than dividing by zero', () => {
    expect(studioTierFrom(lakhsToPaise(20), 0)).toBe('ESSENTIAL');
  });
});

describe('tiersForBudget', () => {
  it('offers everything when no budget was given', () => {
    const offered = tiersForBudget(null, 1150);
    expect(offered.map((o) => o.tier)).toEqual([...TIERS]);
    expect(offered.every((o) => o.withinBudget)).toBe(true);
  });

  /**
   * A band above budget is shown and marked, not hidden. People move up when
   * they see what the difference buys, and removing the option silently would
   * be deciding for them.
   */
  it('shows a band above budget rather than hiding it', () => {
    const offered = tiersForBudget(lakhsToPaise(9), 1150);
    const premium = offered.find((o) => o.tier === 'PREMIUM');
    expect(premium).toBeDefined();
    expect(premium?.withinBudget).toBe(false);
  });

  it('marks bands the budget clears as within reach', () => {
    // ₹24L on 1150 sqft clears Essential (₹13.8–20.7 L) and reaches into
    // Premium (₹20.7–28.75 L), without having outgrown either.
    const offered = tiersForBudget(lakhsToPaise(24), 1150);
    expect(offered.find((o) => o.tier === 'ESSENTIAL')?.withinBudget).toBe(true);
    expect(offered.find((o) => o.tier === 'PREMIUM')?.withinBudget).toBe(true);
    expect(offered.find((o) => o.tier === 'LUXURY')?.withinBudget).toBe(false);
  });

  /**
   * The regression. An earlier version dropped bands the customer had
   * "outgrown", which on a small flat with a healthy budget left exactly ONE
   * card on screen — and one option is not a choice. The whole point of the
   * step is comparing what more money buys.
   */
  it('always offers all three, whatever the budget', () => {
    for (const budget of [1, 5, 10, 40, 200]) {
      for (const area of [350, 850, 1650]) {
        const offered = tiersForBudget(lakhsToPaise(budget), area);
        expect(offered.map((o) => o.tier)).toEqual([...TIERS]);
      }
    }
  });

  it('marks a band the budget clears entirely as within reach', () => {
    // ₹40 lakh on 1150 sqft clears Essential's ceiling completely.
    const offered = tiersForBudget(lakhsToPaise(40), 1150);
    expect(offered.find((o) => o.tier === 'ESSENTIAL')?.fit).toBe('under');
    expect(offered.find((o) => o.tier === 'ESSENTIAL')?.withinBudget).toBe(true);
  });

  it('marks a band the budget cannot reach as a stretch', () => {
    const offered = tiersForBudget(lakhsToPaise(9), 1150);
    expect(offered.find((o) => o.tier === 'LUXURY')?.fit).toBe('stretch');
    expect(offered.find((o) => o.tier === 'LUXURY')?.withinBudget).toBe(false);
  });

  it('marks the band the budget actually lands in', () => {
    // ₹24 lakh on 1150 sqft sits inside Premium's range.
    const offered = tiersForBudget(lakhsToPaise(24), 1150);
    expect(offered.find((o) => o.tier === 'PREMIUM')?.fit).toBe('within');
  });

  it('never marks the open top band as outgrown', () => {
    // Luxury has no ceiling, so no budget clears it.
    const offered = tiersForBudget(lakhsToPaise(500), 1150);
    expect(offered.find((o) => o.tier === 'LUXURY')?.fit).toBe('within');
  });
});

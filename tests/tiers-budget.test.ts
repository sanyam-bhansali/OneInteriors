import { describe, it, expect } from 'vitest';
import {
  TIER,
  TIERS,
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
    expect(tierForPerSqft(850)).toBe('ESSENTIAL');
    expect(tierForPerSqft(1400)).toBe('PREMIUM');
    expect(tierForPerSqft(2400)).toBe('LUXURY');
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

  it('produces figures that match the Pune market', () => {
    // A 2 BHK at 850 sqft in Premium should land in the 9–15 lakh region,
    // which is where studios in this segment actually advertise.
    const { lowPaise, highPaise } = tierRangeFor('PREMIUM', 850);
    expect(paiseToLakhs(lowPaise)).toBeGreaterThan(8);
    expect(paiseToLakhs(highPaise)).toBeLessThan(16);
  });

  it('always returns low below high', () => {
    for (const tier of TIERS) {
      const range = tierRangeFor(tier, 1150);
      expect(range.lowPaise).toBeLessThan(range.highPaise);
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
    expect(studioTierFrom(lakhsToPaise(10), area)).toBe('ESSENTIAL');
    expect(studioTierFrom(lakhsToPaise(16), area)).toBe('PREMIUM');
    expect(studioTierFrom(lakhsToPaise(25), area)).toBe('LUXURY');
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
    // ₹14L on 1150 sqft clears Essential and reaches into Premium, without
    // having outgrown either.
    const offered = tiersForBudget(lakhsToPaise(14), 1150);
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
    // ₹14 lakh on 1150 sqft sits inside Premium's range.
    const offered = tiersForBudget(lakhsToPaise(14), 1150);
    expect(offered.find((o) => o.tier === 'PREMIUM')?.fit).toBe('within');
  });
});

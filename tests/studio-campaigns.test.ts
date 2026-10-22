import { describe, expect, it } from 'vitest';
import { campaignKey, foldCampaigns } from '@/modules/studio-sales/campaign-rules';

/**
 * "By campaign" on lead analytics (owner, 22 Oct 2026): the four groupBys
 * folded into one line per campaign.
 */

describe('by campaign', () => {
  it('one campaign is its id, whatever it was called; without an id, its name', () => {
    expect(campaignKey({ campaignId: '120', campaignName: 'Oct' })).toBe('id:120');
    expect(campaignKey({ campaignId: null, campaignName: ' Oct-Kitchens ' })).toBe('name:oct-kitchens');
    expect(campaignKey({ campaignId: null, campaignName: null })).toBeNull();
  });

  it('folds leads, called, quoted and customers per campaign, most leads first', () => {
    const lines = foldCampaigns({
      leads: [
        { campaignId: '120', campaignName: 'Oct kitchens', count: 30 },
        /* Renamed mid-flight: still the same campaign, the commoner name shown. */
        { campaignId: '120', campaignName: 'Oct kitchens v2', count: 10 },
        { campaignId: '999', campaignName: null, count: 50 },
        { campaignId: null, campaignName: 'website-oct', count: 5 },
        { campaignId: null, campaignName: null, count: 99 },
      ],
      contacted: [
        { campaignId: '120', campaignName: 'Oct kitchens', count: 20 },
        { campaignId: '999', campaignName: null, count: 10 },
        { campaignId: 'ghost', campaignName: null, count: 3 },
      ],
      quoted: [{ campaignId: '120', campaignName: 'Oct kitchens v2', count: 4 }],
      converted: [
        { campaignId: '120', campaignName: 'Oct kitchens', count: 2 },
        { campaignId: null, campaignName: 'Website-Oct', count: 1 },
      ],
    });
    expect(lines).toEqual([
      { key: 'id:999', label: 'Campaign 999', leads: 50, contacted: 10, quoted: 0, converted: 0, rate: 0 },
      { key: 'id:120', label: 'Oct kitchens', leads: 40, contacted: 20, quoted: 4, converted: 2, rate: 5 },
      { key: 'name:website-oct', label: 'website-oct', leads: 5, contacted: 0, quoted: 0, converted: 1, rate: 20 },
    ]);
  });

  it('nothing in, nothing out; and at most the limit', () => {
    expect(foldCampaigns({ leads: [], contacted: [], quoted: [], converted: [] })).toEqual([]);
    const many = Array.from({ length: 30 }, (_, i) => ({ campaignId: `c${i}`, campaignName: null, count: i + 1 }));
    const lines = foldCampaigns({ leads: many, contacted: [], quoted: [], converted: [] }, 20);
    expect(lines).toHaveLength(20);
    expect(lines[0]).toMatchObject({ key: 'id:c29', leads: 30 });
  });
});

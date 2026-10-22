/**
 * "By campaign" on lead analytics (owner, 22 Oct 2026): leads, contacted,
 * quoted and converted per ad campaign, from the attribution columns lead
 * intake and the AxLeads import fill (`StudioClient.campaignId`,
 * `campaignName`).
 *
 * Pure, tested in tests/studio-campaigns.test.ts. The counting is SQL
 * (`campaign-analytics.ts`, four groupBys); this folds the rows into one line
 * per campaign.
 *
 * A campaign is its id when it has one (a Meta or Google campaign renamed
 * mid-flight is still one campaign) and its name otherwise (a website's
 * utm_campaign has no id). The name shown is the one most leads carry,
 * falling back to "Campaign <id>".
 */

export interface CampaignGroupRow {
  campaignId: string | null;
  campaignName: string | null;
  count: number;
}

export interface CampaignLine {
  key: string;
  label: string;
  leads: number;
  contacted: number;
  quoted: number;
  converted: number;
  /** converted ÷ leads, whole per cent; null with no leads. */
  rate: number | null;
}

export function campaignKey(row: { campaignId: string | null; campaignName: string | null }): string | null {
  if (row.campaignId) return `id:${row.campaignId}`;
  if (row.campaignName) return `name:${row.campaignName.trim().toLowerCase()}`;
  return null;
}

/**
 * One line per campaign, most leads first, at most `limit`. `leads` decides
 * which campaigns exist; the other three only add to them.
 */
export function foldCampaigns(
  rows: { leads: readonly CampaignGroupRow[]; contacted: readonly CampaignGroupRow[]; quoted: readonly CampaignGroupRow[]; converted: readonly CampaignGroupRow[] },
  limit = 20,
): CampaignLine[] {
  const lines = new Map<string, CampaignLine & { names: Map<string, number>; id: string | null }>();
  for (const r of rows.leads) {
    const key = campaignKey(r);
    if (!key) continue;
    const line = lines.get(key) ?? { key, label: '', leads: 0, contacted: 0, quoted: 0, converted: 0, rate: null, names: new Map<string, number>(), id: r.campaignId };
    line.leads += r.count;
    const name = r.campaignName?.trim();
    if (name) line.names.set(name, (line.names.get(name) ?? 0) + r.count);
    lines.set(key, line);
  }
  const add = (list: readonly CampaignGroupRow[], field: 'contacted' | 'quoted' | 'converted') => {
    for (const r of list) {
      const key = campaignKey(r);
      const line = key ? lines.get(key) : undefined;
      if (line) line[field] += r.count;
    }
  };
  add(rows.contacted, 'contacted');
  add(rows.quoted, 'quoted');
  add(rows.converted, 'converted');

  return [...lines.values()]
    .map(({ names, id, ...line }) => {
      const best = [...names.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
      return { ...line, label: best ?? (id ? `Campaign ${id}` : line.key), rate: line.leads > 0 ? Math.round((line.converted / line.leads) * 100) : null };
    })
    .sort((a, b) => b.leads - a.leads || a.label.localeCompare(b.label))
    .slice(0, limit);
}

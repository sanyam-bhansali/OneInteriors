/**
 * The journey export's shape, and the CSV writer.
 *
 * Split from `journey-export.ts` for the reason CONTRIBUTING §9.5 gives: that
 * file carries `server-only` because it queries Postgres, and `server-only`
 * cannot be imported by a test. The CSV writer is pure and is the single
 * riskiest line of code in this feature — a field holding a comma shifts every
 * column after it and quietly makes a spreadsheet lie — so it has to be
 * testable. Nothing here touches a request.
 */

export interface JourneyRow {
  briefId: string;
  briefCreated: string;
  briefCompleted: string;
  locality: string;
  propertyType: string;
  carpetAreaSqft: string;
  tier: string;
  /** Rupees, not paise — this is read by a human in a spreadsheet. */
  budgetMin: string;
  budgetMax: string;

  studio: string;
  quoteTotal: string;
  quoteLow: string;
  quoteHigh: string;
  modular: string;
  nonModular: string;
  variancePct: string;
  kitchenRunMm: string;
  runSource: string;
  linesQuoted: string;
  notPriced: string;
  ratesVersion: string;
  builtAt: string;

  studiosCompared: string;
  starredCodes: string;
  /** "won", "another studio won", or "" when nothing is known. */
  outcome: string;
  outcomeSource: string;
  decidedAt: string;
}

/**
 * CSV, with the quoting Excel actually needs.
 *
 * A field holding a comma or a quote breaks a spreadsheet silently — the row
 * shifts one column left and every number after it is under the wrong heading,
 * which is the worst possible failure for a file whose purpose is deciding
 * things. Wrap everything, double any embedded quote, and be done.
 */
export function toCsv(rows: JourneyRow[]): string {
  const headers: (keyof JourneyRow)[] = [
    'briefId', 'briefCreated', 'briefCompleted', 'locality', 'propertyType',
    'carpetAreaSqft', 'tier', 'budgetMin', 'budgetMax',
    'studio', 'quoteTotal', 'quoteLow', 'quoteHigh', 'modular', 'nonModular',
    'variancePct', 'kitchenRunMm', 'runSource', 'linesQuoted', 'notPriced',
    'ratesVersion', 'builtAt',
    'studiosCompared', 'starredCodes', 'outcome', 'outcomeSource', 'decidedAt',
  ];

  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((h) => cell(row[h])).join(','));
  return lines.join('\n');
}

/**
 * The hash of exactly what the client signs (signoff-rules.ts): a SHA-256 of
 * a quotation revision's stored content and the terms printed with it. Kept
 * apart from the rules so the customer projection, which the website's
 * screens import, never pulls in `node:crypto`. Tested in
 * tests/quote-signoff.test.ts.
 */

import { createHash } from 'node:crypto';
import { canonical } from './signoff-rules';

/**
 * What a revision is, for the hash: its number, the quotation's number, its
 * lines, pricing terms and total as stored, and the terms and conditions
 * printed with it (the quotation's own, else the studio's).
 */
export interface RevisionContent {
  quoteNumber: string;
  n: number;
  lines: unknown;
  terms: unknown;
  totalPaise: number;
  termsText: string | null;
}

export function contentHash(c: RevisionContent): string {
  return createHash('sha256')
    .update(canonical({ q: c.quoteNumber, n: c.n, lines: c.lines, terms: c.terms, total: c.totalPaise, tc: c.termsText?.trim() || null }))
    .digest('hex');
}

/**
 * Reading EVERY quotation from the Hauspire quotation app, for the full
 * import (scripts/import-hauspire-quotes.ts; owner, 22 Oct 2026). The same
 * read-only connection as hauspire-source.ts — the same three settings,
 * PostgREST, GET only — without `server-only`, so a command-line script can
 * use it. Nothing here ever writes to the old app, and it never logs the
 * key, the URL or a row.
 *
 * Page by page (`limit` + `offset`), in a fixed order (`created_at`, then
 * `id`) so a page boundary never skips or repeats a row; every column
 * (`select=*`), because older copies of the app lack `settings`, `stage` or
 * `quote_no`, and naming a missing column is an error. `fetcher` is a
 * parameter so the tests drive it with a fake.
 */

import type { SourceQuote } from './hauspire-map';

export interface HauspireConnection {
  url: string;
  key: string;
  slug: string;
}

/** The connection from the environment, or null when it is not set up. */
export function connectionFromEnv(env: Record<string, string | undefined> = process.env): HauspireConnection | null {
  const url = env.HAUSPIRE_QUOTES_SUPABASE_URL?.trim().replace(/\/+$/, '');
  const key = env.HAUSPIRE_QUOTES_SUPABASE_KEY?.trim();
  const slug = env.HAUSPIRE_QUOTES_STUDIO_SLUG?.trim();
  if (!url || !key || !slug || !/^https?:\/\//.test(url)) return null;
  return { url, key, slug };
}

export const PAGE_SIZE = 500;
/** A ceiling, so a misbehaving endpoint cannot loop for ever (500 × 400 = 2,00,000 rows). */
export const MAX_PAGES = 400;
const TIMEOUT_MS = 20_000;

export type FetchResult = { ok: true; rows: SourceQuote[] } | { ok: false; error: string };

export async function listAllHauspire(c: HauspireConnection, fetcher: typeof fetch = fetch, onPage?: (rowsSoFar: number) => void): Promise<FetchResult> {
  const rows: SourceQuote[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const query = `select=*&order=created_at.asc,id.asc&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    let body: unknown;
    try {
      const res = await fetcher(`${c.url}/rest/v1/quotes?${query}`, {
        method: 'GET',
        headers: { apikey: c.key, Authorization: `Bearer ${c.key}`, Accept: 'application/json' },
        signal: ctl.signal,
        cache: 'no-store',
      });
      if (!res.ok) return { ok: false, error: `The quotation app refused page ${page + 1} (HTTP ${res.status}).` };
      body = await res.json();
    } catch (error) {
      return { ok: false, error: `The quotation app did not answer page ${page + 1} (${error instanceof Error ? error.name : 'unknown'}).` };
    } finally {
      clearTimeout(timer);
    }
    if (!Array.isArray(body)) return { ok: false, error: `Page ${page + 1} was not a list of rows.` };
    rows.push(...(body as SourceQuote[]));
    onPage?.(rows.length);
    if (body.length < PAGE_SIZE) return { ok: true, rows };
  }
  return { ok: false, error: `More than ${MAX_PAGES * PAGE_SIZE} rows; stopped.` };
}

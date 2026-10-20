import 'server-only';

/**
 * The read-only connector to the Hauspire quotation app's database
 * (docs/studio-os/BRING-IN-PROJECTS.md). Server-side only, plain `fetch` to
 * its PostgREST endpoint, switched on only when the owner sets:
 *
 * - `HAUSPIRE_QUOTES_SUPABASE_URL`  — https://<project>.supabase.co
 * - `HAUSPIRE_QUOTES_SUPABASE_KEY`  — a read-only key
 * - `HAUSPIRE_QUOTES_STUDIO_SLUG`   — the one studio that sees the import
 *
 * Only the columns the import needs are selected, it reads only, it gives up
 * after a few seconds, and it never logs the key, the URL or any client data
 * (only an error's kind). The mapping is pure, in hauspire-map.ts.
 */

import { cleanSearch, toMatch, type SourceMatch, type SourceQuote } from './hauspire-map';

export const NOT_CONNECTED = 'Ask One Interiors to connect your quotation app.';
const UNREACHABLE = 'The quotation app did not answer. Try again in a minute, or build the quotation in our builder.';
const TIMEOUT_MS = 6_000;
const SEARCH_COLUMNS = 'id,quote_no,stage,client_name,location,bhk,tpv,created_at,settings';
const QUOTE_COLUMNS = 'id,quote_no,stage,client_name,location,bhk,tpv,created_at,lines,settings';
const UUIDISH = /^[0-9a-zA-Z-]{8,64}$/;

interface Config {
  url: string;
  key: string;
  slug: string;
}

/** The connection, or null when it is not set up (then only "build it in our builder" shows). */
export function hauspireConfig(env: Record<string, string | undefined> = process.env): Config | null {
  const url = env.HAUSPIRE_QUOTES_SUPABASE_URL?.trim().replace(/\/+$/, '');
  const key = env.HAUSPIRE_QUOTES_SUPABASE_KEY?.trim();
  const slug = env.HAUSPIRE_QUOTES_STUDIO_SLUG?.trim();
  if (!url || !key || !slug || !/^https?:\/\//.test(url)) return null;
  return { url, key, slug };
}

/** Whether this studio may import from the quotation app. */
export function importOpenFor(studioSlug: string | null | undefined, env?: Record<string, string | undefined>): boolean {
  const c = hauspireConfig(env);
  return c !== null && Boolean(studioSlug) && c.slug === studioSlug;
}

export type SourceResult<T> = { ok: true; value: T } | { ok: false; error: string };

async function get(c: Config, query: string, fetcher: typeof fetch): Promise<SourceResult<SourceQuote[]>> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetcher(`${c.url}/rest/v1/quotes?${query}`, {
      method: 'GET',
      headers: { apikey: c.key, Authorization: `Bearer ${c.key}`, Accept: 'application/json' },
      signal: ctl.signal,
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error('[bring-in] quotation app refused', res.status);
      return { ok: false, error: UNREACHABLE };
    }
    const body: unknown = await res.json();
    if (!Array.isArray(body)) return { ok: false, error: UNREACHABLE };
    return { ok: true, value: body.filter((r): r is SourceQuote => Boolean(r) && typeof (r as SourceQuote).id === 'string') };
  } catch (error) {
    console.error('[bring-in] quotation app unreachable', error instanceof Error ? error.name : 'unknown');
    return { ok: false, error: UNREACHABLE };
  } finally {
    clearTimeout(timer);
  }
}

/** Newest row per (quotation number, stage): the app overrides a stage on every save, older apps kept revisions. */
function newestPerStage(rows: SourceQuote[]): SourceQuote[] {
  const best = new Map<string, SourceQuote>();
  for (const r of rows) {
    const key = `${r.quote_no ?? r.id}|${r.stage ?? 'sales'}`;
    const cur = best.get(key);
    if (!cur || (r.created_at ?? '') > (cur.created_at ?? '')) best.set(key, r);
  }
  return [...best.values()].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
}

/** Quotations whose number or client name matches, newest first, at most 20. */
export async function searchHauspire(studioSlug: string, raw: unknown, fetcher: typeof fetch = fetch): Promise<SourceResult<SourceMatch[]>> {
  const c = hauspireConfig();
  if (!c || c.slug !== studioSlug) return { ok: false, error: NOT_CONNECTED };
  const q = cleanSearch(raw);
  if (q.length < 2) return { ok: true, value: [] };
  const like = encodeURIComponent(`*${q}*`);
  const query = `select=${SEARCH_COLUMNS}&or=(quote_no.ilike.${like},client_name.ilike.${like})&order=created_at.desc&limit=60`;
  const r = await get(c, query, fetcher);
  if (!r.ok) return r;
  return { ok: true, value: newestPerStage(r.value).slice(0, 20).map(toMatch) };
}

/** One quotation, and its design-stage copy when the app has one. */
export async function readHauspire(
  studioSlug: string,
  sourceId: unknown,
  fetcher: typeof fetch = fetch,
): Promise<SourceResult<{ sales: SourceQuote; design: SourceQuote | null }>> {
  const c = hauspireConfig();
  if (!c || c.slug !== studioSlug) return { ok: false, error: NOT_CONNECTED };
  const id = typeof sourceId === 'string' ? sourceId.trim() : '';
  if (!UUIDISH.test(id)) return { ok: false, error: 'Pick a quotation from the list.' };
  const one = await get(c, `select=${QUOTE_COLUMNS}&id=eq.${encodeURIComponent(id)}&limit=1`, fetcher);
  if (!one.ok) return one;
  const row = one.value[0];
  if (!row) return { ok: false, error: 'That quotation is no longer in the quotation app.' };
  let sales = row;
  let design: SourceQuote | null = null;
  const no = typeof row.quote_no === 'string' ? row.quote_no.trim() : '';
  if (no) {
    const both = await get(c, `select=${QUOTE_COLUMNS}&quote_no=eq.${encodeURIComponent(no)}&order=created_at.desc&limit=20`, fetcher);
    if (both.ok) {
      const newest = newestPerStage(both.value);
      sales = newest.find((r) => (r.stage ?? 'sales') !== 'design') ?? row;
      design = newest.find((r) => r.stage === 'design') ?? null;
    }
  }
  // Picked the design copy and there is no sales copy: it is the agreed quotation.
  if (sales.stage === 'design' && design?.id === sales.id) design = null;
  return { ok: true, value: { sales, design } };
}

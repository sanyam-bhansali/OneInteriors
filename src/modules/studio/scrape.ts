/**
 * Website scraping — prefill, never proof.
 *
 * This reads a studio's own website and pulls out the facts we would otherwise
 * ask them to type. **Everything it returns is a claim the studio makes about
 * itself.** It is prefill for a form and a starting point for a conversation;
 * it is never evidence, and nothing here may ever set a verification tier or
 * a published number. The `ScrapedSite.source` field exists so that every field
 * we show an ops reviewer can be labelled "from their website" rather than
 * quietly appearing beside things we actually checked.
 *
 * Deliberately dependency-free. An HTML parser is one more thing to keep
 * patched, and for reading meta tags, JSON-LD, mailto: and tel: links out of a
 * marketing site, regex over the raw source is honest about how rough this is.
 * If extraction gets more ambitious than this, add a real parser — do not grow
 * the regexes.
 */

import { PUNE_LOCALITIES } from '@/modules/brief/types';
import { lakhsToPaise, type Paise } from '@/lib/money';

export interface ScrapedSite {
  /** The URL we actually ended up reading, after redirects. */
  url: string;
  fetchedAt: Date;
  title: string | null;
  description: string | null;
  emails: string[];
  phones: string[];
  instagram: string | null;
  /** Locality slugs from PUNE_LOCALITIES that the site mentions by name. */
  localities: string[];
  /** Lowest "starting from ₹X lakh" figure on the page, in paise. */
  startingFromPaise: Paise | null;
  /** Years-in-business, if a copyright range or "since YYYY" gives it away. */
  yearsActive: number | null;
  /** Sentences that read like a promise — the things we will have to verify. */
  claims: string[];
  /** Every field above is the studio's own assertion. Never treat as checked. */
  source: 'website-claim';
}

export type ScrapeResult =
  | { ok: true; site: ScrapedSite }
  | { ok: false; error: string };

const TIMEOUT_MS = 12_000;
const MAX_BYTES = 3_000_000;

/** Normalise what a person types into something fetchable, or null. */
export function normaliseUrl(raw: string): string | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    // Only ever fetch public web. No file://, no internal hostnames — this URL
    // arrives from a form, so it is attacker-controlled input.
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname.includes('.')) return null;
    if (isPrivateHost(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Block SSRF targets. A studio's website is never on a private network. */
function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal')) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
    const [a, b] = h.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
  }
  if (h.startsWith('[') || h.includes(':')) return true; // bare IPv6
  return false;
}

export async function scrapeStudioSite(rawUrl: string): Promise<ScrapeResult> {
  const url = normaliseUrl(rawUrl);
  if (!url) return { ok: false, error: 'That does not look like a website address.' };

  let html: string;
  let finalUrl = url;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // Identify ourselves. A studio's web person should be able to see who
        // read their site and why.
        'User-Agent': 'OneInteriorsBot/1.0 (+https://oneinteriors.in/about-our-bot)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timer);

    if (!response.ok) return { ok: false, error: `Their site returned ${response.status}.` };
    finalUrl = response.url || url;

    const type = response.headers.get('content-type') ?? '';
    if (!type.includes('html')) return { ok: false, error: 'That URL is not a web page.' };

    const body = await response.text();
    html = body.length > MAX_BYTES ? body.slice(0, MAX_BYTES) : body;
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return { ok: false, error: aborted ? 'Their site took too long to respond.' : 'Could not reach their site.' };
  }

  return { ok: true, site: extract(html, finalUrl) };
}

/** Pure — exported so it can be tested against saved HTML without a network. */
export function extract(html: string, url: string): ScrapedSite {
  const text = toText(html);

  return {
    url,
    fetchedAt: new Date(),
    title: meta(html, 'og:title') ?? tag(html, 'title'),
    description: meta(html, 'og:description') ?? metaName(html, 'description'),
    emails: uniq(findEmails(html)).slice(0, 5),
    phones: uniq(findPhones(html)).slice(0, 5),
    instagram: findInstagram(html),
    localities: findLocalities(text),
    startingFromPaise: findStartingPrice(text),
    yearsActive: findYearsActive(text),
    claims: findClaims(text, meta(html, 'og:description') ?? metaName(html, 'description')),
    source: 'website-claim',
  };
}

// ── Extractors ─────────────────────────────────────────────────

function toText(html: string): string {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    // Typographers' hyphens read as hyphens to a person and as nothing to a
    // regex. A "10‑year warranty" set with a non-breaking hyphen was silently
    // failing to register as a promise.
    .replace(/[‐‑‒–⁃]/g, '-')
    .replace(/[   ]/g, ' ');
}

function tag(html: string, name: string): string | null {
  const m = html.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1].trim()) || null : null;
}

function meta(html: string, property: string): string | null {
  const m = html.match(
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, 'i'),
  );
  return m ? decode(m[1].trim()) || null : null;
}

function metaName(html: string, name: string): string | null {
  const m = html.match(
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i'),
  );
  return m ? decode(m[1].trim()) || null : null;
}

/**
 * Entity decoding. Numeric and hex forms matter as much as the named ones —
 * `&#x27;` is what a Next.js page emits for an apostrophe, and it turned up
 * verbatim inside quoted claims the first time this ran against a real site.
 */
function decode(s: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    rsquo: '’',
    lsquo: '‘',
    ldquo: '“',
    rdquo: '”',
    mdash: '—',
    ndash: '–',
    hellip: '…',
    rupee: '₹',
  };

  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => named[name.toLowerCase()] ?? whole)
    // Ampersands decoded above can reveal a second layer (&amp;#39;).
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(Number(dec)))
    .replace(/\s+/g, ' ')
    .trim();
}

function safeCodePoint(n: number): string {
  if (!Number.isFinite(n) || n < 1 || n > 0x10ffff) return '';
  try {
    return String.fromCodePoint(n);
  } catch {
    return '';
  }
}

function findEmails(html: string): string[] {
  const found: string[] = [];
  // mailto: first — a linked address is far more likely to be theirs than one
  // scraped out of body text.
  for (const m of html.matchAll(/mailto:([^"'>?\s]+@[^"'>?\s]+)/gi)) found.push(m[1]);
  for (const m of html.matchAll(/\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/g)) found.push(m[0]);
  return found
    .map((e) => e.toLowerCase().replace(/[.,;]+$/, ''))
    // Analytics, CDN and example addresses are not the studio.
    .filter((e) => !/(sentry|wixpress|example\.|\.png$|\.jpg$|godaddy|zyrosite)/i.test(e));
}

function findPhones(html: string): string[] {
  const found: string[] = [];
  for (const m of html.matchAll(/tel:\+?([\d\s()-]{8,17})/gi)) found.push(m[1]);
  for (const m of html.matchAll(/wa\.me\/(\d{10,14})/gi)) found.push(m[1]);
  return found
    .map((raw) => {
      const d = raw.replace(/\D/g, '');
      if (d.length === 10 && /^[6-9]/.test(d)) return `+91${d}`;
      if (d.length === 12 && d.startsWith('91')) return `+${d}`;
      return null;
    })
    .filter((v): v is string => v !== null);
}

function findInstagram(html: string): string | null {
  const m = html.match(/instagram\.com\/([A-Za-z0-9_.]{2,30})/i);
  if (!m) return null;
  const handle = m[1].toLowerCase();
  if (['p', 'reel', 'reels', 'explore', 'accounts', 'stories'].includes(handle)) return null;
  return `@${handle}`;
}

function findLocalities(text: string): string[] {
  const lower = text.toLowerCase();
  return PUNE_LOCALITIES.filter((l) => {
    // Word-boundary match, so "Baner" does not fire on "Banerjee".
    const pattern = new RegExp(`\\b${l.label.toLowerCase().replace(/[-\s]/g, '[-\\s]')}\\b`);
    return pattern.test(lower);
  }).map((l) => l.slug);
}

/**
 * "Starting from ₹6 lakh" and friends. Takes the *lowest* figure found, since
 * that is the entry price the studio is advertising — and it is the number a
 * customer will hold them to.
 */
function findStartingPrice(text: string): Paise | null {
  const values: number[] = [];
  const pattern = /₹\s*([\d.]+)\s*(l|lakh|lakhs|lac|lacs)\b/gi;
  for (const m of text.matchAll(pattern)) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0 && n < 500) values.push(n);
  }
  // "Starting From - 6 Lakhs" — no rupee glyph at all.
  for (const m of text.matchAll(/starting\s*from\s*[-–:]?\s*([\d.]+)\s*(lakh|lakhs|lac|lacs|l)\b/gi)) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0 && n < 500) values.push(n);
  }
  if (values.length === 0) return null;
  return lakhsToPaise(Math.min(...values));
}

function findYearsActive(text: string): number | null {
  const thisYear = new Date().getFullYear();
  const years: number[] = [];
  for (const m of text.matchAll(/(?:©|\(c\)|since|est\.?|established)\s*(\d{4})/gi)) {
    years.push(Number(m[1]));
  }
  // A copyright range like "© 2016–2026" — the first year is the founding one.
  for (const m of text.matchAll(/(\d{4})\s*[–—-]\s*\d{4}/g)) years.push(Number(m[1]));

  const valid = years.filter((y) => y >= 1970 && y <= thisYear);
  if (valid.length === 0) return null;
  const earliest = Math.min(...valid);
  const age = thisYear - earliest;
  return age > 0 && age < 80 ? age : null;
}

/**
 * Sentences that read like a commitment. These are the things we will have to
 * verify — a studio publishing "45-day handover" has handed us the exact
 * measurement to hold them to, which is the whole basis of the tier system.
 */
function findClaims(text: string, description: string | null): string[] {
  // Studios write "forty-five days" as often as "45 days", and the sharpest
  // promise on a site is frequently in the meta description rather than the
  // body — so both spellings and both sources are in scope.
  const NUM = String.raw`(?:\d{1,3}|one|two|three|five|ten|fifteen|twenty|thirty|forty[- ]five|forty|sixty|ninety)`;
  const triggers = new RegExp(
    [
      // A duration tied to a commitment word.
      String.raw`\b${NUM}[\s-]?(?:day|year|month|week)s?\b[^.]{0,70}\b(?:warranty|handover|delivery|guarantee|contract|in writing|written)\b`,
      // The commitment first, the duration after: "warranty of ten years".
      String.raw`\b(?:warranty|handover|delivery)\b[^.]{0,40}\b${NUM}[\s-]?(?:day|year|month)s?\b`,
      String.raw`\bon[- ]time delivery\b`,
      String.raw`\bfixed price\b|\bthe price we quote is the price you pay\b`,
      String.raw`\bno hidden\b|\bno .{0,20}escalation\b`,
      String.raw`\b\d{2,4}\+?\s*(?:homes|projects)\s*(?:delivered|completed)\b`,
    ].join('|'),
    'i',
  );

  const candidates = [
    ...(description ? [description] : []),
    ...text.split(/(?<=[.!?])\s+/),
  ];

  return uniq(
    candidates
      .map((s) => s.trim())
      .filter((s) => {
        if (s.length < 20 || s.length > 180) return false;
        // A question is the FAQ asking about the promise, not the promise.
        // Without this, "What does the ten-year warranty cover?" was being
        // filed as something we had to verify.
        if (s.endsWith('?')) return false;
        // Navigation and heading runs get swept up by the tag stripper and
        // read as sentences. Real prose has lowercase words in it.
        const words = s.split(/\s+/);
        const lowercase = words.filter((w) => /^[a-z]/.test(w)).length;
        if (lowercase / words.length < 0.4) return false;
        return triggers.test(s);
      }),
  ).slice(0, 8);
}

function uniq<T>(items: T[]): T[] {
  return [...new Set(items)];
}

/**
 * Resolving the site's own origin.
 *
 * This looks trivial and is not. `process.env.NEXT_PUBLIC_*` is inlined at
 * BUILD time, and a variable that is merely *declared* — as Vercel does for
 * unset public vars — arrives as an empty string, not undefined. So:
 *
 *     process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
 *
 * does NOT fall back, because `??` only catches null and undefined. It yields
 * '' and `new URL('')` throws ERR_INVALID_URL, which fails the production
 * build during page-data collection — while working perfectly in local dev,
 * where the variable is genuinely undefined.
 *
 * Every env read in this codebase should therefore test for truthiness, never
 * nullishness. Covered by tests.
 */

const LOCAL = 'http://localhost:3000';

/** First non-empty value, trimmed. Empty strings are treated as absent. */
function firstPresent(...values: Array<string | undefined>): string | undefined {
  for (const v of values) {
    const trimmed = v?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

/**
 * Resolution order:
 *   1. NEXT_PUBLIC_SITE_URL — the real domain, once we have one
 *   2. VERCEL_URL — the per-deployment hostname, so preview builds get a
 *      correct metadataBase without any configuration
 *   3. localhost — dev, and any build where neither is set
 */
export function resolveSiteUrl(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string {
  const explicit = firstPresent(env.NEXT_PUBLIC_SITE_URL);
  if (explicit) return withProtocol(explicit);

  const vercel = firstPresent(env.NEXT_PUBLIC_VERCEL_URL, env.VERCEL_URL);
  if (vercel) return withProtocol(vercel);

  return LOCAL;
}

function withProtocol(host: string): string {
  return /^https?:\/\//i.test(host) ? host : `https://${host}`;
}

/**
 * The URL object Next wants for `metadataBase`.
 * Never throws: a malformed value degrades to localhost rather than taking the
 * whole build down, which is what happened the first time.
 */
export function siteUrl(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): URL {
  try {
    return new URL(resolveSiteUrl(env));
  } catch {
    return new URL(LOCAL);
  }
}

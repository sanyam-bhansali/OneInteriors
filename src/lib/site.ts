/**
 * Resolving the site's own origin, and validating where we send people.
 *
 * The origin part looks trivial and is not. `process.env.NEXT_PUBLIC_*` is
 * inlined at BUILD time, and a variable that is merely *declared* — as Vercel
 * does for unset public vars — arrives as an empty string, not undefined. So:
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

/**
 * Newline, carriage return, tab, NUL and friends.
 *
 * Checked by code point rather than with a regex character class on purpose:
 * a literal control character inside a regex is invisible in a diff and in
 * review, which makes the one place it matters most the one place nobody can
 * see it.
 */
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Where to send someone after they sign in.
 *
 * A security control, not a convenience. `?next=` on a sign-in page is the
 * classic open redirect, and an open redirect on the end of an *emailed*
 * sign-in link is a phishing primitive: the mail genuinely comes from us, the
 * link genuinely signs the person in, and then it drops them on somebody
 * else's page while they are feeling trusting.
 *
 * So only a same-site absolute path survives. This lives here rather than
 * beside the auth code because that module is `server-only` and a security
 * control has to be exhaustively testable — see CONTRIBUTING §9.5.
 */
export function safeNext(value: string | null | undefined): string | null {
  if (!value) return null;

  const path = value.trim();
  if (!path.startsWith('/')) return null;

  // Browsers treat both of these as protocol-relative, i.e. off-site, while
  // they sail past a naive startsWith('/') check.
  if (path.startsWith('//') || path.startsWith('/\\')) return null;

  // A scheme anywhere means it is trying to be an absolute URL.
  if (path.includes('://')) return null;

  // A newline in a redirect value can split a header or a log line.
  if (hasControlChars(path)) return null;

  return path;
}

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

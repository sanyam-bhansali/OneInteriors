/**
 * An Instagram handle out of whatever a studio published.
 *
 * Split from `enrich.ts` for the reason CONTRIBUTING §9.5 gives: that file
 * carries `server-only` because it makes network calls, and `server-only`
 * cannot be imported by a test. This is the only pure piece of enrichment and
 * it is the piece that puts a link in front of an ops reviewer, so it has to
 * be testable — a wrong handle is worse than none, because it sends somebody
 * to a stranger's account and they judge a studio on it.
 */

/**
 * A handle out of any Instagram URL, or out of something already a handle.
 *
 * Reserved paths matter: `instagram.com/p/xyz` is a post and
 * `instagram.com/explore/...` is a directory, and treating either as a handle
 * puts a dead link in front of an ops reviewer.
 */
const RESERVED = new Set(['p', 'reel', 'reels', 'explore', 'stories', 'tv', 'accounts']);

export function instagramHandle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  const fromUrl = value.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  const candidate = fromUrl ? fromUrl[1]! : value.replace(/^@/, '');

  if (!/^[A-Za-z0-9._]{1,30}$/.test(candidate)) return null;
  if (RESERVED.has(candidate.toLowerCase())) return null;
  // A handle cannot be only dots, and Instagram does not allow a trailing one.
  if (/^\.+$/.test(candidate) || candidate.endsWith('.')) return null;

  return candidate.toLowerCase();
}

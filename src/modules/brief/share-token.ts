/**
 * Share-token shape, on its own so it can be tested.
 *
 * `share.ts` carries `server-only` because it touches Postgres and the session.
 * That import makes the whole module unloadable from Vitest, and this check is
 * the one part of sharing that most deserves a test — it is the guard that runs
 * before an attacker-supplied string reaches a database query. See
 * CONTRIBUTING §9.5; this is the fifth time the split has been needed.
 *
 * Pure. No imports.
 */

/**
 * Tokens we mint are 24 random bytes as base64url, which is always 32
 * characters. The accepted range is wider than that on purpose: it has to keep
 * accepting tokens issued before any future change to the length, and a bound
 * that exactly matches today's generator turns a routine change into a silent
 * outage for everyone holding an old link.
 */
const SHAPE = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * Is this string shaped like one of our tokens?
 *
 * A cheap gate in front of the lookup. It is not a security boundary on its own
 * — the database query is authoritative — but it means a URL full of junk,
 * SQL, or a path traversal attempt never becomes a query at all, and it keeps
 * the logs readable when somebody starts scanning.
 */
export function isShareTokenShape(value: string | null | undefined): boolean {
  if (!value) return false;
  return SHAPE.test(value);
}

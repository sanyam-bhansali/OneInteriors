/**
 * The token from an `Authorization: Bearer` header, or null.
 *
 * Pure, so the parsing is tested rather than trusted. Anything that is not
 * exactly the scheme followed by a plausible token is ignored rather than
 * half-read: a session token is 43 url-safe characters (`newToken`).
 */
export function bearerFrom(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(header.trim());
  return match ? match[1] : null;
}

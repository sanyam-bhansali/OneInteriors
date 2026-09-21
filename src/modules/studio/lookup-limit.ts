/**
 * A rate limiter for the public website lookup. Pure, so it can be tested.
 *
 * ## Why this exists at all
 *
 * `scrapeStudioSite` makes an outbound HTTP request from our server to a
 * URL a stranger typed. Until now the only caller was gated on
 * `requireRole('OPS')` — and the comment on that action says so
 * explicitly, because that gate was the protection.
 *
 * Putting the same capability on a public application form removes the
 * gate. The SSRF hardening in `scrape.ts` is genuinely good — private
 * ranges blocked including the octal, hex, short-form and trailing-dot
 * tricks, redirects followed by hand with every hop revalidated, body
 * capped while reading — so this cannot be pointed at our own network.
 *
 * What it CAN be turned into without a limiter is an open relay: anybody
 * can drive our server to fetch any public URL, as fast as they like, at
 * our cost and from our IP.
 *
 * ## What this limiter honestly is, and is not
 *
 * In-memory and per-instance. On Vercel that means it resets on a cold
 * start and is enforced separately in each concurrently running lambda,
 * so a determined attacker spreading requests across instances gets a
 * multiple of the quota.
 *
 * It is therefore protection against the ordinary case — a stuck retry
 * loop, somebody hammering the button, one script from one address —
 * and not against a distributed attempt.
 *
 * **Before this sees real traffic it wants a shared store.** `REDIS_URL`
 * is already in the environment. Until then the numbers here are set low
 * enough that even the per-instance multiple stays small.
 */

/** Requests allowed per key per window. Low: this is a courtesy feature. */
export const LOOKUP_LIMIT = 5;

/** The window, in milliseconds. */
export const LOOKUP_WINDOW_MS = 10 * 60 * 1000;

export interface Attempt {
  /** Epoch millis of each request still inside the window. */
  hits: number[];
}

export type LimitVerdict =
  | { allowed: true; remaining: number }
  | { allowed: false; retryInSeconds: number };

/**
 * Sliding window rather than a fixed bucket.
 *
 * A fixed bucket lets somebody spend the whole quota at 09:59:59 and the
 * whole of the next one at 10:00:01 — double the rate at the boundary,
 * which is exactly when an automated caller lands.
 */
export function check(now: number, attempt: Attempt | undefined): LimitVerdict {
  const cutoff = now - LOOKUP_WINDOW_MS;
  const recent = (attempt?.hits ?? []).filter((t) => t > cutoff);

  if (recent.length < LOOKUP_LIMIT) {
    return { allowed: true, remaining: LOOKUP_LIMIT - recent.length - 1 };
  }

  // The oldest hit is the one that has to age out before another is free.
  const oldest = Math.min(...recent);
  const retryInSeconds = Math.max(1, Math.ceil((oldest + LOOKUP_WINDOW_MS - now) / 1000));
  return { allowed: false, retryInSeconds };
}

/** The surviving hits plus this one. Callers store the result. */
export function record(now: number, attempt: Attempt | undefined): Attempt {
  const cutoff = now - LOOKUP_WINDOW_MS;
  return { hits: [...(attempt?.hits ?? []).filter((t) => t > cutoff), now] };
}

/**
 * Who is being limited.
 *
 * `x-forwarded-for` is set by the proxy in front of us and its FIRST
 * entry is the client. Taking the last, or the whole string, lets a
 * caller add their own header and get a fresh quota per request.
 *
 * An unknown address collapses to one shared key rather than to no
 * limit. That is deliberately pessimistic: better that a handful of
 * people behind an unreadable proxy share a quota than that anybody who
 * can suppress the header gets an unlimited one.
 */
export function keyFor(forwardedFor: string | null): string {
  const first = forwardedFor?.split(',')[0]?.trim();
  return first && first.length > 0 && first.length < 64 ? first : 'unknown';
}

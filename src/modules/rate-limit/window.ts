/**
 * The sliding-window decision, alone and pure.
 *
 * No `server-only` — CONTRIBUTING §9.5. Extracted from
 * `studio/lookup-limit.ts`, which had the right logic behind the wrong
 * storage: in-memory and per-instance, resetting on every Vercel cold start
 * and enforced separately in each concurrently running lambda.
 *
 * That was adequate for a courtesy button behind an application form, and its
 * own docblock says so. It is not adequate for an unauthenticated endpoint
 * that writes rows, which is what the hosted capture form is.
 *
 * ## Sliding, not fixed
 *
 * A fixed bucket lets somebody spend the whole quota at 09:59:59 and the whole
 * of the next one at 10:00:01 — double the rate at the boundary, which is
 * exactly when an automated caller lands. The window here moves with the
 * clock, so the quota is a true rate.
 */

export interface Limit {
  /** Requests allowed per bucket per window. */
  max: number;
  windowMs: number;
}

export type Verdict =
  | { allowed: true; remaining: number }
  | { allowed: false; retryInSeconds: number };

/**
 * Given how many attempts survive the window and when the oldest was, may
 * this one proceed?
 *
 * `oldest` is only consulted on refusal, which is why it is allowed to be
 * null: the caller does not have to find it in the common case.
 */
export function decide(
  now: number,
  recent: number,
  oldest: number | null,
  limit: Limit,
): Verdict {
  if (recent < limit.max) {
    return { allowed: true, remaining: limit.max - recent - 1 };
  }

  /* The oldest surviving hit is the one that has to age out before another is
     free. Without it we cannot say when, so a minute is the honest guess —
     and it errs toward telling somebody to wait longer than necessary rather
     than inviting an immediate retry that will also fail. */
  if (oldest === null) return { allowed: false, retryInSeconds: 60 };

  const retryInSeconds = Math.max(1, Math.ceil((oldest + limit.windowMs - now) / 1000));
  return { allowed: false, retryInSeconds };
}

/**
 * Who is being limited.
 *
 * `x-forwarded-for` is set by the proxy in front of us and its FIRST entry is
 * the client. Taking the last, or the whole string, lets a caller add their
 * own header and get a fresh quota per request.
 *
 * An unknown address collapses to one shared key rather than to no limit.
 * Deliberately pessimistic: better that a handful of people behind an
 * unreadable proxy share a quota than that anybody who can suppress the
 * header gets an unlimited one.
 */
export function addressOf(forwardedFor: string | null): string {
  const first = forwardedFor?.split(',')[0]?.trim();
  return first && first.length > 0 && first.length < 64 ? first : 'unknown';
}

/**
 * The bucket key.
 *
 * Namespaced by the caller so two features cannot collide on a bare IP and
 * silently share a quota — the website lookup and the public form are both
 * keyed by address and must not spend each other's allowance.
 */
export function bucketFor(namespace: string, id: string): string {
  return `${namespace}:${id}`.slice(0, 200);
}

/** Wording for a refusal, in seconds a person can act on. */
export function waitPhrase(seconds: number): string {
  if (seconds <= 60) return 'in a minute';
  const mins = Math.ceil(seconds / 60);
  return `in about ${mins} minutes`;
}

import 'server-only';

/**
 * The rate limiter, backed by Postgres.
 *
 * Shared across instances, which is the whole point: `lookup-limit.ts` was
 * in-memory and per-instance, so on Vercel it reset on every cold start and
 * was enforced separately in each concurrently running lambda. A determined
 * caller spreading requests got a multiple of the quota.
 *
 * ## Fails OPEN, deliberately
 *
 * If the database is unreachable, `consume` allows the request. That is the
 * uncomfortable choice and it is the right one here: the limiter protects us
 * from cost and abuse, and a limiter that fails closed turns one broken
 * connection into a total outage of the public form — every legitimate
 * enquiry refused, silently, for as long as it lasts.
 *
 * It is the right choice BECAUSE nothing behind these limits is destructive.
 * A limiter guarding a delete, a payment or an auth attempt has to fail
 * closed, and any future caller in that shape must not reuse this function.
 * `password-signin.ts` has its own lockout for exactly that reason.
 *
 * ## Three queries, not one
 *
 * Prune, count, insert. A single upsert-and-increment would be one round trip
 * and a FIXED window, which doubles the effective rate at the boundary — see
 * `window.ts`. Three indexed queries against a narrow table is a price worth
 * paying on an endpoint that already writes a row when it succeeds.
 */

import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { decide, type Limit, type Verdict } from './window';

export type { Limit, Verdict } from './window';
export { addressOf, bucketFor, waitPhrase } from './window';

/**
 * Count this attempt and say whether it may proceed.
 *
 * Records the hit ONLY when allowed. A refused attempt that counted itself
 * would extend its own lockout every time somebody retried, so a person
 * hammering a button could never get back in — the window would keep sliding
 * forward under them.
 */
export async function consume(bucket: string, limit: Limit): Promise<Verdict> {
  if (!hasDatabase()) return { allowed: true, remaining: limit.max - 1 };

  const now = Date.now();
  const cutoff = new Date(now - limit.windowMs);

  try {
    /* Prune first, so the count below is exactly the surviving hits and the
       table cannot grow without a cron. Scoped to this bucket: a global
       sweep here would make every request pay for every other bucket's
       rubbish. */
    await prisma.rateLimitHit.deleteMany({
      where: { bucket, createdAt: { lt: cutoff } },
    });

    const recent = await prisma.rateLimitHit.count({ where: { bucket } });

    /* The oldest survivor is only needed to say WHEN to retry, so it is only
       fetched on refusal. */
    let oldest: number | null = null;
    if (recent >= limit.max) {
      const first = await prisma.rateLimitHit.findFirst({
        where: { bucket },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      });
      oldest = first ? first.createdAt.getTime() : null;
    }

    const verdict = decide(now, recent, oldest, limit);
    if (verdict.allowed) {
      await prisma.rateLimitHit.create({ data: { bucket } });
    }

    return verdict;
  } catch (error) {
    /* Open. See the note at the top — and note that it is logged loudly,
       because a limiter silently doing nothing is the failure mode that
       matters. */
    console.error('[rate-limit] store unreachable, allowing request', bucket, error);
    return { allowed: true, remaining: 0 };
  }
}

/**
 * Both limits on one request, cheapest first.
 *
 * A public form needs a per-address limit (one person hammering) and a
 * per-form limit (a distributed script that defeats the first). Checked in
 * that order and short-circuited, so the common refusal costs one bucket's
 * worth of queries rather than two.
 *
 * The per-form limit must be generous enough that a genuinely popular form
 * never trips it, because tripping it refuses everybody.
 */
export async function consumeBoth(
  first: { bucket: string; limit: Limit },
  second: { bucket: string; limit: Limit },
): Promise<Verdict> {
  const a = await consume(first.bucket, first.limit);
  if (!a.allowed) return a;
  return consume(second.bucket, second.limit);
}

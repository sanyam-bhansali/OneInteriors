import { describe, expect, it } from 'vitest';
import {
  addressOf,
  bucketFor,
  decide,
  waitPhrase,
  type Limit,
} from '@/modules/rate-limit/window';

const LIMIT: Limit = { max: 5, windowMs: 10 * 60 * 1000 };
const NOW = 1_700_000_000_000;

describe('decide', () => {
  it('allows while there is room, and counts down', () => {
    expect(decide(NOW, 0, null, LIMIT)).toEqual({ allowed: true, remaining: 4 });
    expect(decide(NOW, 4, null, LIMIT)).toEqual({ allowed: true, remaining: 0 });
  });

  it('refuses at the limit, not one past it', () => {
    /* Off by one here is either a limiter that never fires or one that fires
       a request early. Both look fine. */
    const v = decide(NOW, 5, NOW - 60_000, LIMIT);
    expect(v.allowed).toBe(false);
  });

  it('says when to come back, from the oldest surviving hit', () => {
    /* The oldest hit is the one that has to age out before another is free.
       One minute in, nine minutes to wait. */
    const v = decide(NOW, 5, NOW - 60_000, LIMIT);
    expect(v).toEqual({ allowed: false, retryInSeconds: 9 * 60 });
  });

  it('never says zero seconds', () => {
    /* A hit that aged out this millisecond would compute 0, and "try again in
       0 seconds" invites an immediate retry that also fails. */
    const v = decide(NOW, 5, NOW - LIMIT.windowMs, LIMIT);
    expect(v.allowed).toBe(false);
    if (!v.allowed) expect(v.retryInSeconds).toBeGreaterThanOrEqual(1);
  });

  it('guesses a minute when it cannot find the oldest', () => {
    /* Errs toward telling somebody to wait longer than necessary rather than
       inviting a retry that will also fail. */
    expect(decide(NOW, 5, null, LIMIT)).toEqual({ allowed: false, retryInSeconds: 60 });
  });

  it('is a rate, not a bucket', () => {
    /**
     * The whole reason for a sliding window. With a fixed bucket, five hits
     * at 09:59:59 and five at 10:00:01 both pass — ten in two seconds.
     *
     * Here the five old ones are still inside the window a second later, so
     * the sixth is refused.
     */
    const almostGone = NOW - (LIMIT.windowMs - 1000);
    expect(decide(NOW, 5, almostGone, LIMIT).allowed).toBe(false);

    /* And a second after they age out, it opens again. */
    expect(decide(NOW, 0, null, LIMIT).allowed).toBe(true);
  });
});

describe('addressOf', () => {
  it('takes the FIRST entry, which is the client', () => {
    /* Taking the last, or the whole string, lets a caller add their own
       header and get a fresh quota per request. */
    expect(addressOf('203.0.113.9, 70.41.3.18, 150.172.238.178')).toBe('203.0.113.9');
  });

  it('collapses an unreadable address to one shared key, never to no limit', () => {
    expect(addressOf(null)).toBe('unknown');
    expect(addressOf('')).toBe('unknown');
    expect(addressOf('   ')).toBe('unknown');
  });

  it('refuses an address long enough to be an attack on the column', () => {
    expect(addressOf('x'.repeat(200))).toBe('unknown');
  });
});

describe('bucketFor', () => {
  it('namespaces, so two features cannot share a quota by accident', () => {
    /* The website lookup and the public form are both keyed by address. A
       bare IP would make them one allowance. */
    expect(bucketFor('lookup', '1.2.3.4')).not.toBe(bucketFor('form', '1.2.3.4'));
  });

  it('is bounded', () => {
    expect(bucketFor('form', 'x'.repeat(500)).length).toBeLessThanOrEqual(200);
  });
});

describe('waitPhrase', () => {
  it('reads like a person saying it', () => {
    expect(waitPhrase(30)).toBe('in a minute');
    expect(waitPhrase(60)).toBe('in a minute');
    expect(waitPhrase(9 * 60)).toBe('in about 9 minutes');
  });
});

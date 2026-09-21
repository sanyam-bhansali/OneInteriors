import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { audienceFor, isAlwaysAllowed, normaliseHost, route, type HostEnv } from '@/lib/host';
import { siteUrlFor, siteUrlForHost } from '@/lib/site';

/**
 * The whole routing table, asserted.
 *
 * Middleware cannot be tested where it runs, and a mistake in it has two
 * shapes and both are bad: a surface that should be hidden is served, or
 * somebody is locked out of their own software. Neither shows up in a
 * typecheck. So the decision is a pure function and this is it, exhaustively.
 */

const SPLIT: HostEnv = {
  STUDIO_HOST: 'studio.oneinteriors.in',
  OPS_HOST: 'ops.oneinteriors.in',
  PUBLIC_HOST: 'oneinteriors.in',
};

const LIVE: HostEnv = { ...SPLIT, CUSTOMER_LIVE: '1' };

const STUDIO = 'studio.oneinteriors.in';
const OPS = 'ops.oneinteriors.in';
const APEX = 'oneinteriors.in';
const PREVIEW = 'one-interiors-abc123.vercel.app';

describe('reading the host', () => {
  it('ignores the port and the casing', () => {
    expect(normaliseHost('Studio.OneInteriors.in:3000')).toBe('studio.oneinteriors.in');
    expect(normaliseHost(null)).toBe('');
  });

  it('matches exactly, never by prefix', () => {
    /**
     * A prefix match on "studio." would serve our practice software from
     * `studio.someone-elses-domain.example` the moment they pointed it at this
     * deployment — a domain we do not control, showing a login that looks like
     * ours. Exact matches only.
     */
    expect(audienceFor('studio.oneinteriors.in.evil.example', SPLIT)).toBe('all');
    expect(audienceFor('notstudio.oneinteriors.in', SPLIT)).toBe('all');
    expect(audienceFor(STUDIO, SPLIT)).toBe('studio');
  });

  it('takes www on the apex', () => {
    expect(audienceFor(`www.${APEX}`, SPLIT)).toBe('public');
  });

  it('is "all" when nothing is configured, so local development is untouched', () => {
    expect(audienceFor('localhost', {})).toBe('all');
    expect(audienceFor(STUDIO, {})).toBe('all');
  });

  it('is "all" on an unrecognised host, so preview deploys still work', () => {
    // The one that would have bitten: treating a *.vercel.app preview as
    // `public` 404s /studio and /ops, making the place you test a change the
    // one place the change cannot be tested.
    expect(audienceFor(PREVIEW, SPLIT)).toBe('all');
    expect(route(PREVIEW, '/studio', SPLIT)).toEqual({ kind: 'next' });
    expect(route(PREVIEW, '/ops', SPLIT)).toEqual({ kind: 'next' });
  });
});

describe('the studio host', () => {
  it('serves the practice software at the root', () => {
    expect(route(STUDIO, '/', SPLIT)).toEqual({ kind: 'rewrite', to: '/studio' });
  });

  it('keeps studio paths and the application form', () => {
    expect(route(STUDIO, '/studio/clients', SPLIT)).toEqual({ kind: 'next' });
    // A studio reaches us through /apply, so it lives with the studio product.
    expect(route(STUDIO, '/apply', SPLIT)).toEqual({ kind: 'next' });
  });

  it('404s ops and the customer app rather than redirecting them', () => {
    // A redirect confirms the path exists somewhere. These do not exist here.
    expect(route(STUDIO, '/ops', SPLIT)).toEqual({ kind: 'notFound' });
    expect(route(STUDIO, '/ops/applications', SPLIT)).toEqual({ kind: 'notFound' });
    expect(route(STUDIO, '/match', SPLIT)).toEqual({ kind: 'notFound' });
    expect(route(STUDIO, '/studios', SPLIT)).toEqual({ kind: 'notFound' });
  });

  it('still 404s the customer app once the marketplace is live', () => {
    // Opening the marketplace does not put the customer app on the studio
    // host. It only ever belonged on the apex.
    expect(route(STUDIO, '/match', LIVE)).toEqual({ kind: 'notFound' });
  });
});

describe('the ops host', () => {
  it('serves the console at the root and nothing else', () => {
    expect(route(OPS, '/', SPLIT)).toEqual({ kind: 'rewrite', to: '/ops' });
    expect(route(OPS, '/ops/verification', SPLIT)).toEqual({ kind: 'next' });
    expect(route(OPS, '/studio', SPLIT)).toEqual({ kind: 'notFound' });
    expect(route(OPS, '/match', SPLIT)).toEqual({ kind: 'notFound' });
    expect(route(OPS, '/apply', SPLIT)).toEqual({ kind: 'notFound' });
  });
});

describe('the apex, while the marketplace is closed', () => {
  it('leaves the root alone — the waitlist is a separate deployment', () => {
    expect(route(APEX, '/', SPLIT)).toEqual({ kind: 'next' });
  });

  it('sends every customer path to the waitlist', () => {
    for (const path of ['/quiz', '/match', '/compare', '/expert', '/prepare', '/account']) {
      expect(route(APEX, path, SPLIT), path).toEqual({ kind: 'redirect', to: '/' });
    }
  });

  it('sends /quotes to the waitlist, although it is only a redirect itself', () => {
    // A redirect that fires is still a page that answered, and this one would
    // hand a visitor /match.
    expect(route(APEX, '/quotes', SPLIT)).toEqual({ kind: 'redirect', to: '/' });
  });

  it('hides the roster and the verification page too', () => {
    // "A bare waitlist page only" — these are marketing, but they are still
    // the marketplace showing itself before it opens.
    expect(route(APEX, '/studios', SPLIT)).toEqual({ kind: 'redirect', to: '/' });
    expect(route(APEX, '/studios/openplan-studio', SPLIT)).toEqual({ kind: 'redirect', to: '/' });
    expect(route(APEX, '/verification', SPLIT)).toEqual({ kind: 'redirect', to: '/' });
  });

  it('404s the two products, which have their own hostnames', () => {
    expect(route(APEX, '/studio', SPLIT)).toEqual({ kind: 'notFound' });
    expect(route(APEX, '/ops', SPLIT)).toEqual({ kind: 'notFound' });
  });

  it('opens the customer app when CUSTOMER_LIVE is set', () => {
    expect(route(APEX, '/match', LIVE)).toEqual({ kind: 'next' });
    expect(route(APEX, '/studios', LIVE)).toEqual({ kind: 'next' });
  });
});

describe('what must never be blocked', () => {
  it('lets auth through on every host, or a magic link cannot be redeemed', () => {
    for (const host of [STUDIO, OPS, APEX, PREVIEW]) {
      expect(route(host, '/sign-in', SPLIT), host).toEqual({ kind: 'next' });
      expect(route(host, '/auth/verify', SPLIT), host).toEqual({ kind: 'next' });
      expect(route(host, '/api/health', SPLIT), host).toEqual({ kind: 'next' });
    }
  });

  it('lets assets through, or every page renders unstyled', () => {
    expect(route(STUDIO, '/_next/static/chunk.js', SPLIT)).toEqual({ kind: 'next' });
    expect(route(APEX, '/favicon.ico', SPLIT)).toEqual({ kind: 'next' });
  });
});

describe('one origin, the way it runs today', () => {
  it('changes nothing except the customer gate', () => {
    expect(route('localhost', '/studio', {})).toEqual({ kind: 'next' });
    expect(route('localhost', '/ops', {})).toEqual({ kind: 'next' });
    expect(route('localhost', '/', {})).toEqual({ kind: 'next' });
    expect(route('localhost', '/match', {})).toEqual({ kind: 'redirect', to: '/' });
    expect(route('localhost', '/match', { CUSTOMER_LIVE: '1' })).toEqual({ kind: 'next' });
  });
});

// ── The link inside the email ────────────────────────────────────────

describe('magic-link base URLs', () => {
  const env = {
    STUDIO_HOST: 'studio.oneinteriors.in',
    OPS_HOST: 'ops.oneinteriors.in',
    PUBLIC_HOST: 'oneinteriors.in',
    NEXT_PUBLIC_SITE_URL: 'https://oneinteriors.in',
  };

  it('sends a studio invite to the studio host', () => {
    // Sessions are host-only. A link redeemed on the apex writes a cookie
    // studio.oneinteriors.in cannot read, so the studio signs in, lands on
    // their software, and is asked to sign in again with no explanation.
    expect(siteUrlFor('studio', env)).toBe('https://studio.oneinteriors.in');
    expect(siteUrlFor('ops', env)).toBe('https://ops.oneinteriors.in');
    expect(siteUrlFor('public', env)).toBe('https://oneinteriors.in');
  });

  it('falls back to the single site URL when the split is not configured', () => {
    const solo = { NEXT_PUBLIC_SITE_URL: 'https://oneinteriors.in' };
    expect(siteUrlFor('studio', solo)).toBe('https://oneinteriors.in');
  });

  it('returns sign-in to the host it started on', () => {
    expect(siteUrlForHost('studio.oneinteriors.in', env)).toBe('https://studio.oneinteriors.in');
    expect(siteUrlForHost('ops.oneinteriors.in:443', env)).toBe('https://ops.oneinteriors.in');
    expect(siteUrlForHost('www.oneinteriors.in', env)).toBe('https://oneinteriors.in');
  });

  it('NEVER puts an unrecognised Host header inside an email', () => {
    /**
     * The whole reason this is checked rather than trusted. `Host` is
     * attacker-controlled on some stacks, and a link built from it unchecked
     * is a phishing link carrying our name, our wording and a real working
     * token — sent by us, to an address we chose.
     */
    for (const evil of [
      'evil.example',
      'studio.oneinteriors.in.evil.example',
      'oneinteriors.in.evil.example',
      'ops.oneinteriors.in@evil.example',
    ]) {
      expect(siteUrlForHost(evil, env), evil).toBe('https://oneinteriors.in');
    }
  });

  it('falls back rather than throwing on a missing header', () => {
    expect(siteUrlForHost(null, env)).toBe('https://oneinteriors.in');
    expect(siteUrlForHost('', env)).toBe('https://oneinteriors.in');
  });
});

// ── The status code, not just the body ───────────────────────────────

describe('a hidden path answers 404, not 200 with a 404 page', () => {
  it('the middleware sets an explicit status on the notFound rewrite', () => {
    /**
     * Caught in production with curl, invisible in a browser.
     *
     * `NextResponse.rewrite(new URL('/404', ...))` with no init serves the
     * 404 BODY under a 200 STATUS. On studio.oneinteriors.in, /ops, /match
     * and /studios each rendered "404: This page could not be found." and
     * each returned HTTP 200. Every manual check passed, because a browser
     * shows you the body.
     *
     * Nothing leaked — the wall itself held. The cost is that each hidden
     * path becomes a crawlable, indexable page, which is the opposite of
     * what the host split is for: the marketplace we are keeping out of
     * sight would be advertised to search engines from the studio host.
     *
     * This is asserted against the source because middleware cannot run in
     * this suite. A source assertion that catches a real regression beats a
     * runtime test that does not exist.
     */
    const src = readFileSync(join(__dirname, '..', 'src/middleware.ts'), 'utf8');
    // To the end of the statement, not to the first `)` — the first one
    // closes `new URL(...)` and the init object we care about comes after it.
    const rewrite = /NextResponse\.rewrite\(\s*new URL\('\/404'[^;]*/.exec(src);

    expect(rewrite, 'the notFound branch should rewrite to /404').not.toBeNull();
    expect(
      rewrite?.[0],
      'rewrite to /404 must pass { status: 404 }, or it serves a 404 page with a 200 status',
    ).toMatch(/status:\s*404/);
  });
});

describe('the cookie pre-filter cannot redirect to the page it is refusing', () => {
  /**
   * ERR_TOO_MANY_REDIRECTS on ops.oneinteriors.in/sign-in, live.
   *
   * The pre-filter's own condition was
   *
   *     path === '/ops' || path.startsWith('/ops/') || audienceFor(host) === 'ops'
   *
   * and on the ops subdomain that last clause is true for EVERY path — so it
   * fired on `/sign-in`, found no session cookie, and redirected to
   * `/sign-in`. Which it then refused again.
   *
   * The console was unreachable by any route, including the only route that
   * exists to let you back in. Every routing test here passed throughout,
   * because `route()` correctly returns `next` for /sign-in: the bug was in a
   * SECOND decision, further down the same function, that had stopped
   * honouring the same allow-list.
   *
   * So the invariant is asserted directly: nothing the filter redirects to may
   * itself be something the filter would act on.
   */
  it('every path the filter redirects to is on the always-allowed list', () => {
    expect(isAlwaysAllowed('/sign-in')).toBe(true);
  });

  it('the allow-list covers the whole auth round trip', () => {
    // Redeeming the link is the other half. If /auth/verify were filtered, the
    // link would bounce to sign-in and the session would never be written.
    for (const p of ['/sign-in', '/auth/verify', '/api/health']) {
      expect(isAlwaysAllowed(p), p).toBe(true);
    }
  });

  it('the middleware applies that list to the pre-filter, not only to routing', () => {
    // Source-level, because middleware cannot run here — and because the
    // failure was precisely that one of the two decisions dropped the check.
    const src = readFileSync(join(__dirname, '..', 'src/middleware.ts'), 'utf8');
    const filter = /const servingOps =[\s\S]*?;/.exec(src);
    expect(filter, 'servingOps should still exist').not.toBeNull();
    expect(
      filter?.[0],
      'servingOps must exclude always-allowed paths, or /sign-in redirects to itself',
    ).toMatch(/isAlwaysAllowed/);
  });

  it('ops paths are still filtered — the fix must not open the console', () => {
    // The obvious wrong fix is to loosen the condition until the loop stops.
    expect(isAlwaysAllowed('/ops')).toBe(false);
    expect(isAlwaysAllowed('/ops/applications')).toBe(false);
  });
});

describe('the sign-in page offers only what the host can deliver', () => {
  /**
   * `ops.oneinteriors.in/sign-in` showed the customer WhatsApp form — name,
   * mobile number, "send me a code" — as the primary action.
   *
   * It could never have worked. Every customer route 404s on the ops and
   * studio hosts, so a customer who completed that form would have signed in
   * and landed nowhere. And an offer that cannot be accepted is worse than no
   * offer: the person reasonably concludes they are in the right place and
   * keeps trying.
   *
   * The cause was that the page picked its variant from `next` alone, which is
   * absent when somebody simply types the hostname. The host is the fact that
   * was always available and was not consulted.
   */
  it('treats studio. and ops. as staff-only', () => {
    expect(audienceFor(STUDIO, SPLIT)).toBe('studio');
    expect(audienceFor(OPS, SPLIT)).toBe('ops');
  });

  it('leaves the shared origin serving both, since there it really does', () => {
    // One origin in development and on previews: /sign-in is the only sign-in
    // there is, so it must keep offering the phone form.
    expect(audienceFor('localhost', {})).toBe('all');
    expect(audienceFor(PREVIEW, SPLIT)).toBe('all');
  });

  it('the page asks the host, not only the query string', () => {
    const src = readFileSync(join(__dirname, '..', 'src/app/sign-in/page.tsx'), 'utf8');
    expect(src, 'sign-in must derive staffHost from the Host header').toMatch(
      /audienceFor\(\s*\(await headers\(\)\)\.get\('host'\)\s*\)/,
    );
    // And the staff variant must be reachable from the host alone.
    expect(src).toMatch(/const forStaff\s*=\s*\n?\s*staffHost/);
  });
});

describe('the whole sign-in round trip is reachable on every host', () => {
  /**
   * `/set-password` was not on the allow-list, so ops.oneinteriors.in 404'd
   * it. Redeeming an approval link signed you in, redirected you to choose a
   * password, and dead-ended on the page meant to finish the job — a real
   * session, and nothing at the address.
   *
   * Second time a path in this round trip has been missed; `/sign-in` was left
   * out of the cookie pre-filter and redirected to itself. So this asserts the
   * whole journey rather than the page that happened to break, on every host,
   * including the ones a studio never sees.
   */
  it('covers every step from clicking the link to being signed in', () => {
    const JOURNEY = ['/sign-in', '/auth/verify', '/set-password', '/sign-in/verify'];
    for (const host of [STUDIO, OPS, APEX, PREVIEW]) {
      for (const path of JOURNEY) {
        expect(route(host, path, SPLIT), `${host} ${path}`).toEqual({ kind: 'next' });
      }
    }
  });

  it('is the same list the cookie pre-filter skips', () => {
    // Being routable is not enough — the /ops pre-filter runs afterwards, and
    // a path it acts on will bounce a signed-out visitor to /sign-in even
    // though route() let it through.
    for (const path of ['/sign-in', '/auth/verify', '/set-password']) {
      expect(isAlwaysAllowed(path), path).toBe(true);
    }
  });

  it('does not accidentally open anything else', () => {
    // '/set-password' must not make '/set-password-reset' or '/settings'
    // reachable. `under` matches the exact path or a '/' boundary.
    expect(isAlwaysAllowed('/set-password-reset')).toBe(false);
    expect(isAlwaysAllowed('/settings')).toBe(false);
    expect(isAlwaysAllowed('/set-password/confirm')).toBe(true);
  });
});

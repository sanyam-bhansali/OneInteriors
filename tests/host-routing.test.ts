import { describe, expect, it } from 'vitest';
import { audienceFor, normaliseHost, route, type HostEnv } from '@/lib/host';
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

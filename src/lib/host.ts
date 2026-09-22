/**
 * Which of the three products is this request for?
 *
 * One deployment serves three audiences that have nothing to do with each
 * other: the studios who run their practice on us, the two or three of us who
 * run operations, and the homeowners the marketplace is for. Until now they
 * were all one origin and told apart only by a path prefix.
 *
 * They are now told apart by hostname:
 *
 *   studio.oneinteriors.in   the practice software
 *   ops.oneinteriors.in      the console
 *   oneinteriors.in          the public site
 *
 * ## Why this is worth doing rather than just tidy
 *
 * **The customer software stops having a public address.** While it is behind
 * a waitlist, the strongest possible gate is not a flag somebody can
 * misconfigure — it is that no hostname routes to it. A `/match` typed into a
 * browser reaches nothing, because nothing answers for it on any host we have
 * pointed at this app.
 *
 * It also means an ops session cookie is never sent to the studio host and
 * vice versa. Cookies are host-only by default — we do not set a `domain` —
 * so splitting the hosts splits the sessions, with no extra code and nothing
 * to remember. See `session.ts`; if anybody ever adds `domain` there, that
 * property is lost and this file's second paragraph becomes false.
 *
 * ## Degrading to one host
 *
 * When `STUDIO_HOST` and `OPS_HOST` are unset — local development, preview
 * deployments, and production until the DNS is cut over — every request is
 * `'all'` and the app behaves exactly as it did before: one origin, paths for
 * everything. That is deliberate. A change that only works once DNS is right
 * cannot be tested before it is live, which is the worst moment to find out.
 *
 * Pure, per CONTRIBUTING §9.5 — no `server-only`, because middleware runs on
 * the edge runtime and the tests import it directly.
 */

export type Audience = 'studio' | 'ops' | 'public' | 'all';

/**
 * What these functions read.
 *
 * An open shape rather than a closed one, because `process.env` carries an
 * index signature and TypeScript refuses to pass it to an object type with no
 * properties in common. Naming it once also means a test can hand in a plain
 * object with only the keys it cares about.
 */
export interface HostEnv {
  STUDIO_HOST?: string | undefined;
  OPS_HOST?: string | undefined;
  PUBLIC_HOST?: string | undefined;
  CUSTOMER_LIVE?: string | undefined;
  [key: string]: string | undefined;
}

/**
 * Strip the port and lowercase. `Host` carries `:3000` locally and can arrive
 * with odd casing; neither is part of the identity we are matching on.
 */
export function normaliseHost(host: string | null | undefined): string {
  if (!host) return '';
  return host.split(':')[0]!.trim().toLowerCase();
}

/**
 * Which surface answers for this host.
 *
 * Exact matches only. A wildcard like "anything starting with studio." would
 * match `studio.evil.example` pointed at our deployment by somebody else,
 * which is a free way to serve our practice software from a domain we do not
 * control.
 */
export function audienceFor(
  host: string | null | undefined,
  env: HostEnv = process.env,
): Audience {
  const studioHost = normaliseHost(env.STUDIO_HOST);
  const opsHost = normaliseHost(env.OPS_HOST);
  const publicHost = normaliseHost(env.PUBLIC_HOST);

  // Neither configured: one origin, everything on. See the header.
  if (!studioHost && !opsHost) return 'all';

  const h = normaliseHost(host);
  if (studioHost && h === studioHost) return 'studio';
  if (opsHost && h === opsHost) return 'ops';
  if (publicHost && (h === publicHost || h === `www.${publicHost}`)) return 'public';

  /**
   * An unrecognised host is `all`, not `public`, and the difference matters
   * every working day.
   *
   * Vercel gives every preview deployment its own `*.vercel.app` hostname,
   * which by definition matches none of the three. Treating that as `public`
   * would 404 `/studio` and `/ops` on every preview — so the one place you
   * test a change before it reaches a studio would be the one place the
   * change cannot be tested.
   *
   * This is safe rather than a hole: `all` still refuses the customer app
   * unless `CUSTOMER_LIVE` is set, and reaching `/studio` or `/ops` on a
   * preview still requires a real session and a real role. The hostname split
   * is defence in depth over those gates, never instead of them.
   */
  return 'all';
}

/**
 * The customer software — everything a homeowner would use, as opposed to
 * read. None of this is reachable while `CUSTOMER_LIVE` is unset.
 *
 * `/quotes` is in the list although it only redirects: a redirect that fires
 * is still a page that answered, and it would hand a visitor `/match`.
 */
const CUSTOMER_APP = [
  '/quiz',
  '/tier',
  '/match',
  '/compare',
  '/expert',
  '/prepare',
  '/account',
  '/quotes',
  '/shared',
];

/**
 * The public-facing pages that are marketing rather than software.
 *
 * Listed separately because the waitlist decision is about the *software*, and
 * a later decision to put the roster back in front of people should not
 * require re-reading the gate. Today the waitlist is bare and none of these
 * are served; the list is here so that turning one back on is one line.
 */
const PUBLIC_PAGES = ['/studios', '/verification'];

/**
 * Always reachable, on every host. Auth, health, assets, and the webhooks.
 *
 * ## This list is the whole sign-in round trip, not just the sign-in page
 *
 * `/set-password` was missing and the ops host 404'd it — so redeeming an
 * approval link signed you in, redirected you to choose a password, and hit a
 * dead end on the page that was supposed to finish the job. The session was
 * real; there was simply nothing at the address.
 *
 * That is the second time a path in this round trip has been left off.
 * `/sign-in` was missing from the cookie pre-filter and redirected to itself.
 * The pattern to watch for: anything `/auth/verify` can hand somebody, or that
 * a signed-out person must reach to become signed in, belongs here — a page
 * being reachable is not the same as it being ON A HOST.
 */
const ALWAYS = [
  '/api',
  '/auth',
  '/sign-in',
  '/set-password',
  /**
   * The studios' own enquiry forms.
   *
   * Third time this list has been the answer, and the first where the person
   * reaching it has no account at all. A studio copies this link from the
   * studio host and pastes it into an Instagram bio, where it is opened by
   * strangers on whichever host the link carries — so it has to answer on all
   * of them or the link is dead for everybody except the studio that tested
   * it while signed in.
   */
  '/f',
  '/_next',
  '/favicon',
  '/robots.txt',
  '/sitemap.xml',
];

function under(path: string, prefixes: string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

export function isAlwaysAllowed(path: string): boolean {
  return under(path, ALWAYS);
}

export function isCustomerApp(path: string): boolean {
  return under(path, CUSTOMER_APP);
}

export function isPublicPage(path: string): boolean {
  return under(path, PUBLIC_PAGES);
}

/** Has the customer marketplace been opened to the public? */
export function customerLive(env: HostEnv = process.env): boolean {
  return env.CUSTOMER_LIVE?.trim() === '1';
}

export type Decision =
  | { kind: 'next' }
  | { kind: 'rewrite'; to: string }
  | { kind: 'redirect'; to: string }
  | { kind: 'notFound' };

/**
 * What to do with a request, given its host and path.
 *
 * Pure so the whole routing table can be asserted in a test rather than
 * discovered in production — a mistake here either exposes a surface that
 * should be hidden or locks somebody out of their own software, and both are
 * the kind you find out about from a customer.
 *
 * ## The rules
 *
 * - On the studio host: `/` is the practice software. Ops and the customer app
 *   are not there at all — a 404, not a redirect, because a redirect confirms
 *   the path exists somewhere.
 * - On the ops host: the mirror image.
 * - On the public host: the waitlist, and nothing else until `CUSTOMER_LIVE`.
 *   `/studio` and `/ops` 404 here rather than redirecting to their subdomains,
 *   for the same reason.
 * - `all` (no hosts configured) keeps every path where it is and gates only
 *   the customer app.
 */
export function route(
  host: string | null | undefined,
  path: string,
  env: HostEnv = process.env,
): Decision {
  if (isAlwaysAllowed(path)) return { kind: 'next' };

  const audience = audienceFor(host, env);
  const live = customerLive(env);

  if (audience === 'studio') {
    if (path === '/') return { kind: 'rewrite', to: '/studio' };
    if (under(path, ['/studio', '/apply'])) return { kind: 'next' };
    return { kind: 'notFound' };
  }

  if (audience === 'ops') {
    if (path === '/') return { kind: 'rewrite', to: '/ops' };
    if (under(path, ['/ops'])) return { kind: 'next' };
    return { kind: 'notFound' };
  }

  if (audience === 'public') {
    // The two products live on their own hostnames now.
    if (under(path, ['/studio', '/ops'])) return { kind: 'notFound' };
    if (!live && (isCustomerApp(path) || isPublicPage(path))) {
      return path === '/' ? { kind: 'next' } : { kind: 'redirect', to: '/' };
    }
    return { kind: 'next' };
  }

  // 'all' — one origin. Only the customer gate applies.
  if (!live && isCustomerApp(path)) return { kind: 'redirect', to: '/' };
  return { kind: 'next' };
}

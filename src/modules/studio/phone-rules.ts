/**
 * The studio on a phone (owner, 1 Nov 2026; walkthrough, 27 Oct 2026: "it
 * is going to be a web portal, only accessible through laptop"): on a phone
 * the studio opens site mode and nothing else, so nobody ticks a design step
 * from home. Site mode is for the site, on the phone; everything else is the
 * office, on a laptop. A tablet counts as a laptop.
 *
 * Pure and edge-safe (the middleware runs it on every studio request, so a
 * client-side navigation cannot step past it), tested in
 * tests/studio-phone.test.ts. Who may open site mode is still the layout's
 * door (surfaces.ts `mayOpen`); this only says what a phone may ask for.
 */

/** The page a phone is sent to: "open this on your laptop", with site mode for those who have it. */
export const PHONE_PAGE = '/studio/phone';

/**
 * What a phone may open: site mode (Today, posting, snags, me), the meetings
 * its bar opens, choosing a password (the first sign-in), and the phone page.
 */
export const PHONE_OPEN: readonly string[] = ['/studio/site', '/studio/calendar/meetings', '/studio/password', PHONE_PAGE];

const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

/** Is this a studio screen, the office or site mode (not its sign-in, which sits outside)? */
export const isStudioPath = (path: string): boolean => under(path, '/studio');

/** May a phone open it? Only studio screens are asked about; anything else is not ours to stop. */
export function phoneMayOpen(path: string): boolean {
  if (!isStudioPath(path)) return true;
  return PHONE_OPEN.some((p) => under(path, p));
}

/**
 * A phone, from its request: `Sec-CH-UA-Mobile: ?1` where the browser sends
 * it (Chrome, Edge, Samsung), else the user agent. Tablets are not phones:
 * an iPad sends "iPad" or a desktop Safari agent, an Android tablet has no
 * "Mobile".
 */
export function isPhone(userAgent: string | null | undefined, chMobile: string | null | undefined): boolean {
  if (chMobile === '?1') return true;
  if (chMobile === '?0') return false;
  const ua = userAgent ?? '';
  if (/iPad|Tablet/i.test(ua)) return false;
  return /iPhone|iPod|Windows Phone|Android.+Mobile|Mobile.+Firefox|BlackBerry|Opera Mini|IEMobile/i.test(ua);
}

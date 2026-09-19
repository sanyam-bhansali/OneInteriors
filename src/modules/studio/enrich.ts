import 'server-only';

/**
 * Everything we can find out about a studio without asking them.
 *
 * Their website, their Google listing, and their Instagram handle — gathered
 * in one call so ops sees a single panel and the studio sees a single set of
 * suggestions rather than three integrations bolted on separately.
 *
 * ## The rule, restated because it is the only thing that matters here
 *
 * **None of this is evidence.** Every field is something the studio has
 * published about itself, it is labelled as such on every surface that renders
 * it, and nothing here may set a verification tier, a match score or a
 * published figure. The twelve checks are people ringing past clients and
 * standing in finished flats; a Google rating is a number a business can buy.
 *
 * The value is entirely in saved typing and in knowing where to look. A
 * studio whose website promises "45-day delivery" has just told us what to
 * verify. A studio with no Google listing at all is a studio to ask about it.
 *
 * ## Instagram is found, not scraped
 *
 * We take the handle from their own website and from their Google listing and
 * link it. We do not read posts or follower counts, because scraping Meta
 * breaks their terms and gets a deploy's IP blocked within days — and doing
 * that from inside a product that sells verification would be indefensible.
 *
 * Reading their posts properly means the studio connecting their own account
 * through the Graph API, which is a consented flow they would recognise and a
 * day of work on its own. Worth doing; not done here, and deliberately not
 * faked in the meantime.
 *
 * ## Nothing here can fail a caller
 *
 * Each source is independent and each one is allowed to come back empty. A
 * studio with no website still gets their Google listing; a deployment with no
 * Places key still gets the website scrape. Enrichment is a convenience and
 * must never be the reason an application cannot be reviewed.
 */

import { scrapeStudioSite, type ScrapedSite } from './scrape';
import { findListing, placesConfigured, type PlaceListing } from './places';
import { instagramHandle } from './handle';

export { instagramHandle } from './handle';

export interface Enrichment {
  site: ScrapedSite | null;
  listing: PlaceListing | null;
  /** Bare handle, no @ and no URL. Taken from the site or the listing. */
  instagram: string | null;
  /** Which sources answered, so a surface can say what it looked at. */
  tried: { website: boolean; google: boolean };
  /** Why a source came back empty, for the ops panel. */
  notes: string[];
}

export async function enrichStudio(input: {
  tradeName: string;
  website?: string | null;
  city?: string;
}): Promise<Enrichment> {
  const notes: string[] = [];

  /* Both at once. They are independent, and running them in series would make
     an ops reviewer wait for the slower of the two for no reason. */
  const [siteResult, listingResult] = await Promise.all([
    input.website
      ? scrapeStudioSite(input.website).catch(() => ({ ok: false as const, error: 'failed' }))
      : Promise.resolve({ ok: false as const, error: 'no_website' }),
    placesConfigured()
      ? findListing(input.tradeName, input.city ?? 'Pune').catch(() => ({
          ok: false as const,
          error: 'failed',
        }))
      : Promise.resolve({ ok: false as const, error: 'not_configured' }),
  ]);

  const site = siteResult.ok ? siteResult.site : null;
  const listing = listingResult.ok ? listingResult.listing : null;

  if (!input.website) notes.push('No website on the application, so nothing to read.');
  else if (!site) notes.push(`Their website did not load (${siteResult.ok ? '' : siteResult.error}).`);

  if (!placesConfigured()) {
    notes.push('Google lookup is off — no API key configured.');
  } else if (!listing) {
    notes.push(
      listingResult.ok
        ? ''
        : listingResult.error === 'not_found'
          ? 'No Google listing found under that name. Worth asking them about.'
          : `Google lookup failed (${listingResult.error}).`,
    );
  }

  /* Their own site first: a handle they publish themselves is more likely to
     be the studio's than one Google inferred from a link somewhere. */
  const instagram =
    instagramHandle(site?.instagram) ??
    instagramHandle(listing?.website) ??
    null;

  return {
    site,
    listing,
    instagram,
    tried: { website: Boolean(input.website), google: placesConfigured() },
    notes: notes.filter(Boolean),
  };
}

import 'server-only';

/**
 * Their Google listing — prefill, never proof.
 *
 * Same footing as `scrape.ts`, and deliberately so: **everything here is what
 * a studio has published about itself**, and none of it may ever set a
 * verification tier, a published figure, or a match score. Google's star
 * rating in particular is exactly the kind of number that looks like evidence
 * and is not — it is unaudited, gameable, and about a business rather than
 * about a project. It is here so an ops reviewer can see it and go looking; it
 * is not a check and never counts as one.
 *
 * ## Why the official API and not scraping the map
 *
 * Scraping Google Maps breaks their terms, gets the deploy's IP blocked within
 * days, and would sit inside a product whose entire argument is that we do
 * things properly. The Places API is licensed, stable, and free at the volume
 * this is used at.
 *
 * ## Cost
 *
 * Since March 2025 Google gives a free monthly allowance per SKU rather than
 * one shared credit: 10,000 Essentials calls and 5,000 Pro calls a month,
 * reset on the first. Onboarding a studio is two calls — one search, one
 * details. Fifty studios is a hundred calls, so this is free at any volume
 * this business will reach for years. A billing account still has to exist on
 * the Google project; it simply never gets charged.
 *
 * ## No key, no problem
 *
 * With `GOOGLE_PLACES_API_KEY` unset every function here returns `null` and
 * the surfaces that use it render without a Google panel. The same bargain
 * the database and the email provider already make: the product works before
 * the integration exists.
 */

const SEARCH_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
const TIMEOUT_MS = 8_000;

export interface PlaceListing {
  /** Google's own id, so a later lookup does not have to search again. */
  placeId: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  /** 1.0–5.0. Unaudited and gameable. See the header. */
  rating: number | null;
  reviewCount: number | null;
  mapsUrl: string | null;
  /** Never treat as checked. Mirrors `ScrapedSite.source`. */
  source: 'google-listing';
}

export type PlacesResult =
  | { ok: true; listing: PlaceListing }
  | { ok: false; error: string };

function apiKey(): string | null {
  return process.env.GOOGLE_PLACES_API_KEY?.trim() || null;
}

export function placesConfigured(): boolean {
  return apiKey() !== null;
}

/**
 * Find a studio's Google listing by name and city.
 *
 * One Text Search call, asking for exactly the fields we render — the field
 * mask is what decides the billing SKU, so requesting everything "just in
 * case" is how a free integration stops being free.
 */
export async function findListing(
  tradeName: string,
  city = 'Pune',
): Promise<PlacesResult> {
  const key = apiKey();
  if (!key) return { ok: false, error: 'not_configured' };

  const name = tradeName.trim();
  if (name.length < 2) return { ok: false, error: 'no_name' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(SEARCH_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        /* The field mask sets the SKU. Only what is rendered. */
        'X-Goog-FieldMask': [
          'places.id',
          'places.displayName',
          'places.formattedAddress',
          'places.nationalPhoneNumber',
          'places.websiteUri',
          'places.rating',
          'places.userRatingCount',
          'places.googleMapsUri',
        ].join(','),
      },
      body: JSON.stringify({
        textQuery: `${name} interior designer ${city}`,
        maxResultCount: 1,
        languageCode: 'en',
        regionCode: 'IN',
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // Surface Google's own message. PROJECT_LEARNINGS §3.
      console.error(`[places] ${res.status}: ${body.slice(0, 300)}`);
      return { ok: false, error: `provider_${res.status}` };
    }

    const json = (await res.json()) as {
      places?: Array<{
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        nationalPhoneNumber?: string;
        websiteUri?: string;
        rating?: number;
        userRatingCount?: number;
        googleMapsUri?: string;
      }>;
    };

    const hit = json.places?.[0];
    if (!hit?.id) return { ok: false, error: 'not_found' };

    return {
      ok: true,
      listing: {
        placeId: hit.id,
        name: hit.displayName?.text ?? name,
        address: hit.formattedAddress ?? null,
        phone: hit.nationalPhoneNumber ?? null,
        website: hit.websiteUri ?? null,
        rating: typeof hit.rating === 'number' ? hit.rating : null,
        reviewCount: typeof hit.userRatingCount === 'number' ? hit.userRatingCount : null,
        mapsUrl: hit.googleMapsUri ?? null,
        source: 'google-listing',
      },
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'timeout' };
    }
    console.error('[places] lookup failed:', err instanceof Error ? err.message : err);
    return { ok: false, error: 'network' };
  } finally {
    clearTimeout(timer);
  }
}

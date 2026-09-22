'use server';

import { headers } from 'next/headers';
import { submitApplication } from '@/modules/studio/application';
import { scrapeStudioSite } from '@/modules/studio/scrape';
import { consume, addressOf, bucketFor, waitPhrase } from '@/modules/rate-limit/store';
import { LOOKUP_LIMIT } from '@/modules/studio/lookup-limit';
import { PUNE_LOCALITIES } from '@/modules/brief/types';

export interface ApplyState {
  status: 'idle' | 'sent' | 'error';
  errors?: Record<string, string>;
}

function num(v: FormDataEntryValue | null): number | undefined {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export async function submitApplicationAction(
  _prev: ApplyState,
  formData: FormData,
): Promise<ApplyState> {
  const h = await headers();

  const result = await submitApplication({
    tradeName: String(formData.get('tradeName') ?? ''),
    legalName: String(formData.get('legalName') ?? ''),
    contactName: String(formData.get('contactName') ?? ''),
    email: String(formData.get('email') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    website: String(formData.get('website') ?? ''),
    instagram: String(formData.get('instagram') ?? ''),
    localities: formData.getAll('localities').map(String),
    gstin: String(formData.get('gstin') ?? ''),
    yearsActive: num(formData.get('yearsActive')),
    teamSize: num(formData.get('teamSize')),
    minLakhs: num(formData.get('minLakhs')),
    maxLakhs: num(formData.get('maxLakhs')),
    about: String(formData.get('about') ?? ''),
    howHeard: String(formData.get('howHeard') ?? ''),
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  });

  if (!result.ok) return { status: 'error', errors: result.errors };
  return { status: 'sent' };
}

/**
 * Read a studio's own website so they do not have to retype it.
 *
 * ## This is the one public caller of the scraper
 *
 * Everywhere else it is behind `requireRole('OPS')`, and that role check
 * was the protection. Here there is no session at all, so three things
 * stand in for it:
 *
 *  1. `scrapeStudioSite` cannot be pointed at our own network — private
 *     ranges are blocked including the octal, hex, short-form and
 *     trailing-dot tricks, and redirects are followed by hand with every
 *     hop revalidated. That is the SSRF half and it was already there.
 *  2. This limiter, which stops it being used as a free open relay. It is
 *     now shared across instances — see `rate-limit/store.ts`. It used to
 *     be an in-memory Map, which reset on every cold start and was enforced
 *     separately in each concurrently running lambda, so a caller spreading
 *     requests got a multiple of the quota.
 *  3. It only ever runs on an explicit button press. Nothing fetches on
 *     blur, on debounce, or while somebody is typing a URL one character
 *     at a time.
 *
 * What comes back is a SUGGESTION. It is shown to the applicant to
 * accept or ignore, never written into the application behind their
 * back — it is scraped text about them, not a fact we have checked, and
 * `enrich.ts` is careful to label it that way for ops for the same
 * reason.
 */
export interface LookupState {
  status: 'idle' | 'found' | 'nothing' | 'error';
  message?: string;
  /** What we will put in each field if they accept. */
  about?: string;
  instagram?: string;
  yearsActive?: number;
  minLakhs?: number;
  /** Locality slugs the site names. Ticked on the areas step. */
  localities?: string[];
  /** Human labels for those slugs, so the offer can be read before accepting. */
  localityLabels?: string[];
}

export async function lookupSiteAction(
  _prev: LookupState,
  formData: FormData,
): Promise<LookupState> {
  const website = String(formData.get('website') ?? '').trim();
  if (!website) {
    return { status: 'error', message: 'Put your website address in first.' };
  }

  const h = await headers();

  /* Namespaced, so the lookup and the public capture form cannot spend each
     other's allowance — both are keyed by address and a bare IP would make
     them one quota. */
  const verdict = await consume(
    bucketFor('lookup', addressOf(h.get('x-forwarded-for'))),
    LOOKUP_LIMIT,
  );
  if (!verdict.allowed) {
    return {
      status: 'error',
      message: `That is a few lookups in a short time. Try again ${waitPhrase(verdict.retryInSeconds)}, or just type it in — it is only a shortcut.`,
    };
  }

  const result = await scrapeStudioSite(website);
  if (!result.ok) {
    return {
      status: 'nothing',
      message: `${result.error} No matter — type it in and carry on.`,
    };
  }

  const site = result.site;

  /**
   * Take EVERYTHING the scraper found, not just the description.
   *
   * The first version returned `description` and `instagram` and nothing
   * else, so a site with no meta description — which is most small studio
   * sites — reported "nothing worth copying across" after a ten-second
   * wait. That reads as broken rather than as empty, and it was the most
   * common outcome.
   *
   * `scrapeStudioSite` already extracts the localities a page names, a
   * "starting from ₹X lakh" figure, and a years-in-business from a
   * copyright range. Those are the fields most worth saving somebody —
   * the localities especially, because ticking areas is the longest step
   * in the form.
   */
  const about = (site.description ?? site.title ?? '').trim();

  const out: LookupState = { status: 'found' };
  if (about) out.about = about;
  if (site.instagram) out.instagram = site.instagram.trim();
  if (site.yearsActive) out.yearsActive = site.yearsActive;
  if (site.startingFromPaise) out.minLakhs = Math.round(site.startingFromPaise / 10_000_000);
  if (site.localities.length > 0) {
    out.localities = site.localities;
    out.localityLabels = site.localities.map(
      (slug) => PUNE_LOCALITIES.find((l) => l.slug === slug)?.label ?? slug,
    );
  }

  const gotSomething =
    out.about || out.instagram || out.yearsActive || out.minLakhs || out.localities;

  if (!gotSomething) {
    return {
      status: 'nothing',
      message:
        'We reached the site but it gave us nothing to go on — no description, no areas, nothing. Type it in and carry on.',
    };
  }

  return out;
}

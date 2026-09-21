'use server';

import { headers } from 'next/headers';
import { submitApplication } from '@/modules/studio/application';
import { scrapeStudioSite } from '@/modules/studio/scrape';
import { check, record, keyFor, type Attempt } from '@/modules/studio/lookup-limit';

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
 *  2. This limiter, which stops it being used as a free open relay. See
 *     `lookup-limit.ts` for what it honestly does and does not cover.
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
  about?: string;
  instagram?: string;
}

/** Per-instance, per-address. Cleared by any cold start. */
const attempts = new Map<string, Attempt>();

export async function lookupSiteAction(
  _prev: LookupState,
  formData: FormData,
): Promise<LookupState> {
  const website = String(formData.get('website') ?? '').trim();
  if (!website) {
    return { status: 'error', message: 'Put your website address in first.' };
  }

  const h = await headers();
  const key = keyFor(h.get('x-forwarded-for'));
  const now = Date.now();

  const verdict = check(now, attempts.get(key));
  if (!verdict.allowed) {
    const mins = Math.ceil(verdict.retryInSeconds / 60);
    return {
      status: 'error',
      message: `That is a few lookups in a short time. Try again in about ${mins} minute${mins === 1 ? '' : 's'}, or just type it in — it is only a shortcut.`,
    };
  }
  attempts.set(key, record(now, attempts.get(key)));

  // Keep the map from growing without bound on a long-lived instance.
  if (attempts.size > 5000) attempts.clear();

  const result = await scrapeStudioSite(website);
  if (!result.ok) {
    return {
      status: 'nothing',
      message: 'We could not read that site. No matter — type it in and carry on.',
    };
  }

  const about = result.site.description?.trim() ?? '';
  const instagram = result.site.instagram?.trim() ?? '';

  if (!about && !instagram) {
    return {
      status: 'nothing',
      message: 'We reached the site but found nothing worth copying across.',
    };
  }

  return {
    status: 'found',
    about: about || undefined,
    instagram: instagram || undefined,
  };
}

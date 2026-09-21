'use server';

import { revalidatePath } from 'next/cache';
import {
  approveApplication,
  rejectApplication,
  setReviewing,
} from '@/modules/studio/application';
import { requireRole } from '@/modules/auth/session';
import { enrichStudio } from '@/modules/studio/enrich';

export interface ScrapeState {
  status: 'idle' | 'done' | 'error';
  message?: string;
  site?: {
    title: string | null;
    description: string | null;
    emails: string[];
    phones: string[];
    instagram: string | null;
    localities: string[];
    startingFromPaise: number | null;
    yearsActive: number | null;
    claims: string[];
  } | null;
  /** Their Google listing. Published by them, unaudited, never a check. */
  listing?: {
    name: string;
    address: string | null;
    phone: string | null;
    website: string | null;
    rating: number | null;
    reviewCount: number | null;
    mapsUrl: string | null;
  } | null;
  /** Bare handle. Found on their own site or their listing, never scraped. */
  instagram?: string | null;
  /** Why a source came back empty. */
  notes?: string[];
}

/**
 * Look the applicant up. Ops-only — this makes an outbound request from our
 * server on a URL a stranger supplied, so it is gated on the role, not just on
 * the page being unlisted.
 *
 * The Date and the 'website-claim' marker are dropped here: what crosses to the
 * client is plain data the UI labels for itself.
 *
 * ## A website is not required, and used not to be optional
 *
 * This refused outright when the application carried no website —
 * "No website on this application." — which was exactly backwards. The studio
 * with no website is the one where there is least to go on and where the
 * Google listing is the ONLY independent trace of the business; the studio
 * with a polished site is the one that needs us least.
 *
 * `SitePanel` had always passed `tradeName` for precisely this, with a comment
 * saying a studio without a website still gets its listing looked up. The
 * guard on the line below made that comment a lie for months, and the first
 * real applicant to arrive without a website is what surfaced it.
 *
 * `enrichStudio` already handles an absent website properly: it skips the
 * fetch, records "No website on the application, so nothing to read", and runs
 * the Google lookup regardless. So there was never anything to fix downstream
 * — only this early return to delete.
 */
export async function scrapeSiteAction(
  _prev: ScrapeState,
  formData: FormData,
): Promise<ScrapeState> {
  await requireRole('OPS');

  const url = String(formData.get('website') ?? '').trim();
  const tradeName = String(formData.get('tradeName') ?? '').trim();

  // The trade name is what Google is searched by, so with neither a name nor a
  // site there is genuinely nothing to look up. In practice this cannot happen
  // — the application form requires a trade name — but a server action is a
  // public endpoint and does not get to assume its own UI called it.
  if (!url && !tradeName) {
    return { status: 'error', message: 'Nothing to look up — no website and no name.' };
  }

  /* Their site AND their Google listing, in one press.
     Two integrations behind one button, because an ops reviewer deciding on
     an application wants everything findable in front of them at once — and
     because a second button labelled "also check Google" is a button that
     gets forgotten on the applications that matter. */
  const found = await enrichStudio({ tradeName, website: url || null });

  if (!found.site && !found.listing) {
    return {
      status: 'error',
      message: found.notes.join(' ') || 'Nothing found on their website or on Google.',
    };
  }

  const site = found.site;

  return {
    status: 'done',
    site: site
      ? {
          title: site.title,
          description: site.description,
          emails: site.emails,
          phones: site.phones,
          instagram: site.instagram,
          localities: site.localities,
          startingFromPaise: site.startingFromPaise,
          yearsActive: site.yearsActive,
          claims: site.claims,
        }
      : null,
    listing: found.listing
      ? {
          name: found.listing.name,
          address: found.listing.address,
          phone: found.listing.phone,
          website: found.listing.website,
          rating: found.listing.rating,
          reviewCount: found.listing.reviewCount,
          mapsUrl: found.listing.mapsUrl,
        }
      : null,
    instagram: found.instagram,
    notes: found.notes,
  };
}

export interface DecisionState {
  status: 'idle' | 'done' | 'error';
  message?: string;
}

/**
 * One action for both decisions, because the UI is one form. The intent comes
 * from the submit button's `name`, so a form with JS disabled still works.
 */
export async function decideAction(
  _prev: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  const id = String(formData.get('id') ?? '');
  const intent = String(formData.get('intent') ?? '');
  const note = String(formData.get('note') ?? '');

  if (!id) return { status: 'error', message: 'Missing application.' };

  const result =
    intent === 'approve'
      ? await approveApplication(id, note)
      : intent === 'reject'
        ? await rejectApplication(id, note)
        : intent === 'reviewing'
          ? await setReviewing(id)
          : ({ ok: false, error: 'Unknown action.' } as const);

  if (!result.ok) return { status: 'error', message: result.error };

  revalidatePath('/ops/applications');

  return {
    status: 'done',
    message:
      intent === 'approve'
        ? `Approved. Studio created in onboarding${
            'studioSlug' in result && result.studioSlug ? ` as /${result.studioSlug}` : ''
          }. ${
            // Never claim an email sent when it did not. The studio exists now
            // and cannot get in without this link — ops finding out here beats
            // finding out in a week from a studio who thinks we forgot them.
            'emailDelivered' in result && result.emailDelivered === false
              ? 'THE SIGN-IN EMAIL DID NOT SEND — no email provider is configured. Send them a link another way before they hear about the approval from anyone else.'
              : 'A sign-in link is on its way.'
          }`
        : intent === 'reject'
          ? /* It emails them now, with the reason you typed, verbatim. Say
               plainly when it did not — a rejection nobody received is the
               exact silence /apply promises we will not send. */
            'emailDelivered' in result && result.emailDelivered === false
            ? 'Rejected — but THE EMAIL DID NOT SEND. They have heard nothing. Tell them yourself.'
            : 'Rejected. They have been emailed the reason you gave, word for word.'
          : 'Marked as under review.',
  };
}

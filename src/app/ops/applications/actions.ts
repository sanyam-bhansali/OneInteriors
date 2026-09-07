'use server';

import { revalidatePath } from 'next/cache';
import {
  approveApplication,
  rejectApplication,
  setReviewing,
} from '@/modules/studio/application';
import { requireRole } from '@/modules/auth/session';
import { scrapeStudioSite } from '@/modules/studio/scrape';

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
  };
}

/**
 * Read the applicant's website. Ops-only — this makes an outbound request from
 * our server on a URL a stranger supplied, so it is gated on the role, not just
 * on the page being unlisted.
 *
 * The Date and the 'website-claim' marker are dropped here: what crosses to the
 * client is plain data the UI labels for itself.
 */
export async function scrapeSiteAction(
  _prev: ScrapeState,
  formData: FormData,
): Promise<ScrapeState> {
  await requireRole('OPS');

  const url = String(formData.get('website') ?? '');
  if (!url.trim()) return { status: 'error', message: 'No website on this application.' };

  const result = await scrapeStudioSite(url);
  if (!result.ok) return { status: 'error', message: result.error };

  const { title, description, emails, phones, instagram, localities, startingFromPaise, yearsActive, claims } =
    result.site;

  return {
    status: 'done',
    site: { title, description, emails, phones, instagram, localities, startingFromPaise, yearsActive, claims },
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
          }, and a sign-in link is on its way.`
        : intent === 'reject'
          ? 'Rejected. Tell them yourself as well — this does not email them.'
          : 'Marked as under review.',
  };
}

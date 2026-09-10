'use server';

/**
 * Actions for the comparison screen.
 *
 * Only one so far, and it is the important one: minting the link that lets the
 * person who was not on the call read the same page.
 */

import { shareLinkForCurrentBrief, revokeShareLink } from '@/modules/brief/share';
import { resolveSiteUrl } from '@/lib/site';
import { record } from '@/modules/analytics/record';

export type ShareLinkResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function createShareLinkAction(): Promise<ShareLinkResult> {
  const result = await shareLinkForCurrentBrief();

  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === 'no_brief'
          ? 'We could not find your brief on this account.'
          : 'Could not create a link just now. Try again in a moment.',
    };
  }

  await record('share.created');

  // Built server-side from the configured site URL rather than from anything
  // the browser reported. A link assembled out of a request header is a link
  // an attacker can point wherever they like, and this one is meant to be
  // forwarded to somebody's spouse.
  return { ok: true, url: `${resolveSiteUrl()}/shared/${result.token}` };
}

export async function revokeShareLinkAction(): Promise<{ ok: boolean }> {
  return revokeShareLink();
}

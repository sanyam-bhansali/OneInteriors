/**
 * The brief carried in the address, for builds with no database only.
 *
 * A local or sample build cannot store the brief, so the server-rendered
 * expert page had nothing to read and the customer hit "we could not save
 * them" at step 05 (owner, 10 Oct 2026: "fix this"). There, and only there,
 * BriefRescue puts the brief in `?preview=` and the page renders from it.
 *
 * Contact details are stripped before encoding — a name or a number never
 * goes in a URL. A deployment with a database ignores the parameter.
 */

import { EMPTY_BRIEF, type Brief } from './types';

export const PREVIEW_PARAM = 'preview';

function withoutContact(brief: Brief): Brief {
  return { ...brief, contactName: null };
}

export function encodePreviewBrief(brief: Brief): string {
  const json = JSON.stringify(withoutContact(brief));
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodePreviewBrief(value: string | undefined): Brief | null {
  if (!value || value.length > 20_000) return null;
  try {
    const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<Brief>;
    if (!parsed || typeof parsed !== 'object') return null;
    return withoutContact({ ...EMPTY_BRIEF, ...parsed });
  } catch {
    return null;
  }
}

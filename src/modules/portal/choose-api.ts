/**
 * The website's Choose & sign view (`chooseView`) in the phone app's shape
 * (docs/APP-API-JOURNEY.md). Pure, and tested. Every field the website reads
 * is kept; the app also gets each studio's one visit to act on now.
 */

import type { ChooseView, ChooseVisit } from './choose';

export interface ApiChooseVisit {
  id: string;
  at: string;
  kind: 'first_meeting' | 'site_visit' | 'follow_up';
  state: 'proposed' | 'confirmed' | 'completed';
  location: string | null;
}

export interface ApiChooseView {
  studios: {
    introId: string;
    slug: string;
    name: string;
    /** The visit to act on: the next proposed or confirmed one, else the last done. */
    visit: ApiChooseVisit | null;
    visits: ApiChooseVisit[];
    finalQuoteId: string | null;
    finalQuote: { id: string; totalPaise: number; issuedOn: string | null; accepted: boolean } | null;
  }[];
  /** A note from the expert to the customer. There is no such note yet; always null. */
  expertNote: string | null;
  call: { scheduledFor: string | null; status: string } | null;
  signedWith: string | null;
}

const visitOf = (v: ChooseVisit): ApiChooseVisit => ({
  id: v.id,
  at: v.startsAt,
  kind: v.kind.toLowerCase() as ApiChooseVisit['kind'],
  state: v.status.toLowerCase() as ApiChooseVisit['state'],
  location: v.location,
});

export function chooseApiView(view: ChooseView): ApiChooseView {
  return {
    studios: view.studios.map((s) => {
      const live = s.visits.find((v) => v.status !== 'COMPLETED') ?? s.visits.filter((v) => v.status === 'COMPLETED').pop() ?? null;
      return {
        introId: s.introductionId,
        slug: s.slug,
        name: s.name,
        visit: live ? visitOf(live) : null,
        visits: s.visits.map(visitOf),
        finalQuoteId: s.finalQuote?.id ?? null,
        finalQuote: s.finalQuote,
      };
    }),
    expertNote: null,
    call: view.call,
    signedWith: view.signedWith,
  };
}

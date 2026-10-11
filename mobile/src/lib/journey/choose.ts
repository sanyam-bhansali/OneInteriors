import { call } from '../api';

/**
 * Choose & sign's calls to /api/app/v1 (docs/APP-API-JOURNEY.md): the
 * studios the expert introduced with their visits, a yes or no to a time a
 * studio proposed, the studio's final quote, and signing it with a code and
 * a plan. Shapes copied from the website's src/modules/portal/choose-api.ts
 * and `FinalQuoteView` in src/modules/portal/choose.ts (React Native cannot
 * import from src/). Change one, change the other.
 */

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
    /** `totalPaise` here is before GST, as the website shows it. */
    finalQuote: {
      id: string;
      totalPaise: number;
      issuedOn: string | null;
      accepted: boolean;
    } | null;
  }[];
  /** A note from the expert to the customer. There is no such note yet; always null. */
  expertNote: string | null;
  call: { scheduledFor: string | null; status: string } | null;
  signedWith: string | null;
}

export interface FinalQuoteView {
  id: string;
  studioName: string;
  studioSlug: string;
  number: string;
  issuedOn: string | null;
  accepted: boolean;
  rooms: {
    room: string;
    amountPaise: number;
    lines: { product: string; details: string | null; amountPaise: number }[];
  }[];
  lineCount: number;
  workPaise: number;
  feePaise: number;
  discountPaise: number;
  onSpotPaise: number;
  onSpotLabel: string | null;
  /** After every discount, before GST — what compares with the first quote. */
  beforeTaxPaise: number;
  /** Zero when the studio quoted without GST. */
  gstPaise: number;
  /** What they pay the studio, GST included when the studio charges it. */
  totalPaise: number;
  terms: string | null;
  handoverDays: number;
  /** The studio's filed stages, or the stages on its own quotation when it filed none. */
  stages: { label: string; pct: number | null; amountPaise: number }[];
  /** Their first quote for this studio, before GST — null when it cannot be priced now. */
  firstBeforeGstPaise: number | null;
}

export type SignPlan = 'basic' | 'assured';

const at = (id: string) => encodeURIComponent(id);

export const chooseApi = {
  /** `view` is null until the account has a brief. */
  view: () => call<{ view: ApiChooseView | null }>('GET', '/choose'),
  answerVisit: (visitId: string, answer: 'confirm' | 'cancel') => call<object>('POST', `/choose/visits/${at(visitId)}`, { answer }),
  quote: (quoteId: string) => call<{ quote: FinalQuoteView }>('GET', `/choose/quote/${at(quoteId)}`),
  /** A 6-digit code to the number on their account. */
  signCode: (quoteId: string) => call<{ devCode?: string }>('POST', `/choose/sign/${at(quoteId)}/code`),
  /** The app shows the terms and the tick before the code is sent, so `agreed` is always true here. */
  sign: (quoteId: string, code: string, plan: SignPlan) =>
    call<{
      projectId: string;
      plan: 'basic' | 'assured';
      assuredRequested: boolean;
    }>('POST', `/choose/sign/${at(quoteId)}`, {
      code,
      plan,
      agreed: true,
    }),
};

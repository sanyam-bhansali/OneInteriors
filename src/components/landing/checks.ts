/**
 * The fifteen checks, as the landing page states them.
 *
 * ## Why this file exists rather than an array in the component
 *
 * Because the claim has to be checkable. "Fifteen mandatory checks, every one
 * with a named verifier" is the load-bearing sentence on the page, and the
 * cheapest way for it to quietly become false is for somebody to add a
 * sixteenth check to `CheckType` and never touch the marketing copy — or
 * worse, remove one.
 *
 * So the order is written out, and `ORDER` is typed as `CheckType[]` with a
 * length assertion below. Add a check to the vocabulary without listing it
 * here and the page silently undercounts; remove one and the build stops.
 * The count the page prints is `CHECKS.length`, never the numeral fifteen.
 *
 * Pure, and with NO `server-only` — the trust spine is a client component and
 * imports these as values. CONTRIBUTING §9.5.
 */

import { CHECK_LABELS, type CheckType } from '@/modules/studio/types';

export interface LandingCheck {
  /** "01" … "15". Mono, in the list and the ring. */
  n: string;
  type: CheckType;
  /** One word, above the title. Not the same as the tier grouping. */
  category: string;
  /** How the page names it — shorter and plainer than `CHECK_LABELS`. */
  title: string;
  /** What was actually done, in the customer's language. */
  detail: string;
  /** Who did it. A check without one of these is not a check. */
  verifier: string;
}

/**
 * The reading order, which is not the tier order.
 *
 * Identity first because it is the cheapest to fake and the easiest to
 * understand; money and aftercare last because they are the ones nobody else
 * performs and they land hardest at the end.
 */
const ROWS: Omit<LandingCheck, 'n'>[] = [
  {
    type: 'PAN_NAME_MATCH',
    category: 'Identity',
    title: 'PAN and legal name match',
    detail: 'The name on the PAN is the name on the contract you sign.',
    verifier: 'Protean',
  },
  {
    type: 'AADHAAR_KYC',
    category: 'Identity',
    title: 'Aadhaar KYC of the principal',
    detail: 'The person who owns the studio, verified — not an office manager.',
    verifier: 'IDfy',
  },
  {
    type: 'ADDRESS_VISIT',
    category: 'Premises',
    title: 'Registered address visited',
    detail: 'Somebody from our team stood at the address on the registration.',
    verifier: 'Our team',
  },
  {
    type: 'CONTACT_REACHABLE',
    category: 'Contact',
    title: 'Working number and email',
    detail: 'Called and emailed. A studio we cannot reach cannot be listed.',
    verifier: 'Our team',
  },
  {
    type: 'CODE_OF_CONDUCT',
    category: 'Conduct',
    title: 'Code of conduct signed',
    detail: 'No cold calling you, no pressure closing, no unapproved substitutions.',
    verifier: 'Signed',
  },
  {
    type: 'GSTIN_ACTIVE',
    category: 'Tax',
    title: 'GSTIN active',
    detail: 'Checked on the GST portal, not from a screenshot they sent us.',
    verifier: 'GST portal',
  },
  {
    type: 'GST_FILING_HISTORY',
    category: 'Tax',
    title: 'Twelve months of GST filings',
    detail: 'GSTR-1 and 3B filed monthly. Gaps say more than a portfolio does.',
    verifier: 'GST portal',
  },
  {
    type: 'MCA_STATUS',
    category: 'Legal',
    title: 'Company filings current',
    detail: 'Annual returns up to date, or the proprietorship declared as one.',
    verifier: 'MCA',
  },
  {
    type: 'UDYAM',
    category: 'Legal',
    title: 'Udyam registration',
    detail: 'The business exists as a business, at the size it claims.',
    verifier: 'Udyam portal',
  },
  {
    type: 'CLIENT_REFERENCE',
    category: 'Clients',
    title: 'Three past clients called',
    detail: 'Asked about delays, and final cost against quoted cost.',
    verifier: 'Our team',
  },
  {
    type: 'SITE_INSPECTION',
    category: 'Work',
    title: 'Two finished sites inspected',
    detail: 'We stand in the flat. Instagram photographs do not count.',
    verifier: 'Our team',
  },
  {
    type: 'LITIGATION_SEARCH',
    category: 'Disputes',
    title: 'Litigation and consumer search',
    detail: 'eCourts and NCDRC, under both trade and legal name.',
    verifier: 'eCourts + NCDRC',
  },
  {
    type: 'RATE_CARD_FILED',
    category: 'Money',
    title: 'Rate card filed and locked',
    detail: 'Their own per-sq-ft prices, on record — what your first quote is built from.',
    verifier: 'Our pricing team',
  },
  {
    type: 'WARRANTY_TERMS',
    category: 'After',
    title: 'Workmanship warranty on paper',
    detail: 'Duration stated, in the contract, on hardware, finish and workmanship.',
    verifier: 'Legal review',
  },
  {
    type: 'LABOUR_INSURANCE',
    category: 'Site',
    title: 'Labour insurance and site safety',
    detail: 'Current certificate for the people who will be working in your home.',
    verifier: 'Insurer certificate',
  },
];

export const CHECKS: LandingCheck[] = ROWS.map((row, i) => ({
  ...row,
  n: String(i + 1).padStart(2, '0'),
}));

/**
 * Every check in the vocabulary appears on this page, exactly once.
 *
 * A compile-time assertion rather than a test, because the failure it guards
 * against is somebody adding a `CheckType` and shipping — and a build error
 * is read on the day it happens, whereas a test in a suite that has not been
 * run this week is not.
 *
 * `Record<CheckType, …>` is exhaustive by construction: leave a check out and
 * TypeScript names it; list one twice and the duplicate key is flagged.
 */
const COVERAGE: Record<CheckType, true> = {
  PAN_NAME_MATCH: true,
  AADHAAR_KYC: true,
  ADDRESS_VISIT: true,
  CONTACT_REACHABLE: true,
  CODE_OF_CONDUCT: true,
  GSTIN_ACTIVE: true,
  GST_FILING_HISTORY: true,
  MCA_STATUS: true,
  UDYAM: true,
  CLIENT_REFERENCE: true,
  SITE_INSPECTION: true,
  LITIGATION_SEARCH: true,
  RATE_CARD_FILED: true,
  WARRANTY_TERMS: true,
  LABOUR_INSURANCE: true,
};

/**
 * The count the page prints. Never the numeral.
 *
 * `Object.keys(COVERAGE).length` rather than `CHECKS.length` so the figure is
 * the size of the actual vocabulary — if this file ever fell behind the
 * vocabulary the two would differ, and the guard below is what says so.
 */
export const CHECK_COUNT = Object.keys(COVERAGE).length;

if (CHECKS.length !== CHECK_COUNT) {
  throw new Error(
    `The landing page lists ${CHECKS.length} checks but the vocabulary has ${CHECK_COUNT}. ` +
      'Add the missing one to ROWS in checks.ts — the page claims every check is mandatory.',
  );
}

/** Kept so the shared label is reachable from the page if it is ever needed. */
export function vocabularyLabel(type: CheckType): string {
  return CHECK_LABELS[type];
}

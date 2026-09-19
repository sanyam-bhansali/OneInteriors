/**
 * The checks a studio has passed, cut down to fit beside a card.
 *
 * ## Why this is not the profile list
 *
 * `/studios/[slug]` publishes every check with its source, its date and what
 * it means — fifteen rows, and correctly so: somebody on that page has chosen
 * this studio and wants the file.
 *
 * Beside a match card there is a 12rem column and about two seconds of
 * attention. Fifteen rows there is not more proof, it is wallpaper. So this
 * picks the few a homeowner would actually weigh, shortens each to something
 * readable at a glance, and says plainly how many are left.
 *
 * ## The order is by what it buys the customer, not by our process
 *
 * Our own funnel starts at PAN and Aadhaar because that is where a file
 * begins. A homeowner does not care that we matched a PAN — they care that
 * somebody from our team walked through a house this studio finished, and
 * that the labourers coming into their home are insured. `WEIGHT` is that
 * order, and it is deliberately close to the reverse of the tier order.
 *
 * ## Only PASS counts
 *
 * PENDING is not a soft yes and EXPIRED is not a slightly old yes. A green
 * tick on either would be the exact thing this product exists to argue
 * against, so both are dropped and both still count as not-shown rather than
 * being quietly folded into the "more" figure.
 */

import { CHECK_LABELS, type CheckType, type VerificationCheck } from './types';

/**
 * The chip form of each check — two or three words.
 *
 * The long name stays in `CHECK_LABELS` and rides along on every chip as its
 * title, so nothing is lost; this is only what fits on one line at 12rem.
 */
export const CHECK_CHIPS: Record<CheckType, string> = {
  SITE_INSPECTION: 'Sites inspected',
  CLIENT_REFERENCE: 'Past clients called',
  LABOUR_INSURANCE: 'Labour insured',
  WARRANTY_TERMS: 'Warranty on paper',
  RATE_CARD_FILED: 'Rate card filed',
  GST_FILING_HISTORY: '12 months of GST',
  LITIGATION_SEARCH: 'Courts searched',
  ADDRESS_VISIT: 'Address visited',
  GSTIN_ACTIVE: 'GST active',
  AADHAAR_KYC: 'Owner identified',
  CODE_OF_CONDUCT: 'Conduct signed',
  MCA_STATUS: 'MCA filings current',
  PAN_NAME_MATCH: 'PAN matched',
  UDYAM: 'Udyam registered',
  CONTACT_REACHABLE: 'Reachable',
};

/** Strongest first, in the customer's terms. */
const WEIGHT: CheckType[] = [
  'SITE_INSPECTION',
  'CLIENT_REFERENCE',
  'LABOUR_INSURANCE',
  'WARRANTY_TERMS',
  'RATE_CARD_FILED',
  'GST_FILING_HISTORY',
  'LITIGATION_SEARCH',
  'ADDRESS_VISIT',
  'GSTIN_ACTIVE',
  'AADHAAR_KYC',
  'CODE_OF_CONDUCT',
  'MCA_STATUS',
  'PAN_NAME_MATCH',
  'UDYAM',
  'CONTACT_REACHABLE',
];

export interface ProofChip {
  type: CheckType;
  /** Short form, for the chip. */
  text: string;
  /** Full name, for the title attribute and assistive technology. */
  label: string;
  /** "GST portal", "Our team". Null when the row never carried one. */
  source: string | null;
}

export interface Proof {
  /** Fans out to the left of the card. */
  left: ProofChip[];
  /** Fans out to the right, at the same time. */
  right: ProofChip[];
  /** Passed checks not shown here. Zero means the list is complete. */
  more: number;
  /** Every check that passed, shown or not. */
  passed: number;
}

/**
 * Split the passed checks into two balanced columns.
 *
 * Dealt alternately rather than sliced in half, so the two strongest land one
 * on each side. Sliced, the left column would carry the site inspections and
 * the references while the right carried GST registration and Udyam, and the
 * card would look lopsided in a way that has nothing to do with the studio.
 */
export function studioProof(checks: VerificationCheck[], perSide = 3): Proof {
  const passed = checks.filter((c) => c.result === 'PASS');

  const ranked = [...passed].sort((a, b) => {
    const ai = WEIGHT.indexOf(a.type);
    const bi = WEIGHT.indexOf(b.type);
    // An unrecognised check type sorts last rather than first. A new CheckType
    // added without a line in WEIGHT must not silently outrank site visits.
    return (ai === -1 ? WEIGHT.length : ai) - (bi === -1 ? WEIGHT.length : bi);
  });

  const left: ProofChip[] = [];
  const right: ProofChip[] = [];

  for (const check of ranked.slice(0, perSide * 2)) {
    const chip: ProofChip = {
      type: check.type,
      text: CHECK_CHIPS[check.type] ?? CHECK_LABELS[check.type] ?? check.type,
      label: CHECK_LABELS[check.type] ?? check.type,
      source: check.source,
    };
    (left.length <= right.length ? left : right).push(chip);
  }

  return {
    left,
    right,
    more: Math.max(0, passed.length - left.length - right.length),
    passed: passed.length,
  };
}

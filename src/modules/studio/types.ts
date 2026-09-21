/**
 * Studio — the supply side.
 *
 * The rule that governs this whole module: every claim the product makes about
 * a studio must be backed by a real value, and a missing value renders as
 * "not enough data yet" — never as a favourable default. That is the brand.
 */

import type { Paise } from '@/lib/money';
import type { PropertyType, ScopeType, StyleTag } from '@/modules/brief/types';

/** Tier 3 (PROVEN) is the only tier a competitor cannot buy from a KYC vendor. */
export type VerificationTier = 'UNVERIFIED' | 'LISTED' | 'VERIFIED' | 'PROVEN';

export type StudioStatus = 'ONBOARDING' | 'ACTIVE' | 'PAUSED' | 'SUSPENDED' | 'REMOVED';

export type CheckType =
  | 'PAN_NAME_MATCH'
  | 'AADHAAR_KYC'
  | 'ADDRESS_VISIT'
  | 'CONTACT_REACHABLE'
  | 'CODE_OF_CONDUCT'
  | 'GSTIN_ACTIVE'
  | 'GST_FILING_HISTORY'
  | 'MCA_STATUS'
  | 'UDYAM'
  | 'CLIENT_REFERENCE'
  | 'SITE_INSPECTION'
  | 'LITIGATION_SEARCH'
  // The last three arrived with the landing page's "fifteen checks" claim.
  // They are not decoration: the rate card is what every first quote is
  // priced from, the warranty is the only thing a customer holds after
  // handover, and the labour insurance covers people working inside their
  // home. Claiming fifteen on the marketing page while performing twelve
  // would be exactly the kind of unverifiable number this company exists to
  // argue against — so they are checks, with verifiers, like the rest.
  | 'RATE_CARD_FILED'
  | 'WARRANTY_TERMS'
  | 'LABOUR_INSURANCE';

export type CheckResult = 'PENDING' | 'PASS' | 'FAIL' | 'NOT_APPLICABLE' | 'EXPIRED';

export interface VerificationCheck {
  type: CheckType;
  result: CheckResult;
  /** Shown to the customer. "GST portal", "Site visit by our team", "IDfy". */
  source: string | null;
  /** ISO date. The profile publishes this — a badge without a date is noise. */
  checkedAt: string | null;
  detail: string | null;
}

export interface PortfolioProject {
  id: string;
  title: string;
  locality: string | null;
  propertyType: PropertyType | null;
  scope: ScopeType | null;
  styleTags: StyleTag[];
  valuePaise: Paise | null;
  durationDays: number | null;
  completedOn: string | null;
  images: string[];
  /** A render labelled as a render is fine. Passing one off as a photo is not. */
  isRender: boolean;
}

export interface Studio {
  id: string;
  slug: string;
  legalName: string;
  tradeName: string;
  about: string;
  city: string;
  localities: string[];

  status: StudioStatus;
  tier: VerificationTier;

  /** Verified from the GST portal, not self-declared. Public by law. */
  gstin: string | null;
  /**
   * The studio has told us it has no GST registration.
   *
   * Distinct from a null `gstin`, which only means nobody has answered yet. Ops
   * needs the difference: one is an unfinished form, the other is a studio to
   * verify on PAN and bank records instead.
   *
   * Optional because the v0.1 fixture studios in `src/data/studios.ts` predate
   * it and none of them needs it — nothing in matching or pricing reads this
   * field, only the ops verification screen does. Read it as `?? false`.
   */
  gstinNotApplicable?: boolean;
  gstinNote?: string | null;

  /**
   * What a studio with fewer than three completed projects says it has
   * instead, in its own words.
   *
   * Ops reads this; nothing computes on it. A studio that wrote one has
   * *declared* a shortfall rather than left the step unfinished, and those are
   * different facts — the first is a judgement waiting to be made, the second
   * is a studio still typing.
   *
   * Optional for the same fixture reason as the GSTIN pair above.
   */
  portfolioShortfallNote?: string | null;

  /**
   * When ops marked this row as a test record. Null — the normal case — means
   * it is a real studio.
   *
   * Set means it is hidden from the roster, from matching and from every ops
   * count. Not a status: see the field's note in schema.prisma for why a test
   * fixture must not be filed as REMOVED.
   *
   * Optional for the same fixture reason as the fields above — none of the
   * invented studios in `src/data/studios.ts` is hidden, and reading it as
   * `?? null` is correct everywhere.
   */
  hiddenAsTestAt?: string | null;

  /**
   * The studio has finished its side and sent the profile for verification.
   *
   * Optional for the same fixture reason as the two fields above. Derived from
   * the `onboardingSteps` JSON the studio surface writes — deliberately not a
   * second column, because two sources of the same fact is how they come to
   * disagree.
   */
  submittedForReview?: boolean;
  yearsActive: number | null;
  teamSize: number | null;

  minProjectPaise: Paise | null;
  maxProjectPaise: Paise | null;

  // ── Derived performance ──
  // Recomputed by a job from real projects. NULL means "we don't know yet"
  // and must render as such. Never default these to flattering values.
  completedProjects: number;
  avgVarianceDays: number | null;
  upheldDisputes: number;
  specComplianceRate: number | null;
  communicationRating: number | null;
  /** 0 = hands-off, 1 = highly collaborative. From past-client feedback. */
  autonomyProfile: number | null;

  // ── Allocation ──
  // How often a studio is shown, never where it appears. See the schema
  // comment: there is deliberately no priority or boost field here.

  /** Projects a month this studio says it can take. Self-declared. */
  capacityPerMonth: number | null;
  /** ISO timestamp while out of rotation, null when live. */
  pausedAt: string | null;
  /** Why they are paused. Always set when pausedAt is. */
  pausedReason: string | null;
  /**
   * What kind of pause, which decides who lifts it. Capacity and payment
   * pauses lift themselves; a manual one waits for a person.
   */
  pauseCause: 'MANUAL' | 'AT_CAPACITY' | 'PAYMENT_DUE' | null;

  checks: VerificationCheck[];
  portfolio: PortfolioProject[];
}

export const TIER_LABELS: Record<VerificationTier, string> = {
  UNVERIFIED: 'Unverified',
  LISTED: 'Listed',
  VERIFIED: 'Verified',
  PROVEN: 'Proven',
};

export const TIER_DESCRIPTIONS: Record<VerificationTier, string> = {
  UNVERIFIED: 'Not yet checked.',
  LISTED: 'Identity and address confirmed by our team.',
  VERIFIED: 'Identity, GST filing history, references and two site inspections confirmed.',
  PROVEN: 'Everything in Verified, plus a delivery record built on projects we monitored stage by stage.',
};

export const CHECK_LABELS: Record<CheckType, string> = {
  PAN_NAME_MATCH: 'PAN name match',
  AADHAAR_KYC: 'Identity of the principal',
  ADDRESS_VISIT: 'Business address visited',
  CONTACT_REACHABLE: 'Phone and email reachable',
  CODE_OF_CONDUCT: 'Code of conduct signed',
  GSTIN_ACTIVE: 'GST registration active',
  GST_FILING_HISTORY: '12 months of GST filings',
  MCA_STATUS: 'Company filings current',
  UDYAM: 'Udyam / MSME registration',
  CLIENT_REFERENCE: 'Past clients contacted',
  SITE_INSPECTION: 'Completed sites inspected',
  LITIGATION_SEARCH: 'Litigation and consumer forum search',
  RATE_CARD_FILED: 'Rate card filed and locked',
  WARRANTY_TERMS: 'Workmanship warranty on paper',
  LABOUR_INSURANCE: 'Labour insurance and site safety',
};

/**
 * What each check actually means, in the customer's language.
 *
 * `CHECK_LABELS` names the check for us; this says what was done for them.
 * "GST_FILING_HISTORY" and even "12 months of GST filings" tell a homeowner
 * nothing — "they have filed returns for twelve straight months, so the
 * business is trading, not dormant" tells them why they should care.
 *
 * Every line here is a claim we have to be able to stand behind for every
 * studio showing it. If a check stops being performed, the sentence comes out
 * of this file on the same day.
 */
export const CHECK_MEANINGS: Record<CheckType, string> = {
  PAN_NAME_MATCH: 'The PAN on file belongs to the person who signed for the studio.',
  AADHAAR_KYC: 'We confirmed who owns this business, from government ID.',
  ADDRESS_VISIT: 'Somebody from our team stood at the address they gave us.',
  CONTACT_REACHABLE: 'The phone number and email reach a person who answers.',
  CODE_OF_CONDUCT: 'They have signed our code of conduct, which covers how disputes are handled.',
  GSTIN_ACTIVE: 'Their GST registration is live, checked against the public register.',
  GST_FILING_HISTORY:
    'Twelve straight months of GST returns — the business is trading, not dormant.',
  MCA_STATUS: 'Company filings are up to date at the Ministry of Corporate Affairs.',
  UDYAM: 'Registered as an MSME, which is where their scale is declared.',
  CLIENT_REFERENCE: 'We telephoned past clients ourselves. We did not take a list of testimonials.',
  SITE_INSPECTION: 'We walked through finished homes they built, in person.',
  LITIGATION_SEARCH: 'We searched the courts and consumer forums for cases against them.',
  RATE_CARD_FILED:
    'Their own per-sq-ft prices are on record with us — it is what your first quote is built from.',
  WARRANTY_TERMS:
    'A written warranty on hardware, finish and workmanship, with the duration stated in the contract.',
  LABOUR_INSURANCE:
    'A current insurance certificate for the people who will be working inside your home.',
};

/** Which checks belong to which tier — drives the profile checklist grouping. */
export const TIER_CHECKS: Record<Exclude<VerificationTier, 'UNVERIFIED'>, CheckType[]> = {
  LISTED: ['PAN_NAME_MATCH', 'AADHAAR_KYC', 'ADDRESS_VISIT', 'CONTACT_REACHABLE', 'CODE_OF_CONDUCT'],
  VERIFIED: [
    'GSTIN_ACTIVE',
    'GST_FILING_HISTORY',
    'MCA_STATUS',
    'UDYAM',
    'CLIENT_REFERENCE',
    'SITE_INSPECTION',
    'LITIGATION_SEARCH',
    // Adding these three to VERIFIED is a real gate, not a label change: a
    // studio without a filed rate card, written warranty terms or current
    // labour insurance now cannot hold the badge. That is the point — the
    // landing page tells every visitor these are mandatory — but it does
    // mean any live studio missing one drops to LISTED until ops records
    // it. Tiers are computed and never assigned, so there is no override.
    'RATE_CARD_FILED',
    'WARRANTY_TERMS',
    'LABOUR_INSURANCE',
  ],
  PROVEN: [],
};

/** Do we have enough completed work to state a delivery record at all? */
export const MIN_PROJECTS_FOR_RELIABILITY = 3;

export function hasDeliveryRecord(studio: Studio): boolean {
  return studio.completedProjects >= MIN_PROJECTS_FOR_RELIABILITY && studio.avgVarianceDays !== null;
}

/**
 * Human phrasing of the delivery record, including when there isn't one.
 * The honest version outperforms a fabricated number — and it is checkable.
 */
export function describeDelivery(studio: Studio): string {
  if (!hasDeliveryRecord(studio)) {
    if (studio.completedProjects === 0) {
      return 'No delivery record yet — this studio has not completed a project with us.';
    }
    const n = studio.completedProjects;
    return `${n} project${n === 1 ? '' : 's'} completed with us — not yet enough to state a reliable average.`;
  }
  const d = Math.round(studio.avgVarianceDays as number);
  if (d <= 0) {
    return `${studio.completedProjects} projects completed on or ahead of the committed date.`;
  }
  return `${studio.completedProjects} projects completed, averaging ${d} day${d === 1 ? '' : 's'} past the committed date.`;
}

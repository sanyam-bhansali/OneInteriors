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
  | 'LITIGATION_SEARCH';

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
};

/** Which checks belong to which tier — drives the profile checklist grouping. */
export const TIER_CHECKS: Record<Exclude<VerificationTier, 'UNVERIFIED'>, CheckType[]> = {
  LISTED: ['PAN_NAME_MATCH', 'AADHAAR_KYC', 'ADDRESS_VISIT', 'CONTACT_REACHABLE', 'CODE_OF_CONDUCT'],
  VERIFIED: ['GSTIN_ACTIVE', 'GST_FILING_HISTORY', 'MCA_STATUS', 'UDYAM', 'CLIENT_REFERENCE', 'SITE_INSPECTION', 'LITIGATION_SEARCH'],
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
    return 'No delivery record yet — this studio has not completed a project with us.';
  }
  const d = Math.round(studio.avgVarianceDays as number);
  if (d <= 0) {
    return `${studio.completedProjects} projects completed on or ahead of the committed date.`;
  }
  return `${studio.completedProjects} projects completed, averaging ${d} day${d === 1 ? '' : 's'} past the committed date.`;
}

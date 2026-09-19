/**
 * The verification record, arranged for a customer to read.
 *
 * ## The one rule this module exists to enforce
 *
 * **Every status, source and date here comes from a `VerificationCheck` row.**
 * Nothing is defaulted, nothing is assumed, and a check nobody has performed
 * renders as not performed — not as a tick with yesterday's date on it.
 *
 * That sounds obvious and it is the single easiest thing to get wrong on this
 * screen. A trust panel is a design brief that pulls hard toward fifteen green
 * ticks and a tidy date, because fifteen green ticks look better. On a page
 * whose entire argument is that somebody actually rang the past clients and
 * actually stood in the finished flats, a fabricated tick is not a placeholder
 * — it is the product failing at the exact thing it sells. `FUTURE-SCOPE.md`
 * puts it under "Never": *an unmeasured value renders as "not enough data
 * yet". Always.*
 *
 * So `passed` counts `PASS` rows and nothing else, and a studio missing nine
 * checks shows six of fifteen. That is the honest number and it is also the
 * useful one: it is how a customer tells a fully audited studio from a new
 * one, which is the whole point of publishing it.
 *
 * ## Why three sections and not two
 *
 * The brief asked for Identity and Trading History, which together cover
 * eleven of the fifteen checks in `CHECK_LABELS`. Dropping the other four
 * would mean either printing a count that contradicts the landing page's
 * fifteen, or quietly shrinking the claim. They are grouped as Commercial
 * terms instead — they are genuinely a third kind of thing, and the total
 * stays the number the rest of the product states.
 *
 * Pure, per CONTRIBUTING §9.5 — no `server-only`, so the panel, the studio
 * profile and the tests all read the same grouping.
 */

import { CHECK_LABELS, type CheckResult, type CheckType, type VerificationCheck } from './types';

export interface CheckView {
  type: CheckType;
  /** How the customer sees it named. */
  title: string;
  /** What was actually done, in one line. */
  detail: string;
  /** Who did it. A check without one of these is not a check. */
  source: string | null;
  /** ISO date, or null when nobody has run it. */
  checkedAt: string | null;
  result: CheckResult;
  /** True only for PASS. Everything else is a different thing. */
  passed: boolean;
}

export interface CheckSection {
  id: string;
  title: string;
  /** One line on why this group of checks exists. */
  why: string;
  checks: CheckView[];
  passed: number;
}

export interface VerificationView {
  sections: CheckSection[];
  /** PASS rows only. */
  passed: number;
  total: number;
  /** The most recent `checkedAt` across every check, or null. */
  lastChecked: string | null;
  /** Checks that were run and did not pass — never hidden. */
  failed: number;
  /** Checks nobody has run yet. */
  pending: number;
}

/**
 * What each check actually means, in a customer's language.
 *
 * Kept here rather than read from the landing page's copy because that file
 * writes for a reader who has not chosen a studio yet. This one is read by
 * somebody deciding on a specific business.
 */
const DETAIL: Record<CheckType, string> = {
  PAN_NAME_MATCH: 'The name on the PAN is the name on the contract.',
  AADHAAR_KYC: 'The person who signs is the person who was checked.',
  ADDRESS_VISIT: 'Somebody from our team stood at the registered address.',
  CONTACT_REACHABLE: 'The number and the address on the listing both answer.',
  CODE_OF_CONDUCT: 'Signed terms on pricing, site conduct and handover.',
  GSTIN_ACTIVE: 'Registration live on the GST portal, not lapsed or cancelled.',
  GST_FILING_HISTORY: 'A year of returns actually filed — a trading history, not a certificate.',
  MCA_STATUS: 'Company filings up to date with the registrar.',
  UDYAM: 'Registered as an MSME, which ties the business to a declared size.',
  CLIENT_REFERENCE: 'We rang past clients ourselves. They did not choose who we spoke to.',
  SITE_INSPECTION: 'Our team walked finished flats and looked behind the shutters.',
  LITIGATION_SEARCH: 'Searched the courts and the consumer forums under the legal name.',
  RATE_CARD_FILED: 'Their rates are filed with us and cannot move mid-project.',
  WARRANTY_TERMS: 'A written workmanship warranty, not a verbal assurance.',
  LABOUR_INSURANCE: 'Cover for the people working in your home.',
};

const SECTIONS: { id: string; title: string; why: string; types: CheckType[] }[] = [
  {
    id: 'identity',
    title: 'Identity',
    why: 'Who they are is the cheapest thing to fake, so it is checked first.',
    types: [
      'PAN_NAME_MATCH',
      'AADHAAR_KYC',
      'ADDRESS_VISIT',
      'CONTACT_REACHABLE',
      'CODE_OF_CONDUCT',
    ],
  },
  {
    id: 'trading',
    title: 'Trading history',
    why: 'Anyone can register a company. This is whether it has been trading.',
    types: [
      'GSTIN_ACTIVE',
      'GST_FILING_HISTORY',
      'MCA_STATUS',
      'UDYAM',
      'CLIENT_REFERENCE',
      'SITE_INSPECTION',
      'LITIGATION_SEARCH',
    ],
  },
  {
    id: 'commercial',
    title: 'What you are owed',
    why: 'The paperwork that matters if something goes wrong.',
    types: ['RATE_CARD_FILED', 'WARRANTY_TERMS', 'LABOUR_INSURANCE'],
  },
];

/** Every check in the vocabulary, in reading order. Asserted in the tests. */
export const ALL_CHECK_TYPES: CheckType[] = SECTIONS.flatMap((s) => s.types);

export function verificationView(checks: VerificationCheck[]): VerificationView {
  const byType = new Map(checks.map((c) => [c.type, c]));

  const sections: CheckSection[] = SECTIONS.map((section) => {
    const views: CheckView[] = section.types.map((type) => {
      const row = byType.get(type);
      return {
        type,
        title: CHECK_LABELS[type],
        detail: DETAIL[type],
        /* Null rather than a plausible default. A source is the difference
           between a check and a badge, so inventing one would be inventing
           the check. */
        source: row?.source ?? null,
        checkedAt: row?.checkedAt ?? null,
        result: row?.result ?? 'PENDING',
        passed: row?.result === 'PASS',
      };
    });

    return {
      id: section.id,
      title: section.title,
      why: section.why,
      checks: views,
      passed: views.filter((v) => v.passed).length,
    };
  });

  const all = sections.flatMap((s) => s.checks);

  /* The latest date any check was run. Shown once at the top rather than
     repeated on every row — and it is a real maximum, not today's date. */
  const dates = all.map((c) => c.checkedAt).filter((d): d is string => d !== null);
  const lastChecked = dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : null;

  return {
    sections,
    passed: all.filter((c) => c.passed).length,
    total: all.length,
    /* FAIL and EXPIRED are shown, never quietly folded into "pending".
       A studio that failed a check and a studio nobody has checked are not
       the same thing, and the customer is the one who needs to know. */
    failed: all.filter((c) => c.result === 'FAIL' || c.result === 'EXPIRED').length,
    pending: all.filter((c) => c.result === 'PENDING').length,
    lastChecked,
  };
}

/** "30 Aug 2026". Returns null for null, never a stand-in date. */
export function formatCheckDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

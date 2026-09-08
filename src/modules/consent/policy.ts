/**
 * Consent under the DPDP Act 2023 — the rules, pure and testable.
 *
 * ## What the Act actually requires
 *
 * Consent must be **free, specific, informed, unconditional and unambiguous,
 * with a clear affirmative action**, and it must be *for a specified purpose*.
 * Four consequences fall out of that, and each one is enforced here rather
 * than left to whoever builds the next form:
 *
 *  1. **No pre-ticked boxes.** A default-on checkbox is not an affirmative
 *     action. `DEFAULT_GRANTED` is `false` for every marketing purpose and
 *     there is a test asserting it.
 *  2. **Service cannot be conditional on marketing consent.** "Unconditional"
 *     means we may not withhold the matches unless they agree to be marketed
 *     to. `isBlocking()` is what keeps that honest.
 *  3. **Purposes are separate.** One tick cannot cover email, WhatsApp and SMS
 *     at once; each is its own row.
 *  4. **Withdrawal must be as easy as giving it**, and the record has to
 *     survive so we can prove what was agreed and when.
 *
 * Every consent row stores the **policy version** it was given against. When
 * the notice changes materially, old consent no longer covers the new use —
 * which is only knowable if the version was recorded at the time.
 */

export const POLICY_VERSION = '2026-09-01';

export const CONSENT_PURPOSES = [
  'DATA_PROCESSING',
  'MARKETING_EMAIL',
  'MARKETING_WHATSAPP',
  'MARKETING_SMS',
  'IMPORTED_LEAD',
] as const;

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

/**
 * What we tell the person, in the words they see. Kept here rather than in the
 * component so the notice and the stored purpose cannot drift apart — the Act
 * cares that consent was *informed*, and this is the evidence of what they were
 * informed of.
 */
export const PURPOSE_NOTICE: Record<ConsentPurpose, { label: string; detail: string }> = {
  DATA_PROCESSING: {
    label: 'Use my brief to find and contact matching studios',
    detail:
      'We share your brief — area, budget range, scope and style — with the studios you choose to enquire with. Without this we cannot introduce you to anyone.',
  },
  MARKETING_EMAIL: {
    label: 'Email me about my project and new studios',
    detail: 'Occasional email. You can stop it in one click from any message.',
  },
  MARKETING_WHATSAPP: {
    label: 'Message me on WhatsApp',
    detail: 'Updates about your enquiry and reminders. Reply STOP to end it.',
  },
  MARKETING_SMS: {
    label: 'Send me SMS updates',
    detail: 'Only where WhatsApp does not reach you.',
  },
  IMPORTED_LEAD: {
    label: 'Contact recorded from an earlier enquiry',
    detail:
      'Recorded when a contact reaches us from a source other than this site. The source is always stored with it.',
  },
};

/**
 * Purposes we ask for at the end of the quiz. Marketing is asked separately
 * and never bundled.
 */
export const QUIZ_PURPOSES: ConsentPurpose[] = [
  'DATA_PROCESSING',
  'MARKETING_EMAIL',
  'MARKETING_WHATSAPP',
];

/**
 * Nothing is granted by default. Ever.
 *
 * This constant exists so that turning a marketing purpose on by default
 * requires editing a line that says, in the name, that it should not be done.
 */
export const DEFAULT_GRANTED: Record<ConsentPurpose, boolean> = {
  DATA_PROCESSING: false,
  MARKETING_EMAIL: false,
  MARKETING_WHATSAPP: false,
  MARKETING_SMS: false,
  IMPORTED_LEAD: false,
};

/**
 * Is this purpose required in order to deliver the thing the person asked for?
 *
 * Only `DATA_PROCESSING` is — we cannot introduce someone to a studio without
 * passing on their brief. Marketing consent is never blocking, and building
 * the UI so that it *could* be is the mistake this function exists to prevent.
 */
export function isBlocking(purpose: ConsentPurpose): boolean {
  return purpose === 'DATA_PROCESSING';
}

export interface ConsentRecord {
  purpose: ConsentPurpose;
  granted: boolean;
  policyVersion: string;
  withdrawnAt?: Date | string | null;
}

/**
 * May we contact this person for this purpose, right now?
 *
 * Deliberately strict, and the strictness is the point — every one of these
 * conditions is a way a real platform ends up sending a message it had no
 * right to send:
 *
 *  - no record at all (silence is not consent)
 *  - a record that says no
 *  - a record that was withdrawn
 *  - a record given against an older policy than the one now in force
 */
export function mayContact(
  records: ConsentRecord[],
  purpose: ConsentPurpose,
  currentPolicy: string = POLICY_VERSION,
): boolean {
  const relevant = records.filter((r) => r.purpose === purpose);
  if (relevant.length === 0) return false;

  // The most recent record wins; a later "no" overrides an earlier "yes".
  const latest = relevant[relevant.length - 1];

  if (!latest.granted) return false;
  if (latest.withdrawnAt) return false;
  if (latest.policyVersion !== currentPolicy) return false;

  return true;
}

/**
 * Which purposes need re-asking because the notice has changed since they
 * agreed. Consent does not carry across a material change to what we said.
 */
export function needsRefresh(
  records: ConsentRecord[],
  currentPolicy: string = POLICY_VERSION,
): ConsentPurpose[] {
  const stale = new Set<ConsentPurpose>();
  for (const record of records) {
    if (record.granted && !record.withdrawnAt && record.policyVersion !== currentPolicy) {
      stale.add(record.purpose);
    }
  }
  return [...stale];
}

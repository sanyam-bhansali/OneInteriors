/**
 * The contact step — the last screen of the brief — and what it accepts.
 *
 * ## Why the number is asked here
 *
 * The owner's direction (29 Sep 2026): the brief takes the customer's name
 * and number, so the matches page can greet them and the expert call can be
 * booked without a form. The number is asked on the LAST screen rather than
 * the first — after four minutes they can see what they get for it, and the
 * notice has something concrete to refer to. docs/CUSTOMER-JOURNEY-PLAN.md §2.
 *
 * ## What the number is, and is not
 *
 * An unverified way to reach them about this brief. It is stored on the brief
 * (`contactPhone`), never on `User.phone`, which is unique and is an identity:
 * writing an unverified number there would let anyone claim someone else's.
 * It moves to the account only once verified.
 *
 * ## Consent
 *
 * The notice must be agreed to — it is the purpose without which we cannot
 * introduce them to anyone (`isBlocking('DATA_PROCESSING')`). WhatsApp
 * updates are separate, optional and never pre-ticked (DPDP: consent must be
 * specific and an affirmative act).
 *
 * Pure, so the screen validates as they type and the server action applies
 * exactly the same rules (CONTRIBUTING §9.5).
 */

import { normalisePhone } from '@/modules/studio/phone';
import { cleanName } from './steps';

export interface ContactInput {
  name: string;
  phone: string;
  /** Optional. Filled in from a Google sign-in when there was one. */
  email: string;
  /** The notice. Required. */
  agreed: boolean;
  /** WhatsApp updates about their matches. Optional, never pre-ticked. */
  whatsappUpdates: boolean;
}

export interface CleanContact {
  name: string;
  /** E.164, "+919876543210". */
  phone: string;
  email: string | null;
  whatsappUpdates: boolean;
}

export type ContactField = 'name' | 'phone' | 'email' | 'agreed';

export type ContactCheck =
  | { ok: true; value: CleanContact }
  | { ok: false; errors: Partial<Record<ContactField, string>> };

export const EMPTY_CONTACT: ContactInput = {
  name: '',
  phone: '',
  email: '',
  agreed: false,
  whatsappUpdates: false,
};

/** Deliberately loose: the address is optional, and a typo is theirs to fix. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Check the contact screen. Every refusal says what to do, in their terms —
 * "A 10-digit Indian mobile, please" was once read as an accusation by
 * somebody who had typed their number correctly with a leading zero.
 */
export function checkContact(input: ContactInput): ContactCheck {
  const errors: Partial<Record<ContactField, string>> = {};

  const name = cleanName(input.name);
  if (!name) errors.name = 'Tell us what to call you.';

  const phone = normalisePhone(input.phone);
  if (!input.phone.trim()) errors.phone = 'We need a mobile number to arrange your expert call.';
  else if (!phone) errors.phone = 'That does not look like an Indian mobile — check the number.';

  const rawEmail = input.email.trim();
  const email = rawEmail ? rawEmail.toLowerCase().slice(0, 254) : null;
  if (email && !EMAIL.test(email)) errors.email = 'Check the email address, or leave it empty.';

  if (!input.agreed) {
    errors.agreed =
      'We can only find your matches and arrange your call if you agree to this. Nothing is shared with a studio until you choose one.';
  }

  if (Object.keys(errors).length > 0 || !name || !phone) return { ok: false, errors };
  return { ok: true, value: { name, phone, email, whatsappUpdates: input.whatsappUpdates } };
}

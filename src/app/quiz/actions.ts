'use server';

/**
 * Quiz persistence and instrumentation.
 *
 * Both are **fire-and-forget from the client's point of view**. The quiz keeps
 * its own copy in React state and sessionStorage and never waits on these — a
 * slow database must not make the Continue button feel broken, and a failed
 * write costs a brief while a blocked click costs the customer.
 */

import { headers } from 'next/headers';
import {
  saveBrief as persistBrief,
  loadBrief as readBrief,
  saveContact,
} from '@/modules/brief/repository';
import { checkContact, type ContactField, type ContactInput } from '@/modules/brief/contact';
import { consume, addressOf, bucketFor, waitPhrase } from '@/modules/rate-limit/store';
import { hashIp } from '@/modules/auth/session';
import { record } from '@/modules/analytics/record';
import { recordConsent, type ConsentDecision } from '@/modules/consent/record';
import { QUIZ_PURPOSES, isBlocking, type ConsentPurpose } from '@/modules/consent/policy';
import type { Brief } from '@/modules/brief/types';
import type { EventName, EventProps } from '@/modules/analytics/events';

/** Persist the brief. Returns whether it actually reached Postgres. */
export async function saveBriefAction(brief: Brief): Promise<{ persisted: boolean }> {
  const result = await persistBrief(brief);
  return { persisted: result.persisted };
}

/**
 * Read the stored brief on first load.
 *
 * Returns null when there is nothing, so the client keeps whatever it has in
 * sessionStorage rather than being reset to empty by a server that simply does
 * not know about this browser yet.
 */
export async function loadBriefAction(): Promise<Brief | null> {
  const { brief, found } = await readBrief();
  return found ? brief : null;
}

export async function trackAction(name: EventName, props: EventProps = {}): Promise<void> {
  await record(name, props);
}

export type ConsentResult = { ok: true } | { ok: false; error: string };

/**
 * Record the consent decisions taken at the end of the quiz.
 *
 * The blocking purpose is checked server-side as well as in the UI. Under the
 * DPDP Act consent must be *unconditional* — we may not withhold the matches
 * because someone declined marketing — so the only thing that can be refused
 * here is the one purpose without which the service genuinely cannot happen.
 */
export async function recordQuizConsentAction(
  granted: ConsentPurpose[],
): Promise<ConsentResult> {
  const decisions: ConsentDecision[] = QUIZ_PURPOSES.map((purpose) => ({
    purpose,
    // A refusal is recorded as explicitly as an agreement — otherwise "they
    // said no" and "we never asked" become indistinguishable.
    granted: granted.includes(purpose),
  }));

  const blocking = decisions.filter((d) => isBlocking(d.purpose) && !d.granted);
  if (blocking.length > 0) {
    return {
      ok: false,
      error: 'We cannot introduce you to a studio without passing on your brief.',
    };
  }

  await recordConsent(decisions, 'quiz_consent_step');
  return { ok: true };
}

export type ContactResult =
  | { ok: true; persisted: boolean }
  | { ok: false; errors: Partial<Record<ContactField | 'form', string>> };

/**
 * Twenty an hour from one address.
 *
 * A household on one Wi-Fi re-submitting after a typo is a handful; a script
 * filling our database with other people's numbers is thousands. Keyed on a
 * hash of the address, never the address itself (CONTRIBUTING §7).
 */
const CONTACT_LIMIT = { max: 20, windowMs: 60 * 60 * 1000 };

/**
 * The last screen of the brief: their name, their number, and the notice.
 *
 * Order matters and is the point of this function: the same checks the
 * screen ran, then the consent rows, and only then the details written — so
 * there is never a number in our database without a recorded agreement
 * beside it. `checkContact` is pure and shared with the screen.
 */
export async function submitContactAction(
  brief: Brief,
  input: ContactInput,
): Promise<ContactResult> {
  const check = checkContact({
    name: String(input?.name ?? ''),
    phone: String(input?.phone ?? ''),
    email: String(input?.email ?? ''),
    agreed: input?.agreed === true,
    whatsappUpdates: input?.whatsappUpdates === true,
  });
  if (!check.ok) return { ok: false, errors: check.errors };

  const h = await headers();
  const verdict = await consume(
    bucketFor('contact', hashIp(addressOf(h.get('x-forwarded-for'))) ?? 'unknown'),
    CONTACT_LIMIT,
  );
  if (!verdict.allowed) {
    return {
      ok: false,
      errors: { form: `That is a lot of tries from one connection. Try again ${waitPhrase(verdict.retryInSeconds)}.` },
    };
  }

  await recordConsent(
    [
      { purpose: 'DATA_PROCESSING', granted: true },
      // Recorded either way: "they said no" and "we never asked" are different.
      { purpose: 'MARKETING_WHATSAPP', granted: check.value.whatsappUpdates },
    ],
    'quiz_contact_step',
  );

  const saved = await saveContact(brief, check.value);
  await record('quiz.contact.saved');
  return { ok: true, persisted: saved.persisted };
}

'use server';

/**
 * Quiz persistence and instrumentation.
 *
 * Both are **fire-and-forget from the client's point of view**. The quiz keeps
 * its own copy in React state and sessionStorage and never waits on these — a
 * slow database must not make the Continue button feel broken, and a failed
 * write costs a brief while a blocked click costs the customer.
 */

import { saveBrief as persistBrief, loadBrief as readBrief } from '@/modules/brief/repository';
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

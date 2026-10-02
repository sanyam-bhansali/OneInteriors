'use server';

/**
 * Quiz persistence and instrumentation.
 *
 * Both are **fire-and-forget from the client's point of view**. The quiz keeps
 * its own copy in React state and sessionStorage and never waits on these — a
 * slow database must not make the Continue button feel broken, and a failed
 * write costs a brief while a blocked click costs the customer.
 */

import { canReadInspiration, readableInspirationType, readInspirationPhoto } from '@/modules/inspiration/read';
import type { StylePick } from '@/modules/inspiration/reading';
import { headers } from 'next/headers';
import {
  saveBrief as persistBrief,
  loadBrief as readBrief,
  saveContact,
} from '@/modules/brief/repository';
import { checkContact, type ContactField, type ContactInput } from '@/modules/brief/contact';
import { consume, addressOf, bucketFor, waitPhrase } from '@/modules/rate-limit/store';
import { hashIp } from '@/modules/auth/session';
import { attachFloorPlan, societyPlanFor } from '@/modules/brief/repository';
import type { LibraryReading } from '@/modules/floorplan/society-library';
import { canReadPlans, readFloorPlan, readablePlanType } from '@/modules/floorplan/read';
import type { FloorPlanReading } from '@/modules/floorplan/reading';
import { floorPlanUploadEnabled, uploadFloorPlan } from '@/modules/storage/floor-plan';
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

export type PlanReadResult =
  | { ok: true; reading: FloorPlanReading; fileName: string }
  | { ok: false; error: string };

/** The most a plan can be: what fits in one request on Vercel. See next.config.ts. */
const PLAN_MAX_BYTES = 4 * 1024 * 1024;

/** Each read costs money. Eight an hour from one connection covers a family trying twice. */
const PLAN_LIMIT = { max: 8, windowMs: 60 * 60 * 1000 };

/**
 * Upload a floor plan, keep it privately, and read it.
 *
 * The reading comes back to the screen, not to the brief: the customer
 * confirms it ("We read: 3 BHK, 1,180 sq ft — right?") and only what they
 * confirm is saved. Storage failing does not stop the read; the read failing
 * says what to do instead. Every refusal is in their terms.
 */
export async function readFloorPlanAction(formData: FormData): Promise<PlanReadResult> {
  const file = formData.get('plan');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose your floor plan first — a PDF or a photo.' };
  }
  if (!readablePlanType(file.type)) {
    return { ok: false, error: 'That file type cannot be read. A PDF, JPG, PNG or WebP works.' };
  }
  if (file.size > PLAN_MAX_BYTES) {
    return {
      ok: false,
      error: 'That file is over 4 MB. A screenshot or a photo of the plan works just as well.',
    };
  }
  if (!canReadPlans()) {
    return {
      ok: false,
      error: 'Reading plans is not switched on here yet. Type your carpet area on the previous screen instead.',
    };
  }

  const h = await headers();
  const verdict = await consume(
    bucketFor('plan', hashIp(addressOf(h.get('x-forwarded-for'))) ?? 'unknown'),
    PLAN_LIMIT,
  );
  if (!verdict.allowed) {
    return { ok: false, error: `That is a lot of plans from one connection. Try again ${waitPhrase(verdict.retryInSeconds)}.` };
  }

  // Kept privately, where the expert and — only once chosen — the studio can see it.
  if (floorPlanUploadEnabled()) {
    const upload = await uploadFloorPlan(file);
    if (upload.ok) await attachFloorPlan(upload);
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
  const result = await readFloorPlan(base64, file.type);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === 'no-rooms'
          ? 'We could not find rooms on that — is it the floor plan? Try a clearer photo, or skip this.'
          : 'We could not read that plan just now. Try a clearer photo, or skip this and we will price a standard kitchen.',
    };
  }
  await record('quiz.plan.read');
  return { ok: true, reading: result.reading, fileName: file.name.slice(0, 120) };
}

// ── "A room you love" ───────────────────────────────────────────

export type InspirationReadResult =
  | { ok: true; picks: StylePick[] }
  | { ok: false; error: string };

const INSPIRATION_LIMIT = { max: 12, windowMs: 60 * 60 * 1000 };

/**
 * Which of our styles a photo shows (modules/inspiration). The photo goes to
 * the model for this one reading and is not stored. Rate-limited per
 * connection, like the plan reader, because each call is paid.
 */
export async function readInspirationAction(formData: FormData): Promise<InspirationReadResult> {
  const file = formData.get('photo');
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Choose a photo first.' };
  if (!readableInspirationType(file.type)) return { ok: false, error: 'A JPG, PNG or WebP photo works.' };
  if (file.size > PLAN_MAX_BYTES) return { ok: false, error: 'That photo is over 4 MB. A screenshot works just as well.' };
  if (!canReadInspiration()) return { ok: false, error: 'Reading photos is not switched on here yet — pick from the styles above.' };

  const h = await headers();
  const verdict = await consume(
    bucketFor('inspiration', hashIp(addressOf(h.get('x-forwarded-for'))) ?? 'unknown'),
    INSPIRATION_LIMIT,
  );
  if (!verdict.allowed) {
    return { ok: false, error: `That is a lot of photos from one connection. Try again ${waitPhrase(verdict.retryInSeconds)}.` };
  }

  const result = await readInspirationPhoto(Buffer.from(await file.arrayBuffer()).toString('base64'), file.type);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === 'not-interior'
          ? 'We could not see a room in that one. Try a photo of an interior.'
          : 'We could not read that photo just now. Pick from the styles above instead.',
    };
  }
  return { ok: true, picks: result.picks };
}

/** "Homes in your building have shared their plan" — the library's offer, when there is one. */
export async function societyPlanAction(society: unknown, propertyType: unknown): Promise<LibraryReading | null> {
  if (typeof society !== 'string' || typeof propertyType !== 'string' || society.length > 80) return null;
  return societyPlanFor(society, propertyType);
}

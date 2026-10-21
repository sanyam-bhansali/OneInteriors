import 'server-only';

/**
 * The public enquiry form: reading it, and taking a submission.
 *
 * ## The one file here with no session
 *
 * Every other read in `studio-practice` is scoped by the studio id from the
 * session, and `bridge.ts` is the documented exception that takes one as an
 * argument. This is the second exception and the more exposed of the two:
 * the caller is an anonymous stranger on the internet.
 *
 * What makes it safe is the shape of what it can do. It resolves a studio
 * from a public slug and creates ONE row of a known shape in that studio's
 * intake column. It cannot read a client, cannot list anything, cannot touch
 * another studio, and returns nothing about the studio beyond what the page
 * already displays.
 *
 * ## Creation is inline, alerts are not
 *
 * The webhook rule — ack in under five seconds, work afterwards — exists
 * because a provider retries on a slow response. There is no provider here;
 * there is a person watching a spinner, and telling them "received" before
 * the row exists would be a lie they could disprove by ringing the studio.
 * So the row is written in the request. AxLeads makes the same exception for
 * its hosted forms and says so.
 *
 * ## Why there is no email or WhatsApp alert yet
 *
 * There is nowhere honest to send one. `hello@oneinteriors.in` has no MX
 * record, and a studio's notification preferences do not exist. A submission
 * lands on the board and in the pool, which is where the studio is already
 * looking. Wiring an alert that silently fails would be worse than the
 * absence, because the absence is at least visible.
 */

import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/env';
import { consume, bucketFor, waitPhrase, type Limit } from '@/modules/rate-limit/store';
import { validate, type CaptureInput } from './capture-fields';
import { formAgainSummary } from '@/modules/studio-sales/intake-rules';
import { landLead } from './land';

/**
 * One person, hammering. Low, because a genuine enquirer submits once.
 */
export const PER_ADDRESS: Limit = { max: 5, windowMs: 60 * 60 * 1000 };

/**
 * One form, from everybody.
 *
 * Generous on purpose: tripping this refuses EVERYBODY, so it has to sit far
 * above anything a real studio could receive. Three hundred an hour is a
 * number no Pune interiors studio will reach honestly, and one a script will
 * reach in seconds.
 */
export const PER_FORM: Limit = { max: 300, windowMs: 60 * 60 * 1000 };

export interface PublicForm {
  studioId: string;
  studioName: string;
  slug: string;
  headline: string;
  blurb: string;
  active: boolean;
}

export type SubmitResult =
  | { status: 'ok' }
  /** Validation, with the field to focus. */
  | { status: 'invalid'; field: string; message: string }
  | { status: 'closed' }
  | { status: 'limited'; message: string }
  | { status: 'error'; message: string };

/**
 * The form behind a public slug, or null.
 *
 * Returns null for a studio that is not ACTIVE. A paused studio's link going
 * dead is the point of a pause — we stop sending them work, and that has to
 * include work they would have sent themselves through a link we host.
 */
export async function formBySlug(slug: string): Promise<PublicForm | null> {
  if (!hasDatabase()) return null;

  try {
    const row = await prisma.studioForm.findUnique({
      where: { slug },
      select: {
        studioId: true,
        slug: true,
        headline: true,
        blurb: true,
        active: true,
        studio: { select: { tradeName: true, status: true } },
      },
    });
    if (!row || row.studio.status !== 'ACTIVE') return null;

    return {
      studioId: row.studioId,
      studioName: row.studio.tradeName,
      slug: row.slug,
      headline: row.headline,
      blurb: row.blurb,
      active: row.active,
    };
  } catch (error) {
    console.error('[capture] form read failed', error);
    return null;
  }
}

/**
 * Take an enquiry.
 *
 * `address` comes from the request headers and is only ever used as a rate
 * limit key — it is not stored on the lead. An IP is personal data under the
 * DPDP Act and it tells a studio nothing they can act on.
 */
export async function submitEnquiry(
  slug: string,
  input: CaptureInput,
  address: string,
): Promise<SubmitResult> {
  const form = await formBySlug(slug);
  if (!form) return { status: 'closed' };
  if (!form.active) return { status: 'closed' };

  /* Validated BEFORE the limiter, so a person correcting a typo does not
     spend an attempt on each try. The honeypot is inside validate() and
     returns silently — see the note on CaptureVerdict for why a bot must be
     told it succeeded. */
  const checked = validate(input);
  if (!checked.ok) {
    if ('silent' in checked) return { status: 'ok' };
    return { status: 'invalid', field: checked.field, message: checked.message };
  }

  const byAddress = await consume(bucketFor('capture-ip', address), PER_ADDRESS);
  if (!byAddress.allowed) {
    return {
      status: 'limited',
      message: `That is a few enquiries in a short time. Try again ${waitPhrase(byAddress.retryInSeconds)}.`,
    };
  }

  const byForm = await consume(bucketFor('capture-form', form.studioId), PER_FORM);
  if (!byForm.allowed) {
    /* Deliberately vague to the visitor: "this studio is receiving a lot of
       enquiries" invites a retry loop, and the truth — that a script is
       hammering it — is not theirs to know. */
    return {
      status: 'limited',
      message: 'We could not take that just now. Please try again shortly.',
    };
  }

  try {
    /* One person, one lead, the pool and "Call them back" today: the same
       landing as every lead nobody typed (land.ts). */
    const landed = await landLead({
      studioId: form.studioId,
      lead: {
        name: checked.value.name,
        phone: checked.value.phone,
        email: checked.value.email,
        locality: checked.value.locality,
        config: checked.value.config,
        notes: checked.value.message,
      },
      /* WEBSITE, not OTHER. The whole reason ClientSource is an enum is so
         the analytics page can say which source closes, and a form
         submission lumped in with spreadsheet imports makes that number
         mean nothing. */
      source: 'WEBSITE',
      sourceNote: 'Enquiry form',
      how: 'your enquiry form',
      createdSummary: 'Came in through your enquiry form',
      againSummary: formAgainSummary(checked.value.message),
    });
    if (landed.kind === 'no-stage') return { status: 'error', message: 'We could not take that just now.' };
    return { status: 'ok' };
  } catch (error) {
    console.error('[capture] submit failed', error);
    return { status: 'error', message: 'We could not take that just now.' };
  }
}

// ── The studio's own side ────────────────────────────────────────

import { myStudioId } from '@/modules/studio-quote/store';

/**
 * This studio's form, created on first read.
 *
 * Same shape as the stage seeder: no migration step, and no moment where a
 * studio has an account but not the thing the screen is about.
 */
export async function myCaptureForm(): Promise<PublicForm | null> {
  const studioId = await myStudioId();
  if (!studioId) return null;

  try {
    const existing = await prisma.studioForm.findUnique({
      where: { studioId },
      select: {
        studioId: true,
        slug: true,
        headline: true,
        blurb: true,
        active: true,
        studio: { select: { tradeName: true } },
      },
    });

    if (existing) {
      return {
        studioId: existing.studioId,
        studioName: existing.studio.tradeName,
        slug: existing.slug,
        headline: existing.headline,
        blurb: existing.blurb,
        active: existing.active,
      };
    }

    const studio = await prisma.studio.findUnique({
      where: { id: studioId },
      select: { slug: true, tradeName: true },
    });
    if (!studio) return null;

    const created = await prisma.studioForm.create({
      data: {
        studioId,
        slug: studio.slug,
        headline: `Talk to ${studio.tradeName}`,
        blurb:
          'Tell us a little about your home and we will call you back. It takes under a minute.',
      },
      select: { slug: true, headline: true, blurb: true, active: true },
    });

    return {
      studioId,
      studioName: studio.tradeName,
      slug: created.slug,
      headline: created.headline,
      blurb: created.blurb,
      active: created.active,
    };
  } catch (error) {
    console.error('[capture] my form failed', error);
    return null;
  }
}

/** Turn the form on or off. The only setting worth one click. */
export async function setFormActive(active: boolean): Promise<{ ok: boolean }> {
  const studioId = await myStudioId();
  if (!studioId) return { ok: false };

  try {
    await prisma.studioForm.updateMany({ where: { studioId }, data: { active } });
    return { ok: true };
  } catch (error) {
    console.error('[capture] toggle failed', error);
    return { ok: false };
  }
}

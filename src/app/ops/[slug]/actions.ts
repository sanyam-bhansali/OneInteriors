'use server';

import { revalidatePath } from 'next/cache';
import {
  recordCheck,
  setGstin,
  setStudioStatus,
  setHiddenAsTest,
  type RecordResult,
} from '@/modules/verification/record';
import type { CheckResult, CheckType, StudioStatus } from '@/modules/studio/types';
import {
  reviewArchive,
  signedUrlForArchiveFile,
} from '@/modules/studio/quotation-archive-store';
import type { ArchiveState } from '@/modules/studio/quotation-archive';
import { after } from 'next/server';
import {
  approveRates,
  rejectRate,
  requestReanalysis,
  analyseArchive,
} from '@/modules/quotation/filed-rate-store';

/**
 * Thin wrappers. All authorisation, validation and audit logging live in
 * `record.ts` — these only translate form data and revalidate.
 *
 * Server actions are directly invocable by anyone who can guess the endpoint,
 * so none of them may assume the UI enforced anything.
 */

export async function recordCheckAction(
  _prev: RecordResult | null,
  formData: FormData,
): Promise<RecordResult> {
  const slug = String(formData.get('slug') ?? '');
  const result = await recordCheck({
    studioId: String(formData.get('studioId') ?? ''),
    type: String(formData.get('type') ?? '') as CheckType,
    result: String(formData.get('result') ?? '') as CheckResult,
    source: String(formData.get('source') ?? ''),
    notes: String(formData.get('notes') ?? ''),
  });

  if (result.ok && slug) {
    revalidatePath(`/ops/${slug}`);
    revalidatePath('/ops');
    // The public profile publishes these checks — it must not lag behind.
    revalidatePath(`/studios/${slug}`);
    revalidatePath('/studios');
    revalidatePath('/');
  }
  return result;
}

export async function setStatusAction(
  _prev: RecordResult | null,
  formData: FormData,
): Promise<RecordResult> {
  const slug = String(formData.get('slug') ?? '');
  const result = await setStudioStatus(
    String(formData.get('studioId') ?? ''),
    String(formData.get('status') ?? '') as StudioStatus,
    String(formData.get('reason') ?? ''),
  );

  if (result.ok && slug) {
    revalidatePath(`/ops/${slug}`);
    revalidatePath('/ops');
    revalidatePath(`/studios/${slug}`);
    revalidatePath('/studios');
    revalidatePath('/');
  }
  return result;
}

/**
 * Hide a test row, or put it back.
 *
 * Revalidates the same paths as a status change and for the same reason: the
 * roster, the home page and the studio's own profile all read a list this row
 * has just left or rejoined, and a cached page showing a hidden studio is the
 * exact failure this feature exists to prevent.
 */
export async function setHiddenAsTestAction(
  _prev: RecordResult | null,
  formData: FormData,
): Promise<RecordResult> {
  const slug = String(formData.get('slug') ?? '');
  const result = await setHiddenAsTest(
    String(formData.get('studioId') ?? ''),
    formData.get('hidden') === '1',
  );

  if (result.ok) {
    revalidatePath('/ops');
    revalidatePath('/studios');
    revalidatePath('/');
    if (slug) {
      revalidatePath(`/ops/${slug}`);
      revalidatePath(`/studios/${slug}`);
    }
  }
  return result;
}

/**
 * Ops records what they found in a studio's quotation archive.
 */
export async function reviewArchiveAction(
  _prev: RecordResult | null,
  formData: FormData,
): Promise<RecordResult> {
  const raw = String(formData.get('quotationCount') ?? '').trim();
  const parsed = raw === '' ? null : Number(raw);

  if (parsed !== null && !Number.isInteger(parsed)) {
    return { ok: false, error: 'The quotation count has to be a whole number, or blank.' };
  }

  const result = await reviewArchive(
    String(formData.get('archiveId') ?? ''),
    String(formData.get('state') ?? '') as ArchiveState,
    parsed,
    String(formData.get('note') ?? ''),
  );

  if (result.ok) {
    revalidatePath('/ops');
    // The studio's own rates step shows this state back to them, so it has to
    // be invalidated too — otherwise ops marks an archive rejected and the
    // studio keeps being told we are reading it.
    revalidatePath('/studio/onboarding/rates');
  }
  return result;
}

/**
 * Mint a five-minute link to one stored quotation file.
 *
 * Returns the URL to the caller rather than rendering it into the page: a
 * signed URL in the HTML sits there for anyone with the tab open, gets pasted
 * into bug reports, and survives in the cache. The role check is inside
 * `signedUrlForFile`, which is the single access boundary for that bucket.
 */
export async function openArchiveFileAction(fileId: string): Promise<string | null> {
  return signedUrlForArchiveFile(fileId);
}

export async function setGstinAction(
  _prev: RecordResult | null,
  formData: FormData,
): Promise<RecordResult> {
  const slug = String(formData.get('slug') ?? '');
  const result = await setGstin(
    String(formData.get('studioId') ?? ''),
    String(formData.get('gstin') ?? ''),
  );

  if (result.ok && slug) {
    revalidatePath(`/ops/${slug}`);
    revalidatePath(`/studios/${slug}`);
  }
  return result;
}


// ── Derived rates ──────────────────────────────────────────────

export type RateDecision = { ok: true; message: string } | { ok: false; error: string };

/**
 * Put an archive's derived rates into force.
 *
 * The whole set at once, because a half-approved archive prices a home from
 * two different readings — `approveRates` explains why that matters on a
 * screen whose entire purpose is comparing studios on identical lines.
 *
 * The role check lives in the store, not here. An action is a route by
 * another name and route handlers get added in a hurry; the guard belongs
 * next to the write it guards.
 */
export async function approveRatesAction(
  _prev: RateDecision | null,
  formData: FormData,
): Promise<RateDecision> {
  const result = await approveRates(String(formData.get('archiveId') ?? ''));
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath('/ops', 'layout');
  revalidatePath('/studio/onboarding', 'layout');
  /* The studio's own catalogue was filled from the same rates, so the page
     that shows it has to be refreshed too — otherwise a studio who happens to
     have their product master open sees the old blanks. */
  revalidatePath('/studio/products');
  revalidatePath('/studio/quotations', 'layout');

  return {
    ok: true,
    /* Two sentences, because approving does two things now and ops should be
       able to say which. The second is null when the product master could not
       be written, which is survivable — see `fillProductMaster`. */
    message: [
      `${result.live} ${result.live === 1 ? 'rate is' : 'rates are'} now live. Their quotes are built from these.`,
      result.catalogue,
    ]
      .filter(Boolean)
      .join(' '),
  };
}

/**
 * Refuse one derived rate, with a reason the studio reads.
 *
 * Per rate rather than per archive, because that is the shape of the
 * failures: nineteen good rates and a mandir read off three quotes, one of
 * which was for a temple room the size of a bedroom.
 */
export async function rejectRateAction(
  _prev: RateDecision | null,
  formData: FormData,
): Promise<RateDecision> {
  const result = await rejectRate(
    String(formData.get('rateId') ?? ''),
    String(formData.get('note') ?? ''),
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath('/ops', 'layout');
  revalidatePath('/studio/onboarding', 'layout');
  return { ok: true, message: 'Refused. The studio sees your note.' };
}


/**
 * Read an archive again.
 *
 * The work runs in `after()` because it is minutes, not seconds — twenty
 * documents through the extractor would time out the action and leave ops
 * looking at a failure that did not happen. `requestReanalysis` marks the
 * archive READING first so the screen changes on the press, and the state it
 * leaves behind is one that can simply be pressed again if the background
 * work never ran.
 *
 * `analyseArchive` never throws; its failures land in `analysisState`. The
 * catch is for an unhandled rejection reaching a serverless function, where
 * it would take the instance down with it.
 */
export async function reanalyseArchiveAction(
  _prev: RateDecision | null,
  formData: FormData,
): Promise<RateDecision> {
  const archiveId = String(formData.get('archiveId') ?? '');

  const result = await requestReanalysis(archiveId);
  if (!result.ok) return { ok: false, error: result.error };

  after(() => analyseArchive(archiveId).catch(() => {}));

  revalidatePath('/ops', 'layout');
  return {
    ok: true,
    message: 'Reading them again. Refresh in a minute or two — it carries on without you.',
  };
}

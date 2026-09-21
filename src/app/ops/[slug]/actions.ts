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

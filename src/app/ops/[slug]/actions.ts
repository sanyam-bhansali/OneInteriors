'use server';

import { revalidatePath } from 'next/cache';
import {
  recordCheck,
  setGstin,
  setStudioStatus,
  type RecordResult,
} from '@/modules/verification/record';
import type { CheckResult, CheckType, StudioStatus } from '@/modules/studio/types';

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

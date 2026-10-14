'use server';

import { revalidatePath } from 'next/cache';
import { applySetup, previewSetup, skipSetup } from '@/modules/studio/setup-quiz-store';

/**
 * "Set up your studio". Thin: the owner check, the plan and every write are
 * in setup-quiz-store.ts, which applies through the settings modules' own
 * functions (and their own permission checks).
 */

export async function previewSetupAction(answers: unknown) {
  return previewSetup(answers);
}

export async function applySetupAction(answers: unknown, ticked: unknown) {
  const r = await applySetup(answers, ticked);
  if (r.ok) {
    for (const p of ['/studio/home', '/studio/settings', '/studio/settings/sources', '/studio/settings/pipeline', '/studio/settings/payments', '/studio/settings/design', '/studio/clients', '/studio/quotations']) revalidatePath(p);
  }
  return r;
}

export async function skipSetupAction(answers: unknown) {
  const r = await skipSetup(answers);
  if (r.ok) revalidatePath('/studio/home');
  return r;
}

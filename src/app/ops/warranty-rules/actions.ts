'use server';

import { revalidatePath } from 'next/cache';
import { saveCoverageRule } from '@/modules/aftercare/coverage-ops';

/** The warranty's coverage rules. The OPS check is in the module. */
export async function saveRuleAction(id: string | null, fields: Record<string, string | boolean>): Promise<{ ok: boolean; message: string }> {
  const clean: Record<string, unknown> = {};
  for (const k of ['key', 'label', 'examples', 'covered', 'serviceCategory', 'sortOrder', 'clientNote', 'active']) {
    const v = fields?.[k];
    clean[k] = typeof v === 'string' ? v.slice(0, 700) : v;
  }
  const r = await saveCoverageRule(id ? String(id).slice(0, 64) : null, clean);
  if (r.ok) revalidatePath('/ops/warranty-rules');
  return r.ok ? { ok: true, message: r.message } : { ok: false, message: r.error };
}

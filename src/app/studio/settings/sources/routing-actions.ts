'use server';

import { revalidatePath } from 'next/cache';
import { saveConnectionRouting, saveLeadRouting } from '@/modules/studio-sales/settings';
import { saveConversionSettings } from '@/modules/studio-sales/conversions';
import type { Done } from '../../sales-types';

/**
 * Settings → Lead sources: "New leads go to" (studio and per door) and
 * "Tell Meta which leads turned into customers" (owner, 22 Oct 2026). The
 * modules check who may.
 */

export async function saveLeadRoutingAction(mode: string, personId: string, turnIds: string[]): Promise<Done> {
  const r = await saveLeadRouting({ mode, personId, turnIds: Array.isArray(turnIds) ? turnIds : [] });
  if (!r.ok) return r;
  revalidatePath('/studio/settings/sources');
  return { ok: true, message: mode === 'POOL' ? 'Saved. New leads land in the pool.' : 'Saved. The next new lead follows this.' };
}

export async function saveConnectionRoutingAction(connectionId: string, mode: string, personId: string): Promise<Done> {
  const r = await saveConnectionRouting(connectionId, { mode, personId });
  if (!r.ok) return r;
  revalidatePath('/studio/settings/sources');
  return { ok: true, message: 'Saved.' };
}

export async function saveMetaFeedbackAction(enabled: boolean, stages: Record<string, string>): Promise<Done> {
  const r = await saveConversionSettings({ enabled: enabled === true, stages });
  if (r.ok) revalidatePath('/studio/settings/sources');
  return r;
}

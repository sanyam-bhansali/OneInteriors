'use server';

import { revalidatePath } from 'next/cache';
import {
  createConnection,
  removeConnection,
  retryFailedLead,
  rotateKey,
  setConnectionEnabled,
  type IntakeResult,
} from '@/modules/studio-intake/connections';

/** Settings → Lead sources, "Leads that come in by themselves". The module checks who may. */

function refresh(r: IntakeResult): IntakeResult {
  if (r.ok) revalidatePath('/studio/settings/sources');
  return r;
}

export async function addConnectionAction(kind: string, label: string, metaPageId: string): Promise<IntakeResult> {
  return refresh(await createConnection({ kind, label, metaPageId }));
}

export async function rotateKeyAction(id: string): Promise<IntakeResult> {
  return refresh(await rotateKey(id));
}

export async function setConnectionEnabledAction(id: string, enabled: boolean): Promise<IntakeResult> {
  return refresh(await setConnectionEnabled(id, enabled === true));
}

export async function removeConnectionAction(id: string): Promise<IntakeResult> {
  return refresh(await removeConnection(id));
}

export async function retryLeadAction(eventId: string): Promise<IntakeResult> {
  const r = await retryFailedLead(eventId);
  if (r.ok) {
    revalidatePath('/studio/settings/sources');
    revalidatePath('/studio/clients');
    revalidatePath('/studio/today');
  }
  return r;
}

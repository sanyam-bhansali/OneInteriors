'use server';

import { revalidatePath } from 'next/cache';
import type { BackfillCursor, BackfillStep, BackfillTally } from '@/modules/studio-intake/intake';
import { campaignScreen, connectPage, saveCampaigns, type CampaignScreen, type ConnectResult } from '@/modules/studio-intake/meta-account';
import {
  backfillStep,
  releaseStep,
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

// ── Meta: Connect Facebook, campaigns, past leads (owner, 12 Nov 2026) ─

export async function connectPageAction(pageId: string): Promise<ConnectResult> {
  const r = await connectPage(pageId);
  if (r.ok) {
    revalidatePath('/studio/settings/sources');
    revalidatePath('/studio/settings/sources/meta');
  }
  return r;
}

export async function loadCampaignsAction(connectionId: string): Promise<CampaignScreen> {
  return campaignScreen(connectionId);
}

export async function saveCampaignsAction(connectionId: string, only: boolean, picked: { id: string; name: string }[]): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const r = await saveCampaigns(connectionId, only === true, picked);
  if (r.ok) revalidatePath('/studio/settings/sources');
  return r;
}

export async function backfillStepAction(connectionId: string, cursor: BackfillCursor | null): Promise<BackfillStep> {
  const r = await backfillStep(connectionId, cursor);
  if (r.ok && r.done) {
    revalidatePath('/studio/settings/sources');
    revalidatePath('/studio/clients');
  }
  return r;
}

export async function releaseStepAction(connectionId: string): Promise<{ ok: true; tally: BackfillTally; left: number } | { ok: false; error: string }> {
  const r = await releaseStep(connectionId);
  if (r.ok && r.left === 0) {
    revalidatePath('/studio/settings/sources');
    revalidatePath('/studio/clients');
  }
  return r;
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

'use server';

/**
 * Quotation requests (owner, 22 Oct 2026; docs/studio-os/QUOTE-REQUESTS.md):
 * the actions behind To build, the heads' Requests, the lead page's
 * "Request quotation" and Settings → Team → Quotations. Each hands untrusted
 * input to studio-quote/quote-requests.ts, which checks who is asking.
 * Only async functions are exported from here.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cancelRequest, finishRequest, reassignRequest, requestQuotation, saveBuilders, startRequest } from '@/modules/studio-quote/quote-requests';
import { TEAM_PATH } from '@/modules/studio/surfaces';
import type { Done } from '../../sales-types';

const REQUESTS = '/studio/quotations/requests';

function refresh(clientId?: string | null) {
  revalidatePath(REQUESTS);
  revalidatePath('/studio/quotations');
  if (clientId) revalidatePath(`/studio/clients/${clientId}`);
}

const id = (v: unknown) => (typeof v === 'string' ? v.slice(0, 64) : '');

/** "Request quotation" on the lead page. */
export async function requestQuotationAction(clientId: string, note: string): Promise<Done> {
  const r = await requestQuotation(id(clientId), typeof note === 'string' ? note : '');
  if (r.ok) refresh(id(clientId));
  return r;
}

/** "Open" on To build: the request is being built, and the builder opens on its draft. */
export async function startRequestAction(requestId: string): Promise<Done> {
  const r = await startRequest(id(requestId));
  if (!r.ok) return r;
  refresh();
  redirect(`/studio/quotations/${r.quoteId}`);
}

export async function finishRequestAction(requestId: string, clientId?: string): Promise<Done> {
  const r = await finishRequest(id(requestId));
  if (r.ok) refresh(clientId ? id(clientId) : null);
  return r;
}

export async function reassignRequestAction(requestId: string, memberId: string, clientId?: string): Promise<Done> {
  const r = await reassignRequest(id(requestId), id(memberId));
  if (r.ok) refresh(clientId ? id(clientId) : null);
  return r;
}

export async function cancelRequestAction(requestId: string, clientId?: string): Promise<Done> {
  const r = await cancelRequest(id(requestId));
  if (r.ok) refresh(clientId ? id(clientId) : null);
  return r;
}

/** Settings → Team → Quotations: "Who builds quotations". */
export async function saveBuildersAction(ids: string[]): Promise<Done> {
  const r = await saveBuilders(Array.isArray(ids) ? ids.map(id) : null);
  if (r.ok) {
    revalidatePath(TEAM_PATH);
    revalidatePath(REQUESTS);
  }
  return r;
}

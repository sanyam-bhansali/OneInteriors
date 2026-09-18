'use server';

import { revalidatePath } from 'next/cache';
import {
  addClient,
  updateClient,
  assignClients,
  logContact,
  binClients,
  restoreClients,
  eraseClients,
  type ClientSourceName,
  type LostReasonName,
} from '@/modules/studio-practice/clients';

// `State` and `IDLE` live in studio/form-state.ts. A 'use server'
// file may only export async functions — and Turbopack rejects even a
// type-only re-export here, so this import is for local use and
// callers take the type from form-state directly.
import type { State } from '../form-state';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

/**
 * Everything the studio's own fields sent, unprefixed.
 *
 * Custom fields post as `custom.society`, `custom.carpet_area_sqft` and so on.
 * The prefix is what keeps a studio from defining a field called "name" and
 * silently overwriting the client's name — the two namespaces never touch.
 */
function custom(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (k.startsWith('custom.') && typeof v === 'string') out[k.slice(7)] = v;
  }
  return out;
}

function refresh() {
  revalidatePath('/studio/clients');
  revalidatePath('/studio');
}

export async function addClientAction(_prev: State, form: FormData): Promise<State> {
  const result = await addClient({
    name: str(form, 'name'),
    phone: str(form, 'phone'),
    society: str(form, 'society'),
    config: str(form, 'config'),
    source: (str(form, 'source') || 'OTHER') as ClientSourceName,
    sourceNote: str(form, 'sourceNote'),
    nextAction: str(form, 'nextAction'),
    nextActionOn: str(form, 'nextActionOn'),
    custom: custom(form),
  });

  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

export async function updateClientAction(_prev: State, form: FormData): Promise<State> {
  const lostReason = (str(form, 'lostReason') || null) as LostReasonName | null;

  const result = await updateClient({
    id: str(form, 'id'),
    stageId: str(form, 'stageId') || undefined,
    lostReason,
    nextAction: str(form, 'nextAction') || null,
    nextActionOn: str(form, 'nextActionOn') || null,
    custom: custom(form),
  });

  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

/**
 * Move a client one column along. The whole interaction on a board.
 *
 * A move into a LOST column is refused here rather than in the module, because
 * one click cannot supply a reason and `updateClient` is right to insist on
 * one. The card's own form asks.
 */
export async function setStageAction(id: string, stageId: string): Promise<State> {
  const result = await updateClient({ id, stageId });
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

/**
 * Hand clients to somebody, or put them back in the pool.
 *
 * `null` for the member is a real choice, not a failure to choose — "this is
 * not mine any more" needs to be one click, or people keep work they have
 * stopped doing rather than admit it on a screen everyone can see.
 */
export async function assignAction(ids: string[], memberId: string | null): Promise<State> {
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: 'Nobody selected.' };

  const result = await assignClients(ids, memberId);
  if (!result.ok) return result;

  refresh();
  revalidatePath('/studio/clients/pool');
  return { ok: true };
}

/**
 * "I have just spoken to them."
 *
 * Separate from every other save because it is the only one that moves
 * `lastContactedAt`, and that column is what the quiet counts are built on. An
 * edit to a follow-up note is not evidence anybody called.
 */
export async function logContactAction(id: string): Promise<State> {
  const result = await logContact(id);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

function refreshBin() {
  refresh();
  revalidatePath('/studio/clients/bin');
}

/**
 * Delete, reversibly. Thirty days in the bin first.
 *
 * The module refuses this for anyone carrying a quotation or a project and
 * says whose — that message goes straight to the person, because "cannot
 * delete" without a name is a dead end on a screen full of names.
 */
export async function binAction(ids: string[]): Promise<State> {
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: 'Nothing selected.' };

  const result = await binClients(ids);
  if (!result.ok) return result;
  refreshBin();
  return { ok: true };
}

export async function restoreAction(ids: string[]): Promise<State> {
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: 'Nothing selected.' };

  const result = await restoreClients(ids);
  if (!result.ok) return result;
  refreshBin();
  return { ok: true };
}

/** Gone for good, now rather than in thirty days. Only ever from the bin. */
export async function eraseAction(ids: string[]): Promise<State> {
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: 'Nothing selected.' };

  const result = await eraseClients(ids);
  if (!result.ok) return result;
  refreshBin();
  return { ok: true };
}

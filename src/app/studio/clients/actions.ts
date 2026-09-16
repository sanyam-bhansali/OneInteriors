'use server';

import { revalidatePath } from 'next/cache';
import {
  addClient,
  updateClient,
  type ClientSourceName,
  type LostReasonName,
} from '@/modules/studio-practice/clients';

export type State = { ok: true } | { ok: false; error: string } | { idle: true };
export const IDLE: State = { idle: true };

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

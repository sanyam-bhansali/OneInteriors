'use server';

import { revalidatePath } from 'next/cache';
import {
  addSocietyNote,
  assignSocietyLeads,
  createSociety,
  mySocietyAccess,
  saveWing,
  setLeadWing,
  setSocietyHeat,
  setSocietyOwner,
  setSocietyPriority,
  updateSociety,
} from '@/modules/studio-practice/societies';
import { parsePossession, type Heat, type Priority } from '@/modules/studio-practice/society-rules';
import { SOCIETIES_PATH } from '@/modules/studio/surfaces';

export type SocietyFormState = { ok?: boolean; error?: string; message?: string; id?: string } | null;

const str = (f: FormData, k: string) => String(f.get(k) ?? '');
const NO_ACCESS = { error: 'Societies are part of the Max plan, and only for people who work leads.' };

function done(id?: string) {
  revalidatePath(SOCIETIES_PATH);
  if (id) revalidatePath(`${SOCIETIES_PATH}/${id}`);
}

export async function addSocietyAction(_: SocietyFormState, f: FormData): Promise<SocietyFormState> {
  const access = await mySocietyAccess();
  if (!access) return NO_ACCESS;
  const possession = str(f, 'possession') ? parsePossession(str(f, 'possession')) : null;
  if (str(f, 'possession') && !possession) return { error: 'Possession should be a month, e.g. 2027-03.' };
  const r = await createSociety(access, { name: f.get('name'), locality: f.get('locality'), builder: f.get('builder'), wings: f.get('wings'), possession });
  if (!r.ok) return { error: r.error };
  done(r.id);
  return { ok: true, id: r.id, message: r.linked ? `Added. ${r.linked} existing lead${r.linked === 1 ? '' : 's'} linked by name.` : 'Added.' };
}

export async function editSocietyAction(_: SocietyFormState, f: FormData): Promise<SocietyFormState> {
  const access = await mySocietyAccess();
  if (!access) return NO_ACCESS;
  const id = str(f, 'id');
  const r = await updateSociety(access, id, { name: f.get('name'), locality: f.get('locality'), builder: f.get('builder') });
  if (!r.ok) return { error: r.error };
  done(id);
  return { ok: true, message: r.linked ? `Saved. ${r.linked} lead${r.linked === 1 ? '' : 's'} linked by the new name.` : 'Saved.' };
}

export async function ownerAction(_: SocietyFormState, f: FormData): Promise<SocietyFormState> {
  const access = await mySocietyAccess();
  if (!access) return NO_ACCESS;
  const id = str(f, 'id');
  const r = await setSocietyOwner(access, id, str(f, 'owner') || null);
  if (!r.ok) return { error: r.error };
  done(id);
  return { ok: true, message: 'Owner changed.' };
}

const PRIORITIES = new Set(['P1', 'P2', 'P3']);
const HEATS = new Set(['HOT', 'WARM', 'COLD']);

export async function priorityAction(_: SocietyFormState, f: FormData): Promise<SocietyFormState> {
  const access = await mySocietyAccess();
  if (!access) return NO_ACCESS;
  const id = str(f, 'id');
  const v = str(f, 'priority');
  const r = await setSocietyPriority(access, id, PRIORITIES.has(v) ? (v as Priority) : null, f.get('reason'));
  if (!r.ok) return { error: r.error };
  done(id);
  return { ok: true, message: PRIORITIES.has(v) ? 'Priority set by hand.' : 'Priority back to automatic.' };
}

export async function heatAction(_: SocietyFormState, f: FormData): Promise<SocietyFormState> {
  const access = await mySocietyAccess();
  if (!access) return NO_ACCESS;
  const id = str(f, 'id');
  const v = str(f, 'heat');
  const r = await setSocietyHeat(access, id, HEATS.has(v) ? (v as Heat) : null, f.get('reason'));
  if (!r.ok) return { error: r.error };
  done(id);
  return { ok: true, message: HEATS.has(v) ? 'Set by hand for 30 days.' : 'Back to automatic, from the calls.' };
}

export async function noteAction(_: SocietyFormState, f: FormData): Promise<SocietyFormState> {
  const access = await mySocietyAccess();
  if (!access) return NO_ACCESS;
  const id = str(f, 'id');
  const r = await addSocietyNote(access, id, f.get('body'));
  if (!r.ok) return { error: r.error };
  done(id);
  return { ok: true, message: 'Note added.' };
}

export async function wingAction(_: SocietyFormState, f: FormData): Promise<SocietyFormState> {
  const access = await mySocietyAccess();
  if (!access) return NO_ACCESS;
  const id = str(f, 'id');
  const raw = str(f, 'possession');
  const possession = raw ? parsePossession(raw) : null;
  if (raw && !possession) return { error: 'Possession should be a month, e.g. 2027-03.' };
  const r = await saveWing(access, id, { wingId: str(f, 'wingId') || null, name: f.get('name'), flats: f.get('flats'), possession });
  if (!r.ok) return { error: r.error };
  done(id);
  return { ok: true, message: 'Wing saved.' };
}

export async function assignLeadsAction(_: SocietyFormState, f: FormData): Promise<SocietyFormState> {
  const access = await mySocietyAccess();
  if (!access) return NO_ACCESS;
  const id = str(f, 'id');
  const mode = str(f, 'mode');
  if (mode !== 'one' && mode !== 'split' && mode !== 'first') return { error: 'Pick how to give them out.' };
  const memberIds = mode === 'split' ? f.getAll('people').map(String) : [str(f, mode === 'first' ? 'firstTo' : 'oneTo')];
  const count = mode === 'first' ? Number(str(f, 'count') === 'other' ? str(f, 'countOther') : str(f, 'count')) : null;
  const r = await assignSocietyLeads(access, id, { mode, memberIds: memberIds.filter(Boolean), count, only: str(f, 'only') === 'all' ? 'all' : 'unassigned' });
  if (!r.ok) return { error: r.error };
  done(id);
  revalidatePath('/studio/clients');
  return { ok: true, message: r.message };
}

export async function leadWingAction(societyId: string, clientId: string, wingId: string | null): Promise<{ error?: string }> {
  const access = await mySocietyAccess();
  if (!access) return NO_ACCESS;
  const r = await setLeadWing(access, societyId, clientId, wingId);
  if (!r.ok) return { error: r.error };
  done(societyId);
  return {};
}

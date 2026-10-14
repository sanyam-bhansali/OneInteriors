'use server';

import { revalidatePath } from 'next/cache';
import { addCrewMember, setCrewActive, type CrewResult } from '@/modules/project/site-log-crew';

/**
 * Settings → Crew. Thin calls: the `crew.manage` check (owner and project
 * managers) is in site-log-crew.ts.
 */

async function done(r: Promise<CrewResult>): Promise<CrewResult> {
  try {
    const result = await r;
    if (result.ok) revalidatePath('/studio/settings/crew');
    return result;
  } catch (error) {
    console.error('[crew] action failed', error instanceof Error ? error.name : 'unknown');
    return { ok: false, error: 'That did not save. Try again.' };
  }
}

export async function addCrewAction(input: { name: string; role: string; phone: string }): Promise<CrewResult> {
  return done(addCrewMember(String(input.name ?? ''), String(input.role ?? ''), String(input.phone ?? '')));
}

export async function setCrewActiveAction(id: string, active: boolean): Promise<CrewResult> {
  return done(setCrewActive(String(id).slice(0, 64), active === true));
}

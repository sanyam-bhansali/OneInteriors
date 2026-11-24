'use server';

import { guarded, SAVE_FAILED } from '@/lib/action-guard';

import { revalidatePath } from 'next/cache';
import { myProfile, saveMyHomePrefs, type Profile } from '@/modules/studio/profile';
import type { HomePrefs } from '@/modules/studio/home-prefs';

/** The profile menu's contents, read when it opens (the signed-in member only). */
export async function myProfileAction(): Promise<Profile | null> {
  return guarded('myProfileAction', null, async () => {
  return myProfile();
});
}

/** Save the signed-in member's own home settings. */
export async function saveHomePrefsAction(prefs: HomePrefs): Promise<{ ok: true; prefs: HomePrefs } | { ok: false; error: string }> {
  return guarded('saveHomePrefsAction', { ok: false, error: SAVE_FAILED }, async () => {
  const r = await saveMyHomePrefs(prefs);
  if (r.ok) revalidatePath('/studio/home');
  return r;
});
}

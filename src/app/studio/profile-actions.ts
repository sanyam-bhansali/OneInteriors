'use server';

import { revalidatePath } from 'next/cache';
import { myProfile, saveMyHomePrefs, type Profile } from '@/modules/studio/profile';
import type { HomePrefs } from '@/modules/studio/home-prefs';

/** The profile menu's contents, read when it opens (the signed-in member only). */
export async function myProfileAction(): Promise<Profile | null> {
  return myProfile();
}

/** Save the signed-in member's own home settings. */
export async function saveHomePrefsAction(prefs: HomePrefs): Promise<{ ok: true; prefs: HomePrefs } | { ok: false; error: string }> {
  const r = await saveMyHomePrefs(prefs);
  if (r.ok) revalidatePath('/studio/home');
  return r;
}

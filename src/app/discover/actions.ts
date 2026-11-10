'use server';

import { loadBrief } from '@/modules/brief/repository';
import { readSaves, storeSaves } from '@/modules/discover/saves';
import { applyStyle } from '@/modules/discover/server';

/**
 * "Use this style in my Home Profile" (modules/discover/server.ts). Only for
 * a Home Profile we already hold; a new visitor carries the style into the
 * quiz on their own device instead (DiscoverClient).
 */
export async function applyDiscoverStyleAction(styles: unknown, studioIds: unknown): Promise<{ saved: boolean }> {
  return { saved: await applyStyle(styles, studioIds) };
}

/**
 * Keep this device's saves on the Home Profile, so the expert sees them before
 * the call and the phone app shows the same boards. Nothing is stored without
 * a Home Profile; the saves then stay on the device until there is one.
 *
 * Merge adds this device's saves to what is kept (from the app or another
 * browser); the Discover page itself replaces, so a removal sticks.
 */
export async function syncDiscoverSavesAction(saved: unknown, merge = false): Promise<{ stored: boolean }> {
  const { found, id } = await loadBrief();
  if (!found || !id) return { stored: false };
  const list = merge && Array.isArray(saved) ? [...(await readSaves(id)), ...saved] : saved;
  await storeSaves(id, list);
  return { stored: true };
}

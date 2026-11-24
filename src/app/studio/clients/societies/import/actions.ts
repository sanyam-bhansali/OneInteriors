'use server';

import { guarded, SAVE_FAILED } from '@/lib/action-guard';

import { revalidatePath } from 'next/cache';
import { importSocietySheet, mySocietyAccess, type SocietyImportResult } from '@/modules/studio-practice/societies';
import type { SocietyImportPayload } from '@/modules/studio-practice/society-import';
import { SOCIETIES_PATH } from '@/modules/studio/surfaces';

export async function importSocietySheetAction(payload: SocietyImportPayload): Promise<({ ok: true } & SocietyImportResult) | { ok: false; error: string }> {
  return guarded('importSocietySheetAction', { ok: false, error: SAVE_FAILED }, async () => {
  const access = await mySocietyAccess();
  if (!access) return { ok: false, error: 'Societies are part of the Max plan.' };
  const r = await importSocietySheet(access, payload);
  if (r.ok) {
    revalidatePath(SOCIETIES_PATH);
    revalidatePath('/studio/clients');
  }
  return r;
});
}

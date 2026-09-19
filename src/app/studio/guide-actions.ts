'use server';

/**
 * Skipping, and bringing it back.
 *
 * Nothing here can complete a step — a step is done when the studio has done
 * the thing, read from their own rows. This writes one boolean and returns
 * nothing the UI branches on, because a walkthrough must never be able to fail
 * the screen it sits on.
 */

import { revalidatePath } from 'next/cache';
import { setDismissed } from '@/modules/studio/guide-store';
import type { GuideId } from '@/modules/studio/guide';

export async function dismissGuideAction(guide: GuideId, dismissed: boolean): Promise<void> {
  await setDismissed(guide, dismissed);
  revalidatePath(guide === 'leads' ? '/studio/clients' : '/studio/quotations');
  revalidatePath('/studio');
}

'use server';

import { revalidatePath } from 'next/cache';
import { dismissAnnouncement } from '@/modules/studio/announcements';

/**
 * The studio has read an announcement.
 *
 * Returns null rather than a result: there is nothing useful to say back. It
 * succeeded and the banner is gone, or it failed and the banner is still
 * there to press again — and an error message about a dismissal is noise
 * about a thing that did not matter.
 */
export async function dismissAnnouncementAction(
  _prev: null,
  formData: FormData,
): Promise<null> {
  await dismissAnnouncement(String(formData.get('id') ?? ''));
  revalidatePath('/studio', 'layout');
  return null;
}

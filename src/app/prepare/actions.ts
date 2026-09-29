'use server';

import { savePrepRoom, type SavePrepResult } from '@/modules/prepare/prep';

/**
 * Room-board actions, for the boards on "Your home" (the /prepare page they
 * came from now redirects there; its floor-plan upload was the brief's own,
 * repeated, and went with it).
 *
 * Note what this does not take — a `briefId`. The brief is resolved from the
 * session or the anonymous cookie on the server every time, because an id in
 * a form field is a request to write to somebody else's brief.
 */
export async function saveRoomAction(
  roomKey: string,
  patch: { shuffle?: number; chosenOption?: number | null; note?: string; items?: string[] },
): Promise<SavePrepResult> {
  // No `revalidatePath` on success. The page holds this state in React and
  // re-rendering the server component underneath a half-typed note would take
  // the cursor out of the textarea.
  return savePrepRoom(roomKey, patch);
}

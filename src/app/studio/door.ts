import 'server-only';
import { redirect } from 'next/navigation';
import { currentMember } from '@/modules/studio/access';
import { doorFor } from '@/modules/studio/pilot';

/**
 * The door, asked by a page itself (owner, 24 Nov 2026). `app/studio/layout.tsx`
 * asks `doorFor` only when the layout renders, which an in-app link or Back
 * does not do: a designer who pressed Back on a Design Final landed on My
 * Quotations. A page that calls this sends anyone the door would not let in to
 * their home, on every navigation. `DoorGuard` does the same in the browser.
 *
 * Signed out, or no membership (an ops account looking in), passes: the layout
 * and the module layer decide those.
 */
export async function requireDoor(path: string): Promise<void> {
  const member = await currentMember();
  if (!member) return;
  const door = doorFor(member, path);
  if (door.kind === 'home') redirect(door.to);
}

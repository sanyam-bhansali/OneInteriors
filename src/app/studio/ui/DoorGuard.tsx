'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { doorFor } from '@/modules/studio/pilot';
import type { MemberRole } from '@/modules/studio/roles';

/**
 * The door on every in-app move (owner, 24 Nov 2026: a designer who opened a
 * Design Final and pressed Back landed on My Quotations, a screen that is not
 * theirs). `app/studio/layout.tsx` asks the door (`doorFor`) when it renders,
 * but a layout is not rendered again on in-app navigation, so a link or Back
 * inside the studio skipped it. This asks the same pure rule on every path
 * change and sends them home, exactly as the layout does on a full load.
 *
 * Still a sign, not the lock: what each screen reads and writes is decided in
 * the module layer. "Coming soon" screens are left to their own PilotGate.
 */
export function DoorGuard({ member }: { member: MemberRole }) {
  const path = usePathname() ?? '';
  const router = useRouter();
  useEffect(() => {
    if (!path.startsWith('/studio')) return;
    const door = doorFor(member, path);
    if (door.kind === 'home' && door.to !== path) router.replace(door.to);
  }, [member, path, router]);
  return null;
}

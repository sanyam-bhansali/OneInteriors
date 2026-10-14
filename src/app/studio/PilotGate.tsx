import { redirect } from 'next/navigation';
import { currentMember } from '@/modules/studio/access';
import type { PilotArea } from '@/modules/studio/pilot';
import { STUDIO_HOME, needsFullSoftware } from '@/modules/studio/surfaces';
import { ComingSoon } from './ComingSoon';

/**
 * The lock on each full-software section (owner, 14 Oct 2026;
 * modules/studio/pilot.ts). The studio layout is the door, but a layout is
 * not re-run on every in-app navigation, so each gated section's own layout
 * asks again whenever somebody enters it: in a studio without the full
 * software an owner or a salesperson sees the area's "coming soon", the
 * roles that need the full software go home (which tells them why). The
 * module layer (`can()`) refuses the reads and writes underneath as well.
 */
export async function PilotGate({ area, children }: { area: PilotArea; children: React.ReactNode }) {
  const member = await currentMember();
  if (member && member.fullSoftware === false) {
    if (needsFullSoftware(member.role)) redirect(STUDIO_HOME);
    return <ComingSoon area={area} />;
  }
  return <>{children}</>;
}

/** A section layout that is only the gate. */
export function gated(area: PilotArea) {
  return async function PilotLayout({ children }: { children: React.ReactNode }) {
    return <PilotGate area={area}>{children}</PilotGate>;
  };
}

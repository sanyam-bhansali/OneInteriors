/**
 * Settings → Team opens on every plan with more than one person (owner,
 * 21 Oct 2026): on Pro the owner adds salespeople (team-store.ts refuses the
 * full-software roles), on Max everyone; Pro Solo closes it at the door
 * (surfaces.ts `mayOpen`).
 */
export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return children;
}

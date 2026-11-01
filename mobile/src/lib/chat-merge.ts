/**
 * The chat screen's plain logic (1 Nov 2026), with no Expo or React Native
 * modules, so the website's test suite runs it (tests/mobile-logic.test.ts).
 */

export interface MergeMsg {
  id: string;
  mine: boolean;
  kind: string;
  body: string;
  pending?: boolean;
}

/**
 * New messages from the server joined to the ones on screen: anything already
 * shown is not added twice, and my own message coming back from the server
 * replaces the stand-in shown while it was sending.
 */
export function mergeFresh<M extends MergeMsg>(onScreen: M[], fromServer: M[]): M[] {
  const known = new Set(onScreen.filter((m) => !m.pending).map((m) => m.id));
  const fresh = fromServer.filter((m) => !known.has(m.id));
  const kept = onScreen.filter((m) => !m.pending || !fresh.some((f) => f.mine && f.kind === m.kind && f.body === m.body));
  return [...kept, ...fresh];
}

/** "98220 41736", as the design writes a mobile number; anything typed with +91 or a leading 0 is cut to the ten digits. */
export function spacedMobile(typed: string): string {
  const d = typed.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '').slice(0, 10);
  return d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d;
}

/** "0:42". */
export function clock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Where the home screen's "Do it now" goes for the lifecycle's one thing. */
export type OneThingTarget = { to: 'decision'; id: string } | { to: 'snags' } | { to: 'project' };

export function oneThingTarget(kind: string, decisions: { id: string; state: string }[]): OneThingTarget {
  if (kind === 'decide') {
    const d = decisions.find((x) => x.state === 'open' || x.state === 'due-soon');
    if (d) return { to: 'decision', id: d.id };
  }
  if (kind === 'confirm_snag' || kind === 'sign_off') return { to: 'snags' };
  return { to: 'project' };
}

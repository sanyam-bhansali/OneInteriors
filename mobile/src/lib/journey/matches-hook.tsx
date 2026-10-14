import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { call } from '../api';
import { useBrief } from '../brief';
import type { MatchesView } from './types';

/**
 * The brief's matches, fetched once and shared by Matches, Quote, Compare and
 * the Phone screen, so moving between them never waits (the website keeps
 * the same in useAppData). Refetched when the brief changes.
 */
type State = { status: 'idle' | 'loading' } | { status: 'ready'; view: MatchesView; key: string } | { status: 'error'; error: string };

interface Ctx {
  state: State;
  load: () => Promise<void>;
  /** The three studios the customer is looking at, in the tier they chose. */
  tier: 'essential' | 'premium' | 'luxury' | null;
  setTier: (tier: 'essential' | 'premium' | 'luxury') => void;
}

const MatchesContext = createContext<Ctx | null>(null);

export function MatchesProvider({ children }: { children: ReactNode }) {
  const { brief } = useBrief();
  const [state, setState] = useState<State>({ status: 'idle' });
  const [tier, setTier] = useState<Ctx['tier']>(null);
  const key = JSON.stringify(brief);

  /* `load` keeps one identity per brief, and a second call while one is in
     flight, or once this brief's answer is in, does nothing, so screens may
     call it from an effect freely. */
  const done = useRef<string | null>(null);
  const inFlight = useRef<string | null>(null);
  const load = useCallback(async () => {
    if (done.current === key || inFlight.current === key) return;
    inFlight.current = key;
    setState({ status: 'loading' });
    const res = await call<MatchesView>('POST', '/journey/matches', { brief });
    if (inFlight.current !== key) return;
    inFlight.current = null;
    if (res.ok) done.current = key;
    setState(res.ok ? { status: 'ready', view: res.data, key } : { status: 'error', error: res.error });
  }, [brief, key]);

  const value = useMemo(() => ({ state, load, tier, setTier }), [state, load, tier]);
  return <MatchesContext.Provider value={value}>{children}</MatchesContext.Provider>;
}

export function useMatches(): Ctx {
  const ctx = useContext(MatchesContext);
  if (!ctx) throw new Error('useMatches outside MatchesProvider');
  return ctx;
}

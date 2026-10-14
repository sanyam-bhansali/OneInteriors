import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { EMPTY_BRIEF, type Brief } from './brief-types';

/**
 * The brief being answered on this phone, before anyone has signed in.
 *
 * Kept under `oi.brief.v1`, the website's key (src/modules/brief/store.ts),
 * in the website's `Brief` shape, so it can be sent to the server as-is once
 * the customer verifies their number. Each answer is merged in and saved at
 * once, the way the website's `useBrief` (src/components/app/ui.tsx) does.
 * Unlike the website's sessionStorage copy it survives the app being closed:
 * on a phone, coming back tomorrow to finish is the normal case.
 */

const KEY = 'oi.brief.v1';

interface Ctx {
  brief: Brief;
  /** False until the stored brief has been read; screens wait for it. */
  ready: boolean;
  update: (patch: Partial<Brief>) => void;
  /** Forget the brief, e.g. once the server has it. */
  clear: () => void;
}

const BriefContext = createContext<Ctx>({ brief: EMPTY_BRIEF, ready: false, update: () => {}, clear: () => {} });

export function BriefProvider({ children }: { children: ReactNode }) {
  const [brief, setBrief] = useState<Brief>(EMPTY_BRIEF);
  const [ready, setReady] = useState(false);
  // The latest brief, so two answers given in one tick both land.
  const latest = useRef<Brief>(EMPTY_BRIEF);

  useEffect(() => {
    let live = true;
    void AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!live || !raw) return;
        // Merged over EMPTY_BRIEF so an older stored shape cannot leave a field undefined.
        const stored = { ...EMPTY_BRIEF, ...(JSON.parse(raw) as Partial<Brief>) };
        latest.current = stored;
        setBrief(stored);
      })
      .catch(() => {})
      .finally(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);

  const update = useCallback((patch: Partial<Brief>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setBrief(next);
    void AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const clear = useCallback(() => {
    latest.current = EMPTY_BRIEF;
    setBrief(EMPTY_BRIEF);
    void AsyncStorage.removeItem(KEY).catch(() => {});
  }, []);

  const value = useMemo(() => ({ brief, ready, update, clear }), [brief, ready, update, clear]);
  return <BriefContext.Provider value={value}>{children}</BriefContext.Provider>;
}

export function useBrief(): Ctx {
  return useContext(BriefContext);
}

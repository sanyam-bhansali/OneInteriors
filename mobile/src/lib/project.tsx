import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import { useAuth } from './auth';
import type { Project } from './types';

/**
 * The signed-in customer's project, shared by every tab. The last copy is
 * kept on the phone, so the latest update still shows on a site visit with
 * no signal; photos in it are signed links that expire, so they reload when
 * the phone is back online.
 */

const KEY = 'oi.project.v1';

type State =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'ready'; project: Project; stale: boolean; error: string | null };

interface Ctx {
  state: State;
  refreshing: boolean;
  refresh: () => Promise<void>;
}

const ProjectContext = createContext<Ctx | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { state: auth } = useAuth();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const res = await api.projects();
    setRefreshing(false);
    if (res.ok) {
      const project = res.data.projects[0];
      if (!project) {
        setState({ status: 'none' });
        await AsyncStorage.removeItem(KEY).catch(() => {});
        return;
      }
      setState({ status: 'ready', project, stale: false, error: null });
      await AsyncStorage.setItem(KEY, JSON.stringify(project)).catch(() => {});
      return;
    }
    // Offline: keep showing the last copy, marked as such.
    setState((prev) => (prev.status === 'ready' ? { ...prev, stale: true, error: res.error } : prev.status === 'loading' ? { status: 'none' } : prev));
  }, []);

  useEffect(() => {
    if (auth.status !== 'signed-in') return;
    let live = true;
    void (async () => {
      const raw = await AsyncStorage.getItem(KEY).catch(() => null);
      if (raw && live) {
        try {
          setState({ status: 'ready', project: JSON.parse(raw) as Project, stale: true, error: null });
        } catch {
          /* a bad copy is simply ignored */
        }
      }
      if (live) await refresh();
    })();
    return () => {
      live = false;
    };
  }, [auth.status, refresh]);

  const value = useMemo(() => ({ state, refreshing, refresh }), [state, refreshing, refresh]);
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): Ctx {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject outside ProjectProvider');
  return ctx;
}

/** Forget the phone's copy, on sign-out. */
export async function forgetProject(): Promise<void> {
  await AsyncStorage.removeItem(KEY).catch(() => {});
}

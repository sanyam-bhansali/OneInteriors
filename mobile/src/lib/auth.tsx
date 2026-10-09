import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type Me } from './api';
import { clearToken, readToken, writeToken } from './token';
import { forgetProject } from './project';
import { unregisterPush } from './push';

type State =
  | { status: 'loading' }
  | { status: 'signed-out' }
  /** A token we could not check — no signal. Kept, and retried. */
  | { status: 'offline'; error: string }
  | { status: 'signed-in'; user: Me };

interface Auth {
  state: State;
  /** Store a fresh token and load who it belongs to. */
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  retry: () => Promise<void>;
}

const AuthContext = createContext<Auth | null>(null);

/** Where the stored token, if any, leaves us. */
async function resolve(): Promise<State> {
  if (!(await readToken())) return { status: 'signed-out' };
  const me = await api.me();
  if (me.ok) return { status: 'signed-in', user: me.data.user };
  // Only a 401 means the token is dead. Anything else keeps it, so a phone on
  // a site visit with no signal does not sign its owner out.
  if (me.status === 401) {
    await clearToken();
    return { status: 'signed-out' };
  }
  return { status: 'offline', error: me.error };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  const load = useCallback(async () => setState(await resolve()), []);

  useEffect(() => {
    let live = true;
    void resolve().then((next) => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
  }, []);

  const value = useMemo<Auth>(
    () => ({
      state,
      signIn: async (token) => {
        await writeToken(token);
        await load();
      },
      signOut: async () => {
        await unregisterPush();
        await forgetProject();
        await api.signOut();
        await clearToken();
        setState({ status: 'signed-out' });
      },
      retry: async () => {
        setState({ status: 'loading' });
        await load();
      },
    }),
    [state, load],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth outside AuthProvider');
  return auth;
}

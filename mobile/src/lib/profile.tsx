import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import { useAuth } from './auth';
import type { Profile } from './types';

/**
 * The signed-in customer's home, Home Coins, expert and unread count
 * (`/api/app/v1/me`), shared by every screen. An older server sends only the
 * user, so every part falls back to something a screen can show.
 */

const EMPTY: Profile = { plan: null, home: null, coins: { balance: 0, streak: 0 }, expert: { name: 'Meera' }, unread: 0, locale: 'en' };

interface Ctx {
  profile: Profile;
  refresh: () => Promise<void>;
}

const ProfileContext = createContext<Ctx>({ profile: EMPTY, refresh: async () => {} });

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const [profile, setProfile] = useState<Profile>(EMPTY);

  const refresh = useCallback(async () => {
    const res = await api.profile();
    if (!res.ok) return;
    const d = res.data;
    setProfile({
      plan: d.plan ?? null,
      home: d.home ?? null,
      coins: d.coins ?? EMPTY.coins,
      expert: d.expert ?? EMPTY.expert,
      unread: d.unread ?? 0,
      locale: d.locale ?? 'en',
    });
  }, []);

  useEffect(() => {
    if (state.status !== 'signed-in') return;
    let live = true;
    void api.profile().then((res) => {
      if (!live || !res.ok) return;
      const d = res.data;
      setProfile({ plan: d.plan ?? null, home: d.home ?? null, coins: d.coins ?? EMPTY.coins, expert: d.expert ?? EMPTY.expert, unread: d.unread ?? 0, locale: d.locale ?? 'en' });
    });
    return () => {
      live = false;
    };
  }, [state.status]);

  const value = useMemo(() => ({ profile: state.status === 'signed-in' ? profile : EMPTY, refresh }), [profile, refresh, state.status]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): Ctx {
  return useContext(ProfileContext);
}

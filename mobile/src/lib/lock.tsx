import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Text, View } from 'react-native';
import { Button } from '../components/ui';
import { color, font } from './theme';

/**
 * Face ID or fingerprint to open the app (off by default; switched on in
 * Settings). Asked when the app opens and when it comes back after five
 * minutes away, because the app holds photos of the inside of a home.
 */

const KEY = 'oi.lock';
const AWAY_MS = 5 * 60_000;

export async function lockEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY).catch(() => null)) === '1';
}

export async function setLock(on: boolean): Promise<boolean> {
  if (on) {
    const ok = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
    if (!ok) return false;
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Turn on the lock' });
    if (!r.success) return false;
  }
  await AsyncStorage.setItem(KEY, on ? '1' : '0').catch(() => {});
  return true;
}

export function LockGate({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(false);
  const away = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Open One Interiors' });
    if (r.success) setLocked(false);
  }, []);

  useEffect(() => {
    void lockEnabled().then((on) => {
      if (on) {
        setLocked(true);
        void unlock();
      }
    });
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') away.current = Date.now();
      if (s === 'active' && away.current && Date.now() - away.current > AWAY_MS) {
        void lockEnabled().then((on) => {
          if (on) {
            setLocked(true);
            void unlock();
          }
        });
      }
    });
    return () => sub.remove();
  }, [unlock]);

  if (!locked) return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: color.dark, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 24 }}>
      <Text style={{ fontFamily: font.sansSemi, fontSize: 28, color: color.onDark, letterSpacing: -1 }}>One Interiors is locked</Text>
      <Button label="Unlock" onPress={() => void unlock()} />
    </View>
  );
}

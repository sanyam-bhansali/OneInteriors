import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * The session token, in the device keychain (iOS) or keystore (Android).
 *
 * It is a bearer credential for someone's budget, address area and phone
 * number, so it never goes in AsyncStorage. The web build exists only for
 * previewing screens on a computer; it keeps the token for the tab's
 * lifetime and no longer.
 */
const KEY = 'oi.session';

let webToken: string | null = null;

/*
 * The sample build's web preview keeps its pretend sign-in for the browser
 * tab, so a reload does not throw the reviewer back to Welcome. Its token is
 * the word "sample" and opens nothing on a server. Real builds never do this.
 */
const keepOnWeb = process.env.EXPO_PUBLIC_SAMPLE === '1';
const tab = (): Storage | null => {
  try {
    return keepOnWeb && typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
};

export async function readToken(): Promise<string | null> {
  if (Platform.OS === 'web') return webToken ?? tab()?.getItem(KEY) ?? null;
  return SecureStore.getItemAsync(KEY);
}

export async function writeToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    webToken = token;
    tab()?.setItem(KEY, token);
    return;
  }
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearToken(): Promise<void> {
  if (Platform.OS === 'web') {
    webToken = null;
    tab()?.removeItem(KEY);
    return;
  }
  await SecureStore.deleteItemAsync(KEY);
}

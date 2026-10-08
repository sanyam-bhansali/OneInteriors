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

export async function readToken(): Promise<string | null> {
  if (Platform.OS === 'web') return webToken;
  return SecureStore.getItemAsync(KEY);
}

export async function writeToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    webToken = token;
    return;
  }
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearToken(): Promise<void> {
  if (Platform.OS === 'web') {
    webToken = null;
    return;
  }
  await SecureStore.deleteItemAsync(KEY);
}

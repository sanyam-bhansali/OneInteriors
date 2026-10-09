import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { api } from './api';

/**
 * Push notifications (docs/CUSTOMER-PLATFORM-PLAN.md): ask once after
 * sign-in, hand Expo's token to our server, and open the right screen when
 * one is tapped. The server decides what to send (src/modules/notify).
 */

const TOKEN_KEY = 'oi.push-token';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** Register this phone for push. Quietly does nothing on a simulator, without permission, or before an EAS project exists. */
export async function registerForPush(): Promise<void> {
  if (!Device.isDevice) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Project updates',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#ba5329',
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return;
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const res = await api.registerDevice(token, Platform.OS === 'ios' ? 'ios' : 'android');
    if (res.ok) await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    /* no push this time; the next sign-in tries again */
  }
}

/** On sign-out: this phone stops receiving the account's notifications. */
export async function unregisterPush(): Promise<void> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
  if (token) await api.removeDevice(token);
  await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
}

/** A notification's web path (from the server) as a screen in this app. */
export function routeFor(url: string | undefined): Href | null {
  if (!url) return null;
  const [path, query = ''] = url.split('?');
  const id = new URLSearchParams(query).get('id');
  switch (path) {
    case '/app/site':
      return '/site';
    case '/app/snags':
      return '/snags';
    case '/app/locker':
      return '/locker';
    case '/app/decision':
      return id ? { pathname: '/decision/[id]', params: { id } } : '/home';
    default:
      return path?.startsWith('/app') ? '/home' : null;
  }
}

/** Opens the screen a tapped notification points at, including the one that launched the app. */
export function useNotificationRouting(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const open = (r: Notifications.NotificationResponse | null) => {
      const href = routeFor((r?.notification.request.content.data as { url?: string } | undefined)?.url);
      if (href) router.push(href);
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [enabled]);
}

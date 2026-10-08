import Constants from 'expo-constants';

/**
 * Where the API lives.
 *
 * Set `EXPO_PUBLIC_API_URL` for a real build (https://oneinteriors.in once
 * the marketplace is open, a preview URL before). In development without it,
 * the app talks to the Next dev server on the same computer that is serving
 * the bundle — the host Expo already knows — on port 3100, which is the
 * worktree's `customer-fixtures` preview.
 */
export function apiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:3100`;
}

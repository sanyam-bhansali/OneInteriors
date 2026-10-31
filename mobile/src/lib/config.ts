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

/**
 * Only the project app (owner, 1 Nov 2026): Hauspire's clients first, the
 * choosing journey later. `EXPO_PUBLIC_PROJECTS_ONLY=1` in the build profile
 * (eas.json): the app opens on sign-in (mobile number and the password the
 * studio gave), never on the welcome and quiz, matching the website's
 * `CUSTOMER_PROJECTS_LIVE`.
 */
export function projectsOnly(): boolean {
  return process.env.EXPO_PUBLIC_PROJECTS_ONLY === '1';
}

/**
 * The language the customer reads the app in. Pure, and tested.
 *
 * `User.locale` was created with the default "en-IN" before the app had any
 * other language; from now on it stores exactly what the app sends — "en",
 * "hi" or "mr". Reading tolerates both, so no backfill is needed: anything
 * that is not Hindi or Marathi reads as English.
 */

export const APP_LOCALES = ['en', 'hi', 'mr'] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (APP_LOCALES as readonly string[]).includes(value);
}

export function appLocale(stored: string | null | undefined): AppLocale {
  const lang = (stored ?? '').toLowerCase().split(/[-_]/)[0];
  return lang === 'hi' || lang === 'mr' ? lang : 'en';
}

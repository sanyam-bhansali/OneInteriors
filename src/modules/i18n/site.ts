/**
 * The website's language (owner, 9 Oct 2026: "when the language is selected
 * the language should change for all the pages").
 *
 * One choice for the website and the app: the same `oa.lang` key, kept in a
 * cookie so server-rendered pages can read it, and in localStorage for the
 * app's older screens. English, Hindi or Marathi.
 *
 * FIRST DRAFT. The Hindi and Marathi in the `site/` dictionaries need a native
 * speaker's review before launch. Keep them plain and everyday, as a family in
 * Pune speaks; studio names, style names, Essential / Premium / Luxury, GEIO,
 * GST and rupee figures stay as they are.
 */

import type { Lang } from '@/modules/app/i18n-dict';

export type { Lang } from '@/modules/app/i18n-dict';
export { LANGS } from '@/modules/app/i18n-dict';

export const LANG_COOKIE = 'oa.lang';

export function asLang(v: string | null | undefined): Lang {
  return v === 'hi' || v === 'mr' ? v : 'en';
}

/** One phrase in all three languages. */
export type Tx = Record<Lang, string>;

/** The phrase in this language, `{name}` placeholders filled. English when one is missing. */
export function tx(lang: Lang, entry: Tx, vars: Record<string, string | number> = {}): string {
  const text = entry[lang] || entry.en;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** `const t = translator(lang, DICT); t('hero.h1')`. */
export function translator<D extends Record<string, Tx>>(lang: Lang, dict: D) {
  return (key: keyof D, vars?: Record<string, string | number>) => tx(lang, dict[key], vars);
}

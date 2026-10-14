import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DICT, LANGS, type Lang } from './i18n-dict';
import { NATIVE } from './strings';
import type { Entry } from './strings/entry';

/**
 * The app's language: English, हिंदी or मराठी (COPY-AND-LANGUAGES.md),
 * picked on Welcome or in Me and kept on the phone under the website's
 * `oa.lang` name. Screens call `useT()`. Hindi and Marathi are a first
 * draft that Sanyam reviews before launch.
 */

export type { Lang };
export { LANGS };

const KEY = 'oa.lang';
const WORDS: Record<string, Entry> = { ...DICT, ...NATIVE };

export type Key = keyof typeof DICT | keyof typeof NATIVE;
export type T = (key: Key, vars?: Record<string, string | number>) => string;

/** The phrase in `lang`, placeholders filled; English when a language lacks one. */
export function translate(lang: Lang, key: Key, vars: Record<string, string | number> = {}): string {
  const entry = WORDS[key];
  if (!entry) return key;
  const text = entry[lang] || entry.en;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

interface Ctx {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: T;
}

const LangContext = createContext<Ctx>({ lang: 'en', setLang: () => {}, t: (k, v) => translate('en', k, v) });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, set] = useState<Lang>('en');
  useEffect(() => {
    void AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === 'hi' || v === 'mr') set(v);
      })
      .catch(() => {});
  }, []);
  const setLang = useCallback((next: Lang) => {
    set(next);
    void AsyncStorage.setItem(KEY, next).catch(() => {});
  }, []);
  const value = useMemo<Ctx>(() => ({ lang, setLang, t: (k, v) => translate(lang, k, v) }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): Ctx {
  return useContext(LangContext);
}

export function useT(): T {
  return useContext(LangContext).t;
}

/** Headlines drop from 40 to 34 px in Hindi and Marathi, so they fit without clipping. */
export function useHeadline(en = 40): number {
  return useContext(LangContext).lang === 'en' ? en : Math.round(en * 0.85);
}

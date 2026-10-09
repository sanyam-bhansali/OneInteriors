'use client';

/**
 * The app's language: English, हिंदी or मराठी, chosen on Welcome or in Me
 * and kept on this device. Screens call `useT()`; GEIO starts in the same
 * language.
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { LANGS, translate, type Key, type Lang } from '@/modules/app/i18n-dict';

const KEY = 'oa.lang';
const EVENT = 'oa-lang';

function read(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'hi' || v === 'mr' ? v : 'en';
  } catch {
    return 'en';
  }
}

function subscribe(fn: () => void) {
  window.addEventListener(EVENT, fn);
  window.addEventListener('storage', fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener('storage', fn);
  };
}

export function setLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* storage blocked: this visit only */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useLang(): Lang {
  const lang = useSyncExternalStore(subscribe, read, () => 'en' as Lang);
  useEffect(() => {
    document.documentElement.lang = lang === 'en' ? 'en-IN' : lang;
  }, [lang]);
  return lang;
}

/** `t('welcome.h1')`, `t('q.meta', { n: 2, of: 7 })`. */
export function useT() {
  const lang = useLang();
  return useCallback((key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
}

/** English · हिंदी · मराठी, as on Welcome and in Me. */
export function LangPicker({ dark = false }: { dark?: boolean }) {
  const lang = useLang();
  return (
    <div className={`oa-langs${dark ? ' dark' : ''}`} role="radiogroup" aria-label="Language">
      {LANGS.map((l) => (
        <button key={l.id} type="button" role="radio" aria-checked={lang === l.id} lang={l.id} onClick={() => setLang(l.id)}>
          {l.label}
        </button>
      ))}
    </div>
  );
}

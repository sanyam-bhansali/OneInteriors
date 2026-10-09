'use client';

/**
 * The app's language: English, हिंदी or मराठी, chosen on Welcome or in Me
 * and kept on this device. Screens call `useT()`; GEIO starts in the same
 * language.
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { LANGS, translate, type Key, type Lang } from '@/modules/app/i18n-dict';
import { LANG_COOKIE, asLang, tx, type Tx } from '@/modules/i18n/site';

const KEY = 'oa.lang';
const EVENT = 'oa-lang';

/* The cookie first: it is what the server rendered with, so reading it keeps
   the page and the server in step. localStorage is the app's older home for
   the choice, and is copied into the cookie the first time it is found. */
function cookieLang(): string | null {
  const hit = document.cookie.split('; ').find((c) => c.startsWith(`${LANG_COOKIE}=`));
  return hit ? hit.slice(LANG_COOKIE.length + 1) : null;
}

function writeCookie(lang: Lang) {
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
}

function read(): Lang {
  const fromCookie = cookieLang();
  if (fromCookie) return asLang(fromCookie);
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'hi' || v === 'mr') {
      writeCookie(v);
      return v;
    }
  } catch {
    /* storage blocked */
  }
  return 'en';
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
  writeCookie(lang);
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

/** `const t = useSiteT(DICT); t('hero.h1')` — a website dictionary in the chosen language. */
export function useSiteT<D extends Record<string, Tx>>(dict: D) {
  const lang = useLang();
  return useCallback((key: keyof D, vars?: Record<string, string | number>) => tx(lang, dict[key], vars), [lang, dict]);
}

/**
 * English · हिंदी · मराठी for the website. Server-rendered pages read the
 * choice from the cookie, so they are re-rendered after it changes.
 */
export function SiteLangPicker({ onPick, className = '' }: { onPick?: (lang: Lang) => void; className?: string }) {
  const lang = useLang();
  const router = useRouter();
  return (
    <div className={`oi-langs ${className}`} role="radiogroup" aria-label="Language / भाषा">
      {LANGS.map((l) => (
        <button
          key={l.id}
          type="button"
          role="radio"
          aria-checked={lang === l.id}
          lang={l.id}
          onClick={() => {
            setLang(l.id);
            onPick?.(l.id);
            router.refresh();
          }}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

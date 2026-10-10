'use client';

/**
 * "Listen" — the browser reads a summary aloud, for the parent or partner who
 * would rather hear it than read it (plan §17.1). The device's own speech
 * engine, so it costs nothing and nothing leaves the phone.
 *
 * Shown only where the browser can actually speak, and in the text's own
 * language — a Hindi summary read by an English voice is worse than none.
 */

import { useEffect, useState } from 'react';
import type { Language } from '@/modules/brief/types';
import { useLang } from '@/components/app/i18n';
import { tx } from '@/modules/i18n/site';

const LISTEN = { en: 'Listen', hi: 'सुनिए', mr: 'ऐका' };
const STOP = { en: 'Stop', hi: 'रोकें', mr: 'थांबवा' };

const VOICE_LANG: Record<Language, string> = { EN: 'en-IN', HI: 'hi-IN', MR: 'mr-IN' };
const SITE_TO_LANGUAGE = { en: 'EN', hi: 'HI', mr: 'MR' } as const;

/**
 * The most human voice this device has for the language (owner, 10 Oct 2026:
 * "this seems to be too robotic").
 *
 * The first voice the browser lists is usually the oldest, most mechanical
 * one — on Windows, "Microsoft Heera". The neural voices (Edge's "… Online
 * (Natural)", Chrome's "Google …", Apple's "Enhanced"/"Premium") sound like a
 * person, so they are preferred, then an exact accent match. English falls
 * back to a natural British or American voice before a robotic Indian one.
 */
function bestVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const base = lang.slice(0, 2);
  const score = (v: SpeechSynthesisVoice) => {
    const name = v.name.toLowerCase();
    let s = 0;
    if (/natural|neural|online|premium|enhanced|siri/.test(name)) s += 100;
    else if (name.startsWith('google')) s += 60;
    if (v.lang.replace('_', '-') === lang) s += 30;
    else if (v.lang.startsWith(base)) s += 10;
    if (/female|neerja|swara|aarohi|heera|kalpana/.test(name)) s += 2;
    return s;
  };
  const sameLanguage = voices.filter((v) => v.lang.startsWith(base));
  if (sameLanguage.length === 0) return null;
  return [...sameLanguage].sort((a, b) => score(b) - score(a))[0];
}

export function Listen({ text, language }: { text: string; language?: Language }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  /* The page's language when the caller does not say — the text on a card
     is written in the language the visitor chose. */
  const siteLang = useLang();
  const spoken = language ?? SITE_TO_LANGUAGE[siteLang];

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    setSupported(true);
    // Voices arrive late in Chrome and Edge; the natural ones especially.
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  if (!supported || !text) return null;

  return (
    <button
      type="button"
      onClick={() => {
        const synth = window.speechSynthesis;
        if (speaking) {
          synth.cancel();
          setSpeaking(false);
          return;
        }
        const u = new SpeechSynthesisUtterance(text);
        u.lang = VOICE_LANG[spoken];
        const voice = bestVoice(voices.length ? voices : synth.getVoices(), u.lang);
        if (voice) {
          u.voice = voice;
          u.lang = voice.lang;
        }
        // A natural voice already paces itself; the old ones need slowing a touch.
        u.rate = voice && /natural|neural|online|premium|enhanced/i.test(voice.name) ? 1 : 0.92;
        u.pitch = 1;
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
        synth.cancel();
        synth.speak(u);
        setSpeaking(true);
      }}
      aria-pressed={speaking}
      className="min-h-11 cursor-pointer rounded-full border border-[var(--line)] bg-transparent px-4 py-2 text-[13.5px] font-semibold text-[var(--ink)] hover:border-[var(--ink2)] print:hidden"
    >
      {speaking ? `■ ${tx(siteLang, STOP)}` : `▶ ${tx(siteLang, LISTEN)}`}
    </button>
  );
}

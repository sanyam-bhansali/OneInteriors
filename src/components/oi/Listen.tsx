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

const VOICE_LANG: Record<Language, string> = { EN: 'en-IN', HI: 'hi-IN', MR: 'mr-IN' };

export function Listen({ text, language = 'EN' }: { text: string; language?: Language }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
    return () => {
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
        u.lang = VOICE_LANG[language];
        const voice = synth.getVoices().find((v) => v.lang === u.lang) ?? synth.getVoices().find((v) => v.lang.startsWith(u.lang.slice(0, 2)));
        if (voice) u.voice = voice;
        u.rate = 0.95;
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
        synth.cancel();
        synth.speak(u);
        setSpeaking(true);
      }}
      aria-pressed={speaking}
      className="min-h-11 cursor-pointer rounded-full border border-[var(--line)] bg-transparent px-4 py-2 text-[13.5px] font-semibold text-[var(--ink)] hover:border-[var(--ink2)]"
    >
      {speaking ? '■ Stop' : '▶ Listen'}
    </button>
  );
}

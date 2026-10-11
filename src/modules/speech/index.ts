/**
 * The speech adapter (studio workspace Phase 2; brief §8.1: provider not
 * chosen). One entry point, `listen`, that the site screens' speech route
 * and the offline catch-up in site-log.ts both call.
 *
 * ## Which provider
 *
 * `SPEECH_PROVIDER` env:
 * - `fake` — the canned provider (fake.ts). The default in development and
 *   tests.
 * - unset in production — none. Voice notes are still recorded and kept;
 *   the customer simply gets no sentence under that photo until a provider
 *   is switched on. A canned sentence must never reach a real customer.
 * - any other name — the real-provider slot (`REAL_PROVIDERS`), empty until
 *   the owner chooses one (Marathi, Hindi and English transcription, plus a
 *   model that writes the customer sentence). Add it there; nothing else
 *   changes.
 */

import { fakeSpeech } from './fake';
import { customerSentence, suggestTicks } from './rules';
import type { AudioSource, SentenceContext, SpeechLang, SpeechProvider, TickItem } from './types';

export type { AudioSource, SentenceContext, SpeechLang, SpeechProvider, TickItem, Transcript } from './types';
export { asSpeechLang } from './types';
export { customerSentence, isSafeSentence, neutralSentence, suggestTicks } from './rules';

/** The real providers, by `SPEECH_PROVIDER` name. Empty until the owner chooses (brief §8.1). */
const REAL_PROVIDERS: Record<string, () => SpeechProvider> = {};

export function speechProvider(env: Record<string, string | undefined> = process.env): SpeechProvider | null {
  const name = env.SPEECH_PROVIDER?.trim().toLowerCase() || '';
  if (name === 'fake') return fakeSpeech;
  if (!name) return env.NODE_ENV === 'production' ? null : fakeSpeech;
  const make = REAL_PROVIDERS[name];
  if (!make) {
    console.error('[speech] unknown SPEECH_PROVIDER', name);
    return null;
  }
  return make();
}

export interface Heard {
  /** Which provider wrote it; the site screen says so when it is the fake. */
  provider: string;
  transcript: string;
  transcriptLang: SpeechLang;
  /** The sentence the customer reads, in their language, already through `customerSentence`. */
  customerText: string;
  customerLang: SpeechLang;
  /** Checklist item ids the note mentions as done: suggestions, never ticks. */
  ticks: string[];
}

/**
 * Transcribe a voice note, write the customer's sentence and suggest ticks.
 * Null when no provider is switched on, or the provider failed — the caller
 * keeps the recording and carries on without a sentence.
 */
export async function listen(input: {
  audio: AudioSource;
  langHint: SpeechLang;
  customerLang: SpeechLang;
  context: SentenceContext;
  items: readonly TickItem[];
  provider?: SpeechProvider | null;
}): Promise<Heard | null> {
  const provider = input.provider === undefined ? speechProvider() : input.provider;
  if (!provider) return null;
  try {
    const heard = await provider.transcribe(input.audio, input.langHint, input.context);
    const raw = await provider.toCustomerSentence(heard, input.customerLang, input.context);
    return {
      provider: provider.name,
      transcript: heard.text.slice(0, 2000),
      transcriptLang: heard.lang,
      customerText: customerSentence(raw, input.context, input.customerLang),
      customerLang: input.customerLang,
      ticks: suggestTicks(heard.text, input.items, input.context.room),
    };
  } catch (error) {
    console.error('[speech] failed', provider.name, error instanceof Error ? error.name : 'unknown');
    return null;
  }
}

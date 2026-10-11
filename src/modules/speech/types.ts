/**
 * The speech adapter's contract (studio workspace Phase 2, brief §6 and
 * §8.1: the provider is not chosen yet).
 *
 * A site supervisor speaks about a photo in any language; we keep the
 * recording and the transcript inside the studio (never shown to the
 * customer), and the customer reads one plain sentence in their own
 * language. Pure types; no provider code here.
 */

export type SpeechLang = 'en' | 'hi' | 'mr';

export const SPEECH_LANGS: readonly SpeechLang[] = ['en', 'hi', 'mr'];

export const asSpeechLang = (v: unknown): SpeechLang => (v === 'hi' || v === 'mr' ? v : 'en');

/** What was heard, in the language it was said in. */
export interface Transcript {
  text: string;
  lang: SpeechLang;
}

/** What the sentence writer may lean on: where the photo is and what is being worked on. */
export interface SentenceContext {
  room?: string | null;
  /** The studio's stage name ("Carpentry"). */
  stage?: string | null;
  /** The open checklist labels of that stage, for words the transcript may not spell. */
  items?: readonly string[];
}

/** A checklist item the voice note may mention. */
export interface TickItem {
  id: string;
  label: string;
  room: string;
}

/** The recording, fetched only when a real provider needs it (the fake never does). */
export type AudioSource = () => Promise<Uint8Array | null>;

export interface SpeechProvider {
  readonly name: string;
  /**
   * The recording → what was said, in the language it was said in.
   * `fakeHint` is read by the fake only, so dev and tests get a transcript
   * that mentions a real item; a real provider ignores it.
   */
  transcribe(audio: AudioSource, langHint: SpeechLang, fakeHint?: SentenceContext): Promise<Transcript>;
  /**
   * One plain sentence for the customer, in `targetLang`. No promises about
   * dates or prices: the result passes `customerSentence()` (rules.ts), which
   * replaces anything that does with a neutral sentence.
   */
  toCustomerSentence(transcript: Transcript, targetLang: SpeechLang, context: SentenceContext): Promise<string>;
}

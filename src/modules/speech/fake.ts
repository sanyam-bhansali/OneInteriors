/**
 * The fake speech provider, for development and tests (brief §6: "a fake
 * implementation returning canned text"). It never listens to the audio:
 * the transcript is canned, built from the photo's room and the first open
 * checklist item so the rest of the flow — the sentence, the suggested
 * ticks, the preview — can be walked through end to end. Deterministic.
 *
 * Never used in a production build unless `SPEECH_PROVIDER=fake` is set on
 * purpose (index.ts): a canned sentence must not reach a real customer.
 */

import { keyWords, neutralSentence } from './rules';
import type { SentenceContext, SpeechLang, SpeechProvider, Transcript } from './types';

const CANNED: Record<SpeechLang, (room: string | null, item: string | null) => string> = {
  en: (room, item) => (item ? `${item} done${room ? ` in the ${room.toLowerCase()}` : ''} today.` : 'Work went on today, all good.'),
  hi: (room, item) => (item ? `${room ? `${room} में ` : ''}${item} का काम आज पूरा हुआ।` : 'आज काम ठीक चला।'),
  mr: (room, item) => (item ? `${room ? `${room} मध्ये ` : ''}${item} चे काम आज पूर्ण केले.` : 'आज काम व्यवस्थित झाले.'),
};

const SENTENCE: Record<SpeechLang, (room: string | null, item: string) => string> = {
  en: (room, item) => `${item}${room ? ` in the ${room.toLowerCase()}` : ''}.`,
  hi: (room, item) => `${room ? `${room}: ` : ''}${item} का काम हुआ।`,
  mr: (room, item) => `${room ? `${room}: ` : ''}${item} चे काम झाले.`,
};

export const fakeSpeech: SpeechProvider = {
  name: 'fake',
  async transcribe(_audio, langHint, hint): Promise<Transcript> {
    const item = hint?.items?.[0] ?? null;
    return { text: CANNED[langHint](hint?.room?.trim() || null, item), lang: langHint };
  },
  async toCustomerSentence(transcript, targetLang, context: SentenceContext): Promise<string> {
    const said = transcript.text.toLowerCase();
    const item = (context.items ?? []).find((label) => {
      const words = keyWords(label);
      return words.length > 0 && words.every((w) => said.includes(w));
    });
    return item ? SENTENCE[targetLang](context.room?.trim() || null, item) : neutralSentence(context, targetLang);
  },
};

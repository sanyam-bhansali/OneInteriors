/**
 * The rules around speech that do not depend on a provider. Pure, tested
 * (tests/speech.test.ts):
 *
 * - `suggestTicks`: which checklist items a voice note clearly mentions.
 *   Deterministic keyword matching, so a suggestion can always be explained.
 *   Suggestions only: the site screen shows each one as "from your voice
 *   note" and the supervisor corrects it with a tap. Nothing is ever ticked
 *   silently.
 * - `customerSentence`: the guard on what the customer reads. One plain
 *   sentence; anything that sounds like a promise about a date or a price is
 *   replaced by a neutral sentence (brief §6: "no promises about dates or
 *   prices"). Applied to every provider's output, the fake's included.
 */

import type { SentenceContext, SpeechLang, TickItem } from './types';

/** Words that say WHAT was done; a label is matched on the other words (the things). */
const ACTION_WORDS = new Set([
  'fitted', 'fixed', 'installed', 'done', 'complete', 'completed', 'laid', 'applied', 'levelled', 'leveled', 'finished',
  'work', 'works', 'made', 'mounted', 'put', 'up', 'started',
]);
const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'of', 'in', 'to', 'a', 'an', 'all', 'on', 'at', 'per', 'from', 'by', 'its']);

/**
 * How the same thing is said on a Pune site in Hindi and Marathi (and in
 * Devanagari-spelt English). First draft; extend as real transcripts come in.
 */
const SAME_AS: Record<string, readonly string[]> = {
  wardrobe: ['वॉर्डरोब', 'वार्डरोब', 'वॉडरोब', 'अलमारी', 'कपाट'],
  frame: ['फ्रेम'],
  kitchen: ['किचन', 'रसोई', 'स्वयंपाकघर'],
  carcass: ['कार्कस', 'कारकस', 'कार्कास'],
  bedroom: ['बेडरूम', 'बेडरुम'],
  living: ['लिविंग', 'लिव्हिंग', 'हॉल', 'hall'],
  tv: ['टीव्ही', 'टीवी', 'टीव्ही'],
  unit: ['यूनिट', 'युनिट'],
  shutter: ['शटर'],
  shutters: ['शटर'],
  electrical: ['बिजली', 'इलेक्ट्रिकल', 'वायरिंग', 'wiring'],
  wiring: ['वायरिंग'],
  paint: ['पेंट', 'रंग'],
  painting: ['पेंटिंग', 'पेंट', 'रंग'],
  ceiling: ['सीलिंग', 'सिलिंग'],
  false: ['फॉल्स', 'फाल्स'],
  tiles: ['टाइल', 'टाइल्स', 'फरशी'],
  tiling: ['टाइल', 'फरशी'],
  plumbing: ['प्लंबिंग', 'नल'],
  door: ['दरवाजा', 'दार'],
  doors: ['दरवाजे', 'दार'],
  loft: ['लॉफ्ट', 'माळा'],
  bathroom: ['बाथरूम'],
  laminate: ['लॅमिनेट', 'लेमिनेट'],
  wall: ['भिंत', 'दीवार'],
  panel: ['पॅनल', 'पैनल'],
  panelling: ['पॅनलिंग', 'पैनलिंग'],
  bed: ['बेड', 'पलंग'],
  study: ['स्टडी'],
  dining: ['डायनिंग'],
  crockery: ['क्रॉकरी', 'क्रोकरी'],
  vanity: ['व्हॅनिटी', 'वैनिटी'],
  mirror: ['आरसा', 'शीशा', 'मिरर'],
  hardware: ['हार्डवेअर', 'हार्डवेयर'],
  handles: ['हँडल', 'हैंडल'],
  '1': ['एक', 'one', 'पहला', 'पहले', 'पहिल्या', 'पहिला', '१'],
  '2': ['दो', 'two', 'दूसरा', 'दूसरे', 'दुसऱ्या', 'दुसरा', 'दोन', '२'],
  '3': ['तीन', 'three', 'तीसरा', 'तिसऱ्या', 'तिसरा', '३'],
};

/** Saying it is not done, or not yet. A clause with one of these never suggests a tick. */
const NOT_DONE = /\b(not|isn'?t|wasn'?t|pending|tomorrow|yet to|remaining|left)\b|नहीं|नही|नाही|बाकी|उद्या|अधूरा|अपूर्ण/i;

const isLatin = (w: string) => /^[a-z0-9]+$/.test(w);

/** The words of a label worth matching on. */
export function keyWords(label: string): string[] {
  const words = label
    .toLowerCase()
    .replace(/[^a-z0-9ऀ-ॿ\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w) && (w.length >= 2 || /^\d$/.test(w)));
  const things = words.filter((w) => !ACTION_WORDS.has(w));
  return things.length ? things : words;
}

/** Whether a clause says this word, in English or its Hindi/Marathi forms. */
function says(clause: string, word: string): boolean {
  const forms = [word, ...(SAME_AS[word] ?? [])];
  return forms.some((f) => (isLatin(f) ? new RegExp(`(^|[^a-z0-9])${f}`, 'i').test(clause) : clause.includes(f)));
}

/** Clauses: a "but" starts a new thought ("frame done but shutters pending"). */
function clauses(transcript: string): string[] {
  return transcript
    .toLowerCase()
    .split(/[.!?।;,\n]|\bbut\b|\bपर\b|\bपण\b|\bलेकिन\b/)
    .map((c) => c.trim())
    .filter(Boolean);
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * The checklist items the transcript clearly mentions as done. An item
 * matches when one clause names every thing in its label and does not say
 * "not yet". Where the same label is on the list for several rooms, the room
 * must be named too (or be the photo's own room, `room`).
 */
export function suggestTicks(transcript: string, items: readonly TickItem[], room?: string | null): string[] {
  if (!transcript.trim() || items.length === 0) return [];
  const parts = clauses(transcript);
  const sameLabel = new Map<string, number>();
  for (const it of items) sameLabel.set(norm(it.label), (sameLabel.get(norm(it.label)) ?? 0) + 1);
  const out: string[] = [];
  for (const it of items) {
    const words = keyWords(it.label);
    if (words.length === 0) continue;
    const roomWords = keyWords(it.room);
    const hit = parts.some((c) => {
      if (NOT_DONE.test(c) || !words.every((w) => says(c, w))) return false;
      if ((sameLabel.get(norm(it.label)) ?? 0) <= 1) return true;
      if (room && norm(room) === norm(it.room)) return true;
      return roomWords.length > 0 && roomWords.every((w) => says(c, w));
    });
    if (hit) out.push(it.id);
  }
  return out;
}

/** Sounds like a promise about a date or money: never shown to the customer as said. */
const PROMISE =
  /₹|\brs\.?\s*\d|\brupees?\b|रुपये|रुपए|रुपया|\blakhs?\b|लाख|हज़ार|हजार|\bprice|\bcost|\bdiscount|\bpayment|किंमत|कीमत|पैसे|\btomorrow\b|\bnext (week|month)\b|\bby (mon|tue|wed|thu|fri|sat|sun)|\bwill be (done|ready|finished|complete)|\bwithin \d|\bin \d+ days?\b|\d+\s*(din|दिन|दिवस)|\bdeadline|\bhandover (on|by)|कल तक|उद्या|अगले हफ्ते|पुढच्या आठवड्यात|हो जाएगा|हो जायेगा|पूर्ण होईल|तारीख/i;

const MAX_SENTENCE = 180;

/** A neutral sentence for when the real one cannot be used. */
export function neutralSentence(context: SentenceContext, lang: SpeechLang): string {
  const room = context.room?.trim();
  if (lang === 'hi') return room ? `आज ${room} में काम चला।` : 'आज साइट पर काम चला।';
  if (lang === 'mr') return room ? `आज ${room} मध्ये काम झाले.` : 'आज साइटवर काम झाले.';
  return room ? `Work went on in the ${room.toLowerCase()} today.` : 'Work went on at the site today.';
}

/** Whether a sentence is fit to show the customer as it is. */
export function isSafeSentence(text: string): boolean {
  return text.trim().length > 0 && !PROMISE.test(text);
}

/**
 * The sentence the customer reads: the first sentence of what the writer
 * produced, tidied and capped, or a neutral one when it is empty or sounds
 * like a promise about a date or a price.
 */
export function customerSentence(raw: string | null | undefined, context: SentenceContext, lang: SpeechLang): string {
  const flat = (raw ?? '').replace(/\s+/g, ' ').trim().replace(/^["“'‘]+|["”'’]+$/g, '');
  const first = /^(.+?[.!?।])(\s|$)/.exec(flat)?.[1] ?? flat;
  if (!isSafeSentence(first)) return neutralSentence(context, lang);
  const capped = first.length > MAX_SENTENCE ? `${first.slice(0, MAX_SENTENCE - 1).trimEnd()}…` : first;
  return capped.charAt(0).toUpperCase() + capped.slice(1);
}

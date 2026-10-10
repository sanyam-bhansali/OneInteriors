/**
 * GEIO's preview conversations (the owner's v1 screens, GEIO 1–4).
 *
 * There is no model behind GEIO yet. These are the three conversations the
 * design shows, written out, so the screens can be judged on a phone; the
 * screen says "Preview" on every message. Anything typed that is not one of
 * them is handed to the expert, which is what GEIO is meant to do with a
 * question it should not answer.
 */

import { EXAMPLE } from './example-project';

export type GeioTopic = 'site' | 'photo' | 'price' | 'other';

export interface GeioAnswer {
  paragraphs: string[];
  photos?: number[];
  photosCaption?: string;
  see?: { what: string; verdict: string; watch?: boolean }[];
  handover?: string;
  follow?: string[];
}

export const SUGGESTIONS: { topic: GeioTopic; label: string; ask: string }[] = [
  { topic: 'site', label: 'On site', ask: 'What’s happening on site today?' },
  { topic: 'photo', label: 'Photo check', ask: 'Is this crack normal? I’ll send a photo' },
  { topic: 'price', label: 'Price', ask: 'Can the studio give me a better price on the TV unit?' },
];

export function answerFor(topic: GeioTopic, name: string, expert: string, question: string): GeioAnswer {
  switch (topic) {
    case 'site':
      return {
        paragraphs: [
          `Today was a good day at ${EXAMPLE.flat.split(',')[0]}. Ramesh, your carpenter, and one helper were on site from 9:40 am. Both bedroom wardrobe frames are now fitted, so carpentry is on day ${EXAMPLE.stage.day} of ${EXAMPLE.stage.of} and on track for 31 October.`,
          'One thing needs you this week. The kitchen shutters get cut next week, and they’re waiting on your finish choice. Choosing late is the most common reason a kitchen slips; here it would cost about 3 days.',
        ],
        photos: [28, 31, 25],
        photosCaption: 'Today’s site update, 9:40 am',
        follow: ['Which finish suits a family with kids?', 'Will handover still be 14 Dec?'],
      };
    case 'photo':
      return {
        paragraphs: [
          `Thanks, ${name}. This is the top of the bedroom 1 wardrobe. The thin line along the joint is normal at this stage: the panels are not filled and polished yet, and the polisher closes gaps like this during finishing.`,
          'The corner is different. The edge band there has started to lift. If it’s left, moisture gets into the board. It’s a 10-minute fix for the carpenter while he’s still on site, so it’s worth flagging now.',
        ],
        see: [
          { what: 'Hairline gap at the joint', verdict: 'Common' },
          { what: 'Edge band lifting at the corner', verdict: 'Flag it', watch: true },
        ],
        follow: ['Add it to my snags', 'Who fixes it, and by when?'],
      };
    case 'price':
      return {
        paragraphs: [
          `That’s a fair question, and one for a person rather than me. Prices are agreed between you and ${EXAMPLE.studio}, and I never promise a number I can’t stand behind.`,
          `From experience, though, the TV unit is often where savings sit: a laminate that matches your veneer saves 20 to 30% and looks the same from the sofa. I’ve passed everything to ${expert} so you don’t have to explain again.`,
        ],
        handover: `${name} wants a lower price on the TV unit. Quote line 14, ₹86,000, veneer. Open to a simpler finish.`,
      };
    default:
      return {
        paragraphs: [
          `I’d rather not guess at that one. I’ve passed your question to ${expert}, who has your quote and site record in front of her, so you won’t need to explain it twice.`,
        ],
        handover: `${name} asked: “${question.slice(0, 180)}”`,
      };
  }
}

/** The preview has no model: a typed question is matched to a written answer or handed over. */
export function topicOf(question: string): GeioTopic {
  const q = question.toLowerCase();
  if (/site|today|carpenter|progress|आज|साइट/.test(q)) return 'site';
  if (/crack|photo|normal|gap|scratch|दरार|फोटो/.test(q)) return 'photo';
  if (/price|cheaper|discount|cost|₹|कीमत|किंमत/.test(q)) return 'price';
  return 'other';
}

export const GREETING: Record<'en' | 'hi' | 'mr', { hello: (part: string, name: string) => string; ask: string; placeholder: string }> = {
  en: {
    hello: (part, name) => `Good ${part}, ${name}.`,
    ask: 'What’s on your mind?',
    placeholder: 'Ask in English, हिंदी or मराठी',
  },
  hi: { hello: (_p, name) => `नमस्ते, ${name}.`, ask: 'आज क्या जानना चाहेंगे?', placeholder: 'हिंदी में पूछें' },
  mr: { hello: (_p, name) => `नमस्कार, ${name}.`, ask: 'आज काय जाणून घ्यायचं आहे?', placeholder: 'मराठीत विचारा' },
};

export function partOfDay(hour: number): string {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

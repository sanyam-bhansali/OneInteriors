import { describe, expect, it } from 'vitest';
import { customerSentence, isSafeSentence, listen, neutralSentence, speechProvider, suggestTicks } from '@/modules/speech';
import { fakeSpeech } from '@/modules/speech/fake';

/** The speech adapter (studio workspace Phase 2): the fake, the tick suggestions, the customer-sentence guard. */

const ITEMS = [
  { id: 'b1', label: 'Wardrobe frame fitted', room: 'Bedroom 1' },
  { id: 'b2', label: 'Wardrobe frame fitted', room: 'Bedroom 2' },
  { id: 'kc', label: 'Kitchen carcass levelled and fixed', room: 'Kitchen' },
  { id: 'tv', label: 'TV unit frame', room: 'Living room' },
];

describe('suggestTicks', () => {
  it('suggests an item a note names, with its room when the label repeats', () => {
    expect(suggestTicks('Bedroom 1 wardrobe frame fitted today.', ITEMS)).toEqual(['b1']);
    expect(suggestTicks('Kitchen carcass is levelled and fixed to the wall', ITEMS)).toEqual(['kc']);
  });

  it('reads Marathi and Hindi as said on site', () => {
    expect(suggestTicks('बेडरूम एकमधल्या वॉर्डरोबची फ्रेम आज बसवली.', ITEMS)).toEqual(['b1']);
    expect(suggestTicks('दुसऱ्या बेडरूमची वॉर्डरोब फ्रेमपण पूर्ण झाली.', ITEMS)).toEqual(['b2']);
    expect(suggestTicks('किचन का कार्कस लगा दिया', ITEMS)).toEqual(['kc']);
  });

  it('uses the photo’s room when the note does not say it', () => {
    expect(suggestTicks('wardrobe frame done', ITEMS, 'Bedroom 2')).toEqual(['b2']);
    expect(suggestTicks('wardrobe frame done', ITEMS)).toEqual([]);
  });

  it('never suggests what the note says is not done', () => {
    expect(suggestTicks('TV unit frame not done yet', ITEMS)).toEqual([]);
    expect(suggestTicks('टीवी यूनिट फ्रेम बाकी है', ITEMS)).toEqual([]);
    expect(suggestTicks('Kitchen carcass fixed, but TV unit frame is pending', ITEMS)).toEqual(['kc']);
  });

  it('needs every thing in the label, not one word', () => {
    expect(suggestTicks('the kitchen looks good', ITEMS)).toEqual([]);
    expect(suggestTicks('', ITEMS)).toEqual([]);
  });
});

describe('customerSentence', () => {
  it('keeps one plain sentence', () => {
    expect(customerSentence('wardrobe frame fitted in bedroom 1. Also cleaned up.', {}, 'en')).toBe('Wardrobe frame fitted in bedroom 1.');
    expect(customerSentence('  "Kitchen carcass levelled."  ', {}, 'en')).toBe('Kitchen carcass levelled.');
  });

  it('replaces any promise about a date or a price with a neutral sentence', () => {
    for (const s of [
      'Shutters will be done tomorrow.',
      'Handover by Friday for sure.',
      'Extra ₹4,000 for the loft.',
      'The cost goes up a little.',
      'Work will be ready in 3 days.',
      'शटर कल तक हो जाएगा।',
      'उद्या काम पूर्ण होईल.',
    ]) {
      expect(isSafeSentence(s), s).toBe(false);
      expect(customerSentence(s, { room: 'Kitchen' }, 'en')).toBe(neutralSentence({ room: 'Kitchen' }, 'en'));
    }
  });

  it('writes the neutral sentence in the customer’s language', () => {
    expect(neutralSentence({}, 'hi')).toBe('आज साइट पर काम चला।');
    expect(neutralSentence({ room: 'Kitchen' }, 'mr')).toBe('आज Kitchen मध्ये काम झाले.');
  });
});

describe('the fake provider', () => {
  it('is deterministic, never reads the audio, and mentions the first open item', async () => {
    let read = false;
    const audio = async () => {
      read = true;
      return null;
    };
    const a = await fakeSpeech.transcribe(audio, 'mr', { room: 'Bedroom 1', items: ['Wardrobe frame fitted'] });
    const b = await fakeSpeech.transcribe(audio, 'mr', { room: 'Bedroom 1', items: ['Wardrobe frame fitted'] });
    expect(a).toEqual(b);
    expect(a.lang).toBe('mr');
    expect(read).toBe(false);
  });

  it('flows end to end: transcript, sentence in the customer’s language, suggested ticks', async () => {
    const heard = await listen({
      audio: async () => null,
      langHint: 'mr',
      customerLang: 'en',
      context: { room: 'Bedroom 1', items: ['Wardrobe frame fitted'] },
      items: ITEMS,
      provider: fakeSpeech,
    });
    expect(heard).toMatchObject({ provider: 'fake', transcriptLang: 'mr', customerLang: 'en', customerText: 'Wardrobe frame fitted in the bedroom 1.', ticks: ['b1'] });
  });

  it('is the default in development and tests, never silently in production', () => {
    expect(speechProvider({ NODE_ENV: 'development' })?.name).toBe('fake');
    expect(speechProvider({ NODE_ENV: 'test' })?.name).toBe('fake');
    expect(speechProvider({ NODE_ENV: 'production' })).toBeNull();
    expect(speechProvider({ NODE_ENV: 'production', SPEECH_PROVIDER: 'fake' })?.name).toBe('fake');
  });

  it('an unknown provider name is none (the real-provider slot is empty until the owner chooses)', async () => {
    expect(speechProvider({ NODE_ENV: 'production', SPEECH_PROVIDER: 'whisper' })).toBeNull();
    expect(await listen({ audio: async () => null, langHint: 'en', customerLang: 'en', context: {}, items: [], provider: null })).toBeNull();
  });
});

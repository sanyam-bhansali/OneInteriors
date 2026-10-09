/**
 * The frame every customer screen sits in — header, footer and the spine
 * (step bar) — in English, Hindi and Marathi.
 *
 * FIRST DRAFT for native-speaker review — see `modules/i18n/site.ts`.
 * The English must stay identical to what `components/oi/Chrome.tsx` showed.
 */

import type { Tx } from '../site';

export const CHROME_DICT = {
  // Header
  'header.homeAria': { en: 'One Interiors, home', hi: 'One Interiors, होम', mr: 'One Interiors, होम' },
  'header.studios': { en: 'Studios', hi: 'स्टूडियो', mr: 'स्टुडिओ' },
  'header.verify': { en: 'How we verify', hi: 'हम कैसे जाँचते हैं', mr: 'आम्ही कसे तपासतो' },
  'header.project': { en: 'Your project', hi: 'आपका प्रोजेक्ट', mr: 'तुमचा प्रोजेक्ट' },

  // Spine
  'spine.aria': { en: 'Your project so far', hi: 'आपका प्रोजेक्ट अब तक', mr: 'तुमचा प्रोजेक्ट आतापर्यंत' },
  'spine.brief': { en: 'Your brief', hi: 'आपकी ज़रूरतें', mr: 'तुमच्या गरजा' },
  'spine.match': { en: 'Who fits', hi: 'कौन सही है', mr: 'कोण योग्य आहे' },
  'spine.quote': { en: 'The quote', hi: 'कोटेशन', mr: 'कोटेशन' },
  'spine.compare': { en: 'Side by side', hi: 'आमने-सामने', mr: 'शेजारी-शेजारी' },
  'spine.expert': { en: 'Your architect', hi: 'आपके आर्किटेक्ट', mr: 'तुमचे आर्किटेक्ट' },
  'spine.readingNow': { en: 'reading now', hi: 'अभी यहाँ', mr: 'आत्ता इथे' },

  // Footer
  'footer.tagline': {
    en: 'Interior studios in Pune, checked fifteen ways and quoted line by line.',
    hi: 'पुणे के इंटीरियर स्टूडियो — पंद्रह तरह से जाँचे हुए, लाइन-दर-लाइन कोटेशन के साथ।',
    mr: 'पुण्यातले इंटीरियर स्टुडिओ — पंधरा प्रकारे तपासलेले, ओळीने ओळ कोटेशनसह.',
  },
  'footer.project': { en: 'Your project', hi: 'आपका प्रोजेक्ट', mr: 'तुमचा प्रोजेक्ट' },
  'footer.startBrief': { en: 'Start the brief', hi: 'अपनी ज़रूरतें बताएँ', mr: 'तुमच्या गरजा सांगा' },
  'footer.everything': { en: 'Everything so far', hi: 'अब तक का सब कुछ', mr: 'आतापर्यंतचं सगळं' },
  'footer.studios': { en: 'Studios', hi: 'स्टूडियो', mr: 'स्टुडिओ' },
  'footer.checks': { en: 'The fifteen checks', hi: 'पंद्रह जाँचें', mr: 'पंधरा तपासण्या' },
  'footer.apply': {
    en: 'For studios — apply to join',
    hi: 'स्टूडियो के लिए — जुड़ने के लिए आवेदन करें',
    mr: 'स्टुडिओंसाठी — सामील होण्यासाठी अर्ज करा',
  },
  'footer.prelaunch': {
    en: 'Pre-launch build. The studios shown are placeholder records used to develop and review the product — they are not real businesses and the registration numbers are not real.',
    hi: 'लॉन्च से पहले का वर्ज़न। यहाँ दिखे स्टूडियो प्रोडक्ट बनाने और जाँचने के लिए नमूना रिकॉर्ड हैं — ये असली कारोबार नहीं हैं और रजिस्ट्रेशन नंबर भी असली नहीं हैं।',
    mr: 'लॉन्चपूर्वीचं व्हर्जन. इथे दिसणारे स्टुडिओ प्रॉडक्ट बनवण्यासाठी आणि तपासण्यासाठी नमुना रेकॉर्ड आहेत — हे खरे व्यवसाय नाहीत आणि रजिस्ट्रेशन नंबरही खरे नाहीत.',
  },
} satisfies Record<string, Tx>;

import type { Entry } from './entry';

/** The opening and Welcome screens' own words (first draft: Sanyam reviews the Hindi and Marathi). */
export const welcome = {
  'open.tap': { en: 'Tap anywhere to continue', hi: 'आगे बढ़ने के लिए कहीं भी टैप करें', mr: 'पुढे जाण्यासाठी कुठेही टॅप करा' },
  'open.video': { en: 'A bulb lights up in an empty room', hi: 'खाली कमरे में एक बल्ब जलता है', mr: 'रिकाम्या खोलीत एक दिवा लागतो' },
  'welcomeApp.langShort.en': { en: 'EN', hi: 'EN', mr: 'EN' },
  'welcomeApp.langShort.hi': { en: 'हिं', hi: 'हिं', mr: 'हिं' },
  'welcomeApp.langShort.mr': { en: 'मरा', hi: 'मरा', mr: 'मरा' },
  'welcomeApp.offline.h1': { en: 'No connection', hi: 'इंटरनेट नहीं है', mr: 'इंटरनेट नाही' },
  'welcomeApp.retry': { en: 'Try again', hi: 'फिर से कोशिश करें', mr: 'पुन्हा प्रयत्न करा' },
} satisfies Record<string, Entry>;

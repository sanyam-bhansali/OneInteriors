import type { Entry } from './entry';

/** The notifications screen's words, English, Hindi and Marathi (first draft: Sanyam reviews). */
export const notifications = {
  'notif.back': { en: 'Back', hi: 'वापस', mr: 'मागे' },
  'notif.settings': { en: 'Settings', hi: 'सेटिंग्स', mr: 'सेटिंग्ज' },
  'notif.today': { en: 'Today', hi: 'आज', mr: 'आज' },
  'notif.earlier': { en: 'Earlier', hi: 'पहले की', mr: 'आधीच्या' },
  'notif.unread': { en: 'Unread', hi: 'नई', mr: 'नवीन' },
  'notif.empty': {
    en: 'Nothing yet. Site updates, decisions and snags appear here, and on your lock screen.',
    hi: 'अभी कुछ नहीं। साइट अपडेट, फ़ैसले और स्नैग यहाँ और आपकी लॉक स्क्रीन पर दिखेंगे।',
    mr: 'अजून काही नाही. साइट अपडेट, निर्णय आणि स्नॅग इथे आणि तुमच्या लॉक स्क्रीनवर दिसतील.',
  },
} satisfies Record<string, Entry>;

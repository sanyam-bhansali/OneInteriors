import type { Entry } from './entry';

/** The decision screen's words, English, Hindi and Marathi (first draft: Sanyam reviews). */
export const decision = {
  'decision.gone': {
    en: 'This decision is not on your project any more.',
    hi: 'यह फ़ैसला अब आपके प्रोजेक्ट में नहीं है।',
    mr: 'हा निर्णय आता तुमच्या प्रोजेक्टमध्ये नाही.',
  },
  'decision.back': { en: 'Back', hi: 'वापस', mr: 'मागे' },
  'decision.photo': { en: 'Your home, as designed', hi: 'डिज़ाइन के अनुसार आपका घर', mr: 'डिझाइनप्रमाणे तुमचे घर' },
  'decision.due': { en: 'Your decision, due {day}', hi: 'आपका फ़ैसला, {day} तक', mr: 'तुमचा निर्णय, {day} पर्यंत' },
  'decision.closedOn': { en: 'Closed {day}', hi: '{day} को बंद हुआ', mr: '{day} रोजी बंद झाले' },
  'decision.options': { en: 'Options', hi: 'विकल्प', mr: 'पर्याय' },
  'decision.inQuote': { en: 'In quote', hi: 'कोटेशन में शामिल', mr: 'कोटेशनमध्ये समाविष्ट' },

  'decision.votes': { en: 'Family vote', hi: 'परिवार की राय', mr: 'कुटुंबाचे मत' },
  'decision.votedCount': { en: '{n} voted', hi: '{n} ने राय दी', mr: '{n} जणांनी मत दिले' },
  'decision.voted': { en: '{name} voted {option}', hi: '{name} ने चुना {option}', mr: '{name} यांनी निवडले {option}' },
  'decision.youVoted': { en: 'You voted {option}', hi: 'आपने चुना {option}', mr: 'तुम्ही निवडले {option}' },
  'decision.yourCall': { en: 'Your choice decides', hi: 'आख़िरी फ़ैसला आपका', mr: 'अंतिम निर्णय तुमचा' },

  'decision.notSure': {
    en: 'Not sure? Ask {name} before {day}. She is on One Interiors’ payroll and earns nothing from any option.',
    hi: 'पक्का नहीं? {day} से पहले {name} से पूछिए। वे One Interiors की कर्मचारी हैं और किसी भी विकल्प से उन्हें कुछ नहीं मिलता।',
    mr: 'खात्री नाही? {day} आधी {name} यांना विचारा. त्या One Interiors च्या कर्मचारी आहेत आणि कोणत्याही पर्यायातून त्यांना काहीही मिळत नाही.',
  },
  'decision.ask': { en: 'Ask {name}', hi: '{name} से पूछिए', mr: '{name} यांना विचारा' },

  'decision.confirm': { en: 'Confirm {option}', hi: '{option} पक्का करें', mr: '{option} नक्की करा' },
  'decision.confirmed': { en: '{option} confirmed. {studio} is told.', hi: '{option} पक्का हो गया। {studio} को बता दिया गया है।', mr: '{option} नक्की झाले. {studio} ला कळवले आहे.' },
  'decision.closed': { en: 'This decision has closed', hi: 'यह फ़ैसला बंद हो चुका है', mr: 'हा निर्णय बंद झाला आहे' },
  'decision.closedReason': {
    en: 'The due date has passed. Ask {name} if something must change.',
    hi: 'आख़िरी तारीख निकल गई है। कुछ बदलना हो तो {name} से पूछिए।',
    mr: 'शेवटची तारीख उलटून गेली आहे. काही बदलायचे असल्यास {name} यांना विचारा.',
  },
  'decision.family': {
    en: 'The owner of this project confirms the choice. You can see every option and what it costs here.',
    hi: 'चुनाव इस प्रोजेक्ट के मालिक पक्का करते हैं। हर विकल्प और उसकी क़ीमत आप यहाँ देख सकते हैं।',
    mr: 'निवड या प्रोजेक्टचे मालक नक्की करतात. प्रत्येक पर्याय आणि त्याची किंमत तुम्ही इथे पाहू शकता.',
  },
} satisfies Record<string, Entry>;

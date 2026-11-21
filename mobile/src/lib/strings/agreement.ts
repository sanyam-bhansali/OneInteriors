import type { Entry } from './entry';

/** The client agreement screen (owner, 21 Nov 2026; docs/studio-os/CLIENT-AGREEMENT.md). First draft: Sanyam reviews. */
export const agreementWords = {
  'agree.eyebrow': { en: 'At design closure', hi: 'डिज़ाइन पूरा होने पर', mr: 'डिझाइन पूर्ण झाल्यावर' },
  'agree.title': { en: 'Your agreement', hi: 'आपका एग्रीमेंट', mr: 'तुमचा करार' },
  'agree.none': {
    en: '{studio} sends your agreement when your design is closed. You will get a notice.',
    hi: 'डिज़ाइन पूरा होने पर {studio} आपका एग्रीमेंट भेजेगा। आपको सूचना मिलेगी।',
    mr: 'डिझाइन पूर्ण झाल्यावर {studio} तुमचा करार पाठवेल. तुम्हाला सूचना मिळेल.',
  },
  'agree.sent': {
    en: '{studio} has sent your agreement. Read it in full, then sign it with Aadhaar eSign: an OTP comes to the phone linked to your Aadhaar.',
    hi: '{studio} ने आपका एग्रीमेंट भेजा है। पूरा पढ़ें, फिर आधार ई-साइन से साइन करें: आधार से जुड़े फ़ोन पर OTP आएगा।',
    mr: '{studio} ने तुमचा करार पाठवला आहे. पूर्ण वाचा, मग आधार ई-साइनने सही करा: आधारशी जोडलेल्या फोनवर OTP येईल.',
  },
  'agree.sentFamily': { en: 'The person whose home it is signs it.', hi: 'जिनका घर है, वही साइन करेंगे।', mr: 'ज्यांचे घर आहे तेच सही करतील.' },
  'agree.read': { en: 'Read the agreement', hi: 'एग्रीमेंट पढ़ें', mr: 'करार वाचा' },
  'agree.sign': { en: 'Sign with Aadhaar', hi: 'आधार से साइन करें', mr: 'आधारने सही करा' },
  'agree.soon': { en: 'Signing opens here soon. {studio} will let you know.', hi: 'साइन करना जल्द यहाँ शुरू होगा। {studio} बताएगा।', mr: 'सही करणे लवकरच इथे सुरू होईल. {studio} कळवेल.' },
  'agree.signed': { en: 'You signed your agreement with {studio}.', hi: 'आपने {studio} के साथ अपना एग्रीमेंट साइन कर दिया है।', mr: 'तुम्ही {studio} सोबतच्या करारावर सही केली आहे.' },
  'agree.openSigned': { en: 'Open the signed agreement', hi: 'साइन किया एग्रीमेंट खोलें', mr: 'सही केलेला करार उघडा' },
  'agree.back': { en: 'Back from eSign. If it went through, it shows as signed.', hi: 'ई-साइन से वापस। साइन हुआ हो तो यहाँ दिखेगा।', mr: 'ई-साइनवरून परत. सही झाली असल्यास इथे दिसेल.' },
} satisfies Record<string, Entry>;

import type { Entry } from './entry';

/**
 * The me screen's words, and account deletion's, English, Hindi and Marathi
 * (first draft: Sanyam reviews). Prefixed `meApp.` because the shared
 * dictionary (../i18n-dict.ts) already owns `me.*`; those are reused as they are.
 */
export const me = {
  'meApp.sqft': { en: '{n} sq ft', hi: '{n} वर्ग फुट', mr: '{n} चौ. फूट' },
  'meApp.unread.none': { en: 'All read', hi: 'सब पढ़ लिया', mr: 'सर्व वाचले' },
  'meApp.lang.group': { en: 'App language', hi: 'ऐप की भाषा', mr: 'ॲपची भाषा' },
  // COPY-AND-LANGUAGES.md, Me → Language: must not drift.
  'meApp.lang.note': {
    en: 'The whole app, and GEIO, in English.',
    hi: 'पूरा ऐप और GEIO हिंदी में।',
    mr: 'संपूर्ण ॲप आणि GEIO मराठीत.',
  },
  'meApp.daily': { en: 'Daily site update', hi: 'रोज़ का साइट अपडेट', mr: 'रोजचे साइट अपडेट' },
  'meApp.daily.sub': { en: 'A notification when the studio posts', hi: 'स्टूडियो के पोस्ट करने पर सूचना', mr: 'स्टुडिओने पोस्ट केल्यावर सूचना' },
  'meApp.lock': { en: 'Lock with Face ID or fingerprint', hi: 'Face ID या फ़िंगरप्रिंट से लॉक करें', mr: 'Face ID किंवा फिंगरप्रिंटने लॉक करा' },
  'meApp.lock.sub': {
    en: 'Asked when the app opens, and after five minutes away.',
    hi: 'ऐप खुलने पर, और पाँच मिनट बाद लौटने पर पूछा जाएगा।',
    mr: 'ॲप उघडताना, आणि पाच मिनिटांनी परत आल्यावर विचारले जाईल.',
  },
  'meApp.lock.fail': {
    en: 'This phone has no Face ID or fingerprint set up, or it was cancelled.',
    hi: 'इस फ़ोन में Face ID या फ़िंगरप्रिंट सेट नहीं है, या इसे रद्द किया गया।',
    mr: 'या फोनमध्ये Face ID किंवा फिंगरप्रिंट सेट नाही, किंवा ते रद्द केले गेले.',
  },
  'meApp.email': { en: 'Email One Interiors', hi: 'One Interiors को ईमेल करें', mr: 'One Interiors ला ईमेल करा' },
  'meApp.delete': { en: 'Delete my account', hi: 'मेरा अकाउंट डिलीट करें', mr: 'माझे खाते डिलीट करा' },
  'meApp.version': { en: 'One Interiors · version {v}', hi: 'One Interiors · वर्ज़न {v}', mr: 'One Interiors · आवृत्ती {v}' },

  // Delete my account
  'meApp.del.lead': {
    en: 'This removes your One Interiors account. It cannot be undone.',
    hi: 'इससे आपका One Interiors अकाउंट हट जाएगा। इसे वापस नहीं किया जा सकता।',
    mr: 'यामुळे तुमचे One Interiors खाते काढून टाकले जाईल. हे परत करता येणार नाही.',
  },
  'meApp.del.gone': { en: 'What we delete', hi: 'हम क्या हटाते हैं', mr: 'आम्ही काय काढून टाकतो' },
  'meApp.del.gone1': { en: 'Your name, phone number and email', hi: 'आपका नाम, फ़ोन नंबर और ईमेल', mr: 'तुमचे नाव, फोन नंबर आणि ईमेल' },
  'meApp.del.gone2': { en: 'Your sign-ins on every phone', hi: 'हर फ़ोन पर आपका साइन-इन', mr: 'प्रत्येक फोनवरील तुमचे साइन-इन' },
  'meApp.del.gone4': { en: 'Your notifications', hi: 'आपकी सूचनाएँ', mr: 'तुमच्या सूचना' },
  'meApp.del.gone3': { en: 'The contact details in your brief', hi: 'आपके ब्रीफ़ में दी गई संपर्क जानकारी', mr: 'तुमच्या ब्रीफमधील संपर्क माहिती' },
  'meApp.del.kept': { en: 'What we keep', hi: 'हम क्या रखते हैं', mr: 'आम्ही काय ठेवतो' },
  'meApp.del.kept.body': {
    en: 'Signed project records your studio needs, such as the agreement, quotation and payment receipts, with your name and number taken off. The law requires us to keep these.',
    hi: 'साइन किए गए प्रोजेक्ट के रिकॉर्ड जो आपके स्टूडियो को चाहिए, जैसे एग्रीमेंट, कोटेशन और भुगतान की रसीदें, आपके नाम और नंबर के बिना। क़ानून के अनुसार इन्हें रखना ज़रूरी है।',
    mr: 'तुमच्या स्टुडिओला लागणारे सही केलेले प्रोजेक्ट रेकॉर्ड, जसे करार, कोटेशन आणि पेमेंटच्या पावत्या, तुमचे नाव आणि नंबर काढून. कायद्यानुसार हे ठेवणे आवश्यक आहे.',
  },
  'meApp.del.tick': {
    en: 'I understand my account will be deleted and this cannot be undone.',
    hi: 'मुझे पता है कि मेरा अकाउंट डिलीट हो जाएगा और इसे वापस नहीं किया जा सकता।',
    mr: 'मला माहीत आहे की माझे खाते डिलीट होईल आणि हे परत करता येणार नाही.',
  },
  'meApp.del.reason': { en: 'Tick the box to delete', hi: 'डिलीट करने के लिए बॉक्स टिक करें', mr: 'डिलीट करण्यासाठी बॉक्स टिक करा' },
  'meApp.del.keep': { en: 'Keep my account', hi: 'मेरा अकाउंट रखें', mr: 'माझे खाते ठेवा' },
} satisfies Record<string, Entry>;

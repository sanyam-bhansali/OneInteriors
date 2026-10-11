import type { Entry } from './entry';

/** The snags screen's words, English, Hindi and Marathi (first draft: Sanyam reviews). */
export const snags = {
  // Promises Assured-plan service (FLOWS.md): flagged, kept until plans are decided.
  'snags.eyebrow': { en: 'Fixed by a date, or we chase it', hi: 'तय तारीख तक ठीक, नहीं तो हम पीछे लगेंगे', mr: 'ठरलेल्या तारखेपर्यंत दुरुस्त, नाहीतर आम्ही पाठपुरावा करू' },
  'snags.title': { en: 'Snags', hi: 'कमियाँ', mr: 'त्रुटी' },
  'snags.none': {
    en: 'Once your project starts, photograph anything wrong and it goes straight to the studio.',
    hi: 'प्रोजेक्ट शुरू होने के बाद, कुछ भी गलत दिखे तो फ़ोटो लीजिए। वह सीधे स्टूडियो तक जाएगी।',
    mr: 'प्रोजेक्ट सुरू झाल्यावर, काहीही चुकीचे दिसले तर फोटो काढा. तो थेट स्टुडिओकडे जाईल.',
  },
  'snags.photograph': { en: 'Photograph a problem', hi: 'कमी की फ़ोटो लें', mr: 'त्रुटीचा फोटो काढा' },
  'snags.library': { en: 'Choose from photos', hi: 'गैलरी से चुनें', mr: 'गॅलरीतून निवडा' },
  'snags.permission': {
    en: 'Allow access in your phone’s settings to add a photo.',
    hi: 'फ़ोटो जोड़ने के लिए फ़ोन की सेटिंग में अनुमति दीजिए।',
    mr: 'फोटो जोडण्यासाठी फोनच्या सेटिंगमध्ये परवानगी द्या.',
  },
  'snags.photo': { en: 'Your photo', hi: 'आपकी फ़ोटो', mr: 'तुमचा फोटो' },
  'snags.what': { en: 'What is wrong', hi: 'क्या गलत है', mr: 'काय चुकले आहे' },
  'snags.whatHint': { en: 'Gap between wardrobe and ceiling', hi: 'वॉर्डरोब और छत के बीच गैप', mr: 'वॉर्डरोब आणि छतामध्ये फट' },
  'snags.where': { en: 'Where (optional)', hi: 'कहाँ (ज़रूरी नहीं)', mr: 'कुठे (गरजेचे नाही)' },
  'snags.whereHint': { en: 'Bedroom 1', hi: 'बेडरूम 1', mr: 'बेडरूम 1' },
  'snags.send': { en: 'Send to the studio', hi: 'स्टूडियो को भेजें', mr: 'स्टुडिओला पाठवा' },
  'snags.sendReason': { en: 'Say what is wrong, in a few words', hi: 'कुछ शब्दों में बताइए क्या गलत है', mr: 'काय चुकले आहे ते थोडक्यात सांगा' },
  'snags.cancel': { en: 'Cancel', hi: 'रद्द करें', mr: 'रद्द करा' },
  'snags.sent': {
    en: 'Sent to {studio}. You will hear when it has a fix-by date.',
    hi: '{studio} को भेज दिया। ठीक करने की तारीख तय होते ही आपको बताया जाएगा।',
    mr: '{studio} ला पाठवले. दुरुस्तीची तारीख ठरली की तुम्हाला कळवले जाईल.',
  },

  'snags.filter': { en: 'Filter snags', hi: 'कमियाँ छाँटें', mr: 'त्रुटी निवडा' },
  'snags.open': { en: 'Open', hi: 'बाकी', mr: 'बाकी' },
  'snags.fixed': { en: 'Fixed', hi: 'ठीक हुईं', mr: 'दुरुस्त' },
  'snags.roomRaised': { en: '{room}, raised {day}', hi: '{room}, {day} को बताया', mr: '{room}, {day} रोजी नोंदवले' },
  'snags.raised': { en: 'Raised {day}', hi: '{day} को बताया', mr: '{day} रोजी नोंदवले' },
  'snags.fixBy': { en: 'Fix by {day}', hi: '{day} तक ठीक होगा', mr: '{day} पर्यंत दुरुस्त होईल' },
  'snags.fixedOn': { en: 'Fixed {day}', hi: '{day} को ठीक हुआ', mr: '{day} रोजी दुरुस्त झाले' },
  'snags.withStudio': { en: 'With the studio', hi: 'स्टूडियो के पास है', mr: 'स्टुडिओकडे आहे' },
  'snags.emptyOpen': { en: 'Nothing open. Good.', hi: 'कुछ बाकी नहीं। बढ़िया।', mr: 'काही बाकी नाही. छान.' },
  'snags.emptyFixed': { en: 'Nothing fixed yet.', hi: 'अभी कुछ ठीक नहीं हुआ।', mr: 'अजून काही दुरुस्त झालेले नाही.' },
  'snags.photoOf': { en: 'Photo: {title}', hi: 'फ़ोटो: {title}', mr: 'फोटो: {title}' },

  'snags.walk': { en: 'Handover walk-through, {date}', hi: 'हैंडओवर पर साथ में जाँच, {date}', mr: 'हँडओव्हरला एकत्र पाहणी, {date}' },
  'snags.walkNoDate': { en: 'Handover walk-through', hi: 'हैंडओवर पर साथ में जाँच', mr: 'हँडओव्हरला एकत्र पाहणी' },
  'snags.walkBody': {
    en: 'We walk the flat with you room by room and add everything here. The last payment is due only once these are closed.',
    hi: 'हम आपके साथ फ़्लैट का हर कमरा देखते हैं और सब कुछ यहाँ जोड़ते हैं। आख़िरी भुगतान तभी देना है जब ये सब ठीक हो जाएँ।',
    mr: 'आम्ही तुमच्यासोबत फ्लॅटची प्रत्येक खोली पाहतो आणि सगळे इथे नोंदवतो. हे सगळे दुरुस्त झाल्यावरच शेवटचे पेमेंट द्यायचे.',
  },
} satisfies Record<string, Entry>;

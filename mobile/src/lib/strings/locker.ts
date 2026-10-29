import type { Entry } from './entry';

/** The locker screen's words, English, Hindi and Marathi (first draft: Sanyam reviews). */
export const locker = {
  'locker.eyebrow': { en: 'For as long as you live there', hi: 'जब तक आप वहाँ रहें', mr: 'तुम्ही तिथे राहाल तोपर्यंत' },
  'locker.eyebrow.home': { en: '{home}, for as long as you live there', hi: '{home}, जब तक आप वहाँ रहें', mr: '{home}, तुम्ही तिथे राहाल तोपर्यंत' },
  'locker.search': { en: 'Search the locker', hi: 'लॉकर में खोजें', mr: 'लॉकरमध्ये शोधा' },
  'locker.search.placeholder': { en: 'Search, for example hinge warranty', hi: 'खोजें, जैसे हिंज की वारंटी', mr: 'शोधा, उदा. बिजागरीची वॉरंटी' },
  'locker.docs': { en: 'Documents', hi: 'दस्तावेज़', mr: 'कागदपत्रे' },
  'locker.kind.AGREEMENT': { en: 'Agreement', hi: 'एग्रीमेंट', mr: 'करार' },
  'locker.kind.SIGNED_AGREEMENT': { en: 'Signed agreement (paper)', hi: 'हस्ताक्षरित एग्रीमेंट (काग़ज़)', mr: 'सही केलेला करार (कागद)' },
  'locker.kind.QUOTATION': { en: 'Signed quotation', hi: 'साइन किया हुआ कोटेशन', mr: 'सही केलेले कोटेशन' },
  'locker.kind.DRAWINGS': { en: 'Design drawings', hi: 'डिज़ाइन ड्रॉइंग', mr: 'डिझाइन ड्रॉइंग' },
  'locker.kind.RECEIPT': { en: 'Payment receipts', hi: 'भुगतान की रसीदें', mr: 'पेमेंटच्या पावत्या' },
  'locker.kind.WARRANTY': { en: 'Warranties and manuals', hi: 'वारंटी और मैनुअल', mr: 'वॉरंटी आणि मॅन्युअल' },
  'locker.kind.OTHER': { en: 'Other', hi: 'अन्य', mr: 'इतर' },
  'locker.warranty.later': { en: 'Added at handover, {date}', hi: 'हैंडओवर पर जोड़े जाएँगे, {date}', mr: 'हँडओव्हरला जोडले जातील, {date}' },
  'locker.warranty.laterNoDate': { en: 'Added at handover', hi: 'हैंडओवर पर जोड़े जाएँगे', mr: 'हँडओव्हरला जोडले जातील' },
  'locker.open': { en: 'Open {title}', hi: '{title} खोलें', mr: '{title} उघडा' },
  'locker.none': {
    en: 'Your agreement, drawings, receipts and warranties are kept here once your project starts.',
    hi: 'प्रोजेक्ट शुरू होते ही आपका एग्रीमेंट, ड्रॉइंग, रसीदें और वारंटी यहाँ रखी जाएँगी।',
    mr: 'प्रोजेक्ट सुरू झाल्यावर तुमचा करार, ड्रॉइंग, पावत्या आणि वॉरंटी इथे ठेवल्या जातील.',
  },
  'locker.empty': {
    en: 'Nothing filed yet. Documents appear here as {studio} adds them.',
    hi: 'अभी कुछ नहीं रखा गया। {studio} जैसे-जैसे दस्तावेज़ जोड़ेगा, वे यहाँ दिखेंगे।',
    mr: 'अजून काही ठेवलेले नाही. {studio} कागदपत्रे जोडेल तशी ती इथे दिसतील.',
  },
  'locker.noMatch': { en: 'Nothing matches “{q}”.', hi: '“{q}” से कुछ नहीं मिला।', mr: '“{q}” शी काहीही जुळत नाही.' },
  'locker.hint': {
    en: 'Each link stays open for a few minutes. If one will not open, pull down to refresh.',
    hi: 'हर लिंक कुछ मिनट तक खुलता है। अगर कोई न खुले, तो रिफ़्रेश करने के लिए नीचे खींचें।',
    mr: 'प्रत्येक लिंक काही मिनिटे उघडते. एखादी उघडली नाही तर रिफ्रेश करण्यासाठी खाली ओढा.',
  },

  // Phase 5: materials with product codes, versions, decision outcomes.
  'locker.made': { en: 'What your home is made of', hi: 'आपका घर किससे बना है', mr: 'तुमचे घर कशापासून बनले आहे' },
  'locker.code': { en: 'Code {code}', hi: 'कोड {code}', mr: 'कोड {code}' },
  'locker.codeLater': { en: 'Code added when ordered', hi: 'ऑर्डर होने पर कोड जुड़ेगा', mr: 'ऑर्डर झाल्यावर कोड जोडला जाईल' },
  'locker.orderedNoCode': { en: 'Ordered', hi: 'ऑर्डर हो गया', mr: 'ऑर्डर झाले' },
  'locker.version': { en: 'Version {n}', hi: 'वर्ज़न {n}', mr: 'आवृत्ती {n}' },
  'locker.madeHint': {
    en: 'Quote a code to any shop for a spare or a repair.',
    hi: 'किसी भी दुकान पर स्पेयर या रिपेयर के लिए यह कोड बताइए।',
    mr: 'सुटा भाग किंवा दुरुस्तीसाठी कोणत्याही दुकानात हा कोड सांगा.',
  },
} satisfies Record<string, Entry>;

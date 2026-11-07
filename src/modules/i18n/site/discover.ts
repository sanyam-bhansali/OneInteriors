/**
 * Discover (/discover) in English, Hindi and Marathi.
 *
 * FIRST DRAFT for native-speaker review — see `modules/i18n/site.ts`.
 */

import type { Tx } from '../site';

export const DISCOVER_DICT = {
  'meta.title': { en: 'Discover your style', hi: 'अपना स्टाइल खोजिए', mr: 'तुमची स्टाइल शोधा' },
  'meta.description': {
    en: 'Scroll real rooms built in Pune, save the ones you love, and see your style.',
    hi: 'पुणे में बने असली कमरे देखिए, जो पसंद आएँ उन्हें सेव कीजिए, और अपना स्टाइल जानिए।',
    mr: 'पुण्यात बनलेल्या खऱ्या खोल्या पाहा, आवडलेल्या सेव्ह करा, आणि तुमची स्टाइल जाणून घ्या.',
  },

  'hero.eyebrow': { en: 'Discover', hi: 'खोजिए', mr: 'शोधा' },
  'hero.title': { en: 'Save the rooms you love.', hi: 'जो कमरे पसंद हों, उन्हें सेव कीजिए।', mr: 'आवडलेल्या खोल्या सेव्ह करा.' },
  'hero.lede': {
    en: "Scroll real rooms built in Pune. Save what feels like home, skip what doesn't. After {n} saves we'll show you your style, and then we build it.",
    hi: 'पुणे में बने असली कमरे देखिए। जो घर जैसा लगे उसे सेव कीजिए, बाकी छोड़ दीजिए। {n} सेव के बाद हम आपका स्टाइल दिखाएँगे, और फिर उसे बनाएँगे।',
    mr: 'पुण्यात बनलेल्या खऱ्या खोल्या पाहा. जे घरासारखे वाटते ते सेव्ह करा, बाकी सोडा. {n} सेव्हनंतर आम्ही तुमची स्टाइल दाखवू, आणि मग ती बनवू.',
  },

  'progress.count': { en: '{n} of {total} saves', hi: '{total} में से {n} सेव', mr: '{total} पैकी {n} सेव्ह' },
  'progress.ready': { en: 'Your style is ready', hi: 'आपका स्टाइल तैयार है', mr: 'तुमची स्टाइल तयार आहे' },
  'progress.see': { en: 'See my style', hi: 'मेरा स्टाइल देखें', mr: 'माझी स्टाइल पाहा' },

  'room.all': { en: 'All rooms', hi: 'सभी कमरे', mr: 'सर्व खोल्या' },
  'room.living': { en: 'Living', hi: 'लिविंग', mr: 'लिव्हिंग' },
  'room.kitchen': { en: 'Kitchen', hi: 'किचन', mr: 'किचन' },
  'room.bedroom': { en: 'Bedroom', hi: 'बेडरूम', mr: 'बेडरूम' },
  'room.mandir': { en: 'Mandir', hi: 'मंदिर', mr: 'देवघर' },
  'room.other': { en: 'Other rooms', hi: 'दूसरे कमरे', mr: 'इतर खोल्या' },

  'pin.save': { en: 'Save', hi: 'सेव', mr: 'सेव्ह' },
  'pin.saved': { en: 'Saved', hi: 'सेव हुआ', mr: 'सेव्ह झाले' },
  'pin.skip': { en: 'Not for me', hi: 'मेरे लिए नहीं', mr: 'माझ्यासाठी नाही' },
  'pin.built': { en: 'Built in Pune', hi: 'पुणे में बना', mr: 'पुण्यात बनलेले' },
  'pin.example': { en: 'Example photo', hi: 'उदाहरण फ़ोटो', mr: 'उदाहरण फोटो' },
  'pin.credit': { en: 'Photo: {name}, Unsplash', hi: 'फ़ोटो: {name}, Unsplash', mr: 'फोटो: {name}, Unsplash' },
  'feed.priceNote': {
    en: 'Prices on real rooms are for your {sqft} sq ft home, before GST.',
    hi: 'असली कमरों पर दाम आपके {sqft} वर्ग फ़ुट के घर के लिए हैं, GST से पहले।',
    mr: 'खऱ्या खोल्यांवरील किमती तुमच्या {sqft} चौ. फूट घरासाठी आहेत, GST आधी.',
  },
  'feed.priceNoteTypical': {
    en: 'Prices on real rooms are for a typical {sqft} sq ft home, before GST. Your Home Profile makes them yours.',
    hi: 'असली कमरों पर दाम आम {sqft} वर्ग फ़ुट के घर के लिए हैं, GST से पहले। आपकी Home Profile उन्हें आपके घर के हिसाब से बनाती है।',
    mr: 'खऱ्या खोल्यांवरील किमती साधारण {sqft} चौ. फूट घरासाठी आहेत, GST आधी. तुमची Home Profile त्या तुमच्या घरानुसार करते.',
  },
  'pin.andUp': { en: '{from} and up', hi: '{from} और ऊपर', mr: '{from} आणि पुढे' },

  'feed.more': { en: 'Show more rooms', hi: 'और कमरे दिखाएँ', mr: 'आणखी खोल्या दाखवा' },
  'feed.end': {
    en: "You've seen every room we have for now. Studios add more every week.",
    hi: 'अभी के सभी कमरे आपने देख लिए। स्टूडियो हर हफ़्ते और जोड़ते हैं।',
    mr: 'सध्याच्या सर्व खोल्या तुम्ही पाहिल्या. स्टुडिओ दर आठवड्याला आणखी जोडतात.',
  },
  'feed.honest': {
    en: "Rooms marked “Built in Pune” are finished homes by studios on One Interiors, shown without the studio's name. Example photos are free stock photos, marked as examples, with no price.",
    hi: '“पुणे में बना” वाले कमरे One Interiors के स्टूडियो के पूरे हुए घर हैं, स्टूडियो के नाम के बिना। उदाहरण फ़ोटो मुफ़्त स्टॉक फ़ोटो हैं, बिना दाम के।',
    mr: '“पुण्यात बनलेले” असलेल्या खोल्या One Interiors वरील स्टुडिओंची पूर्ण झालेली घरे आहेत, स्टुडिओच्या नावाशिवाय. उदाहरण फोटो मोफत स्टॉक फोटो आहेत, किमतीशिवाय.',
  },
  'feed.reset': { en: 'Start again', hi: 'फिर से शुरू करें', mr: 'पुन्हा सुरू करा' },

  'boards.title': { en: 'Your boards', hi: 'आपके बोर्ड', mr: 'तुमचे बोर्ड' },
  'boards.empty': { en: 'Nothing saved yet. Tap Save on a room you love.', hi: 'अभी कुछ सेव नहीं। पसंद के कमरे पर सेव दबाइए।', mr: 'अजून काही सेव्ह नाही. आवडलेल्या खोलीवर सेव्ह दाबा.' },
  'boards.remove': { en: 'Remove', hi: 'हटाएँ', mr: 'काढा' },

  'reveal.eyebrow': { en: 'Your style', hi: 'आपका स्टाइल', mr: 'तुमची स्टाइल' },
  'reveal.lede': { en: 'From the {n} rooms you saved.', hi: 'आपके सेव किए {n} कमरों से।', mr: 'तुम्ही सेव्ह केलेल्या {n} खोल्यांवरून.' },
  'reveal.colours': { en: 'Its colours', hi: 'इसके रंग', mr: 'त्याचे रंग' },
  'reveal.materials': { en: 'Materials that suit it', hi: 'इसके साथ जमने वाले मटीरियल', mr: 'याला शोभणारे मटेरियल' },
  'reveal.price': {
    en: 'The real rooms you saved were built at {tier}: {range} for your home, before GST.',
    hi: 'आपके सेव किए असली कमरे {tier} में बने थे: आपके घर के लिए {range}, GST से पहले।',
    mr: 'तुम्ही सेव्ह केलेल्या खऱ्या खोल्या {tier} मध्ये बनल्या होत्या: तुमच्या घरासाठी {range}, GST आधी.',
  },
  'reveal.start': { en: 'Start my Home Profile with this style', hi: 'इस स्टाइल से मेरी Home Profile शुरू करें', mr: 'या स्टाइलने माझी Home Profile सुरू करा' },
  'reveal.use': { en: 'Use this style in my Home Profile', hi: 'यह स्टाइल मेरी Home Profile में जोड़ें', mr: 'ही स्टाइल माझ्या Home Profile मध्ये वापरा' },
  'reveal.used': { en: 'Added to your Home Profile.', hi: 'आपकी Home Profile में जुड़ गया।', mr: 'तुमच्या Home Profile मध्ये जोडले.' },
  'reveal.seeMatches': { en: 'See studios that fit', hi: 'फ़िट होने वाले स्टूडियो देखें', mr: 'जुळणारे स्टुडिओ पाहा' },
  'reveal.keep': { en: 'Keep scrolling', hi: 'और देखते रहें', mr: 'आणखी पाहत राहा' },
  'reveal.next': {
    en: 'Next: your Home Profile turns this style into priced looks for your own rooms, and studios quote on it.',
    hi: 'आगे: आपकी Home Profile इस स्टाइल को आपके कमरों के दाम वाले लुक में बदलती है, और स्टूडियो उसी पर कोटेशन देते हैं।',
    mr: 'पुढे: तुमची Home Profile ही स्टाइल तुमच्या खोल्यांसाठी किमतीसह लुकमध्ये बदलते, आणि स्टुडिओ त्यावरच कोटेशन देतात.',
  },
} satisfies Record<string, Tx>;

import type { Entry } from './entry';

/** Discover's words in the app (owner, 7 Nov 2026), English, Hindi and Marathi (first draft: Sanyam reviews). */
export const discoverWords = {
  'me.discover': { en: 'Discover your style', hi: 'अपना स्टाइल खोजिए', mr: 'तुमची स्टाइल शोधा' },
  'me.discover.sub': { en: 'Save rooms you love; we show your style', hi: 'पसंद के कमरे सेव कीजिए; हम आपका स्टाइल दिखाएँगे', mr: 'आवडलेल्या खोल्या सेव्ह करा; आम्ही तुमची स्टाइल दाखवू' },
  'dc.title': { en: 'Save the rooms you love.', hi: 'जो कमरे पसंद हों, उन्हें सेव कीजिए।', mr: 'आवडलेल्या खोल्या सेव्ह करा.' },
  'dc.lede': {
    en: 'Real rooms built in Pune. Save what feels like home; after {n} saves we show your style.',
    hi: 'पुणे में बने असली कमरे। जो घर जैसा लगे उसे सेव कीजिए; {n} सेव के बाद हम आपका स्टाइल दिखाएँगे।',
    mr: 'पुण्यात बनलेल्या खऱ्या खोल्या. जे घरासारखे वाटते ते सेव्ह करा; {n} सेव्हनंतर आम्ही तुमची स्टाइल दाखवू.',
  },
  'dc.count': { en: '{n} of {total} saves', hi: '{total} में से {n} सेव', mr: '{total} पैकी {n} सेव्ह' },
  'dc.ready': { en: 'Your style is ready', hi: 'आपका स्टाइल तैयार है', mr: 'तुमची स्टाइल तयार आहे' },
  'dc.all': { en: 'All rooms', hi: 'सभी कमरे', mr: 'सर्व खोल्या' },
  'dc.room.living': { en: 'Living', hi: 'लिविंग', mr: 'लिव्हिंग' },
  'dc.room.kitchen': { en: 'Kitchen', hi: 'किचन', mr: 'किचन' },
  'dc.room.bedroom': { en: 'Bedroom', hi: 'बेडरूम', mr: 'बेडरूम' },
  'dc.room.mandir': { en: 'Mandir', hi: 'मंदिर', mr: 'देवघर' },
  'dc.save': { en: 'Save', hi: 'सेव', mr: 'सेव्ह' },
  'dc.saved': { en: 'Saved', hi: 'सेव हुआ', mr: 'सेव्ह झाले' },
  'dc.skip': { en: 'Not for me', hi: 'मेरे लिए नहीं', mr: 'माझ्यासाठी नाही' },
  'dc.built': { en: 'Built in Pune', hi: 'पुणे में बना', mr: 'पुण्यात बनलेले' },
  'dc.example': { en: 'Example photo', hi: 'उदाहरण फ़ोटो', mr: 'उदाहरण फोटो' },
  'dc.andUp': { en: '{from} and up', hi: '{from} और ऊपर', mr: '{from} आणि पुढे' },
  'dc.priceNote': {
    en: 'Prices on real rooms are for your {sqft} sq ft home, before GST.',
    hi: 'असली कमरों पर दाम आपके {sqft} वर्ग फ़ुट के घर के लिए हैं, GST से पहले।',
    mr: 'खऱ्या खोल्यांवरील किमती तुमच्या {sqft} चौ. फूट घरासाठी आहेत, GST आधी.',
  },
  'dc.priceNoteTypical': {
    en: 'Prices on real rooms are for a typical {sqft} sq ft home, before GST.',
    hi: 'असली कमरों पर दाम आम {sqft} वर्ग फ़ुट के घर के लिए हैं, GST से पहले।',
    mr: 'खऱ्या खोल्यांवरील किमती साधारण {sqft} चौ. फूट घरासाठी आहेत, GST आधी.',
  },
  'dc.more': { en: 'Show more rooms', hi: 'और कमरे दिखाएँ', mr: 'आणखी खोल्या दाखवा' },
  'dc.end': { en: "You've seen every room we have for now.", hi: 'अभी के सभी कमरे आपने देख लिए।', mr: 'सध्याच्या सर्व खोल्या तुम्ही पाहिल्या.' },
  'dc.yourStyle': { en: 'Your style', hi: 'आपका स्टाइल', mr: 'तुमची स्टाइल' },
  'dc.from': { en: 'From the {n} rooms you saved.', hi: 'आपके सेव किए {n} कमरों से।', mr: 'तुम्ही सेव्ह केलेल्या {n} खोल्यांवरून.' },
  'dc.builtAt': {
    en: 'The real rooms you saved were built at {tier}: {range} for your home, before GST.',
    hi: 'आपके सेव किए असली कमरे {tier} में बने थे: आपके घर के लिए {range}, GST से पहले।',
    mr: 'तुम्ही सेव्ह केलेल्या खऱ्या खोल्या {tier} मध्ये बनल्या होत्या: तुमच्या घरासाठी {range}, GST आधी.',
  },
  'dc.use': { en: 'Use this style in my Home Profile', hi: 'यह स्टाइल मेरी Home Profile में जोड़ें', mr: 'ही स्टाइल माझ्या Home Profile मध्ये वापरा' },
  'dc.used': { en: 'Added to your Home Profile.', hi: 'आपकी Home Profile में जुड़ गया।', mr: 'तुमच्या Home Profile मध्ये जोडले.' },
  'dc.start': { en: 'Start my Home Profile', hi: 'मेरी Home Profile शुरू करें', mr: 'माझी Home Profile सुरू करा' },
  'dc.noProfile': {
    en: 'Start your Home Profile to keep these saves and use this style.',
    hi: 'ये सेव रखने और यह स्टाइल इस्तेमाल करने के लिए अपनी Home Profile शुरू कीजिए।',
    mr: 'हे सेव्ह ठेवण्यासाठी आणि ही स्टाइल वापरण्यासाठी तुमची Home Profile सुरू करा.',
  },
  'dc.honest': {
    en: "“Built in Pune” rooms are finished homes by studios on One Interiors, shown without the studio's name. Example photos are free stock photos, with no price.",
    hi: '“पुणे में बना” कमरे One Interiors के स्टूडियो के पूरे हुए घर हैं, स्टूडियो के नाम के बिना। उदाहरण फ़ोटो मुफ़्त स्टॉक फ़ोटो हैं, बिना दाम के।',
    mr: '“पुण्यात बनलेले” खोल्या One Interiors वरील स्टुडिओंची पूर्ण झालेली घरे आहेत, स्टुडिओच्या नावाशिवाय. उदाहरण फोटो मोफत स्टॉक फोटो आहेत, किमतीशिवाय.',
  },
} satisfies Record<string, Entry>;

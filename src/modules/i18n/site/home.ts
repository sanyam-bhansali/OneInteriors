/**
 * The home page (/) in English, Hindi and Marathi: the hero, the five steps,
 * the example match and quote, the trust tiles, the styles, the finish levels,
 * the benefits, the FAQ and the footer — plus the live price and the 3D flat
 * (components/landing-v3) the page borrows.
 *
 * FIRST DRAFT for native-speaker review — see `modules/i18n/site.ts`.
 * The English must stay identical to what the page said before.
 * `benefit.*` mirrors BENEFITS[].terms (modules/portal/benefits.ts) and
 * `style.*` mirrors STYLE_DEFINITIONS (modules/inspiration/reading.ts),
 * capitalised; the page falls back to that English when a key is missing, so
 * keep these in step with them.
 */

import type { Tx } from '../site';

export const HOME_DICT = {
  // ── page metadata ──
  'meta.title': {
    en: 'One Interiors — verified interior studios in Pune',
    hi: 'One Interiors — पुणे के जाँचे हुए इंटीरियर स्टूडियो',
    mr: 'One Interiors — पुण्यातले तपासलेले इंटिरियर स्टुडिओ',
  },
  'meta.description': {
    en: 'A four-minute brief about your flat. Verified studios matched to your answers, every quote priced in seconds on their own rates, and a 30-minute call with our architect.',
    hi: 'आपके फ़्लैट के बारे में चार मिनट का ब्रीफ़। आपके जवाबों से मेल खाते जाँचे हुए स्टूडियो, उनके अपने रेट पर सेकंडों में हर कोटेशन, और हमारी आर्किटेक्ट के साथ 30 मिनट की कॉल।',
    mr: 'तुमच्या फ्लॅटबद्दल चार मिनिटांचा ब्रीफ. तुमच्या उत्तरांशी जुळणारे तपासलेले स्टुडिओ, त्यांच्याच दरांवर काही सेकंदांत प्रत्येक कोटेशन, आणि आमच्या आर्किटेक्टसोबत 30 मिनिटांचा कॉल.',
  },

  // ── nav ──
  'cursor.start': { en: 'Start', hi: 'शुरू करें', mr: 'सुरू करा' },
  'nav.logo': { en: 'One Interiors, back to top', hi: 'One Interiors, ऊपर जाएँ', mr: 'One Interiors, वर जा' },
  'nav.aria': { en: 'Main', hi: 'मुख्य', mr: 'मुख्य' },
  'nav.how': { en: 'How it works', hi: 'यह कैसे काम करता है', mr: 'हे कसे काम करते' },
  'nav.styles': { en: 'Styles', hi: 'स्टाइल', mr: 'स्टाईल' },
  'nav.benefits': { en: 'Benefits', hi: 'फ़ायदे', mr: 'फायदे' },
  'nav.faq': { en: 'FAQ', hi: 'सवाल-जवाब', mr: 'प्रश्नोत्तरे' },
  'cta.find': { en: 'Find your designer', hi: 'अपना डिज़ाइनर खोजें', mr: 'तुमचा डिझायनर शोधा' },
  'cta.expert': { en: 'Book your expert call', hi: 'अपनी एक्सपर्ट कॉल बुक करें', mr: 'तुमचा एक्सपर्ट कॉल बुक करा' },

  // ── hero ──
  'hero.aria': { en: 'Introduction', hi: 'परिचय', mr: 'ओळख' },
  'hero.meta': {
    en: 'Pune · {n} verified studios · Quotes you can read',
    hi: 'पुणे · {n} जाँचे हुए स्टूडियो · समझ में आने वाले कोटेशन',
    mr: 'पुणे · {n} तपासलेले स्टुडिओ · समजणारी कोटेशन्स',
  },
  'hero.h1': {
    en: 'Find the right interior designer for your home.',
    hi: 'अपने घर के लिए सही इंटीरियर डिज़ाइनर खोजें।',
    mr: 'तुमच्या घरासाठी योग्य इंटिरियर डिझायनर शोधा.',
  },
  'hero.sub': {
    en: 'Tell us about your flat in four minutes. We match you with studios that actually fit it, price every one on its own rates, line by line, and a 30-minute call with our architect helps you choose.',
    hi: 'चार मिनट में अपने फ़्लैट के बारे में बताइए। हम आपको उन स्टूडियो से मिलाते हैं जो सच में आपके घर के लिए सही हैं, हर एक का दाम उसके अपने रेट पर, लाइन-दर-लाइन निकालते हैं, और हमारी आर्किटेक्ट के साथ 30 मिनट की कॉल आपको चुनने में मदद करती है।',
    mr: 'चार मिनिटांत तुमच्या फ्लॅटबद्दल सांगा. तुमच्या घराला खरोखर जुळणाऱ्या स्टुडिओंशी आम्ही तुमची ओळख करून देतो, प्रत्येकाची किंमत त्याच्याच दरांवर, ओळीनुसार काढतो, आणि आमच्या आर्किटेक्टसोबत 30 मिनिटांचा कॉल तुम्हाला निवड करायला मदत करतो.',
  },
  'hero.cta': { en: 'Find your interior designer', hi: 'अपना इंटीरियर डिज़ाइनर खोजें', mr: 'तुमचा इंटिरियर डिझायनर शोधा' },
  'hero.how': { en: 'See how it works', hi: 'देखें यह कैसे काम करता है', mr: 'हे कसे चालते ते पाहा' },

  // ── what we do ──
  'ov.label': { en: 'What we do', hi: 'हम क्या करते हैं', mr: 'आम्ही काय करतो' },
  'ov.text': {
    en: 'We check Pune’s interior studios fifteen ways, read fifty of each one’s own quotations, and turn your brief into quotes you can compare line by line — before you ring anyone.',
    hi: 'हम पुणे के इंटीरियर स्टूडियो को पंद्रह तरह से जाँचते हैं, हर एक के अपने पचास कोटेशन पढ़ते हैं, और आपके ब्रीफ़ को ऐसे कोटेशन में बदलते हैं जिन्हें आप लाइन-दर-लाइन मिला सकें — किसी को फ़ोन करने से पहले।',
    mr: 'आम्ही पुण्यातले इंटिरियर स्टुडिओ पंधरा प्रकारे तपासतो, प्रत्येकाची स्वतःची पन्नास कोटेशन्स वाचतो, आणि तुमच्या ब्रीफचे रूपांतर अशा कोटेशन्समध्ये करतो ज्यांची तुम्ही ओळीनुसार तुलना करू शकता — कोणालाही फोन करण्याआधी.',
  },

  // ── live price ──
  'price.label': { en: 'What would my home cost?', hi: 'मेरे घर का खर्च कितना होगा?', mr: 'माझ्या घराला किती खर्च येईल?' },
  'price.h': { en: 'Your home, priced in a second.', hi: 'आपके घर का दाम, एक सेकंड में।', mr: 'तुमच्या घराची किंमत, एका सेकंदात.' },
  'price.lede': {
    en: 'Pick your home and a finish level. This is the range for a full home at that level; your brief turns it into real quotes from verified studios.',
    hi: 'अपना घर और फ़िनिश लेवल चुनिए। उस लेवल पर पूरे घर की यह रेंज है; आपका ब्रीफ़ इसे जाँचे हुए स्टूडियो के असली कोटेशन में बदल देता है।',
    mr: 'तुमचे घर आणि फिनिश लेव्हल निवडा. त्या लेव्हलवर संपूर्ण घरासाठी ही रेंज आहे; तुमचा ब्रीफ याचे तपासलेल्या स्टुडिओंच्या खऱ्या कोटेशन्समध्ये रूपांतर करतो.',
  },
  'lp.home': { en: 'Your home', hi: 'आपका घर', mr: 'तुमचे घर' },
  'lp.area': { en: 'Carpet area · {n} sq ft', hi: 'कारपेट एरिया · {n} sq ft', mr: 'कार्पेट एरिया · {n} sq ft' },
  'lp.areaAria': { en: 'Carpet area in square feet', hi: 'कारपेट एरिया, स्क्वेयर फ़ीट में', mr: 'कार्पेट एरिया, स्क्वेअर फूटमध्ये' },
  'lp.finish': { en: 'Finish level', hi: 'फ़िनिश लेवल', mr: 'फिनिश लेव्हल' },
  'lp.result': { en: 'A full home at {tier} · before GST', hi: '{tier} में पूरा घर · GST से पहले', mr: '{tier} मध्ये संपूर्ण घर · GST आधी' },
  'lp.from': { en: 'From {x}', hi: '{x} से', mr: '{x} पासून' },
  'lp.per': {
    en: '{per} per sq ft of carpet · {promise}',
    hi: 'कारपेट के प्रति sq ft {per} · {promise}',
    mr: 'कार्पेटच्या प्रति sq ft {per} · {promise}',
  },
  'lp.cta': { en: 'Get it priced by real studios', hi: 'असली स्टूडियो से दाम निकलवाएँ', mr: 'खऱ्या स्टुडिओंकडून किंमत काढा' },

  // ── how it works ──
  'how.label': { en: 'How it works · 5 steps', hi: 'यह कैसे काम करता है · 5 कदम', mr: 'हे कसे चालते · 5 टप्पे' },
  'how.h': {
    en: 'Every home starts dark and empty. Here is how yours comes together.',
    hi: 'हर घर अँधेरे और खाली से शुरू होता है। ऐसे सजता है आपका घर।',
    mr: 'प्रत्येक घर अंधारे आणि रिकामे असते. तुमचे घर असे आकार घेते.',
  },
  'step.brief.tag': { en: 'Brief', hi: 'ब्रीफ़', mr: 'ब्रीफ' },
  'step.brief.title': { en: 'Tell us about your home', hi: 'अपने घर के बारे में बताइए', mr: 'तुमच्या घराबद्दल सांगा' },
  'step.brief.body': {
    en: 'Twelve short screens: your flat, the work, the finish level, the styles you love and the ones you never want, and who lives there.',
    hi: 'बारह छोटी स्क्रीन: आपका फ़्लैट, काम, फ़िनिश लेवल, आपको पसंद आने वाले स्टाइल और जो बिल्कुल नहीं चाहिए, और घर में कौन रहता है।',
    mr: 'बारा छोट्या स्क्रीन: तुमचा फ्लॅट, काम, फिनिश लेव्हल, तुम्हाला आवडणाऱ्या स्टाईल आणि कधीच नको असलेल्या, आणि घरात कोण राहते.',
  },
  'step.brief.chip': { en: '12 screens · about 4 min', hi: '12 स्क्रीन · लगभग 4 मिनट', mr: '12 स्क्रीन · सुमारे 4 मिनिटे' },
  'step.match.tag': { en: 'Match', hi: 'मैच', mr: 'मॅच' },
  'step.match.title': { en: 'Meet the studios that fit', hi: 'आपके लिए सही स्टूडियो से मिलिए', mr: 'तुम्हाला जुळणारे स्टुडिओ भेटा' },
  'step.match.body': {
    en: '{n} verified studios, scored against your answers, each with the reason in your own words. Nobody can pay to rank higher.',
    hi: '{n} जाँचे हुए स्टूडियो, आपके जवाबों पर स्कोर किए गए, हर एक के साथ वजह आपके ही शब्दों में। पैसे देकर कोई ऊपर नहीं आ सकता।',
    mr: '{n} तपासलेले स्टुडिओ, तुमच्या उत्तरांवर स्कोअर केलेले, प्रत्येकासोबत कारण तुमच्याच शब्दांत. पैसे देऊन कोणीही वर येऊ शकत नाही.',
  },
  'step.match.chip': { en: '3–6 matches, each with its reason', hi: '3–6 मैच, हर एक की वजह के साथ', mr: '3–6 मॅच, प्रत्येकाच्या कारणासह' },
  'step.quote.tag': { en: 'Quote', hi: 'कोटेशन', mr: 'कोटेशन' },
  'step.quote.title': { en: 'Every quote in seconds', hi: 'हर कोटेशन सेकंडों में', mr: 'प्रत्येक कोटेशन काही सेकंदांत' },
  'step.quote.body': {
    en: 'Each studio priced on rates read from its own past quotations, line by line, with every board, finish and fitting named.',
    hi: 'हर स्टूडियो का दाम उसके अपने पुराने कोटेशन से लिए गए रेट पर, लाइन-दर-लाइन, हर बोर्ड, फ़िनिश और फ़िटिंग के नाम के साथ।',
    mr: 'प्रत्येक स्टुडिओची किंमत त्याच्याच जुन्या कोटेशन्समधून घेतलेल्या दरांवर, ओळीनुसार, प्रत्येक बोर्ड, फिनिश आणि फिटिंगच्या नावासह.',
  },
  'step.quote.chip': { en: 'Every match priced at once', hi: 'हर मैच का दाम एक साथ', mr: 'प्रत्येक मॅचची किंमत एकाच वेळी' },
  'step.compare.tag': { en: 'Compare', hi: 'तुलना', mr: 'तुलना' },
  'step.compare.title': { en: 'Compare them side by side', hi: 'आमने-सामने तुलना कीजिए', mr: 'शेजारी शेजारी तुलना करा' },
  'step.compare.body': {
    en: 'Room by room and material by material, with a plain-language summary of where the money really differs.',
    hi: 'कमरे-दर-कमरे और मटीरियल-दर-मटीरियल, आसान भाषा में सार के साथ कि असल में पैसे का फ़र्क कहाँ है।',
    mr: 'खोलीनुसार आणि मटेरियलनुसार, पैशांचा खरा फरक कुठे आहे याच्या सोप्या भाषेतल्या सारांशासह.',
  },
  'step.compare.chip': { en: 'Rooms · materials · summary', hi: 'कमरे · मटीरियल · सार', mr: 'खोल्या · मटेरियल · सारांश' },
  'step.architect.tag': { en: 'Architect', hi: 'आर्किटेक्ट', mr: 'आर्किटेक्ट' },
  'step.architect.title': {
    en: 'A 30-minute call with your architect',
    hi: 'आपकी आर्किटेक्ट के साथ 30 मिनट की कॉल',
    mr: 'तुमच्या आर्किटेक्टसोबत 30 मिनिटांचा कॉल',
  },
  'step.architect.body': {
    en: '{name} reads your brief and every quote first, tells you where the studios differ, and sets up the meeting with the one you choose.',
    hi: '{name} पहले आपका ब्रीफ़ और हर कोटेशन पढ़ती हैं, बताती हैं कि स्टूडियो में कहाँ फ़र्क है, और आपके चुने स्टूडियो के साथ मीटिंग तय करती हैं।',
    mr: '{name} आधी तुमचा ब्रीफ आणि प्रत्येक कोटेशन वाचतात, स्टुडिओंमध्ये कुठे फरक आहे ते सांगतात, आणि तुम्ही निवडलेल्या स्टुडिओसोबत मीटिंग ठरवतात.',
  },
  'step.architect.chip': { en: 'Then we introduce you', hi: 'फिर हम आपका परिचय कराते हैं', mr: 'मग आम्ही तुमची ओळख करून देतो' },

  // ── the checks reel: "{pre} <em>15</em> {post}" ──
  'reel.pre': { en: 'Every studio clears', hi: 'हर स्टूडियो', mr: 'प्रत्येक स्टुडिओ' },
  'reel.post': { en: 'checks', hi: 'जाँचें पास करता है', mr: 'तपासण्या पार करतो' },

  // ── matching panel ──
  'match.h': {
    en: 'Studios scored on your brief. Never on who paid.',
    hi: 'स्टूडियो आपके ब्रीफ़ पर स्कोर होते हैं। कभी इस पर नहीं कि किसने पैसे दिए।',
    mr: 'स्टुडिओ तुमच्या ब्रीफवर स्कोअर होतात. कोणी पैसे दिले यावर कधीच नाही.',
  },
  'brief.label': { en: 'An example brief', hi: 'एक उदाहरण ब्रीफ़', mr: 'एक उदाहरण ब्रीफ' },
  'brief.home': { en: 'Home', hi: 'घर', mr: 'घर' },
  'brief.area': { en: 'Carpet area', hi: 'कारपेट एरिया', mr: 'कार्पेट एरिया' },
  'brief.finish': { en: 'Finish level', hi: 'फ़िनिश लेवल', mr: 'फिनिश लेव्हल' },
  'brief.household': { en: 'Household', hi: 'परिवार', mr: 'कुटुंब' },
  'brief.householdV': { en: '2 adults, 1 elderly', hi: '2 बड़े, 1 बुज़ुर्ग', mr: '2 प्रौढ, 1 ज्येष्ठ' },
  'brief.leaning': { en: 'Leaning', hi: 'झुकाव', mr: 'कल' },
  'brief.first': { en: 'Put first', hi: 'सबसे ज़रूरी', mr: 'सर्वात महत्त्वाचे' },
  'match.studioA': { en: 'Studio A', hi: 'स्टूडियो A', mr: 'स्टुडिओ A' },
  'match.studioB': { en: 'Studio B', hi: 'स्टूडियो B', mr: 'स्टुडिओ B' },
  'match.studioC': { en: 'Studio C', hi: 'स्टूडियो C', mr: 'स्टुडिओ C' },
  'match.whyA': {
    en: 'Can start in January, when you get the keys',
    hi: 'जनवरी में शुरू कर सकते हैं, जब आपको चाबी मिलेगी',
    mr: 'जानेवारीत सुरू करू शकतात, जेव्हा तुम्हाला चावी मिळेल',
  },
  'match.whyB': {
    en: 'Three of their projects are like yours',
    hi: 'इनके तीन प्रोजेक्ट आपके जैसे हैं',
    mr: 'त्यांचे तीन प्रोजेक्ट तुमच्यासारखे आहेत',
  },
  'match.whyC': {
    en: 'Has designed for elderly parents before',
    hi: 'पहले भी बुज़ुर्ग माता-पिता के लिए डिज़ाइन कर चुके हैं',
    mr: 'याआधी ज्येष्ठ आई-वडिलांसाठी डिझाइन केले आहे',
  },
  'match.checks': { en: '{a}/{b} checks', hi: '{a}/{b} जाँच', mr: '{a}/{b} तपासण्या' },
  'match.note': {
    en: 'An example of how a match reads — your own matches are real studios, scored on your answers.',
    hi: 'मैच कैसा दिखता है, इसका एक उदाहरण — आपके मैच असली स्टूडियो होंगे, आपके जवाबों पर स्कोर किए हुए।',
    mr: 'मॅच कसा दिसतो याचे एक उदाहरण — तुमचे मॅच खरे स्टुडिओ असतील, तुमच्या उत्तरांवर स्कोअर केलेले.',
  },

  // ── the example quote ──
  'quote.h': { en: 'A quote you can actually read.', hi: 'ऐसा कोटेशन जो सच में समझ आए।', mr: 'खरोखर समजणारे कोटेशन.' },
  'quote.label': {
    en: 'Example · 2 BHK, 960 sq ft, full home · {n} lines · sample rates',
    hi: 'उदाहरण · 2 BHK, 960 sq ft, पूरा घर · {n} लाइनें · सैंपल रेट',
    mr: 'उदाहरण · 2 BHK, 960 sq ft, संपूर्ण घर · {n} ओळी · सॅम्पल दर',
  },
  'quote.more': { en: '{n} more lines', hi: '{n} और लाइनें', mr: 'आणखी {n} ओळी' },
  'quote.total': { en: 'Total for all {n} lines', hi: 'सभी {n} लाइनों का कुल', mr: 'सर्व {n} ओळींची एकूण रक्कम' },
  'quote.fees': {
    en: 'Fees and GST included · ±{pct}% until a site visit',
    hi: 'फ़ीस और GST शामिल · साइट विज़िट तक ±{pct}%',
    mr: 'फी आणि GST सहित · साइट भेटीपर्यंत ±{pct}%',
  },
  'home3d.aria': { en: 'Your home in 3D', hi: 'आपका घर 3D में', mr: 'तुमचे घर 3D मध्ये' },

  // ── the 3D flat (components/landing-v3/FlatStage) ──
  'flat.eyebrow': { en: 'Your home, in 3D', hi: 'आपका घर, 3D में', mr: 'तुमचे घर, 3D मध्ये' },
  'flat.h': { en: 'See it before anyone builds it.', hi: 'बनने से पहले ही देख लीजिए।', mr: 'बांधण्याआधीच पाहा.' },
  'flat.p': {
    en: 'Your brief draws your flat in the style you lean to — every room, in its palette. Scroll to build it; drag to turn it.',
    hi: 'आपका ब्रीफ़ आपके पसंदीदा स्टाइल में आपका फ़्लैट बनाता है — हर कमरा, उसके रंगों में। बनाने के लिए स्क्रॉल करें; घुमाने के लिए ड्रैग करें।',
    mr: 'तुमचा ब्रीफ तुमच्या आवडीच्या स्टाईलमध्ये तुमचा फ्लॅट काढतो — प्रत्येक खोली, तिच्या रंगांत. बांधण्यासाठी स्क्रोल करा; फिरवण्यासाठी ड्रॅग करा.',
  },
  'flat.styles': { en: 'Style', hi: 'स्टाइल', mr: 'स्टाईल' },
  'flat.note': {
    en: 'An example: a typical 3 BHK of 1,150 sq ft — a sketch, not a floor plan.',
    hi: 'एक उदाहरण: 1,150 sq ft का एक आम 3 BHK — एक स्केच, फ़्लोर प्लान नहीं।',
    mr: 'एक उदाहरण: 1,150 sq ft चा एक सामान्य 3 BHK — एक स्केच, फ्लोअर प्लॅन नाही.',
  },
  'flat.label': {
    en: 'A 3D sketch of a 3 BHK in {style}',
    hi: '{style} में एक 3 BHK का 3D स्केच',
    mr: '{style} मधील 3 BHK चे 3D स्केच',
  },

  // ── why trust us ──
  'trust.label': { en: 'Why trust us', hi: 'हम पर भरोसा क्यों', mr: 'आमच्यावर विश्वास का ठेवावा' },
  'trust.h': { en: 'Checked before you ever see them.', hi: 'आपके देखने से पहले ही जाँचे हुए।', mr: 'तुम्ही पाहण्याआधीच तपासलेले.' },
  'trust.checks': {
    en: 'Checks on every studio, each with a named source — from GST filings to finished sites we have stood in.',
    hi: 'हर स्टूडियो पर जाँच, हर एक का स्रोत बताया हुआ — GST रिटर्न से लेकर उन पूरे हुए घरों तक जहाँ हम खुद जाकर खड़े हुए।',
    mr: 'प्रत्येक स्टुडिओवर तपासण्या, प्रत्येकीचा स्रोत सांगितलेला — GST रिटर्नपासून आम्ही स्वतः जाऊन पाहिलेल्या पूर्ण कामांपर्यंत.',
  },
  'trust.quotes': {
    en: 'Of a studio’s own quotations read before it is listed, so every price you see is its own.',
    hi: 'किसी स्टूडियो के अपने कोटेशन, लिस्ट होने से पहले पढ़े जाते हैं, ताकि आपको दिखने वाला हर दाम उसी का हो।',
    mr: 'स्टुडिओची स्वतःची कोटेशन्स, लिस्ट होण्यापूर्वी वाचली जातात, म्हणजे तुम्हाला दिसणारी प्रत्येक किंमत त्याचीच असते.',
  },
  'trust.zero': {
    en: 'Paid by you for the brief, the matches, the quotes or the comparison.',
    hi: 'आपका खर्च — ब्रीफ़, मैच, कोटेशन या तुलना के लिए।',
    mr: 'तुमचा खर्च — ब्रीफ, मॅच, कोटेशन किंवा तुलनेसाठी.',
  },
  'arch.h': {
    en: 'Your architect is on our payroll. Never a studio’s.',
    hi: 'आपकी आर्किटेक्ट हमारी पेरोल पर हैं। किसी स्टूडियो की नहीं।',
    mr: 'तुमच्या आर्किटेक्ट आमच्या पेरोलवर आहेत. कोणत्याही स्टुडिओच्या नाही.',
  },
  'arch.p': {
    en: 'A 30-minute call with {name}. She reads your brief and every quote before it, tells you where the studios really differ, and sets up the meeting with the one you choose.',
    hi: '{name} के साथ 30 मिनट की कॉल। कॉल से पहले वे आपका ब्रीफ़ और हर कोटेशन पढ़ती हैं, बताती हैं कि स्टूडियो में असल फ़र्क कहाँ है, और आपके चुने स्टूडियो के साथ मीटिंग तय करती हैं।',
    mr: '{name} यांच्यासोबत 30 मिनिटांचा कॉल. कॉलच्या आधी त्या तुमचा ब्रीफ आणि प्रत्येक कोटेशन वाचतात, स्टुडिओंमध्ये खरा फरक कुठे आहे ते सांगतात, आणि तुम्ही निवडलेल्या स्टुडिओसोबत मीटिंग ठरवतात.',
  },
  // The offer box. English comes straight from modules/consultation/offer.ts.
  'offer.usually': { en: 'Usually {price}', hi: 'आम तौर पर {price}', mr: 'सहसा {price}' },
  'offer.free': { en: 'Free', hi: 'मुफ़्त', mr: 'मोफत' },
  'offer.forFirst': { en: 'for the first {n} customers', hi: 'पहले {n} ग्राहकों के लिए', mr: 'पहिल्या {n} ग्राहकांसाठी' },
  'offer.left1': { en: '{n} free call left', hi: '{n} मुफ़्त कॉल बाकी', mr: '{n} मोफत कॉल बाकी' },
  'offer.leftN': { en: '{n} free calls left', hi: '{n} मुफ़्त कॉल बाकी', mr: '{n} मोफत कॉल बाकी' },
  'offer.paid': { en: '{price} for a 30-minute call', hi: '30 मिनट की कॉल {price} में', mr: '30 मिनिटांच्या कॉलसाठी {price}' },

  // ── styles ──
  'styles.label': { en: 'Styles · pick yours in the brief', hi: 'स्टाइल · ब्रीफ़ में अपना चुनिए', mr: 'स्टाईल · ब्रीफमध्ये तुमची निवडा' },
  'styles.h': { en: 'Twelve styles. Which one is your home?', hi: 'बारह स्टाइल। आपका घर कौन-सा है?', mr: 'बारा स्टाईल. तुमचे घर कोणते?' },
  'styles.lede': {
    en: 'The same photographs you pick from in the brief. Studios’ own finished homes take their place here as they join.',
    hi: 'वही फ़ोटो जिनमें से आप ब्रीफ़ में चुनते हैं। स्टूडियो जुड़ते जाएँगे, तो उनके अपने बने हुए घर यहाँ इनकी जगह लेंगे।',
    mr: 'ब्रीफमध्ये तुम्ही ज्यातून निवडता तेच फोटो. स्टुडिओ जोडले जातील तसे त्यांची स्वतःची पूर्ण झालेली घरे इथे यांची जागा घेतील.',
  },
  'filter.aria': { en: 'Filter by room', hi: 'कमरे के हिसाब से छाँटें', mr: 'खोलीनुसार निवडा' },
  'filter.all': { en: 'All', hi: 'सभी', mr: 'सर्व' },
  'room.LIVING': { en: 'Living room', hi: 'लिविंग रूम', mr: 'लिव्हिंग रूम' },
  'room.BEDROOM': { en: 'Bedroom', hi: 'बेडरूम', mr: 'बेडरूम' },
  'room.KITCHEN': { en: 'Kitchen', hi: 'किचन', mr: 'किचन' },
  'rooms.LIVING': { en: 'Living rooms', hi: 'लिविंग रूम', mr: 'लिव्हिंग रूम' },
  'rooms.BEDROOM': { en: 'Bedrooms', hi: 'बेडरूम', mr: 'बेडरूम' },
  'rooms.KITCHEN': { en: 'Kitchens', hi: 'किचन', mr: 'किचन' },
  'gallery.aria': { en: 'Start your brief — {style}', hi: 'अपना ब्रीफ़ शुरू करें — {style}', mr: 'तुमचा ब्रीफ सुरू करा — {style}' },
  'gallery.credit': { en: 'Photo: {name} / Unsplash', hi: 'फ़ोटो: {name} / Unsplash', mr: 'फोटो: {name} / Unsplash' },
  // STYLE_DEFINITIONS, capitalised; the page adds the full stop.
  'style.contemporary-minimal': {
    en: 'Clean lines, flat surfaces, a neutral palette, almost no ornament',
    hi: 'साफ़ लाइनें, सपाट सतहें, न्यूट्रल रंग, लगभग कोई सजावट नहीं',
    mr: 'स्वच्छ रेषा, सपाट पृष्ठभाग, न्यूट्रल रंग, जवळजवळ सजावट नाही',
  },
  'style.warm-modern': {
    en: 'Modern forms softened with wood, warm neutrals and layered light',
    hi: 'मॉडर्न आकार, जिन्हें लकड़ी, गर्म न्यूट्रल रंग और परत-दर-परत रोशनी नरम बनाते हैं',
    mr: 'मॉडर्न आकार, लाकूड, उबदार न्यूट्रल रंग आणि थरांच्या प्रकाशाने मऊ केलेले',
  },
  'style.indian-contemporary': {
    en: 'Modern layouts with Indian materials — cane, brass, jaali, handloom, stone',
    hi: 'भारतीय मटीरियल के साथ मॉडर्न लेआउट — बेंत, पीतल, जाली, हैंडलूम, पत्थर',
    mr: 'भारतीय मटेरियलसह मॉडर्न मांडणी — वेत, पितळ, जाळी, हातमाग, दगड',
  },
  'style.scandinavian': {
    en: 'Light woods, whites and greys, functional, cosy textiles',
    hi: 'हल्की लकड़ी, सफ़ेद और ग्रे, काम की चीज़ें, आरामदायक कपड़े',
    mr: 'फिकट लाकूड, पांढरा आणि राखाडी, उपयुक्त, उबदार कापड',
  },
  'style.industrial': {
    en: 'Exposed materials — metal, concrete, brick — in darker tones',
    hi: 'खुले मटीरियल — मेटल, कंक्रीट, ईंट — गहरे रंगों में',
    mr: 'उघडे मटेरियल — धातू, काँक्रीट, वीट — गडद रंगांत',
  },
  'style.mid-century': {
    en: 'Walnut, tapered legs, retro shapes and bold accents',
    hi: 'अखरोट की लकड़ी, नीचे पतले होते पाए, रेट्रो आकार और बोल्ड रंग',
    mr: 'अक्रोडाचे लाकूड, निमुळते पाय, रेट्रो आकार आणि ठळक रंग',
  },
  'style.classical-ornate': {
    en: 'Mouldings, carving, rich fabrics and symmetry',
    hi: 'मोल्डिंग, नक्काशी, भारी कपड़े और संतुलित बनावट',
    mr: 'मोल्डिंग, कोरीवकाम, भरजरी कापड आणि समतोल',
  },
  'style.art-deco': {
    en: 'Geometry, brass and gold, velvet, jewel tones',
    hi: 'ज्यामितीय आकार, पीतल और सुनहरा, वेलवेट, रत्नों जैसे गहरे रंग',
    mr: 'भौमितिक आकार, पितळ आणि सोनेरी, वेलवेट, रत्नांसारखे गडद रंग',
  },
  'style.rustic-earthy': {
    en: 'Raw wood, terracotta, stone and handmade texture',
    hi: 'कच्ची लकड़ी, टेराकोटा, पत्थर और हाथ से बना टेक्सचर',
    mr: 'कच्चे लाकूड, टेराकोटा, दगड आणि हाताने बनवलेले टेक्स्चर',
  },
  'style.luxe-glam': {
    en: 'High gloss, marble, metallics, statement lighting',
    hi: 'हाई ग्लॉस, मार्बल, मेटैलिक और ध्यान खींचने वाली लाइटिंग',
    mr: 'हाय ग्लॉस, मार्बल, मेटॅलिक आणि लक्ष वेधणारी लायटिंग',
  },
  'style.japandi': {
    en: 'Low, calm and natural — Japanese restraint with Scandinavian warmth',
    hi: 'नीचा, शांत और प्राकृतिक — जापानी सादगी, स्कैंडिनेवियन गर्माहट के साथ',
    mr: 'बसके, शांत आणि नैसर्गिक — जपानी साधेपणा, स्कँडिनेव्हियन उबदारपणासह',
  },
  'style.coastal-light': {
    en: 'Whites and blues, airy rooms, natural fibres',
    hi: 'सफ़ेद और नीला, हवादार कमरे, प्राकृतिक रेशे',
    mr: 'पांढरा आणि निळा, हवेशीर खोल्या, नैसर्गिक धागे',
  },

  // ── finish levels ──
  'levels.label': {
    en: 'Finish levels · per sq ft of carpet, before GST',
    hi: 'फ़िनिश लेवल · कारपेट के प्रति sq ft, GST से पहले',
    mr: 'फिनिश लेव्हल · कार्पेटच्या प्रति sq ft, GST आधी',
  },
  'levels.h': {
    en: 'Three levels, described in materials rather than adjectives.',
    hi: 'तीन लेवल, विशेषणों में नहीं, मटीरियल में बताए गए।',
    mr: 'तीन लेव्हल, विशेषणांत नाही, मटेरियलमध्ये सांगितलेले.',
  },

  // ── benefits ──
  'ben.label': { en: 'One Interiors benefits', hi: 'One Interiors के फ़ायदे', mr: 'One Interiors चे फायदे' },
  'ben.h': {
    en: 'Everything you get when you do up your home with us.',
    hi: 'हमारे साथ घर सजवाने पर आपको जो कुछ मिलता है।',
    mr: 'आमच्यासोबत घर सजवताना तुम्हाला मिळणारे सगळे.',
  },
  'ben.lede': {
    en: 'The first five change how you choose a studio. The rest come only when you book through us — none of it comes with ringing a studio directly.',
    hi: 'पहले पाँच फ़ायदे बदल देते हैं कि आप स्टूडियो कैसे चुनते हैं। बाकी सिर्फ़ तब मिलते हैं जब आप हमारे ज़रिए बुक करते हैं — सीधे स्टूडियो को फ़ोन करने पर इनमें से कुछ नहीं मिलता।',
    mr: 'पहिले पाच फायदे तुम्ही स्टुडिओ कसा निवडता ते बदलतात. बाकीचे फक्त आमच्यामार्फत बुक केल्यावरच मिळतात — थेट स्टुडिओला फोन केल्यास यातले काहीच मिळत नाही.',
  },
  'ben.choosing': { en: 'Choosing with confidence', hi: 'भरोसे से चुनना', mr: 'खात्रीने निवड' },
  'ben.verified': { en: '{n} verified studios', hi: '{n} जाँचे हुए स्टूडियो', mr: '{n} तपासलेले स्टुडिओ' },
  'ben.quote': { en: 'A quote in seconds', hi: 'सेकंडों में कोटेशन', mr: 'काही सेकंदांत कोटेशन' },
  'ben.compare': { en: 'Quotes compared in plain language', hi: 'आसान भाषा में कोटेशन की तुलना', mr: 'सोप्या भाषेत कोटेशन्सची तुलना' },
  'ben.brief': { en: 'A comparison brief you can read', hi: 'पढ़ने लायक तुलना-सार', mr: 'वाचता येईल असा तुलना-सारांश' },
  'ben.briefP': {
    en: 'A one-page summary of how your quotes differ and why, to read with your family or print.',
    hi: 'एक पेज का सार कि आपके कोटेशन में क्या फ़र्क है और क्यों — परिवार के साथ पढ़ने या प्रिंट करने के लिए।',
    mr: 'तुमच्या कोटेशन्समध्ये काय फरक आहे आणि का, याचा एका पानाचा सारांश — कुटुंबासोबत वाचायला किंवा प्रिंट करायला.',
  },
  'ben.call': { en: 'A 30-minute call with {name}', hi: '{name} के साथ 30 मिनट की कॉल', mr: '{name} यांच्यासोबत 30 मिनिटांचा कॉल' },
  'ben.only': { en: 'Only when you book through us', hi: 'सिर्फ़ हमारे ज़रिए बुक करने पर', mr: 'फक्त आमच्यामार्फत बुक केल्यावर' },
  'bento.cashTag': { en: 'Up to · cashback', hi: 'तक · कैशबैक', mr: 'पर्यंत · कॅशबॅक' },
  'bento.cashH': { en: 'Cashback on your project', hi: 'आपके प्रोजेक्ट पर कैशबैक', mr: 'तुमच्या प्रोजेक्टवर कॅशबॅक' },
  'bento.refH': { en: 'Refer a friend', hi: 'दोस्त को रेफ़र करें', mr: 'मित्राला रेफर करा' },
  'bento.discFig': { en: 'Curated', hi: 'चुनिंदा', mr: 'निवडक' },
  'bento.discTag': { en: 'Discount', hi: 'डिस्काउंट', mr: 'सवलत' },
  'bento.discH': { en: 'One Interiors curated discount', hi: 'One Interiors चुनिंदा डिस्काउंट', mr: 'One Interiors निवडक सवलत' },
  'bento.trk': { en: 'Project tracker', hi: 'प्रोजेक्ट ट्रैकर', mr: 'प्रोजेक्ट ट्रॅकर' },
  'bento.trkExample': { en: '· an example', hi: '· एक उदाहरण', mr: '· एक उदाहरण' },
  'bento.trkDay': { en: 'Day 38 of 75', hi: '75 में से दिन 38', mr: '75 पैकी दिवस 38' },
  'bento.stage.Design': { en: 'Design', hi: 'डिज़ाइन', mr: 'डिझाइन' },
  'bento.stage.Factory': { en: 'Factory', hi: 'फ़ैक्टरी', mr: 'फॅक्टरी' },
  'bento.stage.Site': { en: 'Site', hi: 'साइट', mr: 'साइट' },
  'bento.stage.Install': { en: 'Install', hi: 'इंस्टॉल', mr: 'इन्स्टॉल' },
  'bento.stage.Handover': { en: 'Handover', hi: 'हैंडओवर', mr: 'हँडओव्हर' },
  'bento.trkStatus': {
    en: 'Kitchen carcasses delivered to site',
    hi: 'किचन के ढाँचे साइट पर पहुँच गए',
    mr: 'किचनचे सांगाडे साइटवर पोहोचले',
  },
  'bento.trkOk': { en: 'On schedule', hi: 'समय पर', mr: 'वेळेवर' },
  'bento.trkTag': { en: 'Tracking', hi: 'ट्रैकिंग', mr: 'ट्रॅकिंग' },
  'bento.filmTag': { en: 'Film · worth ₹20,000', hi: 'फ़िल्म · ₹20,000 की', mr: 'फिल्म · ₹20,000 किमतीची' },
  'bento.filmH': { en: 'Cinematic film of your home', hi: 'आपके घर की सिनेमैटिक फ़िल्म', mr: 'तुमच्या घराची सिनेमॅटिक फिल्म' },
  'bento.hamperTag': { en: 'Handover · worth ₹5,000', hi: 'हैंडओवर · ₹5,000 का', mr: 'हँडओव्हर · ₹5,000 किमतीचा' },
  'bento.hamperH': { en: 'A gift at handover', hi: 'हैंडओवर पर एक तोहफ़ा', mr: 'हँडओव्हरला एक भेट' },
  'bento.cabFig': { en: 'Cab', hi: 'कैब', mr: 'कॅब' },
  'bento.cabTag': { en: 'Travel · worth ₹1,000', hi: 'सफ़र · ₹1,000 का', mr: 'प्रवास · ₹1,000 किमतीचा' },
  'bento.cabH': { en: 'Free cab to the studio', hi: 'स्टूडियो तक मुफ़्त कैब', mr: 'स्टुडिओपर्यंत मोफत कॅब' },
  // "{pre} <em>₹76,000</em> {post}"
  'worth.pre': { en: 'Worth up to', hi: 'कुल', mr: 'एकूण' },
  'worth.post': { en: '— only through us.', hi: 'तक के फ़ायदे — सिर्फ़ हमारे ज़रिए।', mr: 'पर्यंतचे फायदे — फक्त आमच्यामार्फत.' },
  // BENEFITS[].terms, by id.
  'benefit.verified': {
    en: 'Every studio you are shown has cleared our checks, each with its source and date.',
    hi: 'आपको दिखाया गया हर स्टूडियो हमारी जाँचें पास कर चुका है, हर जाँच के स्रोत और तारीख के साथ।',
    mr: 'तुम्हाला दाखवलेला प्रत्येक स्टुडिओ आमच्या तपासण्या पार करून आला आहे, प्रत्येकीच्या स्रोत आणि तारखेसह.',
  },
  'benefit.instant-quote': {
    en: 'Every studio that fits prices your home the moment you see them, on the same lines.',
    hi: 'जो भी स्टूडियो सही बैठता है, वह आपके देखते ही आपके घर का दाम बता देता है, एक जैसी लाइनों पर।',
    mr: 'जुळणारा प्रत्येक स्टुडिओ तुम्ही पाहताक्षणी तुमच्या घराची किंमत सांगतो, सारख्याच ओळींवर.',
  },
  'benefit.plain-compare': {
    en: 'Put quotes side by side by room and by material, with a summary whose every figure is checked.',
    hi: 'कोटेशन को कमरे और मटीरियल के हिसाब से आमने-सामने रखिए, ऐसे सार के साथ जिसका हर आँकड़ा जाँचा हुआ है।',
    mr: 'कोटेशन्स खोलीनुसार आणि मटेरियलनुसार शेजारी ठेवा, अशा सारांशासह ज्यातला प्रत्येक आकडा तपासलेला आहे.',
  },
  'benefit.unbiased-expert': {
    en: 'No studio pays our experts. They are there to help you choose, not to sell you one.',
    hi: 'हमारे एक्सपर्ट को कोई स्टूडियो पैसे नहीं देता। वे आपको चुनने में मदद के लिए हैं, कुछ बेचने के लिए नहीं।',
    mr: 'आमच्या एक्सपर्टना कोणताही स्टुडिओ पैसे देत नाही. ते तुम्हाला निवडायला मदत करण्यासाठी आहेत, काही विकण्यासाठी नाही.',
  },
  'benefit.curated-discount': {
    en: 'Studios that offer one show it as its own line on your quote — the same for every customer, never a struck-through price.',
    hi: 'जो स्टूडियो डिस्काउंट देते हैं, वे इसे आपके कोटेशन में अलग लाइन में दिखाते हैं — हर ग्राहक के लिए एक जैसा, कभी काटा हुआ दाम नहीं।',
    mr: 'जे स्टुडिओ सवलत देतात ते ती तुमच्या कोटेशनमध्ये वेगळ्या ओळीत दाखवतात — प्रत्येक ग्राहकासाठी सारखीच, कधीही खोडलेली किंमत नाही.',
  },
  'benefit.cashback': {
    en: 'Up to ₹50,000 back once you have signed with a studio through us and paid its first payment phase. If the project is cancelled before 20% of its value has been paid to the studio, the cashback is cancelled.',
    hi: 'हमारे ज़रिए स्टूडियो के साथ साइन करने और उसकी पहली पेमेंट किस्त देने पर ₹50,000 तक वापस। अगर स्टूडियो को प्रोजेक्ट की 20% रकम मिलने से पहले प्रोजेक्ट रद्द होता है, तो कैशबैक भी रद्द हो जाता है।',
    mr: 'आमच्यामार्फत स्टुडिओसोबत करार करून त्याचा पहिला पेमेंट टप्पा भरल्यावर ₹50,000 पर्यंत परत. स्टुडिओला प्रोजेक्टच्या किमतीपैकी 20% मिळण्याआधी प्रोजेक्ट रद्द झाला, तर कॅशबॅकही रद्द होतो.',
  },
  'benefit.referral': {
    en: 'Refer a friend. When their project with a studio chosen through us has its 20% advance paid, you get ₹10,000 — for every project that closes.',
    hi: 'किसी दोस्त को रेफ़र करें। हमारे ज़रिए चुने गए स्टूडियो के साथ उनके प्रोजेक्ट का 20% एडवांस दे दिया जाए, तो आपको ₹10,000 मिलते हैं — हर पक्के हुए प्रोजेक्ट पर।',
    mr: 'मित्राला रेफर करा. आमच्यामार्फत निवडलेल्या स्टुडिओसोबत त्यांच्या प्रोजेक्टचा 20% ॲडव्हान्स भरला की तुम्हाला ₹10,000 मिळतात — प्रत्येक पक्क्या झालेल्या प्रोजेक्टसाठी.',
  },
  'benefit.free-cab': {
    en: 'After your expert call, when a studio meeting is scheduled, we book your cab to the studio — the first trip, from anywhere in Pune.',
    hi: 'एक्सपर्ट कॉल के बाद, जब स्टूडियो के साथ मीटिंग तय हो जाती है, तो हम स्टूडियो तक आपकी कैब बुक करते हैं — पहली बार, पुणे में कहीं से भी।',
    mr: 'एक्सपर्ट कॉलनंतर, स्टुडिओसोबत मीटिंग ठरली की आम्ही स्टुडिओपर्यंत तुमची कॅब बुक करतो — पहिल्या फेरीसाठी, पुण्यात कुठूनही.',
  },
  'benefit.tracker': {
    en: 'Every stage of your home here, with its planned date, what is done and what has happened on site.',
    hi: 'आपके घर का हर चरण यहाँ, उसकी तय तारीख के साथ — क्या हो चुका है और साइट पर क्या हुआ।',
    mr: 'तुमच्या घराचा प्रत्येक टप्पा इथे, ठरलेल्या तारखेसह — काय झाले आणि साइटवर काय घडले.',
  },
  'benefit.cinematic-shoot': {
    en: 'When a studio chosen through us completes your home, we film it — a cinematic video, with a testimonial from you if you would like to give one, both yours to keep.',
    hi: 'जब हमारे ज़रिए चुना गया स्टूडियो आपका घर पूरा करता है, तो हम उसे फ़िल्माते हैं — एक सिनेमैटिक वीडियो, और अगर आप चाहें तो आपका टेस्टिमोनियल भी, दोनों हमेशा आपके।',
    mr: 'आमच्यामार्फत निवडलेला स्टुडिओ तुमचे घर पूर्ण करतो, तेव्हा आम्ही ते चित्रित करतो — एक सिनेमॅटिक व्हिडिओ, आणि तुमची इच्छा असेल तर तुमचे टेस्टिमोनियलही, दोन्ही कायम तुमचे.',
  },
  'benefit.onehamper': {
    en: 'At handover, every home built through us gets OneHamper — a gift from us.',
    hi: 'हैंडओवर पर, हमारे ज़रिए बने हर घर को OneHamper मिलता है — हमारी ओर से एक तोहफ़ा।',
    mr: 'हँडओव्हरच्या वेळी, आमच्यामार्फत बनलेल्या प्रत्येक घराला OneHamper मिळतो — आमच्याकडून एक भेट.',
  },

  // ── FAQ ──
  'faq.h': { en: 'The awkward questions first.', hi: 'पहले मुश्किल सवाल।', mr: 'आधी अवघड प्रश्न.' },
  // "{pre} <a>hello@…</a> {post}"
  'faq.pre': { en: 'Still unsure? Write to us at', hi: 'अब भी कोई सवाल? हमें', mr: 'अजूनही शंका आहे? आम्हाला' },
  'faq.post': {
    en: 'and one of our architects will reply.',
    hi: 'पर लिखिए, हमारे आर्किटेक्ट में से कोई जवाब देगा।',
    mr: 'वर लिहा, आमच्यापैकी एक आर्किटेक्ट उत्तर देईल.',
  },
  'faq.cost.q': { en: 'What does One Interiors cost me?', hi: 'One Interiors का मुझे कितना खर्च पड़ेगा?', mr: 'One Interiors साठी मला किती खर्च येईल?' },
  'faq.cost.a': {
    en: 'Nothing for the brief, the matches, the quotes or the comparison. The 30-minute call with our architect is ₹5,000, and free for our first 1,000 customers. A studio pays us a fee only if you book it, and that fee comes out of its margin, not your quote.',
    hi: 'ब्रीफ़, मैच, कोटेशन या तुलना के लिए कुछ नहीं। हमारी आर्किटेक्ट के साथ 30 मिनट की कॉल ₹5,000 की है, और हमारे पहले 1,000 ग्राहकों के लिए मुफ़्त। स्टूडियो हमें फ़ीस तभी देता है जब आप उसे बुक करते हैं, और वह फ़ीस उसके मार्जिन से जाती है, आपके कोटेशन से नहीं।',
    mr: 'ब्रीफ, मॅच, कोटेशन किंवा तुलनेसाठी काहीच नाही. आमच्या आर्किटेक्टसोबतचा 30 मिनिटांचा कॉल ₹5,000 चा आहे, आणि आमच्या पहिल्या 1,000 ग्राहकांसाठी मोफत. तुम्ही स्टुडिओ बुक केला तरच तो आम्हाला फी देतो, आणि ती फी त्याच्या मार्जिनमधून जाते, तुमच्या कोटेशनमधून नाही.',
  },
  'faq.seconds.q': { en: 'How can a quote be ready in seconds?', hi: 'कोटेशन सेकंडों में कैसे तैयार हो सकता है?', mr: 'कोटेशन काही सेकंदांत कसे तयार होऊ शकते?' },
  'faq.seconds.a': {
    en: 'No studio is phoned. Every listed studio’s rates are read from at least fifty of its own past quotations. Our system applies them to your brief and writes the quote line by line — their pricing, not our estimate. The studio confirms or revises it after a site visit.',
    hi: 'किसी स्टूडियो को फ़ोन नहीं किया जाता। हर लिस्टेड स्टूडियो के रेट उसके अपने कम से कम पचास पुराने कोटेशन से लिए जाते हैं। हमारा सिस्टम उन्हें आपके ब्रीफ़ पर लगाकर लाइन-दर-लाइन कोटेशन बनाता है — उनकी कीमतें, हमारा अंदाज़ा नहीं। साइट विज़िट के बाद स्टूडियो इसे पक्का करता है या बदलता है।',
    mr: 'कोणत्याही स्टुडिओला फोन केला जात नाही. प्रत्येक लिस्टेड स्टुडिओचे दर त्याच्याच किमान पन्नास जुन्या कोटेशन्समधून घेतले जातात. आमची सिस्टम ते तुमच्या ब्रीफवर लावून ओळीनुसार कोटेशन तयार करते — त्यांच्या किमती, आमचा अंदाज नाही. साइट भेटीनंतर स्टुडिओ ते पक्के करतो किंवा बदलतो.',
  },
  'faq.rank.q': { en: 'Can a studio pay to rank higher?', hi: 'क्या कोई स्टूडियो पैसे देकर ऊपर आ सकता है?', mr: 'स्टुडिओ पैसे देऊन वर येऊ शकतो का?' },
  'faq.rank.a': {
    en: 'No. Matches are scored on your answers and on the checks a studio has cleared. There is no paid placement, and every match shows its score and the reason behind it.',
    hi: 'नहीं। मैच का स्कोर आपके जवाबों और स्टूडियो की पास की गई जाँचों पर बनता है। पैसे देकर जगह नहीं मिलती, और हर मैच अपना स्कोर और उसकी वजह दिखाता है।',
    mr: 'नाही. मॅचचा स्कोअर तुमच्या उत्तरांवर आणि स्टुडिओने पार केलेल्या तपासण्यांवर ठरतो. पैसे देऊन जागा मिळत नाही, आणि प्रत्येक मॅच त्याचा स्कोअर आणि त्यामागचे कारण दाखवतो.',
  },
  'faq.number.q': {
    en: 'Will my number be passed to ten contractors?',
    hi: 'क्या मेरा नंबर दस ठेकेदारों को दे दिया जाएगा?',
    mr: 'माझा नंबर दहा कंत्राटदारांना दिला जाईल का?',
  },
  'faq.number.a': {
    en: 'No. No studio sees your name or number until after your call with our architect — and then only the studios you choose, with your agreement.',
    hi: 'नहीं। हमारी आर्किटेक्ट के साथ आपकी कॉल से पहले कोई स्टूडियो आपका नाम या नंबर नहीं देखता — और उसके बाद भी सिर्फ़ वही स्टूडियो जिन्हें आप चुनें, आपकी सहमति से।',
    mr: 'नाही. आमच्या आर्किटेक्टसोबत तुमचा कॉल होईपर्यंत कोणताही स्टुडिओ तुमचे नाव किंवा नंबर पाहत नाही — आणि त्यानंतरही फक्त तुम्ही निवडलेले स्टुडिओ, तुमच्या संमतीने.',
  },
  'faq.architect.q': { en: 'What does the architect actually do?', hi: 'आर्किटेक्ट असल में क्या करती हैं?', mr: 'आर्किटेक्ट नेमके काय करतात?' },
  'faq.architect.a': {
    en: 'A 30-minute call. {name} reads your brief and every quote before it, tells you where the studios really differ and what to ask them, and sets up the meeting with the one you choose. She is on our payroll, so she never earns more by pushing a particular studio.',
    hi: '30 मिनट की एक कॉल। कॉल से पहले {name} आपका ब्रीफ़ और हर कोटेशन पढ़ती हैं, बताती हैं कि स्टूडियो में असल फ़र्क कहाँ है और उनसे क्या पूछना है, और आपके चुने स्टूडियो के साथ मीटिंग तय करती हैं। वे हमारी पेरोल पर हैं, इसलिए किसी खास स्टूडियो को आगे बढ़ाने से उन्हें ज़्यादा कमाई नहीं होती।',
    mr: '30 मिनिटांचा एक कॉल. कॉलच्या आधी {name} तुमचा ब्रीफ आणि प्रत्येक कोटेशन वाचतात, स्टुडिओंमध्ये खरा फरक कुठे आहे आणि त्यांना काय विचारायचे ते सांगतात, आणि तुम्ही निवडलेल्या स्टुडिओसोबत मीटिंग ठरवतात. त्या आमच्या पेरोलवर आहेत, त्यामुळे एखाद्या ठराविक स्टुडिओला पुढे केल्याने त्यांना जास्त कमाई होत नाही.',
  },
  'faq.pune.q': { en: 'Do you work outside Pune?', hi: 'क्या आप पुणे के बाहर काम करते हैं?', mr: 'तुम्ही पुण्याबाहेर काम करता का?' },
  'faq.pune.a': {
    en: 'Not yet. Verification means visiting sites and calling past clients, so we work one city at a time. Right now that is Pune and Pimpri-Chinchwad.',
    hi: 'अभी नहीं। जाँच का मतलब है साइट पर जाना और पुराने ग्राहकों को फ़ोन करना, इसलिए हम एक बार में एक शहर में काम करते हैं। अभी यह पुणे और पिंपरी-चिंचवड है।',
    mr: 'अजून नाही. तपासणी म्हणजे साइटवर जाणे आणि जुन्या ग्राहकांना फोन करणे, म्हणून आम्ही एका वेळी एकाच शहरात काम करतो. सध्या ते पुणे आणि पिंपरी-चिंचवड आहे.',
  },

  // ── outro + footer ──
  'outro.h': { en: 'Four minutes. Then a quote you can read.', hi: 'चार मिनट। फिर ऐसा कोटेशन जो समझ आए।', mr: 'चार मिनिटे. मग समजणारे कोटेशन.' },
  'outro.p': {
    en: 'No phone call, and nothing payable by you for the brief, your matches or your quotes.',
    hi: 'कोई फ़ोन कॉल नहीं, और ब्रीफ़, मैच या कोटेशन के लिए आपको कुछ नहीं देना।',
    mr: 'फोन कॉल नाही, आणि ब्रीफ, मॅच किंवा कोटेशन्ससाठी तुम्हाला काहीच भरायचे नाही.',
  },
  'foot.hours': { en: 'Tue–Sun · 11:00–19:00 IST', hi: 'मंगल–रवि · 11:00–19:00 IST', mr: 'मंगळ–रवि · 11:00–19:00 IST' },
  'foot.p': {
    en: 'Interior studios in Pune, checked fifteen ways and quoted line by line.',
    hi: 'पुणे के इंटीरियर स्टूडियो, पंद्रह तरह से जाँचे हुए और लाइन-दर-लाइन कोटेशन वाले।',
    mr: 'पुण्यातले इंटिरियर स्टुडिओ, पंधरा प्रकारे तपासलेले आणि ओळीनुसार कोटेशन असलेले.',
  },
  'foot.aria': { en: 'Footer', hi: 'फ़ुटर', mr: 'फूटर' },
  'foot.apply': { en: 'Apply to be listed', hi: 'लिस्ट होने के लिए आवेदन करें', mr: 'लिस्ट होण्यासाठी अर्ज करा' },
  'foot.checks': { en: 'The fifteen checks', hi: 'पंद्रह जाँचें', mr: 'पंधरा तपासण्या' },
  'foot.studio': { en: 'Studio sign-in', hi: 'स्टूडियो साइन-इन', mr: 'स्टुडिओ साइन-इन' },
  'foot.copy': {
    en: '© 2026 One Interiors · Pune, Maharashtra',
    hi: '© 2026 One Interiors · पुणे, महाराष्ट्र',
    mr: '© 2026 One Interiors · पुणे, महाराष्ट्र',
  },
  'foot.legal': { en: 'Legal', hi: 'कानूनी', mr: 'कायदेशीर' },
  'foot.privacy': { en: 'Privacy', hi: 'प्राइवेसी', mr: 'प्रायव्हसी' },
} satisfies Record<string, Tx>;

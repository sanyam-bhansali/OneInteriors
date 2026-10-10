/**
 * The matches page (/match) in English, Hindi and Marathi: the hero, each
 * studio card, its work and checks, the compare bar and the quote screen's
 * own words. Shared labels (property, scope, room, checks) live in labels.ts.
 *
 * FIRST DRAFT for native-speaker review — see `modules/i18n/site.ts`.
 * The English must stay identical to what the page said before.
 * `factor.*` mirrors FACTOR_LABELS and `why.*` mirrors FILTER_REASON_LABELS
 * (modules/matching/score.ts); keep the English in step with them.
 */

import type { Tx } from '../site';

export const MATCH_DICT = {
  // ── page metadata ──
  'meta.title': { en: 'Your matches', hi: 'आपके मैच', mr: 'तुमचे मॅच' },
  'meta.description': {
    en: 'Studios ranked for your home, with the reasoning shown.',
    hi: 'आपके घर के लिए स्टूडियो की रैंकिंग, वजह के साथ।',
    mr: 'तुमच्या घरासाठी स्टुडिओंची क्रमवारी, कारणांसह.',
  },

  // ── what the ranking is for ──
  'for.homeIn': { en: 'your {home} in {where}', hi: '{where} में आपके {home}', mr: '{where} येथील तुमचे {home}' },
  'for.home': { en: 'your {home}', hi: 'आपके {home}', mr: 'तुमचे {home}' },
  'for.anyHomeIn': { en: 'your home in {where}', hi: '{where} में आपके घर', mr: '{where} येथील तुमचे घर' },
  'for.anyHome': { en: 'your home', hi: 'आपके घर', mr: 'तुमचे घर' },

  // ── the band line under a quote ──
  'band.lead': { en: 'Before GST it is {amount}', hi: 'GST से पहले यह {amount} है', mr: 'GST आधी हे {amount} आहे' },
  'band.from': { en: 'from {amount}', hi: '{amount} से शुरू', mr: '{amount} पासून' },
  'band.what': { en: ' for {scope}', hi: '{scope} के लिए ', mr: '{scope} साठी ' },
  'band.inside': {
    en: '{lead}, inside your {level} range{what} ({range}).',
    hi: '{lead}, {what}आपकी {level} रेंज के अंदर ({range})।',
    mr: '{lead}, {what}तुमच्या {level} रेंजमध्ये ({range}).',
  },
  'band.above': {
    en: '{lead}, {by} above your {level} range{what} ({range}).',
    hi: '{lead}, {what}आपकी {level} रेंज ({range}) से {by} ज़्यादा।',
    mr: '{lead}, {what}तुमच्या {level} रेंजपेक्षा ({range}) {by} जास्त.',
  },
  'band.below': {
    en: '{lead}, {by} below your {level} range{what} ({range}).',
    hi: '{lead}, {what}आपकी {level} रेंज ({range}) से {by} कम।',
    mr: '{lead}, {what}तुमच्या {level} रेंजपेक्षा ({range}) {by} कमी.',
  },

  // ── scope phrase (non-English; English uses scopePhrase as is) ──
  'scope.and': { en: 'and', hi: 'और', mr: 'आणि' },
  'scope.renoWith': { en: 'Renovation — civil work and {rooms}', hi: 'रिनोवेशन — सिविल काम और {rooms}', mr: 'नूतनीकरण — सिव्हिल काम आणि {rooms}' },
  'scope.reno': { en: 'Renovation — civil work', hi: 'रिनोवेशन — सिविल काम', mr: 'नूतनीकरण — सिव्हिल काम' },

  // ── the quote screen ──
  'quote.back': { en: '← Back to your matches', hi: '← अपने मैच पर वापस जाएँ', mr: '← तुमच्या मॅचकडे परत' },
  'quote.label': { en: '{studio} · your quote', hi: '{studio} · आपका कोटेशन', mr: '{studio} · तुमचे कोटेशन' },
  'quote.change': { en: '{change}, not saved', hi: '{change}, सेव नहीं हुआ', mr: '{change}, सेव्ह केलेले नाही' },
  'quote.ring': { en: 'Before you ring {studio}', hi: '{studio} को फ़ोन करने से पहले', mr: '{studio} ला फोन करण्यापूर्वी' },
  'quote.onPage': { en: 'See this on {studio}’s page', hi: 'इसे {studio} के पेज पर देखें', mr: 'हे {studio} च्या पेजवर पाहा' },
  'quote.another': { en: 'Price another studio', hi: 'दूसरे स्टूडियो का दाम देखें', mr: 'दुसऱ्या स्टुडिओची किंमत पाहा' },

  // ── progress spine facts ──
  'spine.bhk': { en: '{n} BHK', hi: '{n} BHK', mr: '{n} BHK' },
  'spine.fit': { en: '{n} fit', hi: '{n} फ़िट', mr: '{n} जुळले' },
  'spine.priced': { en: '{n} priced', hi: '{n} के दाम', mr: '{n} च्या किमती' },
  'spine.selected': { en: '{n} selected', hi: '{n} चुने', mr: '{n} निवडले' },

  // ── empty states ──
  'empty.eyebrow': { en: 'Who fits', hi: 'कौन फ़िट है', mr: 'कोण जुळते' },
  'empty.noBrief': { en: 'Tell us about your flat first.', hi: 'पहले अपने फ़्लैट के बारे में बताइए।', mr: 'आधी तुमच्या फ्लॅटबद्दल सांगा.' },
  'empty.noFit': { en: 'Nobody on the roster fits this brief.', hi: 'हमारी लिस्ट में कोई भी स्टूडियो इस ब्रीफ़ में फ़िट नहीं होता।', mr: 'आमच्या यादीतील कोणताही स्टुडिओ या ब्रीफमध्ये बसत नाही.' },
  'empty.noBriefBody': {
    en: 'Scoring studios against an empty brief would give you the roster in an arbitrary order with numbers on it. About four minutes of your brief, and these become real.',
    hi: 'खाली ब्रीफ़ पर स्टूडियो को स्कोर करें तो बस बेतरतीब लिस्ट पर नंबर लग जाएँगे। अपने ब्रीफ़ पर करीब चार मिनट दीजिए, फिर ये नंबर सच में मायने रखेंगे।',
    mr: 'रिकाम्या ब्रीफवर स्टुडिओंना स्कोअर दिला तर फक्त कशीही लावलेली यादी आणि त्यावर आकडे मिळतील. तुमच्या ब्रीफला साधारण चार मिनिटे द्या, मग हे आकडे खरे ठरतील.',
  },
  'empty.start': { en: 'Start the brief', hi: 'ब्रीफ़ शुरू करें', mr: 'ब्रीफ सुरू करा' },
  'empty.noFitBody': {
    en: 'Nothing on the roster matches this brief — usually the level or the kind of work. Changing either is the quickest fix.',
    hi: 'लिस्ट में कोई भी इस ब्रीफ़ से मेल नहीं खाता — अक्सर वजह लेवल या काम का प्रकार होता है। इनमें से किसी एक को बदलना सबसे आसान उपाय है।',
    mr: 'यादीतील काहीही या ब्रीफशी जुळत नाही — बहुतेक वेळा कारण लेव्हल किंवा कामाचा प्रकार असतो. यापैकी एक बदलणे हा सर्वात सोपा उपाय आहे.',
  },
  'empty.change': { en: 'Change your answers', hi: 'अपने जवाब बदलें', mr: 'तुमची उत्तरे बदला' },

  // ── fewer than three ──
  'few.none': { en: 'No studio fits everything you asked for yet.', hi: 'अभी कोई भी स्टूडियो आपकी हर बात में फ़िट नहीं होता।', mr: 'अजून कोणताही स्टुडिओ तुमच्या सगळ्या अटींमध्ये बसत नाही.' },
  'few.one': { en: 'Only one studio fits everything you asked for.', hi: 'सिर्फ़ एक स्टूडियो आपकी हर बात में फ़िट होता है।', mr: 'फक्त एकच स्टुडिओ तुमच्या सगळ्या अटींमध्ये बसतो.' },
  'few.many': { en: 'Only {n} studios fit everything you asked for.', hi: 'सिर्फ़ {n} स्टूडियो आपकी हर बात में फ़िट होते हैं।', mr: 'फक्त {n} स्टुडिओ तुमच्या सगळ्या अटींमध्ये बसतात.' },
  'few.honest': { en: 'We would rather tell you than pad the list.', hi: 'लिस्ट को भरने के बजाय हम आपको साफ़ बताना बेहतर समझते हैं।', mr: 'यादी फुगवण्यापेक्षा तुम्हाला खरे सांगणे आम्हाला योग्य वाटते.' },
  'widen.ANY_ZONE': { en: 'Include studios from other parts of Pune', hi: 'पुणे के दूसरे इलाकों के स्टूडियो भी दिखाएँ', mr: 'पुण्याच्या इतर भागांतील स्टुडिओही दाखवा' },
  'widen.BAND_UP': { en: 'Show the level above yours too, clearly marked', hi: 'आपसे एक ऊपर का लेवल भी दिखाएँ, साफ़ निशान के साथ', mr: 'तुमच्या वरची लेव्हलही दाखवा, स्पष्ट खूण करून' },

  // ── why not the others ──
  'others.summary': { en: 'Why not the others ({n})', hi: 'बाकी क्यों नहीं ({n})', mr: 'बाकीचे का नाहीत ({n})' },
  'why.NOT_VERIFIED': { en: 'Not yet verified', hi: 'अभी जाँच पूरी नहीं हुई', mr: 'अजून तपासणी पूर्ण नाही' },
  'why.PAUSED': { en: 'Not taking new projects right now', hi: 'अभी नए प्रोजेक्ट नहीं ले रहे', mr: 'सध्या नवीन प्रोजेक्ट घेत नाहीत' },
  'why.DISLIKED_STYLE': { en: 'Much of their work is in a style you ruled out', hi: 'इनका ज़्यादातर काम उस स्टाइल में है जो आपने मना किया', mr: 'त्यांचे बरेचसे काम तुम्ही नाकारलेल्या स्टाइलमध्ये आहे' },
  'why.OTHER_BAND': { en: 'Works at a different level from the one you chose', hi: 'आपके चुने लेवल से अलग लेवल पर काम करते हैं', mr: 'तुम्ही निवडलेल्या लेव्हलपेक्षा वेगळ्या लेव्हलवर काम करतात' },
  'why.SCOPE': { en: 'Does not take this kind of work', hi: 'इस तरह का काम नहीं लेते', mr: 'असे काम घेत नाहीत' },
  'why.NO_CIVIL': { en: 'Does not do the civil work a renovation needs', hi: 'रिनोवेशन के लिए ज़रूरी सिविल काम नहीं करते', mr: 'नूतनीकरणासाठी लागणारे सिव्हिल काम करत नाहीत' },
  'why.ZONE': { en: 'Does not work in your part of Pune', hi: 'पुणे के आपके इलाके में काम नहीं करते', mr: 'पुण्याच्या तुमच्या भागात काम करत नाहीत' },
  'why.MINIMUM': { en: 'Their minimum for this work is above your range', hi: 'इस काम के लिए इनका न्यूनतम दाम आपकी रेंज से ऊपर है', mr: 'या कामासाठी त्यांची किमान किंमत तुमच्या रेंजपेक्षा जास्त आहे' },

  // ── hero ──
  'hero.welcome': { en: 'Welcome, {name}', hi: 'नमस्ते, {name}', mr: 'नमस्कार, {name}' },
  'hero.whoFits': { en: 'Who fits you', hi: 'आपके लिए कौन सही है', mr: 'तुमच्यासाठी कोण योग्य' },
  'hero.top': { en: 'Your top', hi: 'आपके टॉप', mr: 'तुमचे टॉप' },
  'hero.word1': { en: 'match', hi: 'मैच', mr: 'मॅच' },
  'hero.wordN': { en: 'matches', hi: 'मैच', mr: 'मॅच' },
  'hero.tail1': { en: 'match.', hi: 'मैच।', mr: 'मॅच.' },
  'hero.tailN': { en: 'matches.', hi: 'मैच।', mr: 'मॅच.' },
  'hero.for': { en: 'For {what}.', hi: '{what} के लिए।', mr: 'यासाठी: {what}.' },
  'hero.footnote': {
    en: 'Ranked on your answers — your area, budget band, scope and the styles you chose. Every studio here has cleared our checks; each card shows which.',
    hi: 'आपके जवाबों पर रैंकिंग — आपका इलाका, बजट रेंज, काम का दायरा और आपकी चुनी स्टाइल। यहाँ हर स्टूडियो ने हमारी जाँच पास की है; हर कार्ड पर लिखा है कौन-सी।',
    mr: 'तुमच्या उत्तरांवर क्रमवारी — तुमचा भाग, बजेट रेंज, कामाचा व्याप आणि तुम्ही निवडलेल्या स्टाइल. इथल्या प्रत्येक स्टुडिओने आमच्या तपासण्या पार केल्या आहेत; कोणत्या ते प्रत्येक कार्डवर दिसते.',
  },
  'reveal.verified': { en: 'verified studios', hi: 'जाँचे हुए स्टूडियो', mr: 'तपासलेले स्टुडिओ' },
  'reveal.at': { en: 'at {level}', hi: '{level} में', mr: '{level} मध्ये' },
  'reveal.forYou': { en: 'for you', hi: 'आपके लिए', mr: 'तुमच्यासाठी' },

  // ── compare bar ──
  'compare.ready': { en: 'Ready to compare', hi: 'तुलना के लिए तैयार', mr: 'तुलनेसाठी तयार' },
  'compare.selected': { en: 'Selected', hi: 'चुने गए', mr: 'निवडलेले' },
  'compare.readyBody': { en: 'Every line side by side, with the materials', hi: 'हर लाइन आमने-सामने, मटीरियल के साथ', mr: 'प्रत्येक ओळ शेजारी शेजारी, मटेरियलसह' },
  'compare.pick': { en: 'Pick {n} more to put them side by side', hi: 'आमने-सामने देखने के लिए {n} और चुनें', mr: 'शेजारी शेजारी पाहण्यासाठी आणखी {n} निवडा' },
  'compare.cta': { en: 'Compare {n}', hi: '{n} की तुलना करें', mr: '{n} ची तुलना करा' },

  // ── project wings ──
  'wings.photo': { en: 'Photo to come', hi: 'फ़ोटो जल्द आएगी', mr: 'फोटो लवकरच' },
  'wings.render': { en: 'Render', hi: 'रेंडर', mr: 'रेंडर' },
  'wings.likeYours': { en: 'Like your home', hi: 'आपके घर जैसा', mr: 'तुमच्या घरासारखे' },
  'wings.days': { en: '{n} days', hi: '{n} दिन', mr: '{n} दिवस' },
  'wings.work': { en: 'Work by {studio}', hi: '{studio} का काम', mr: '{studio} चे काम' },
  'wings.moreWork': { en: 'More work by {studio}', hi: '{studio} का और काम', mr: '{studio} चे आणखी काम' },
  'wings.checks': { en: 'Checks {studio} has passed', hi: '{studio} ने जो जाँच पास की', mr: '{studio} ने पार केलेल्या तपासण्या' },
  'wings.more1': { en: '+{n} more check on their profile', hi: '+{n} और जाँच उनकी प्रोफ़ाइल पर', mr: '+{n} आणखी तपासणी त्यांच्या प्रोफाइलवर' },
  'wings.moreN': { en: '+{n} more checks on their profile', hi: '+{n} और जाँच उनकी प्रोफ़ाइल पर', mr: '+{n} आणखी तपासण्या त्यांच्या प्रोफाइलवर' },

  // ── studio card ──
  'card.factors': { en: '{a} of {b} factors', hi: '{b} में से {a} बातें', mr: '{b} पैकी {a} मुद्दे' },
  'card.about': { en: 'Interior studio in {city}.', hi: '{city} में इंटीरियर स्टूडियो।', mr: '{city} मधील इंटीरियर स्टुडिओ.' },
  'card.yrs': { en: '{n} yrs', hi: '{n} साल', mr: '{n} वर्षे' },
  'card.team': { en: 'Team of {n}', hi: '{n} लोगों की टीम', mr: '{n} जणांची टीम' },
  'card.yourQuote': { en: 'Your quote', hi: 'आपका कोटेशन', mr: 'तुमचे कोटेशन' },
  'card.notPriced': { en: 'Not priced yet', hi: 'अभी दाम नहीं निकला', mr: 'अजून किंमत काढलेली नाही' },
  'card.noRates': { en: 'Rates not filed yet', hi: 'रेट अभी जमा नहीं हुए', mr: 'रेट अजून जमा केलेले नाहीत' },
  'card.delivered': { en: 'Projects delivered', hi: 'पूरे किए प्रोजेक्ट', mr: 'पूर्ण केलेले प्रोजेक्ट' },
  'card.daysUnmeasured': { en: 'Days over — unmeasured', hi: 'देरी के दिन — अभी मापा नहीं', mr: 'उशिराचे दिवस — अजून मोजले नाहीत' },
  'card.daysEarly': { en: 'Days early, on average', hi: 'औसतन इतने दिन पहले', mr: 'सरासरी इतके दिवस आधी' },
  'card.daysOver': { en: 'Days over promise', hi: 'वादे से ज़्यादा दिन', mr: 'वचनापेक्षा जास्त दिवस' },
  'card.widenedZone': { en: 'Works in another part of Pune', hi: 'पुणे के दूसरे इलाके में काम करते हैं', mr: 'पुण्याच्या दुसऱ्या भागात काम करतात' },
  'card.widenedBand': { en: 'One level above the one you chose', hi: 'आपके चुने लेवल से एक ऊपर', mr: 'तुम्ही निवडलेल्या लेव्हलपेक्षा एक वर' },
  'card.whyFits': { en: 'Why this one fits you', hi: 'यह आपके लिए क्यों सही है', mr: 'हा तुमच्यासाठी का योग्य आहे' },
  'card.reading': { en: 'Reading your brief against their work…', hi: 'आपका ब्रीफ़ इनके काम से मिलाया जा रहा है…', mr: 'तुमचा ब्रीफ त्यांच्या कामाशी जुळवत आहोत…' },
  'card.meet': { en: 'Meet {studio} — their intro video', hi: '{studio} से मिलिए — उनका परिचय वीडियो', mr: '{studio} ला भेटा — त्यांचा ओळख व्हिडिओ' },
  'card.getQuote': { en: 'Get a quote', hi: 'कोटेशन लें', mr: 'कोटेशन मिळवा' },
  'card.seeQuote': { en: 'See the quote', hi: 'कोटेशन देखें', mr: 'कोटेशन पाहा' },
  'card.inCompare': { en: 'In compare', hi: 'तुलना में है', mr: 'तुलनेत आहे' },
  'card.addCompare': { en: 'Add to compare', hi: 'तुलना में जोड़ें', mr: 'तुलनेत जोडा' },
  'card.theirWork': { en: 'Their work', hi: 'इनका काम', mr: 'त्यांचे काम' },
  'card.less': { en: 'Less', hi: 'कम', mr: 'कमी' },
  'card.more': { en: 'More', hi: 'और', mr: 'आणखी' },
  'card.scoreMadeOf': { en: 'What the score is made of', hi: 'स्कोर किन बातों से बना है', mr: 'स्कोअर कशाचा बनला आहे' },
  'card.notKnown': { en: 'Not known yet — not counted either way', hi: 'अभी पता नहीं — किसी तरफ़ गिना नहीं गया', mr: 'अजून माहीत नाही — कोणत्याही बाजूने मोजले नाही' },
  'card.measured': { en: 'Measured', hi: 'मापा गया', mr: 'मोजले' },
  'card.quoteInFull': { en: 'See the quote in full', hi: 'पूरा कोटेशन देखें', mr: 'संपूर्ण कोटेशन पाहा' },
  'card.likeYours': { en: 'Their work like yours', hi: 'आपके जैसा इनका काम', mr: 'तुमच्यासारखे त्यांचे काम' },
  'card.checksCleared': { en: '{a} of {b} checks cleared', hi: '{b} में से {a} जाँच पास', mr: '{b} पैकी {a} तपासण्या पार' },
  'card.seeThem': { en: 'See them +', hi: 'देखें +', mr: 'पाहा +' },
  'card.hide': { en: 'Hide −', hi: 'छिपाएँ −', mr: 'लपवा −' },
  'card.cleared': { en: ', cleared', hi: ', पास', mr: ', पार' },
  'card.notCleared': { en: ', not yet cleared', hi: ', अभी पास नहीं', mr: ', अजून पार नाही' },

  // ── score factors ──
  'factor.style': { en: 'Style', hi: 'स्टाइल', mr: 'स्टाइल' },
  'factor.priorities': { en: 'Your priorities', hi: 'आपकी प्राथमिकताएँ', mr: 'तुमचे प्राधान्य' },
  'factor.similarWork': { en: 'Work like yours', hi: 'आपके जैसा काम', mr: 'तुमच्यासारखे काम' },
  'factor.workingStyle': { en: 'Working style', hi: 'काम करने का तरीका', mr: 'कामाची पद्धत' },
  'factor.household': { en: 'Your household', hi: 'आपका परिवार', mr: 'तुमचे कुटुंब' },
  'factor.timeline': { en: 'Timing', hi: 'समय', mr: 'वेळ' },
  // ── check chips beside a card (mirrors CHECK_CHIPS in modules/studio/proof.ts) ──
  'chip.SITE_INSPECTION': { en: 'Sites inspected', hi: 'साइट जाकर देखीं', mr: 'साइट पाहिल्या' },
  'chip.CLIENT_REFERENCE': { en: 'Clients called', hi: 'ग्राहकों से बात की', mr: 'ग्राहकांशी बोललो' },
  'chip.LABOUR_INSURANCE': { en: 'Labour insured', hi: 'मज़दूरों का बीमा', mr: 'कामगार विमा' },
  'chip.WARRANTY_TERMS': { en: 'Warranty on paper', hi: 'लिखित वॉरंटी', mr: 'लेखी वॉरंटी' },
  'chip.RATE_CARD_FILED': { en: 'Rate card filed', hi: 'रेट कार्ड जमा', mr: 'रेट कार्ड जमा' },
  'chip.GST_FILING_HISTORY': { en: '12 months of GST', hi: '12 महीने का GST', mr: '12 महिन्यांचे GST' },
  'chip.LITIGATION_SEARCH': { en: 'Courts searched', hi: 'कोर्ट केस जाँचे', mr: 'कोर्ट केस तपासले' },
  'chip.ADDRESS_VISIT': { en: 'Address visited', hi: 'पता जाकर देखा', mr: 'पत्त्याला भेट' },
  'chip.GSTIN_ACTIVE': { en: 'GST active', hi: 'GST चालू', mr: 'GST चालू' },
  'chip.AADHAAR_KYC': { en: 'Owner identified', hi: 'मालिक की पहचान', mr: 'मालकाची ओळख' },
  'chip.CODE_OF_CONDUCT': { en: 'Conduct signed', hi: 'आचार संहिता साइन', mr: 'आचारसंहितेवर सही' },
  'chip.MCA_STATUS': { en: 'MCA filings ok', hi: 'MCA फ़ाइलिंग ठीक', mr: 'MCA फाइलिंग ठीक' },
  'chip.PAN_NAME_MATCH': { en: 'PAN matched', hi: 'PAN मेल खाता', mr: 'PAN जुळला' },
  'chip.UDYAM': { en: 'Udyam registered', hi: 'उद्यम रजिस्टर्ड', mr: 'उद्यम नोंदणीकृत' },
  'chip.CONTACT_REACHABLE': { en: 'Reachable', hi: 'संपर्क चालू', mr: 'संपर्क चालू' },
} satisfies Record<string, Tx>;

export type MatchKey = keyof typeof MATCH_DICT;

/** What `useSiteT(MATCH_DICT)` returns, for helpers that are handed `t`. */
export type MatchT = (key: MatchKey, vars?: Record<string, string | number>) => string;

/**
 * The app's words in English, Hindi and Marathi (v79 design: the language
 * picker on Welcome and in Me).
 *
 * FIRST DRAFT. The Hindi and Marathi here were written for the owner's v79
 * decision ("the copy is a first draft that needs a native speaker's
 * review") and must be checked by a native speaker before launch. Keep them
 * plain and everyday, as a family in Pune speaks; studio names, style names,
 * Essential / Premium / Luxury, GEIO and GST stay in English.
 *
 * {name}-style placeholders are filled by `t()`.
 */

export type Lang = 'en' | 'hi' | 'mr';
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'हिंदी' },
  { id: 'mr', label: 'मराठी' },
];

type Entry = Record<Lang, string>;

export const DICT = {
  // Welcome and name
  'lang.label': { en: 'Language', hi: 'भाषा', mr: 'भाषा' },
  'welcome.kicker': { en: 'Pune, {n} verified studios', hi: 'पुणे, {n} जाँचे हुए स्टूडियो', mr: 'पुणे, {n} तपासलेले स्टुडिओ' },
  'welcome.h1': {
    en: 'Find the right interior designer for your home.',
    hi: 'अपने घर के लिए सही इंटीरियर डिज़ाइनर चुनिए।',
    mr: 'तुमच्या घरासाठी योग्य इंटिरियर डिझायनर शोधा.',
  },
  'welcome.sub': {
    en: 'Seven questions, three studios matched to your flat, and a quote you can read line by line.',
    hi: 'सात सवाल, आपके फ़्लैट के लिए चुने गए तीन स्टूडियो, और लाइन-दर-लाइन पढ़ा जा सकने वाला कोटेशन।',
    mr: 'सात प्रश्न, तुमच्या फ्लॅटला जुळणारे तीन स्टुडिओ, आणि ओळीनुसार वाचता येईल असे कोटेशन.',
  },
  'welcome.cta': { en: 'Find your designer', hi: 'अपना डिज़ाइनर खोजिए', mr: 'तुमचा डिझायनर शोधा' },
  'welcome.have': { en: 'I already have an account', hi: 'मेरा अकाउंट पहले से है', mr: 'माझे खाते आधीच आहे' },
  'name.meta': { en: 'Before we start', hi: 'शुरू करने से पहले', mr: 'सुरुवात करण्यापूर्वी' },
  'name.h1': { en: 'First, what should we call you?', hi: 'पहले बताइए, हम आपको किस नाम से बुलाएँ?', mr: 'आधी सांगा, आम्ही तुम्हाला काय म्हणू?' },
  'name.label': { en: 'Your first name', hi: 'आपका पहला नाम', mr: 'तुमचे पहिले नाव' },
  'name.note': {
    en: 'No phone number or email yet. We only ask for those when your quotes are ready.',
    hi: 'अभी फ़ोन नंबर या ईमेल नहीं चाहिए। ये हम तभी पूछेंगे जब आपके कोटेशन तैयार होंगे।',
    mr: 'आत्ता फोन नंबर किंवा ईमेल नको. तुमची कोटेशन तयार झाल्यावरच ते विचारू.',
  },
  'common.continue': { en: 'Continue', hi: 'आगे बढ़िए', mr: 'पुढे चला' },
  'common.next': { en: 'Next', hi: 'आगे', mr: 'पुढे' },

  // The brief
  'q.meta': { en: 'Question {n} of {of}', hi: 'सवाल {n} / {of}', mr: 'प्रश्न {n} / {of}' },
  'q.last': { en: 'Last question', hi: 'आख़िरी सवाल', mr: 'शेवटचा प्रश्न' },
  'q.seeMatches': { en: 'See my 3 matches', hi: 'मेरे 3 मैच देखें', mr: 'माझे 3 मॅच पाहा' },
  'q1.h1': { en: 'First, what kind of home are we working with?', hi: 'पहले बताइए, घर किस तरह का है?', mr: 'आधी सांगा, घर कोणत्या प्रकारचे आहे?' },
  'q1.sub': { en: 'And where in Pune is it?', hi: 'और पुणे में कहाँ है?', mr: 'आणि पुण्यात कुठे आहे?' },
  'q1.type': { en: 'Property type', hi: 'घर का प्रकार', mr: 'घराचा प्रकार' },
  'q1.locality': { en: 'Locality', hi: 'इलाका', mr: 'परिसर' },
  'q1.area': { en: 'Carpet area, sq ft (optional)', hi: 'कारपेट एरिया, वर्ग फ़ुट (ज़रूरी नहीं)', mr: 'कार्पेट एरिया, चौ. फूट (ऐच्छिक)' },
  'q1.areaNote': {
    en: 'Not sure? Skip it. Studios measure on their first visit.',
    hi: 'पता नहीं? छोड़ दीजिए। स्टूडियो पहली विज़िट पर नाप लेते हैं।',
    mr: 'माहीत नाही? सोडून द्या. स्टुडिओ पहिल्या भेटीत मोजमाप घेतात.',
  },
  'q1.other': { en: 'My area isn’t listed', hi: 'मेरा इलाका सूची में नहीं है', mr: 'माझा परिसर यादीत नाही' },
  'q1.otherPick': { en: 'Somewhere else in Pune…', hi: 'पुणे में कहीं और…', mr: 'पुण्यात दुसरीकडे…' },
  'q2.h1': { en: 'How much of it are we doing?', hi: 'कितना काम करवाना है?', mr: 'किती काम करायचे आहे?' },
  'scope.FULL_HOME': { en: 'Full home', hi: 'पूरा घर', mr: 'संपूर्ण घर' },
  'scope.FULL_HOME.sub': { en: 'Every room, from bare walls to handover', hi: 'हर कमरा, खाली दीवारों से हैंडओवर तक', mr: 'प्रत्येक खोली, रिकाम्या भिंतींपासून हँडओव्हरपर्यंत' },
  'scope.KITCHEN_WARDROBE': { en: 'Kitchen & wardrobes', hi: 'किचन और वॉर्डरोब', mr: 'किचन आणि वॉर्डरोब' },
  'scope.KITCHEN_WARDROBE.sub': {
    en: 'The two jobs that need a carpenter most',
    hi: 'वो दो काम जिनमें सबसे ज़्यादा कारपेंटर लगता है',
    mr: 'ज्यांना सर्वात जास्त सुताराचे काम लागते ती दोन कामे',
  },
  'scope.SINGLE_ROOM': { en: 'One room', hi: 'एक कमरा', mr: 'एक खोली' },
  'scope.SINGLE_ROOM.sub': { en: 'A bedroom, the living room, a study', hi: 'बेडरूम, लिविंग रूम या स्टडी', mr: 'बेडरूम, लिव्हिंग रूम किंवा स्टडी' },
  'scope.RENOVATION': { en: 'Renovation', hi: 'रेनोवेशन', mr: 'नूतनीकरण' },
  'scope.RENOVATION.sub': { en: 'Change what is already there', hi: 'जो पहले से है उसे बदलना', mr: 'आधी असलेले बदलणे' },
  'q2.rooms': { en: 'Which rooms?', hi: 'कौन-से कमरे?', mr: 'कोणत्या खोल्या?' },
  'q3.h1': { en: 'What are you planning to spend?', hi: 'आप कितना खर्च करने की सोच रहे हैं?', mr: 'तुम्ही किती खर्च करायचा विचार करत आहात?' },
  'tier.ESSENTIAL.tag': { en: 'Good value', hi: 'अच्छी कीमत', mr: 'चांगली किंमत' },
  'tier.PREMIUM.tag': { en: 'Most chosen', hi: 'सबसे ज़्यादा चुना गया', mr: 'सर्वाधिक निवडलेले' },
  'tier.LUXURY.tag': { en: 'Made to order', hi: 'ऑर्डर पर बना', mr: 'मागणीनुसार बनवलेले' },
  'tier.ESSENTIAL.line': { en: 'Everything you need, made well', hi: 'ज़रूरत की हर चीज़, अच्छी तरह बनी', mr: 'गरजेचे सगळे, नीट बनवलेले' },
  'tier.PREMIUM.line': { en: 'Better materials where they are touched', hi: 'जहाँ हाथ लगता है वहाँ बेहतर मटेरियल', mr: 'जिथे हात लागतो तिथे अधिक चांगले साहित्य' },
  'tier.LUXURY.line': {
    en: 'Made to your drawings, in the materials you chose',
    hi: 'आपकी ड्रॉइंग पर, आपके चुने मटेरियल में',
    mr: 'तुमच्या ड्रॉइंगनुसार, तुम्ही निवडलेल्या साहित्यात',
  },
  'q3.note': {
    en: 'This sets the materials, not a fixed price. Your quotes show the exact figure for your flat.',
    hi: 'इससे मटेरियल तय होता है, कीमत नहीं। आपके फ़्लैट का सही आँकड़ा कोटेशन में दिखेगा।',
    mr: 'यावरून साहित्य ठरते, ठरलेली किंमत नाही. तुमच्या फ्लॅटचा नेमका आकडा कोटेशनमध्ये दिसेल.',
  },
  'est.label': { en: 'Your home, so far', hi: 'अब तक आपका घर', mr: 'आतापर्यंत तुमचे घर' },
  'est.note': {
    en: 'What most of {n} studios would quote, with GST. It firms up with every answer.',
    hi: '{n} में से ज़्यादातर स्टूडियो GST सहित इतना कोट करेंगे। हर जवाब के साथ यह और सटीक होगा।',
    mr: '{n} पैकी बहुतेक स्टुडिओ GST सह इतके कोट करतील. प्रत्येक उत्तराने हे अधिक नेमके होते.',
  },
  'est.most': {
    en: 'Most studios: {range} for your flat, with GST',
    hi: 'ज़्यादातर स्टूडियो: आपके फ़्लैट के लिए {range}, GST सहित',
    mr: 'बहुतेक स्टुडिओ: तुमच्या फ्लॅटसाठी {range}, GST सह',
  },
  'est.about': { en: 'about {x}', hi: 'लगभग {x}', mr: 'सुमारे {x}' },
  'q4.h1': { en: 'Which of these feel like your home?', hi: 'इनमें से कौन-सा आपके घर जैसा लगता है?', mr: 'यापैकी कोणते तुमच्या घरासारखे वाटते?' },
  'q4.sub': { en: 'Pick two or three, on instinct.', hi: 'मन से दो या तीन चुनिए।', mr: 'मनाला वाटेल ते दोन किंवा तीन निवडा.' },
  'q4.count': { en: '{n} of 3', hi: '{n} / 3', mr: '{n} / 3' },
  'q5.h1': { en: 'Who’s going to live there?', hi: 'वहाँ कौन रहेगा?', mr: 'तिथे कोण राहणार आहे?' },
  'q5.adults': { en: 'Adults', hi: 'बड़े', mr: 'प्रौढ' },
  'q5.adults.sub': { en: '18 and over', hi: '18 और उससे ऊपर', mr: '18 आणि त्याहून अधिक' },
  'q5.children': { en: 'Children', hi: 'बच्चे', mr: 'मुले' },
  'q5.children.sub': { en: 'Under 18', hi: '18 से कम', mr: '18 पेक्षा कमी' },
  'q5.elderly': { en: 'Parents or elderly', hi: 'माता-पिता या बुज़ुर्ग', mr: 'आई-वडील किंवा ज्येष्ठ' },
  'q5.elderly.sub': {
    en: 'We plan for grab rails and easy reach',
    hi: 'हम पकड़ने की रेलिंग और आसान पहुँच का ध्यान रखते हैं',
    mr: 'आम्ही आधाराचे रेलिंग आणि सहज पोहोच यांचा विचार करतो',
  },
  'q5.pets': { en: 'Pets', hi: 'पालतू जानवर', mr: 'पाळीव प्राणी' },
  'q5.pets.sub': { en: 'Scratch-proof fabrics and finishes', hi: 'खरोंच न पड़ने वाले कपड़े और फ़िनिश', mr: 'ओरखडे न पडणारे कापड आणि फिनिश' },
  'q5.wfh': { en: 'Someone works from home', hi: 'कोई घर से काम करता है', mr: 'कोणी घरून काम करते' },
  'q5.wfh.sub': { en: 'A quiet corner with a proper desk', hi: 'एक शांत कोना, सही डेस्क के साथ', mr: 'योग्य टेबलासह एक शांत कोपरा' },
  'q6.h1': { en: 'What matters most to you here?', hi: 'आपके लिए सबसे ज़रूरी क्या है?', mr: 'तुमच्यासाठी सर्वात महत्त्वाचे काय आहे?' },
  'q6.sub': { en: 'Tap them in order, most important first.', hi: 'क्रम से टैप कीजिए, सबसे ज़रूरी पहले।', mr: 'क्रमाने टॅप करा, सर्वात महत्त्वाचे आधी.' },
  'prio.SPEED': { en: 'Finishing on time', hi: 'समय पर पूरा होना', mr: 'वेळेवर पूर्ण होणे' },
  'prio.SPEED.sub': { en: 'Weighs each studio’s delivery record', hi: 'हर स्टूडियो का डिलीवरी रिकॉर्ड देखता है', mr: 'प्रत्येक स्टुडिओचा डिलिव्हरी रेकॉर्ड पाहते' },
  'prio.DESIGN_AMBITION': { en: 'Design ambition', hi: 'डिज़ाइन की ऊँची सोच', mr: 'डिझाइनची महत्त्वाकांक्षा' },
  'prio.DESIGN_AMBITION.sub': { en: 'Bolder, more personal past work', hi: 'ज़्यादा दमदार, ज़्यादा निजी पिछला काम', mr: 'अधिक धाडसी, अधिक वैयक्तिक पूर्वीचे काम' },
  'prio.BUDGET': { en: 'Staying in budget', hi: 'बजट में रहना', mr: 'बजेटमध्ये राहणे' },
  'prio.BUDGET.sub': { en: 'Final bills that match the quote', hi: 'फ़ाइनल बिल कोटेशन से मेल खाए', mr: 'अंतिम बिल कोटेशनशी जुळणारे' },
  'prio.MATERIAL_QUALITY': { en: 'Material quality', hi: 'मटेरियल की क्वालिटी', mr: 'साहित्याचा दर्जा' },
  'prio.MATERIAL_QUALITY.sub': { en: 'Better boards, hardware and finishes', hi: 'बेहतर बोर्ड, हार्डवेयर और फ़िनिश', mr: 'अधिक चांगले बोर्ड, हार्डवेअर आणि फिनिश' },
  'q6.startOver': { en: 'Start over', hi: 'फिर से शुरू करें', mr: 'पुन्हा सुरू करा' },
  'q6.first': { en: '{x} first', hi: 'पहले: {x}', mr: 'आधी: {x}' },
  'q6.rank': { en: 'Rank all four to continue ({n} of 4)', hi: 'आगे बढ़ने के लिए चारों का क्रम दें ({n} / 4)', mr: 'पुढे जाण्यासाठी चारही क्रमाने लावा ({n} / 4)' },
  'q7.h1': { en: 'How involved do you want to be?', hi: 'आप कितना शामिल रहना चाहते हैं?', mr: 'तुम्हाला किती सहभागी व्हायचे आहे?' },
  'inv.DECIDE_FOR_ME': { en: 'Decide most things for me', hi: 'ज़्यादातर फ़ैसले मेरे लिए कर दीजिए', mr: 'बहुतेक निर्णय माझ्यासाठी घ्या' },
  'inv.DECIDE_FOR_ME.sub': {
    en: 'Studios that lead with a clear design of their own',
    hi: 'ऐसे स्टूडियो जो अपनी साफ़ डिज़ाइन सोच से आगे बढ़ें',
    mr: 'स्वतःच्या स्पष्ट डिझाइनने पुढे नेणारे स्टुडिओ',
  },
  'inv.COLLABORATE': { en: 'Work through it together', hi: 'मिलकर काम करें', mr: 'एकत्र काम करू' },
  'inv.COLLABORATE.sub': {
    en: 'Regular reviews; you sign off the key choices',
    hi: 'नियमित समीक्षा; ज़रूरी फ़ैसलों पर आपकी मंज़ूरी',
    mr: 'नियमित आढावा; महत्त्वाच्या निवडींना तुमची मंजुरी',
  },
  'inv.APPROVE_EVERYTHING': { en: 'I want to approve every detail', hi: 'हर बारीकी को मेरी मंज़ूरी चाहिए', mr: 'प्रत्येक तपशिलाला माझी मंजुरी हवी' },
  'inv.APPROVE_EVERYTHING.sub': {
    en: 'Every finish and fitting comes to you first',
    hi: 'हर फ़िनिश और फ़िटिंग पहले आपके पास आएगी',
    mr: 'प्रत्येक फिनिश आणि फिटिंग आधी तुमच्याकडे येईल',
  },

  // Style DNA
  'style.meta': { en: 'Your answers, in one picture', hi: 'आपके जवाब, एक तस्वीर में', mr: 'तुमची उत्तरे, एका चित्रात' },
  'style.h1': { en: 'This is your style DNA{name}.', hi: 'यह है आपका स्टाइल DNA{name}।', mr: 'हा आहे तुमचा स्टाइल DNA{name}.' },
  'style.leans': { en: 'Your home leans {lead}, with {second} touches.', hi: 'आपका घर {lead} की ओर है, {second} की झलक के साथ।', mr: 'तुमचे घर {lead} कडे झुकते, {second} च्या छटांसह.' },
  'style.leansOne': { en: 'Your home leans {lead}.', hi: 'आपका घर {lead} की ओर है।', mr: 'तुमचे घर {lead} कडे झुकते.' },
  'style.think': { en: 'Think {materials}.', hi: 'जैसे {materials}।', mr: 'जसे {materials}.' },
  'style.share': { en: 'Share your style with family', hi: 'अपना स्टाइल परिवार के साथ शेयर करें', mr: 'तुमची स्टाइल कुटुंबासोबत शेअर करा' },
  'style.share.sub': {
    en: 'Only the styles and colours. No name, flat or number.',
    hi: 'सिर्फ़ स्टाइल और रंग। नाम, फ़्लैट या नंबर नहीं।',
    mr: 'फक्त स्टाइल आणि रंग. नाव, फ्लॅट किंवा नंबर नाही.',
  },
  'style.shared': { en: 'Shared', hi: 'शेयर किया', mr: 'शेअर केले' },
  'style.cta': { en: 'See studios that match my style', hi: 'मेरे स्टाइल से मेल खाते स्टूडियो देखें', mr: 'माझ्या स्टाइलशी जुळणारे स्टुडिओ पाहा' },

  // Matches
  'matches.edit': { en: 'Edit my answers', hi: 'जवाब बदलें', mr: 'उत्तरे बदला' },
  'matches.count': {
    en: '{n} verified studios in Pune · {m} matched for you',
    hi: 'पुणे में {n} जाँचे हुए स्टूडियो · आपके लिए {m} मैच',
    mr: 'पुण्यात {n} तपासलेले स्टुडिओ · तुमच्यासाठी {m} मॅच',
  },
  'matches.h1': {
    en: '{count}, scored on your brief. Never on who paid.',
    hi: '{count}, आपकी ज़रूरत के हिसाब से अंक। पैसे देने वाले के हिसाब से कभी नहीं।',
    mr: '{count}, तुमच्या गरजेनुसार गुण. पैसे कोणी दिले यावरून कधीच नाही.',
  },
  'matches.studios': { en: '{n} studios', hi: '{n} स्टूडियो', mr: '{n} स्टुडिओ' },
  'matches.best': {
    en: 'Best matches for {tier}, at about {range} for your flat before GST.',
    hi: '{tier} के लिए सबसे अच्छे मैच, आपके फ़्लैट के लिए लगभग {range}, GST से पहले।',
    mr: '{tier} साठी सर्वोत्तम मॅच, तुमच्या फ्लॅटसाठी सुमारे {range}, GST आधी.',
  },
  'matches.if': {
    en: 'You chose {chose}. These are the best matches if you go {tier}, at about {range} for your flat before GST.',
    hi: 'आपने {chose} चुना। अगर आप {tier} चुनें तो ये सबसे अच्छे मैच हैं, आपके फ़्लैट के लिए लगभग {range}, GST से पहले।',
    mr: 'तुम्ही {chose} निवडले. तुम्ही {tier} निवडल्यास हे सर्वोत्तम मॅच आहेत, तुमच्या फ्लॅटसाठी सुमारे {range}, GST आधी.',
  },
  'matches.range': { en: '{range} for your brief', hi: 'आपकी ज़रूरत के लिए {range}', mr: 'तुमच्या गरजेसाठी {range}' },
  'matches.checks': { en: '{a}/{b} checks', hi: '{a}/{b} जाँच', mr: '{a}/{b} तपासण्या' },
  'matches.why': { en: 'Why they suit you', hi: 'ये आपके लिए क्यों सही हैं', mr: 'हे तुम्हाला का योग्य आहेत' },
  'matches.more': { en: 'See their homes, checks and record', hi: 'उनके घर, जाँच और रिकॉर्ड देखें', mr: 'त्यांची घरे, तपासण्या आणि रेकॉर्ड पाहा' },
  'matches.all': { en: 'See all {n} verified studios', hi: 'सभी {n} जाँचे हुए स्टूडियो देखें', mr: 'सर्व {n} तपासलेले स्टुडिओ पाहा' },
  'matches.all.sub': { en: 'Filter by area, style and budget', hi: 'इलाके, स्टाइल और बजट से छाँटें', mr: 'परिसर, स्टाइल आणि बजेटनुसार निवडा' },
  'matches.cta': { en: 'Get quotes from these {n}', hi: 'इन {n} से कोटेशन लें', mr: 'या {n} कडून कोटेशन घ्या' },
  'matches.ctaOne': { en: 'Get quotes from this studio', hi: 'इस स्टूडियो से कोटेशन लें', mr: 'या स्टुडिओकडून कोटेशन घ्या' },

  // Phone and consent
  'verify.meta': { en: 'Quotes ready', hi: 'कोटेशन तैयार', mr: 'कोटेशन तयार' },
  'verify.h1': {
    en: 'Your {n} quotes are ready. Where should we send them?',
    hi: 'आपके {n} कोटेशन तैयार हैं। इन्हें कहाँ भेजें?',
    mr: 'तुमची {n} कोटेशन तयार आहेत. ती कुठे पाठवू?',
  },
  'verify.sub': {
    en: 'Your number also saves everything, so you can come back any time.',
    hi: 'आपका नंबर सब कुछ सेव भी करता है, ताकि आप कभी भी लौट सकें।',
    mr: 'तुमचा नंबर सगळे सेव्ह करतो, त्यामुळे तुम्ही कधीही परत येऊ शकता.',
  },
  'verify.mobile': { en: 'Mobile number', hi: 'मोबाइल नंबर', mr: 'मोबाईल नंबर' },
  'verify.code': { en: '6-digit code sent on WhatsApp', hi: 'WhatsApp पर भेजा गया 6 अंकों का कोड', mr: 'WhatsApp वर पाठवलेला 6 अंकी कोड' },
  'verify.send': { en: 'Send me a code on WhatsApp', hi: 'मुझे WhatsApp पर कोड भेजें', mr: 'मला WhatsApp वर कोड पाठवा' },
  'verify.sendThis': { en: 'Send a code to this number', hi: 'इस नंबर पर कोड भेजें', mr: 'या नंबरवर कोड पाठवा' },
  'verify.wait': { en: 'Didn’t get it? Ask for a new code in 0:{s}', hi: 'नहीं मिला? 0:{s} में नया कोड माँगें', mr: 'मिळाला नाही? 0:{s} मध्ये नवीन कोड मागा' },
  'verify.resend': { en: 'Send a new code', hi: 'नया कोड भेजें', mr: 'नवीन कोड पाठवा' },
  'verify.consent': {
    en: 'Share my home details and answers with these studios so they can quote. I agree to the',
    hi: 'मेरे घर की जानकारी और जवाब इन स्टूडियो के साथ शेयर करें ताकि वे कोटेशन दे सकें। मैं सहमत हूँ:',
    mr: 'माझ्या घराची माहिती आणि उत्तरे या स्टुडिओंसोबत शेअर करा म्हणजे ते कोटेशन देऊ शकतील. मी सहमत आहे:',
  },
  'verify.privacy': { en: 'privacy policy', hi: 'प्राइवेसी पॉलिसी', mr: 'प्रायव्हसी पॉलिसी' },
  'verify.tips': {
    en: 'Send me tips and offers on WhatsApp too (optional)',
    hi: 'मुझे WhatsApp पर टिप्स और ऑफ़र भी भेजें (ज़रूरी नहीं)',
    mr: 'मला WhatsApp वर टिप्स आणि ऑफरही पाठवा (ऐच्छिक)',
  },
  'verify.tick': { en: 'Tick the first box to continue', hi: 'आगे बढ़ने के लिए पहला बॉक्स टिक करें', mr: 'पुढे जाण्यासाठी पहिला बॉक्स टिक करा' },
  'verify.cta': { en: 'Verify and see my quotes', hi: 'पुष्टि करें और कोटेशन देखें', mr: 'पडताळणी करा आणि कोटेशन पाहा' },

  // Tab bar
  'tab.home': { en: 'Home', hi: 'होम', mr: 'होम' },
  'tab.project': { en: 'Project', hi: 'प्रोजेक्ट', mr: 'प्रोजेक्ट' },
  'tab.geio': { en: 'GEIO', hi: 'GEIO', mr: 'GEIO' },
  'tab.site': { en: 'Site', hi: 'साइट', mr: 'साइट' },
  'tab.me': { en: 'Me', hi: 'मैं', mr: 'मी' },

  // Me
  'me.h1': { en: 'Me', hi: 'मैं', mr: 'मी' },
  'me.notSignedIn': { en: 'Not signed in', hi: 'साइन इन नहीं किया', mr: 'साइन इन केलेले नाही' },
  'me.locker': { en: 'Home locker', hi: 'होम लॉकर', mr: 'होम लॉकर' },
  'me.locker.sub': { en: 'Agreement, drawings, receipts, warranties', hi: 'एग्रीमेंट, ड्रॉइंग, रसीदें, वारंटी', mr: 'करार, ड्रॉइंग, पावत्या, वॉरंटी' },
  'me.notifications': { en: 'Notifications', hi: 'सूचनाएँ', mr: 'सूचना' },
  'me.notifications.sub': { en: 'Site updates, decisions and payments', hi: 'साइट अपडेट, फ़ैसले और भुगतान', mr: 'साइट अपडेट, निर्णय आणि पेमेंट' },
  'me.unread': { en: '{n} unread', hi: '{n} अनपढ़ी', mr: '{n} न वाचलेल्या' },
  'me.coins': { en: 'Home Coins', hi: 'होम कॉइन्स', mr: 'होम कॉइन्स' },
  'me.coins.sub': { en: 'Earn as your home comes together', hi: 'घर बनते-बनते कमाइए', mr: 'घर तयार होत असताना कमवा' },
  'me.coins.balance': { en: '{n} coins', hi: '{n} कॉइन्स', mr: '{n} कॉइन्स' },
  'me.streak': { en: '{n}-day streak', hi: '{n} दिन लगातार', mr: 'सलग {n} दिवस' },
  'me.family': { en: 'Family', hi: 'परिवार', mr: 'कुटुंब' },
  'me.family.sub': { en: 'They see every update and vote on decisions', hi: 'वे हर अपडेट देखते हैं और फ़ैसलों पर वोट करते हैं', mr: 'ते प्रत्येक अपडेट पाहतात आणि निर्णयांवर मत देतात' },
  'me.dream': { en: 'Dream board', hi: 'ड्रीम बोर्ड', mr: 'ड्रीम बोर्ड' },
  'me.dream.sub': { en: 'Photos you love, shared with your studio', hi: 'आपकी पसंद की फ़ोटो, आपके स्टूडियो के साथ', mr: 'तुमचे आवडते फोटो, तुमच्या स्टुडिओसोबत' },
  'me.refer': { en: 'Refer and earn', hi: 'रेफ़र करें और कमाएँ', mr: 'रेफर करा आणि कमवा' },
  'me.refer.sub': { en: 'Give 5,000, get 5,000', hi: '5,000 दीजिए, 5,000 पाइए', mr: '5,000 द्या, 5,000 मिळवा' },
  'me.expert': { en: 'Ask {expert}', hi: '{expert} से पूछें', mr: '{expert} यांना विचारा' },
  'me.expert.sub': {
    en: 'Your One Interiors expert. She earns nothing from any studio.',
    hi: 'आपकी One Interiors एक्सपर्ट। उन्हें किसी स्टूडियो से कुछ नहीं मिलता।',
    mr: 'तुमच्या One Interiors तज्ज्ञ. त्यांना कोणत्याही स्टुडिओकडून काही मिळत नाही.',
  },
  'me.geio': { en: 'Ask GEIO', hi: 'GEIO से पूछें', mr: 'GEIO ला विचारा' },
  'me.geio.sub': { en: 'Anything about your home, in plain words', hi: 'अपने घर के बारे में कुछ भी, आसान शब्दों में', mr: 'तुमच्या घराबद्दल काहीही, सोप्या शब्दांत' },
  'me.privacy': { en: 'Privacy and your data', hi: 'प्राइवेसी और आपका डेटा', mr: 'प्रायव्हसी आणि तुमचा डेटा' },
  'me.privacy.sub': { en: 'What we keep, and how to have it removed', hi: 'हम क्या रखते हैं, और उसे कैसे हटवाएँ', mr: 'आम्ही काय ठेवतो, आणि ते कसे काढून टाकावे' },
  'me.logout': { en: 'Log out', hi: 'लॉग आउट', mr: 'लॉग आउट' },
  'me.signIn': { en: 'Sign in', hi: 'साइन इन करें', mr: 'साइन इन करा' },
  'me.draft': {
    en: '',
    hi: 'हिंदी अनुवाद अभी जाँचा जा रहा है।',
    mr: 'मराठी भाषांतर अजून तपासले जात आहे.',
  },
} satisfies Record<string, Entry>;

export type Key = keyof typeof DICT;

/** The word in this language, placeholders filled. English when a language is missing one. */
export function translate(lang: Lang, key: Key, vars: Record<string, string | number> = {}): string {
  const entry: Entry = DICT[key];
  const text = entry[lang] || entry.en;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

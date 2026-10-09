/**
 * The expert-call page (/expert), its form and the pieces that pitch the call
 * elsewhere (CallOffer, ExpertPitch, BenefitChips, BriefRescue) in English,
 * Hindi and Marathi.
 *
 * FIRST DRAFT for native-speaker review — see `modules/i18n/site.ts`.
 * The English must stay identical to what those screens showed.
 *
 * Some English here mirrors text that lives in a module (the architect, the
 * benefits, the consultation errors). Those entries are only used while the
 * module's English still matches — see `known()` — so a change to the module
 * shows the new English rather than a stale translation.
 */

import { tx, type Lang, type Tx } from '../site';
import { FREE_CALLS, type OfferState } from '@/modules/consultation/offer';

export const EXPERT_DICT = {
  // ── Page ──
  'meta.title': { en: 'Talk to an expert', hi: 'एक्सपर्ट से बात करें', mr: 'एक्सपर्टशी बोला' },
  'rescue.destination': { en: 'the expert call', hi: 'एक्सपर्ट कॉल', mr: 'एक्सपर्ट कॉल' },
  'spine.priced': { en: '{n} priced', hi: '{n} के दाम तय', mr: '{n} चे दर तयार' },
  'spine.reading': { en: 'Reading it with you', hi: 'आपके साथ पढ़ रहे हैं', mr: 'तुमच्यासोबत वाचतोय' },

  'fact.home': { en: 'Home', hi: 'घर', mr: 'घर' },
  'fact.carpet': { en: 'Carpet', hi: 'कारपेट', mr: 'कार्पेट' },
  'fact.where': { en: 'Where', hi: 'कहाँ', mr: 'कुठे' },
  'fact.level': { en: 'Level', hi: 'लेवल', mr: 'लेव्हल' },
  'fact.quotes': { en: 'Quotes', hi: 'कोटेशन', mr: 'कोटेशन' },

  'ch.eyebrow': { en: 'Your architect', hi: 'आपके आर्किटेक्ट', mr: 'तुमचे आर्किटेक्ट' },
  'ch.title': {
    en: 'One call, and then we introduce you.',
    hi: 'एक कॉल, फिर हम आपकी मुलाक़ात करवाते हैं।',
    mr: 'एक कॉल, मग आम्ही तुमची ओळख करून देतो.',
  },
  'ch.aside': { en: 'No studio pays them', hi: 'कोई स्टूडियो इन्हें पैसे नहीं देता', mr: 'कोणताही स्टुडिओ त्यांना पैसे देत नाही' },
  'ch.body': {
    en: 'Someone who has read your brief, your quotes and every studio’s delivery record spends half an hour helping you choose. Then we set up the meeting or site visit with that studio ourselves. It is slower than a contact button, and it is the reason people do not end up in a meeting with a studio that was never going to suit them.',
    hi: 'जिसने आपकी ज़रूरतें, आपके कोटेशन और हर स्टूडियो का काम का रिकॉर्ड पढ़ा है, वह आधा घंटा आपको चुनने में मदद करता है। फिर उस स्टूडियो के साथ मीटिंग या साइट विज़िट हम खुद तय करते हैं। यह एक "कॉन्टैक्ट" बटन से धीमा है — और इसी वजह से लोग ऐसे स्टूडियो के साथ मीटिंग में नहीं फँसते जो उनके लिए कभी सही था ही नहीं।',
    mr: 'ज्यांनी तुमच्या गरजा, तुमची कोटेशन्स आणि प्रत्येक स्टुडिओचा कामाचा रेकॉर्ड वाचलाय, ते अर्धा तास तुम्हाला निवड करायला मदत करतात. मग त्या स्टुडिओसोबत मीटिंग किंवा साइट व्हिजिट आम्ही स्वतः ठरवतो. हे "कॉन्टॅक्ट" बटणापेक्षा हळू आहे — आणि म्हणूनच लोक अशा स्टुडिओसोबत मीटिंगमध्ये अडकत नाहीत जो त्यांच्यासाठी कधीच योग्य नव्हता.',
  },
  'who.eyebrow': { en: 'Who will ring you', hi: 'आपको कौन कॉल करेगा', mr: 'तुम्हाला कोण फोन करेल' },
  'flag.placeholder': {
    en: 'Pre-launch placeholder — a named architect and their real record go here before anybody is asked for a phone number',
    hi: 'लॉन्च से पहले का नमूना — किसी से फ़ोन नंबर माँगने से पहले यहाँ आर्किटेक्ट का नाम और उनका असली रिकॉर्ड आएगा',
    mr: 'लॉन्चपूर्वीचा नमुना — कोणाकडे फोन नंबर मागण्याआधी इथे आर्किटेक्टचं नाव आणि त्यांचा खरा रेकॉर्ड येईल',
  },

  'reads.label': { en: 'What {name} reads before ringing', hi: 'कॉल से पहले {name} क्या पढ़ती हैं', mr: 'फोन करण्याआधी {name} काय वाचतात' },
  'reads.brief': {
    en: 'Your brief, in full — including what you ruled out',
    hi: 'आपकी पूरी ज़रूरतें — जो आपने मना किया, वह भी',
    mr: 'तुमच्या पूर्ण गरजा — तुम्ही जे नको म्हटलं तेही',
  },
  'reads.leaning': { en: 'Leaning {styles}', hi: 'पसंद: {styles}', mr: 'आवड: {styles}' },
  'reads.ruledOut': { en: 'ruled out {styles}', hi: 'नापसंद: {styles}', mr: 'नको: {styles}' },
  'reads.styleAnswers': { en: 'Your style answers', hi: 'स्टाइल के बारे में आपके जवाब', mr: 'स्टाइलबद्दल तुमची उत्तरं' },
  'reads.allQuotes': {
    en: 'All {n} quotes, line by line, with the materials',
    hi: 'सभी {n} कोटेशन, लाइन-दर-लाइन, मटीरियल के साथ',
    mr: 'सगळी {n} कोटेशन्स, ओळीने ओळ, मटेरियलसह',
  },
  'reads.verification': {
    en: "Every studio's verification standing and delivery record",
    hi: 'हर स्टूडियो की जाँच की स्थिति और काम का रिकॉर्ड',
    mr: 'प्रत्येक स्टुडिओची तपासणीची स्थिती आणि कामाचा रेकॉर्ड',
  },
  'reads.noExplain': {
    en: 'You will not be explaining your flat again.',
    hi: 'आपको अपना फ़्लैट दोबारा समझाना नहीं पड़ेगा।',
    mr: 'तुम्हाला तुमचा फ्लॅट पुन्हा समजावून सांगावा लागणार नाही.',
  },
  'skipped.one': {
    en: '{name} suits this brief but has not published rates for all of this work yet, so we cannot put a number against their name — and a studio on this call without a quote would be one you could not compare.',
    hi: '{name} आपकी ज़रूरतों के लिए सही है, पर इस पूरे काम के रेट अभी तक नहीं डाले हैं, इसलिए उनके नाम के आगे हम कोई रक़म नहीं लिख सकते — और बिना कोटेशन वाले स्टूडियो की आप तुलना नहीं कर पाएँगे।',
    mr: '{name} तुमच्या गरजांसाठी योग्य आहे, पण या सगळ्या कामाचे दर अजून दिलेले नाहीत, त्यामुळे त्यांच्या नावापुढे आम्ही रक्कम लिहू शकत नाही — आणि कोटेशन नसलेल्या स्टुडिओची तुम्हाला तुलना करता येणार नाही.',
  },
  'skipped.many': {
    en: '{n} studios that suit this brief have not published rates for all of this work yet. We have left them out rather than show you a name with no number against it.',
    hi: 'आपकी ज़रूरतों के लिए सही {n} स्टूडियो ने इस पूरे काम के रेट अभी तक नहीं डाले हैं। बिना रक़म के नाम दिखाने के बजाय हमने उन्हें छोड़ दिया है।',
    mr: 'तुमच्या गरजांसाठी योग्य असलेल्या {n} स्टुडिओंनी या सगळ्या कामाचे दर अजून दिलेले नाहीत. रकमेशिवाय नाव दाखवण्यापेक्षा आम्ही त्यांना वगळलं आहे.',
  },
  'onlyOne': {
    en: 'There is one studio we can quote for this brief today, so this call is about whether they are right for you rather than about choosing between two. If the answer is no, we will say so — and we would rather tell you that than introduce you anyway.',
    hi: 'आज आपकी ज़रूरतों के लिए हम एक ही स्टूडियो का कोटेशन दे सकते हैं, इसलिए यह कॉल दो में से चुनने के बारे में नहीं, बल्कि इस बारे में है कि वह आपके लिए सही है या नहीं। अगर जवाब "नहीं" है, तो हम साफ़ बता देंगे — फिर भी मुलाक़ात करवाने से बेहतर है सच बताना।',
    mr: 'आज तुमच्या गरजांसाठी आम्ही एकाच स्टुडिओचं कोटेशन देऊ शकतो, म्हणून हा कॉल दोघांतून निवडण्याबद्दल नाही, तर तो स्टुडिओ तुमच्यासाठी योग्य आहे का याबद्दल आहे. उत्तर "नाही" असेल तर आम्ही स्पष्ट सांगू — तरीही ओळख करून देण्यापेक्षा खरं सांगणं आम्हाला जास्त योग्य वाटतं.',
  },

  // ── Loading ──
  'loading.h1': {
    en: 'Gathering everything they will have read before they ring you.',
    hi: 'कॉल से पहले वे जो कुछ पढ़ेंगे, वह सब जुटा रहे हैं।',
    mr: 'फोन करण्याआधी ते जे वाचतील ते सगळं गोळा करतोय.',
  },

  // ── The architect (mirrors modules/consultation/architect.ts) ──
  'architect.role': { en: 'Your One Interiors expert', hi: 'आपकी One Interiors एक्सपर्ट', mr: 'तुमच्या One Interiors एक्सपर्ट' },
  'architect.says': {
    en: 'I read your brief, your floor plan and every quote before we speak, so the call starts where the studios differ rather than at your requirements. No studio pays me — if none of them suits your home, I will tell you so, and there is nothing on this call to buy.',
    hi: 'बात करने से पहले मैं आपकी ज़रूरतें, फ़्लोर प्लान और हर कोटेशन पढ़ लेती हूँ, ताकि कॉल वहीं से शुरू हो जहाँ स्टूडियो अलग हैं — आपकी ज़रूरतें दोहराने से नहीं। मुझे कोई स्टूडियो पैसे नहीं देता — अगर उनमें से कोई भी आपके घर के लिए सही नहीं है, तो मैं साफ़ बता दूँगी, और इस कॉल पर खरीदने को कुछ नहीं है।',
    mr: 'बोलण्याआधी मी तुमच्या गरजा, फ्लोअर प्लॅन आणि प्रत्येक कोटेशन वाचते, म्हणजे कॉल तिथून सुरू होतो जिथे स्टुडिओ वेगळे आहेत — तुमच्या गरजा पुन्हा सांगण्यापासून नाही. मला कोणताही स्टुडिओ पैसे देत नाही — त्यांच्यापैकी कोणीच तुमच्या घरासाठी योग्य नसेल, तर मी तसं सांगेन, आणि या कॉलवर विकत घेण्यासारखं काहीच नाही.',
  },
  'architect.practising': { en: 'Practising', hi: 'अनुभव', mr: 'अनुभव' },
  'architect.years': { en: '{n} years', hi: '{n} साल', mr: '{n} वर्षं' },
  'architect.briefsRead': { en: 'Briefs read here', hi: 'यहाँ पढ़ी गई ज़रूरतें', mr: 'इथे वाचलेल्या गरजा' },
  'architect.paidBy': { en: 'Paid by a studio', hi: 'स्टूडियो से पैसे', mr: 'स्टुडिओकडून पैसे' },
  'architect.never': { en: 'Never', hi: 'कभी नहीं', mr: 'कधीच नाही' },

  // ── Form: the questions ──
  'std.0': {
    en: 'Is the cheapest quote cheaper because it is worse, or because it is smaller?',
    hi: 'सबसे सस्ता कोटेशन इसलिए सस्ता है कि काम खराब है, या इसलिए कि काम कम है?',
    mr: 'सगळ्यात स्वस्त कोटेशन काम वाईट आहे म्हणून स्वस्त आहे, की काम कमी आहे म्हणून?',
  },
  'std.1': {
    en: 'Which lines in these quotes are the ones that usually grow on site?',
    hi: 'इन कोटेशन की कौन-सी लाइनें साइट पर अक्सर बढ़ जाती हैं?',
    mr: 'या कोटेशन्समधल्या कोणत्या ओळी साइटवर सहसा वाढतात?',
  },
  'std.2': {
    en: 'What happens to the price if the work runs past the agreed weeks?',
    hi: 'अगर काम तय हफ़्तों से ज़्यादा चला, तो कीमत का क्या होगा?',
    mr: 'काम ठरलेल्या आठवड्यांपेक्षा जास्त चाललं, तर किमतीचं काय होईल?',
  },
  'std.3': {
    en: 'Which of these studios has actually delivered a flat like mine?',
    hi: 'इनमें से किस स्टूडियो ने सच में मेरे जैसा फ़्लैट बनाकर दिया है?',
    mr: 'यापैकी कोणत्या स्टुडिओने खरंच माझ्यासारखा फ्लॅट करून दिलाय?',
  },
  'std.4': {
    en: 'Can I keep some of what I already have, and does that save anything real?',
    hi: 'क्या मेरा कुछ पुराना सामान रखा जा सकता है, और क्या उससे सच में कुछ बचत होगी?',
    mr: 'माझ्याकडे आधीच असलेलं काही सामान ठेवता येईल का, आणि त्याने खरंच काही बचत होईल का?',
  },
  'std.5': {
    en: 'What do I have to decide before work starts, and what can wait?',
    hi: 'काम शुरू होने से पहले क्या तय करना ज़रूरी है, और क्या बाद में हो सकता है?',
    mr: 'काम सुरू होण्याआधी काय ठरवायला हवं, आणि काय नंतर चालेल?',
  },
  'gen.why': {
    en: 'Why is {high} about {gap} more than {low}?',
    hi: '{high}, {low} से लगभग {gap} ज़्यादा क्यों है?',
    mr: '{high} हा {low} पेक्षा सुमारे {gap} जास्त का आहे?',
  },
  'gen.leaving': {
    en: 'Is {low} leaving something out, or are they genuinely cheaper?',
    hi: 'क्या {low} कुछ छोड़ रहा है, या सच में सस्ता है?',
    mr: '{low} काही वगळतोय, की खरंच स्वस्त आहे?',
  },

  // ── Form: sent ──
  'sent.booked': { en: 'Booked', hi: 'बुक हो गया', mr: 'बुक झालं' },
  'sent.requested': { en: 'Requested', hi: 'अनुरोध भेजा', mr: 'विनंती पाठवली' },
  'sent.when': { en: '{day}, {time}.', hi: '{day}, {time}.', mr: '{day}, {time}.' },
  'sent.weCall': { en: 'We’ll call you.', hi: 'हम आपको कॉल करेंगे।', mr: 'आम्ही तुम्हाला फोन करू.' },
  'sent.bookedBody': {
    en: 'Thirty minutes, and we ring you. The invite is in your email if you gave us one. Before the call the expert reads your brief, your floor plan and every quote on your comparison — you will not have to explain any of it again.',
    hi: 'तीस मिनट, और कॉल हम करेंगे। अगर आपने ईमेल दिया है, तो इनवाइट उसमें है। कॉल से पहले एक्सपर्ट आपकी ज़रूरतें, फ़्लोर प्लान और आपकी तुलना का हर कोटेशन पढ़ लेंगी — आपको कुछ भी दोबारा समझाना नहीं पड़ेगा।',
    mr: 'तीस मिनिटं, आणि फोन आम्ही करू. तुम्ही ईमेल दिला असेल, तर इनव्हाइट त्यात आहे. कॉलआधी एक्सपर्ट तुमच्या गरजा, फ्लोअर प्लॅन आणि तुलनेतलं प्रत्येक कोटेशन वाचतील — तुम्हाला काहीही पुन्हा समजावून सांगावं लागणार नाही.',
  },
  'sent.requestedBody': {
    en: 'Someone will be in touch within one working day to fix a time. Before the call they will read your brief, your floor plan and every quote on your comparison — you will not have to explain any of it again.',
    hi: 'एक कामकाजी दिन के अंदर कोई आपसे समय तय करने के लिए संपर्क करेगा। कॉल से पहले वे आपकी ज़रूरतें, फ़्लोर प्लान और आपकी तुलना का हर कोटेशन पढ़ लेंगे — आपको कुछ भी दोबारा समझाना नहीं पड़ेगा।',
    mr: 'एका कामकाजाच्या दिवसात कोणीतरी वेळ ठरवण्यासाठी तुमच्याशी संपर्क करेल. कॉलआधी ते तुमच्या गरजा, फ्लोअर प्लॅन आणि तुलनेतलं प्रत्येक कोटेशन वाचतील — तुम्हाला काहीही पुन्हा समजावून सांगावं लागणार नाही.',
  },
  'sent.with': { en: 'With', hi: 'साथ में:', mr: 'सोबत:' },
  'sent.agenda': { en: 'Your agenda', hi: 'आपके सवाल', mr: 'तुमचे प्रश्न' },
  'sent.agendaNote': {
    en: 'Looked into before the call, so it starts at the answers.',
    hi: 'कॉल से पहले इन पर काम हो जाएगा, ताकि बात सीधे जवाबों से शुरू हो।',
    mr: 'कॉलआधी यांवर काम होईल, म्हणजे बोलणं थेट उत्तरांपासून सुरू होईल.',
  },
  'cal.title': { en: 'One Interiors · call with {name}', hi: 'One Interiors · {name} के साथ कॉल', mr: 'One Interiors · {name} सोबत कॉल' },
  'cal.details': {
    en: 'Thirty minutes about your home and your quotes. We ring you.',
    hi: 'आपके घर और आपके कोटेशन पर तीस मिनट। कॉल हम करेंगे।',
    mr: 'तुमचं घर आणि तुमच्या कोटेशन्सबद्दल तीस मिनिटं. फोन आम्ही करू.',
  },
  'cal.add': { en: 'Add to Google Calendar', hi: 'Google Calendar में जोड़ें', mr: 'Google Calendar मध्ये जोडा' },
  'prep.body': {
    en: 'While you wait, go through your home room by room — what each one costs, and the one decision in each that moves the number. The calls that go well are the ones where you already know which three things you are choosing between.',
    hi: 'इंतज़ार के दौरान अपना घर कमरा-दर-कमरा देख लीजिए — हर कमरे का खर्च, और हर कमरे का वह एक फ़ैसला जो रक़म बदल देता है। अच्छी कॉल वही होती हैं जिनमें आपको पहले से पता हो कि आप किन तीन चीज़ों में से चुन रहे हैं।',
    mr: 'वाट पाहताना तुमचं घर खोलीनुसार बघा — प्रत्येक खोलीचा खर्च, आणि प्रत्येक खोलीतला तो एक निर्णय जो रक्कम बदलतो. चांगले कॉल तेच असतात जिथे तुम्हाला आधीच माहीत असतं की तुम्ही कोणत्या तीन गोष्टींमधून निवडताय.',
  },
  'prep.cta': { en: 'Prepare for the call', hi: 'कॉल की तैयारी करें', mr: 'कॉलची तयारी करा' },
  'prep.note': {
    en: 'About fifteen minutes. Entirely optional, and your call is booked either way.',
    hi: 'लगभग पंद्रह मिनट। पूरी तरह आपकी मर्ज़ी — कॉल तो बुक है ही।',
    mr: 'सुमारे पंधरा मिनिटं. पूर्णपणे तुमच्या मर्जीवर — कॉल तर बुक झालाच आहे.',
  },

  // ── Form: studios ──
  'studios.legend': {
    en: 'Which studios do you want to talk about?',
    hi: 'आप किन स्टूडियो के बारे में बात करना चाहते हैं?',
    mr: 'तुम्हाला कोणत्या स्टुडिओंबद्दल बोलायचंय?',
  },
  'studios.help': {
    en: 'Pick between {min} and {max}. Your architect reads all of them before the call, so choosing fewer means a deeper conversation about each.',
    hi: '{min} से {max} के बीच चुनें। आपकी आर्किटेक्ट कॉल से पहले सबको पढ़ती हैं, इसलिए कम चुनेंगे तो हर एक पर गहराई से बात होगी।',
    mr: '{min} ते {max} मधून निवडा. तुमच्या आर्किटेक्ट कॉलआधी सगळे वाचतात, त्यामुळे कमी निवडले तर प्रत्येकावर सविस्तर बोलणं होईल.',
  },

  // ── Form: questions ──
  'asks.legend': { en: 'What do you want answered?', hi: 'आप किन सवालों के जवाब चाहते हैं?', mr: 'तुम्हाला कोणत्या प्रश्नांची उत्तरं हवीत?' },
  'asks.help': {
    en: 'Tick anything you want looked into before the call. The first ones are written from your own quotes and your brief. Nobody is going to open with “so, tell me about your requirement”.',
    hi: 'कॉल से पहले जिन बातों पर काम चाहिए, उन पर टिक करें। पहले वाले सवाल आपके अपने कोटेशन और आपकी ज़रूरतों से बने हैं। कोई भी “तो, अपनी requirement बताइए” से शुरुआत नहीं करेगा।',
    mr: 'कॉलआधी ज्या गोष्टींवर काम हवं, त्यांवर टिक करा. पहिले प्रश्न तुमच्याच कोटेशन्स आणि गरजांवरून लिहिलेले आहेत. कोणीही “तर, तुमची requirement सांगा” असं सुरू करणार नाही.',
  },
  'asks.fromQuotes': { en: 'From your own quotes', hi: 'आपके अपने कोटेशन से', mr: 'तुमच्याच कोटेशन्सवरून' },
  'asks.fromBrief': { en: 'From your brief', hi: 'आपकी ज़रूरतों से', mr: 'तुमच्या गरजांवरून' },
  'asks.common': { en: 'Things most people ask', hi: 'ज़्यादातर लोग यह पूछते हैं', mr: 'बहुतेक लोक हे विचारतात' },
  'asks.own': { en: 'Anything else — optional', hi: 'और कुछ — अपनी मर्ज़ी से', mr: 'आणखी काही — हवं असल्यास' },
  'asks.ownPlaceholder': {
    en: 'We have a two-year-old, so timeline matters more to us than finish.',
    hi: 'हमारा दो साल का बच्चा है, इसलिए हमारे लिए फ़िनिश से ज़्यादा समय-सीमा मायने रखती है।',
    mr: 'आमचं दोन वर्षांचं बाळ आहे, त्यामुळे आमच्यासाठी फिनिशपेक्षा वेळ जास्त महत्त्वाची आहे.',
  },

  // ── Form: contact ──
  'reach.legend': { en: 'How do we reach you?', hi: 'हम आपसे कैसे संपर्क करें?', mr: 'आम्ही तुमच्याशी संपर्क कसा करू?' },
  'reach.help': {
    en: 'A phone number, because this is a call. We do not pass it to any studio — the introduction happens after the call, and only to the one you choose.',
    hi: 'फ़ोन नंबर, क्योंकि यह कॉल है। हम इसे किसी स्टूडियो को नहीं देते — मुलाक़ात कॉल के बाद होती है, और सिर्फ़ उसी स्टूडियो से जिसे आप चुनें।',
    mr: 'फोन नंबर, कारण हा कॉल आहे. आम्ही तो कोणत्याही स्टुडिओला देत नाही — ओळख कॉलनंतर होते, आणि फक्त तुम्ही निवडलेल्या स्टुडिओशी.',
  },
  'field.name': { en: 'Your name', hi: 'आपका नाम', mr: 'तुमचं नाव' },
  'field.mobile': { en: 'Mobile', hi: 'मोबाइल', mr: 'मोबाइल' },
  'field.email': { en: 'Email', hi: 'ईमेल', mr: 'ईमेल' },
  'field.when': { en: 'When suits you?', hi: 'आपके लिए कब ठीक रहेगा?', mr: 'तुम्हाला कधी सोयीचं आहे?' },
  'field.whenPlaceholder': {
    en: 'Weekday evenings, or Saturday morning',
    hi: 'हफ़्ते के दिनों में शाम, या शनिवार सुबह',
    mr: 'आठवड्याच्या दिवशी संध्याकाळी, किंवा शनिवारी सकाळी',
  },
  'field.optional': { en: ' — optional', hi: ' — अपनी मर्ज़ी से', mr: ' — हवं असल्यास' },

  // ── Form: time ──
  'slot.legend': {
    en: 'Pick a time — thirty minutes, we ring you',
    hi: 'समय चुनें — तीस मिनट, कॉल हम करेंगे',
    mr: 'वेळ निवडा — तीस मिनिटं, फोन आम्ही करू',
  },
  'slot.help': {
    en: 'These are real times. Pick one and it is booked — nobody calls you back to arrange it.',
    hi: 'ये असली समय हैं। एक चुनिए और वह बुक हो जाएगा — तय करने के लिए कोई दोबारा कॉल नहीं करेगा।',
    mr: 'या खऱ्या वेळा आहेत. एक निवडा आणि ती बुक होईल — ठरवण्यासाठी कोणी पुन्हा फोन करणार नाही.',
  },

  // ── Form: consent and submit ──
  'consent.label': {
    en: 'Share my brief, name and number with the studios I have ticked — only once you introduce me, and only so they can arrange to meet.',
    hi: 'मेरी ज़रूरतें, नाम और नंबर उन स्टूडियो के साथ शेयर करें जिन पर मैंने टिक किया है — सिर्फ़ आपके मुलाक़ात करवाने के बाद, और सिर्फ़ मिलने का समय तय करने के लिए।',
    mr: 'माझ्या गरजा, नाव आणि नंबर मी टिक केलेल्या स्टुडिओंसोबत शेअर करा — फक्त तुम्ही ओळख करून दिल्यावर, आणि फक्त भेट ठरवण्यासाठी.',
  },
  'consent.withdraw': {
    en: 'You can withdraw this from “Your home” at any time.',
    hi: 'आप इसे कभी भी “Your home” से वापस ले सकते हैं।',
    mr: 'तुम्ही हे कधीही “Your home” मधून मागे घेऊ शकता.',
  },
  'submit.booking': { en: 'Booking…', hi: 'बुक हो रहा है…', mr: 'बुक होतंय…' },
  'submit.sending': { en: 'Sending…', hi: 'भेज रहे हैं…', mr: 'पाठवतोय…' },
  'submit.book': { en: 'Book {day} {time}', hi: '{day} {time} बुक करें', mr: '{day} {time} बुक करा' },
  'submit.pick': { en: 'Pick a time above', hi: 'ऊपर समय चुनें', mr: 'वर वेळ निवडा' },
  'submit.request': { en: 'Request the call', hi: 'कॉल का अनुरोध करें', mr: 'कॉलची विनंती करा' },
  'submit.note': {
    en: 'Free, and there is nothing to buy on the call. We are paid by the studio if you go ahead with one — which is why we would rather tell you none of them fits than push you into a project you regret.',
    hi: 'मुफ़्त, और कॉल पर खरीदने को कुछ नहीं है। अगर आप किसी स्टूडियो के साथ आगे बढ़ते हैं, तो हमें स्टूडियो पैसे देता है — इसीलिए आपको ऐसे प्रोजेक्ट में धकेलने के बजाय, जिस पर बाद में पछतावा हो, हम साफ़ कहना पसंद करेंगे कि कोई भी सही नहीं है।',
    mr: 'मोफत, आणि कॉलवर विकत घेण्यासारखं काहीच नाही. तुम्ही एखाद्या स्टुडिओसोबत पुढे गेलात, तर स्टुडिओ आम्हाला पैसे देतो — म्हणूनच नंतर पश्चात्ताप होईल अशा प्रोजेक्टमध्ये ढकलण्यापेक्षा, कोणीच योग्य नाही असं स्पष्ट सांगणं आम्हाला जास्त आवडेल.',
  },

  // ── Errors (mirror modules/consultation/request.ts) ──
  'err.deployment': {
    en: 'We cannot take requests on this deployment yet.',
    hi: 'इस वर्ज़न पर हम अभी अनुरोध नहीं ले सकते।',
    mr: 'या व्हर्जनवर आम्ही अजून विनंत्या घेऊ शकत नाही.',
  },
  'err.name': { en: 'What should we call you?', hi: 'हम आपको किस नाम से बुलाएँ?', mr: 'आम्ही तुम्हाला काय नावाने हाक मारू?' },
  'err.phone': {
    en: 'A 10-digit Indian mobile number, please.',
    hi: 'कृपया 10 अंकों का भारतीय मोबाइल नंबर डालें।',
    mr: 'कृपया 10 अंकी भारतीय मोबाइल नंबर टाका.',
  },
  'err.email': {
    en: "That doesn't look like an email address.",
    hi: 'यह ईमेल पता सही नहीं लग रहा।',
    mr: 'हा ईमेल पत्ता बरोबर वाटत नाही.',
  },
  'err.pickOne': {
    en: 'Pick the studio you want to talk about.',
    hi: 'जिस स्टूडियो के बारे में बात करनी है, उसे चुनें।',
    mr: 'ज्या स्टुडिओबद्दल बोलायचंय तो निवडा.',
  },
  'err.pickAtLeast': {
    en: 'Pick at least {n} studios — the call is about choosing between them.',
    hi: 'कम से कम {n} स्टूडियो चुनें — कॉल उनमें से चुनने के बारे में है।',
    mr: 'किमान {n} स्टुडिओ निवडा — कॉल त्यांच्यातून निवडण्याबद्दल आहे.',
  },
  'err.pickUpTo': {
    en: 'Pick up to {n}. Past that the call stops being a decision and becomes a tour.',
    hi: 'ज़्यादा से ज़्यादा {n} चुनें। उससे ज़्यादा हुए तो कॉल फ़ैसला नहीं, बस एक सैर बन जाती है।',
    mr: 'जास्तीत जास्त {n} निवडा. त्यापेक्षा जास्त झाले तर कॉल निर्णय न राहता फक्त फेरफटका होतो.',
  },
  'err.consent': {
    en: 'We can only introduce you to a studio if they may see your name and number.',
    hi: 'स्टूडियो से मुलाक़ात तभी करवा सकते हैं जब वे आपका नाम और नंबर देख सकें।',
    mr: 'स्टुडिओला तुमचं नाव आणि नंबर बघता आला तरच आम्ही ओळख करून देऊ शकतो.',
  },
  'err.noBrief': { en: 'We could not find that brief.', hi: 'हमें आपकी ज़रूरतों वाला फ़ॉर्म नहीं मिला।', mr: 'आम्हाला तुमच्या गरजांचा फॉर्म सापडला नाही.' },
  'err.slotGone': {
    en: 'That time has just gone. Pick another — the list is up to date now.',
    hi: 'वह समय अभी-अभी निकल गया। दूसरा चुनें — लिस्ट अब अपडेट है।',
    mr: 'ती वेळ आत्ताच गेली. दुसरी निवडा — यादी आता अपडेट आहे.',
  },
  'err.slotTaken': {
    en: 'Somebody booked that time a moment ago. Pick another.',
    hi: 'वह समय किसी ने अभी-अभी बुक कर लिया। दूसरा चुनें।',
    mr: 'ती वेळ कोणीतरी आत्ताच बुक केली. दुसरी निवडा.',
  },

  // ── BriefRescue ──
  'rescue.defaultDest': { en: 'your quotes', hi: 'आपके कोटेशन', mr: 'तुमची कोटेशन्स' },
  'rescue.picking': { en: 'Picking up your brief…', hi: 'आपकी ज़रूरतें ला रहे हैं…', mr: 'तुमच्या गरजा आणतोय…' },
  'rescue.pickingBody': {
    en: 'Your answers were saved in this browser. We are attaching them to your account, then {dest} will load.',
    hi: 'आपके जवाब इस ब्राउज़र में सेव थे। हम उन्हें आपके अकाउंट से जोड़ रहे हैं, फिर {dest} खुल जाएगा।',
    mr: 'तुमची उत्तरं या ब्राउझरमध्ये सेव्ह होती. आम्ही ती तुमच्या अकाउंटला जोडतोय, मग {dest} उघडेल.',
  },
  'rescue.failedH1': {
    en: 'We have your answers, but we could not save them just now.',
    hi: 'आपके जवाब हमारे पास हैं, पर अभी उन्हें सेव नहीं कर पाए।',
    mr: 'तुमची उत्तरं आमच्याकडे आहेत, पण आत्ता ती सेव्ह करता आली नाहीत.',
  },
  'rescue.failedBody': {
    en: 'Nothing is lost — they are still in this browser. This is our side, not yours. Try again in a moment, and if it keeps happening, tell us and we will sort it out.',
    hi: 'कुछ भी खोया नहीं है — जवाब अब भी इस ब्राउज़र में हैं। गड़बड़ हमारी तरफ़ से है, आपकी नहीं। थोड़ी देर में फिर कोशिश करें, और अगर बार-बार हो, तो हमें बताएँ — हम ठीक कर देंगे।',
    mr: 'काहीही हरवलेलं नाही — उत्तरं अजून या ब्राउझरमध्ये आहेत. गडबड आमच्या बाजूने आहे, तुमच्या नाही. थोड्या वेळाने पुन्हा प्रयत्न करा, आणि सारखं होत राहिलं तर आम्हाला सांगा — आम्ही ठीक करू.',
  },
  'rescue.retry': { en: 'Try again', hi: 'फिर कोशिश करें', mr: 'पुन्हा प्रयत्न करा' },
  'rescue.back': { en: 'Back to your matches', hi: 'अपने मैच पर वापस', mr: 'तुमच्या मॅचेसकडे परत' },
  'rescue.emptyH1': { en: 'We do not have your brief yet.', hi: 'आपकी ज़रूरतें अभी हमारे पास नहीं हैं।', mr: 'तुमच्या गरजा अजून आमच्याकडे नाहीत.' },
  'rescue.emptyBody': {
    en: 'Either it was not finished, or it was answered in a different browser — briefs are held per browser until you sign in. About four minutes, and {dest} follow immediately.',
    hi: 'या तो सवाल पूरे नहीं हुए, या किसी दूसरे ब्राउज़र में जवाब दिए गए — साइन इन करने तक जवाब हर ब्राउज़र में अलग रहते हैं। लगभग चार मिनट लगेंगे, और फिर तुरंत {dest} दिखेंगे।',
    mr: 'एकतर प्रश्न पूर्ण झाले नाहीत, किंवा दुसऱ्या ब्राउझरमध्ये उत्तरं दिली — साइन इन करेपर्यंत उत्तरं प्रत्येक ब्राउझरमध्ये वेगळी राहतात. सुमारे चार मिनिटं, आणि मग लगेच {dest} दिसतील.',
  },
  'rescue.answer': { en: 'Answer the questions', hi: 'सवालों के जवाब दें', mr: 'प्रश्नांची उत्तरं द्या' },

  // ── CallOffer ──
  'offer.usually': { en: 'Usually {price}', hi: 'आम तौर पर {price}', mr: 'सहसा {price}' },
  'offer.free': { en: 'Free', hi: 'मुफ़्त', mr: 'मोफत' },
  'offer.paid': { en: '{price} for a 30-minute call', hi: '30 मिनट की कॉल के लिए {price}', mr: '30 मिनिटांच्या कॉलसाठी {price}' },
  'offer.freeFirstN': { en: 'Free for the first {n} customers', hi: 'पहले {n} ग्राहकों के लिए मुफ़्त', mr: 'पहिल्या {n} ग्राहकांसाठी मोफत' },
  'offer.firstN': { en: 'for the first {n} customers', hi: 'पहले {n} ग्राहकों के लिए', mr: 'पहिल्या {n} ग्राहकांसाठी' },
  'offer.leftOne': { en: '{n} free call left', hi: '{n} मुफ़्त कॉल बची है', mr: '{n} मोफत कॉल उरला आहे' },
  'offer.leftMany': { en: '{n} free calls left', hi: '{n} मुफ़्त कॉल बची हैं', mr: '{n} मोफत कॉल उरले आहेत' },

  // ── ExpertPitch ──
  'pitch.lead': { en: 'Before you ring any studio', hi: 'किसी भी स्टूडियो को कॉल करने से पहले', mr: 'कोणत्याही स्टुडिओला फोन करण्याआधी' },
  'pitch.cta': { en: 'Book your expert call', hi: 'अपनी एक्सपर्ट कॉल बुक करें', mr: 'तुमचा एक्सपर्ट कॉल बुक करा' },
  'pitch.title': {
    en: 'Go through these with {name}, 30 minutes.',
    hi: 'इन्हें {name} के साथ देखिए, 30 मिनट।',
    mr: 'हे {name} सोबत बघा, 30 मिनिटं.',
  },
  'pitch.body': {
    en: 'She reads your brief and every quote first, tells you where the studios really differ, and sets up the meeting with the one you choose. No studio pays her.',
    hi: 'वे पहले आपकी ज़रूरतें और हर कोटेशन पढ़ती हैं, बताती हैं कि स्टूडियो असल में कहाँ अलग हैं, और जिसे आप चुनें उसके साथ मीटिंग तय करती हैं। उन्हें कोई स्टूडियो पैसे नहीं देता।',
    mr: 'त्या आधी तुमच्या गरजा आणि प्रत्येक कोटेशन वाचतात, स्टुडिओ खरंच कुठे वेगळे आहेत ते सांगतात, आणि तुम्ही निवडलेल्या स्टुडिओसोबत मीटिंग ठरवतात. त्यांना कोणताही स्टुडिओ पैसे देत नाही.',
  },

  // ── BenefitChips (mirror modules/portal/benefits.ts) ──
  'benefits.label': { en: 'Only when you book through us', hi: 'सिर्फ़ हमारे ज़रिए बुक करने पर', mr: 'फक्त आमच्यामार्फत बुक केल्यावर' },
  'benefits.worth': { en: ' · worth up to {amount}', hi: ' · {amount} तक का फ़ायदा', mr: ' · {amount} पर्यंतचा फायदा' },
  'benefit.cashback.short': { en: 'Up to ₹50,000 cashback', hi: '₹50,000 तक कैशबैक', mr: '₹50,000 पर्यंत कॅशबॅक' },
  'benefit.cashback.terms': {
    en: 'Up to ₹50,000 back once you have signed with a studio through us and paid its first payment phase. If the project is cancelled before 20% of its value has been paid to the studio, the cashback is cancelled.',
    hi: 'हमारे ज़रिए किसी स्टूडियो के साथ साइन करने और पहली किस्त चुकाने के बाद ₹50,000 तक वापस। अगर स्टूडियो को प्रोजेक्ट की 20% रक़म मिलने से पहले प्रोजेक्ट रद्द हो जाए, तो कैशबैक भी रद्द हो जाता है।',
    mr: 'आमच्यामार्फत स्टुडिओसोबत साइन केल्यावर आणि पहिला हप्ता भरल्यावर ₹50,000 पर्यंत परत. स्टुडिओला प्रोजेक्टच्या रकमेचे 20% मिळण्याआधी प्रोजेक्ट रद्द झाला, तर कॅशबॅकही रद्द होतो.',
  },
  'benefit.curated-discount.short': { en: 'Negotiated studio discounts', hi: 'स्टूडियो से तय की गई छूट', mr: 'स्टुडिओकडून ठरवलेली सूट' },
  'benefit.curated-discount.terms': {
    en: 'Studios that offer one show it as its own line on your quote — the same for every customer, never a struck-through price.',
    hi: 'जो स्टूडियो छूट देते हैं, वे इसे आपके कोटेशन में अलग लाइन में दिखाते हैं — हर ग्राहक के लिए एक जैसी, कभी काटी हुई कीमत नहीं।',
    mr: 'जे स्टुडिओ सूट देतात, ते ती तुमच्या कोटेशनमध्ये वेगळ्या ओळीत दाखवतात — प्रत्येक ग्राहकासाठी सारखीच, कधीही खोडलेली किंमत नाही.',
  },
  'benefit.free-cab.short': { en: 'Free cab to the studio', hi: 'स्टूडियो तक मुफ़्त कैब', mr: 'स्टुडिओपर्यंत मोफत कॅब' },
  'benefit.free-cab.terms': {
    en: 'After your expert call, when a studio meeting is scheduled, we book your cab to the studio — the first trip, from anywhere in Pune.',
    hi: 'एक्सपर्ट कॉल के बाद, जब स्टूडियो के साथ मीटिंग तय हो जाए, तो स्टूडियो तक आपकी कैब हम बुक करते हैं — पहली बार, पुणे में कहीं से भी।',
    mr: 'एक्सपर्ट कॉलनंतर, स्टुडिओसोबत मीटिंग ठरली की स्टुडिओपर्यंत तुमची कॅब आम्ही बुक करतो — पहिल्या वेळी, पुण्यात कुठूनही.',
  },
  'benefit.unbiased-expert.short': { en: 'An architect who is not selling', hi: 'ऐसे आर्किटेक्ट जो कुछ बेच नहीं रहे', mr: 'काहीही न विकणारे आर्किटेक्ट' },
  'benefit.unbiased-expert.terms': {
    en: 'No studio pays our experts. They are there to help you choose, not to sell you one.',
    hi: 'हमारे एक्सपर्ट को कोई स्टूडियो पैसे नहीं देता। वे चुनने में आपकी मदद के लिए हैं, कुछ बेचने के लिए नहीं।',
    mr: 'आमच्या एक्सपर्टना कोणताही स्टुडिओ पैसे देत नाही. ते निवड करायला मदत करण्यासाठी आहेत, काही विकण्यासाठी नाही.',
  },
  'benefit.tracker.short': { en: 'Your project tracked, stage by stage', hi: 'आपके प्रोजेक्ट का हर स्टेज ट्रैक', mr: 'तुमच्या प्रोजेक्टचा प्रत्येक टप्पा ट्रॅक' },
  'benefit.tracker.terms': {
    en: 'Every stage of your home here, with its planned date, what is done and what has happened on site.',
    hi: 'आपके घर का हर स्टेज यहाँ — तय तारीख, क्या हो गया और साइट पर क्या हुआ।',
    mr: 'तुमच्या घराचा प्रत्येक टप्पा इथे — ठरलेली तारीख, काय झालं आणि साइटवर काय घडलं.',
  },
  'benefit.cinematic-shoot.short': {
    en: 'A cinematic film of your finished home',
    hi: 'आपके तैयार घर की सिनेमैटिक फ़िल्म',
    mr: 'तुमच्या तयार घराची सिनेमॅटिक फिल्म',
  },
  'benefit.cinematic-shoot.terms': {
    en: 'When a studio chosen through us completes your home, we film it — a cinematic video, with a testimonial from you if you would like to give one, both yours to keep.',
    hi: 'जब हमारे ज़रिए चुना गया स्टूडियो आपका घर पूरा करता है, तो हम उसकी फ़िल्म बनाते हैं — एक सिनेमैटिक वीडियो, और आप चाहें तो आपका अनुभव भी — दोनों आपके पास रहेंगे।',
    mr: 'आमच्यामार्फत निवडलेला स्टुडिओ तुमचं घर पूर्ण करतो, तेव्हा आम्ही त्याची फिल्म बनवतो — एक सिनेमॅटिक व्हिडिओ, आणि तुम्हाला हवं असल्यास तुमचा अनुभवही — दोन्ही तुमच्याकडे राहतील.',
  },
  'benefit.onehamper.short': { en: 'OneHamper at handover', hi: 'हैंडओवर पर OneHamper', mr: 'हँडओव्हरला OneHamper' },
  'benefit.onehamper.terms': {
    en: 'At handover, every home built through us gets OneHamper — a gift from us.',
    hi: 'हैंडओवर पर, हमारे ज़रिए बने हर घर को OneHamper मिलता है — हमारी तरफ़ से एक तोहफ़ा।',
    mr: 'हँडओव्हरला, आमच्यामार्फत बनलेल्या प्रत्येक घराला OneHamper मिळतो — आमच्याकडून एक भेट.',
  },
  'benefit.referral.short': {
    en: '₹10,000 for every friend who builds',
    hi: 'घर बनवाने वाले हर दोस्त के लिए ₹10,000',
    mr: 'घर करणाऱ्या प्रत्येक मित्रासाठी ₹10,000',
  },
  'benefit.referral.terms': {
    en: 'Refer a friend. When their project with a studio chosen through us has its 20% advance paid, you get ₹10,000 — for every project that closes.',
    hi: 'किसी दोस्त को रेफ़र करें। हमारे ज़रिए चुने गए स्टूडियो के साथ उनके प्रोजेक्ट का 20% एडवांस भरते ही आपको ₹10,000 मिलेंगे — हर पक्के प्रोजेक्ट पर।',
    mr: 'एखाद्या मित्राला रेफर करा. आमच्यामार्फत निवडलेल्या स्टुडिओसोबत त्यांच्या प्रोजेक्टचा 20% ॲडव्हान्स भरला की तुम्हाला ₹10,000 मिळतील — प्रत्येक पक्क्या प्रोजेक्टवर.',
  },
  // ── The short booking flow (owner, 10 Oct 2026) ──
  'flow.brief': { en: 'Your brief', hi: 'आपका ब्रीफ़', mr: 'तुमचे ब्रीफ' },
  'flow.editBrief': { en: 'Edit', hi: 'बदलें', mr: 'बदला' },
  'flow.step1': { en: 'Which studios should we talk about?', hi: 'किन स्टूडियो के बारे में बात करें?', mr: 'कोणत्या स्टुडिओबद्दल बोलूया?' },
  'flow.step1Help': { en: 'Pick {min} to {max}.', hi: '{min} से {max} चुनें।', mr: '{min} ते {max} निवडा.' },
  'flow.step2': { en: 'When suits you?', hi: 'आपके लिए कब ठीक है?', mr: 'तुम्हाला कधी सोयीचे आहे?' },
  'flow.step2Time': { en: 'Pick a time', hi: 'समय चुनें', mr: 'वेळ निवडा' },
  'flow.step2None': {
    en: 'No open times are listed yet — our expert will call you to fix one.',
    hi: 'अभी कोई खाली समय नहीं दिख रहा — हमारे एक्सपर्ट आपको कॉल करके समय तय करेंगे।',
    mr: 'अजून मोकळी वेळ दिसत नाही — आमचे एक्सपर्ट फोन करून वेळ ठरवतील.',
  },
  'flow.step3': { en: 'Booking for', hi: 'किसके लिए बुकिंग', mr: 'कोणासाठी बुकिंग' },
  'flow.change': { en: 'Change', hi: 'बदलें', mr: 'बदला' },
  'flow.done': { en: 'Done', hi: 'ठीक है', mr: 'ठीक आहे' },
  'flow.name': { en: 'Your name', hi: 'आपका नाम', mr: 'तुमचे नाव' },
  'flow.mobile': { en: 'Mobile', hi: 'मोबाइल', mr: 'मोबाइल' },
  'flow.step4': { en: 'Confirm with a code', hi: 'कोड से पक्का करें', mr: 'कोडने पक्के करा' },
  'flow.sendCode': { en: 'Send code on WhatsApp', hi: 'WhatsApp पर कोड भेजें', mr: 'WhatsApp वर कोड पाठवा' },
  'flow.sending': { en: 'Sending…', hi: 'भेज रहे हैं…', mr: 'पाठवतोय…' },
  'flow.codeSent': { en: 'We sent a 6-digit code to +91 {phone} on WhatsApp.', hi: 'हमने +91 {phone} पर WhatsApp से 6 अंकों का कोड भेजा है।', mr: 'आम्ही +91 {phone} वर WhatsApp वर 6 अंकी कोड पाठवला आहे.' },
  'flow.code': { en: '6-digit code', hi: '6 अंकों का कोड', mr: '6 अंकी कोड' },
  'flow.resendIn': { en: 'Resend in {s}s', hi: '{s} सेकंड में फिर भेजें', mr: '{s} सेकंदात पुन्हा पाठवा' },
  'flow.resend': { en: 'Resend code', hi: 'कोड फिर भेजें', mr: 'कोड पुन्हा पाठवा' },
  'flow.confirm': { en: 'Confirm booking', hi: 'बुकिंग पक्की करें', mr: 'बुकिंग पक्की करा' },
  'flow.confirming': { en: 'Booking…', hi: 'बुक हो रहा है…', mr: 'बुक होतंय…' },
  'flow.consent': {
    en: 'By confirming, you agree we share your brief, name and number with the studios you picked — and only them. You can withdraw any time from Your project.',
    hi: 'पक्का करके आप मानते हैं कि हम आपका ब्रीफ़, नाम और नंबर सिर्फ़ आपके चुने स्टूडियो के साथ साझा करें। आप कभी भी "आपका प्रोजेक्ट" से इसे वापस ले सकते हैं।',
    mr: 'पक्के करून तुम्ही मान्य करता की आम्ही तुमचे ब्रीफ, नाव आणि नंबर फक्त तुम्ही निवडलेल्या स्टुडिओसोबत शेअर करू. "तुमचा प्रोजेक्ट" मधून तुम्ही कधीही हे मागे घेऊ शकता.',
  },
  'flow.needPhone': { en: 'Add your mobile number above.', hi: 'ऊपर अपना मोबाइल नंबर डालें।', mr: 'वर तुमचा मोबाइल नंबर टाका.' },
  'flow.needSlot': { en: 'Pick a date and time first.', hi: 'पहले तारीख और समय चुनें।', mr: 'आधी तारीख आणि वेळ निवडा.' },
  'flow.needStudios': { en: 'Pick at least {n} studio(s) first.', hi: 'पहले कम से कम {n} स्टूडियो चुनें।', mr: 'आधी किमान {n} स्टुडिओ निवडा.' },
  'flow.testBuild': { en: 'Test build — any 6 digits work, and nothing is booked.', hi: 'टेस्ट बिल्ड — कोई भी 6 अंक चलेंगे, कुछ बुक नहीं होगा।', mr: 'टेस्ट बिल्ड — कोणतेही 6 अंक चालतील, काहीही बुक होणार नाही.' },
  'flow.verifyFirst': { en: 'Verify your number with the WhatsApp code first.', hi: 'पहले WhatsApp कोड से अपना नंबर पक्का करें।', mr: 'आधी WhatsApp कोडने तुमचा नंबर पक्का करा.' },
  // ── The app-style header and picker (owner, 10 Oct 2026) ──
  'hero.meta': { en: 'Free, 30 minutes', hi: 'मुफ़्त, 30 मिनट', mr: 'मोफत, 30 मिनिटे' },
  'hero.title': {
    en: 'Your expert is on our payroll. Never a studio’s.',
    hi: 'आपके एक्सपर्ट हमारी टीम में हैं। किसी स्टूडियो की नहीं।',
    mr: 'तुमचे एक्सपर्ट आमच्या टीममध्ये आहेत. कोणत्याही स्टुडिओच्या नाहीत.',
  },
  'hero.body': {
    en: '{name} reads your answers and all {n} quotes first. She earns the same whichever studio you pick.',
    hi: '{name} पहले आपके जवाब और सभी {n} कोटेशन पढ़ती हैं। आप कोई भी स्टूडियो चुनें, उनकी कमाई उतनी ही रहती है।',
    mr: '{name} आधी तुमची उत्तरे आणि सगळी {n} कोटेशन वाचतात. तुम्ही कोणताही स्टुडिओ निवडा, त्यांची कमाई तेवढीच राहते.',
  },
  'flow.pickDay': { en: 'Pick a day', hi: 'दिन चुनें', mr: 'दिवस निवडा' },
  'flow.sampleHours': {
    en: 'Test build · usual hours shown, nothing is booked',
    hi: 'टेस्ट बिल्ड · आम तौर के समय दिखाए गए हैं, कुछ बुक नहीं होगा',
    mr: 'टेस्ट बिल्ड · नेहमीच्या वेळा दाखवल्या आहेत, काहीही बुक होणार नाही',
  },
} satisfies Record<string, Tx>;

export type ExpertKey = keyof typeof EXPERT_DICT;

/**
 * Translate text that lives in a module (the architect, a benefit, an error)
 * only while the module still says exactly what the dictionary mirrors.
 * Anything else is shown as the module wrote it.
 */
export function known(lang: Lang, key: string, english: string, vars?: Record<string, string | number>): string {
  const entry = (EXPERT_DICT as Record<string, Tx>)[key];
  if (!entry) return english;
  return tx('en', entry, vars) === english ? tx(lang, entry, vars) : english;
}

/**
 * The expert call's offer lines (consultation/offer.ts writes them in
 * English) rebuilt from the same figures in the visitor's language. Any line
 * the module words differently from what is mirrored here is kept as written.
 *
 * `headline` is the whole line ("Free for the first 1,000 customers");
 * `rest` is it without the leading "Free" (CallOffer shows that separately).
 */
export function offerText(lang: Lang, offer: OfferState): { headline: string; rest: string; remaining: string | null } {
  const n = FREE_CALLS.toLocaleString('en-IN');
  const left = offer.remaining ? /^(\d+) free calls? left$/.exec(offer.remaining) : null;
  const remaining = left
    ? tx(lang, EXPERT_DICT[left[1] === '1' ? 'offer.leftOne' : 'offer.leftMany'], { n: left[1]! })
    : offer.remaining;
  if (!offer.free) {
    const headline = known(lang, 'offer.paid', offer.headline, { price: offer.price });
    return { headline, rest: headline, remaining };
  }
  const rest = offer.headline.replace(/^Free /, '');
  return {
    headline: known(lang, 'offer.freeFirstN', offer.headline, { n }),
    rest: known(lang, 'offer.firstN', rest, { n }),
    remaining,
  };
}

/** The consultation errors (modules/consultation/request.ts), in the visitor's language. */
export function localiseExpertError(lang: Lang, english: string): string {
  if (lang === 'en') return english;
  const atLeast = /^Pick at least (\d+) studios/.exec(english);
  if (atLeast) return known(lang, 'err.pickAtLeast', english, { n: atLeast[1]! });
  const upTo = /^Pick up to (\d+)\./.exec(english);
  if (upTo) return known(lang, 'err.pickUpTo', english, { n: upTo[1]! });
  for (const key of [
    'err.deployment',
    'err.name',
    'err.phone',
    'err.email',
    'err.pickOne',
    'err.consent',
    'err.noBrief',
    'err.slotGone',
    'err.slotTaken',
  ] as const) {
    if (EXPERT_DICT[key].en === english) return tx(lang, EXPERT_DICT[key]);
  }
  return english;
}

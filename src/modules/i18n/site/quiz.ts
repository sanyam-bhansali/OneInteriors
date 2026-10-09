/**
 * The brief (/quiz) in English, Hindi and Marathi: every screen's question,
 * hint, button and note, the running "brief so far" panel, the floor-plan and
 * photo readers, the locality and society fields, the swipe and this-or-that
 * pickers. Shared labels (home type, scope, priorities…) come from `labels.ts`.
 *
 * FIRST DRAFT for native-speaker review — see `modules/i18n/site.ts`.
 * The English must stay identical to what the quiz said before.
 */

import { createElement, Fragment, type ReactNode } from 'react';
import { tx, type Lang, type Tx } from '../site';

export const QUIZ_DICT = {
  // ── Header, footer, progress ───────────────────────────────
  'time.nearlyDone': { en: 'nearly done', hi: 'लगभग हो गया', mr: 'जवळजवळ झाले' },
  'time.underMinute': { en: 'under a minute left', hi: 'एक मिनट से कम बाकी', mr: 'एक मिनिटापेक्षा कमी बाकी' },
  'time.minutes': { en: 'about {n} min left', hi: 'लगभग {n} मिनट बाकी', mr: 'सुमारे {n} मिनिटे बाकी' },
  'head.count': { en: '{n} of {of}', hi: '{of} में से {n}', mr: '{of} पैकी {n}' },
  loading: { en: 'Loading…', hi: 'लोड हो रहा है…', mr: 'लोड होत आहे…' },
  'aria.home': { en: 'One Interiors, home', hi: 'One Interiors, होम पेज', mr: 'One Interiors, होम पेज' },
  'aria.progress': { en: 'Quiz progress', hi: 'क्विज़ की प्रगति', mr: 'क्विझची प्रगती' },
  show: { en: 'Show', hi: 'दिखाएँ', mr: 'दाखवा' },
  hide: { en: 'Hide', hi: 'छिपाएँ', mr: 'लपवा' },
  back: { en: 'Back', hi: 'वापस', mr: 'मागे' },
  'need.rank': {
    en: 'Rank all four to continue ({n} of 4)',
    hi: 'आगे बढ़ने के लिए चारों को क्रम दें (4 में से {n})',
    mr: 'पुढे जाण्यासाठी चारही क्रमाने लावा (4 पैकी {n})',
  },
  'need.two': { en: 'Pick at least two to continue', hi: 'आगे बढ़ने के लिए कम से कम दो चुनें', mr: 'पुढे जाण्यासाठी किमान दोन निवडा' },
  'need.one': { en: 'Pick an answer to continue', hi: 'आगे बढ़ने के लिए एक जवाब चुनें', mr: 'पुढे जाण्यासाठी एक उत्तर निवडा' },
  'cta.writing': { en: 'Writing your brief…', hi: 'आपका ब्रीफ़ तैयार हो रहा है…', mr: 'तुमचे ब्रीफ तयार होत आहे…' },
  'cta.see': { en: 'See who fits', hi: 'देखें कौन सही है', mr: 'कोण योग्य आहे ते पाहा' },
  'cta.continue': { en: 'Continue', hi: 'आगे बढ़ें', mr: 'पुढे चला' },
  and: { en: 'and', hi: 'और', mr: 'आणि' },
  use: { en: 'Use these', hi: 'यही इस्तेमाल करें', mr: 'हेच वापरा' },

  // ── Name ───────────────────────────────────────────────────
  'name.title': { en: 'First — what should we call you?', hi: 'पहले — आपको किस नाम से बुलाएँ?', mr: 'आधी — तुम्हाला कोणत्या नावाने हाक मारू?' },
  'name.hint': {
    en: 'Just a first name is fine. It stays on this device until you send us your brief at the end.',
    hi: 'सिर्फ़ पहला नाम काफ़ी है। आखिर में ब्रीफ़ भेजने तक यह इसी डिवाइस पर रहता है।',
    mr: 'फक्त पहिले नाव पुरेसे आहे. शेवटी ब्रीफ पाठवेपर्यंत ते याच डिव्हाइसवर राहते.',
  },
  'name.placeholder': { en: 'Your first name', hi: 'आपका पहला नाम', mr: 'तुमचे पहिले नाव' },

  // ── Home ───────────────────────────────────────────────────
  'home.titleNamed': { en: '{name}, what kind of home are we working with?', hi: '{name}, घर किस तरह का है?', mr: '{name}, घर कोणत्या प्रकारचे आहे?' },
  'home.title': { en: 'What kind of home are we working with?', hi: 'घर किस तरह का है?', mr: 'घर कोणत्या प्रकारचे आहे?' },
  'home.hint': {
    en: 'And where in Pune it is, so we only show you studios who actually work there.',
    hi: 'और पुणे में कहाँ है, ताकि हम आपको सिर्फ़ वही स्टूडियो दिखाएँ जो सच में वहाँ काम करते हैं।',
    mr: 'आणि पुण्यात कुठे आहे, म्हणजे तिथे खरोखर काम करणारेच स्टुडिओ आम्ही तुम्हाला दाखवू.',
  },
  'home.where': { en: 'Where is it?', hi: 'घर कहाँ है?', mr: 'घर कुठे आहे?' },
  'home.society': { en: 'Society or building, if you like', hi: 'सोसाइटी या बिल्डिंग, अगर बताना चाहें', mr: 'सोसायटी किंवा बिल्डिंग, सांगायची असल्यास' },

  // ── Floor plan ─────────────────────────────────────────────
  'plan.title': { en: 'Have your floor plan?', hi: 'आपके पास फ़्लोर प्लान है?', mr: 'तुमच्याकडे फ्लोअर प्लॅन आहे का?' },
  'plan.hint': {
    en: "The builder's plan, or a photo of it. We read the sizes off it so every studio's quote is priced on your actual kitchen and rooms — not a standard one. Skip it if you don't have it to hand.",
    hi: 'बिल्डर का प्लान, या उसकी फ़ोटो। हम उससे नाप पढ़ते हैं, ताकि हर स्टूडियो का कोटेशन आपके असली किचन और कमरों पर बने — किसी स्टैंडर्ड नाप पर नहीं। अभी पास न हो तो छोड़ दें।',
    mr: 'बिल्डरचा प्लॅन, किंवा त्याचा फोटो. आम्ही त्यावरून मापे वाचतो, म्हणजे प्रत्येक स्टुडिओचे कोटेशन तुमच्या खऱ्या किचन आणि खोल्यांवर बनेल — स्टँडर्ड मापावर नाही. आत्ता हाताशी नसेल तर सोडून द्या.',
  },
  'plan.errDefault': {
    en: 'We could not read that plan just now. Skip this and we will price a standard kitchen.',
    hi: 'अभी यह प्लान पढ़ नहीं पाए। इसे छोड़ दें, हम स्टैंडर्ड किचन के हिसाब से दाम लगाएँगे।',
    mr: 'आत्ता हा प्लॅन वाचता आला नाही. हे सोडून द्या, आम्ही स्टँडर्ड किचननुसार किंमत काढू.',
  },
  'plan.usingSociety': {
    en: 'Using the plan other homes in {society} shared: ',
    hi: '{society} के दूसरे घरों का शेयर किया प्लान इस्तेमाल हो रहा है: ',
    mr: '{society} मधील इतर घरांनी शेअर केलेला प्लॅन वापरत आहोत: ',
  },
  'plan.yourBuilding': { en: 'your building', hi: 'आपकी बिल्डिंग', mr: 'तुमच्या बिल्डिंग' },
  'plan.usingYours': { en: 'Using your plan: ', hi: 'आपका प्लान इस्तेमाल हो रहा है: ', mr: 'तुमचा प्लॅन वापरत आहोत: ' },
  'plan.usingYoursNamed': {
    en: 'Using your plan ({file}): ',
    hi: 'आपका प्लान ({file}) इस्तेमाल हो रहा है: ',
    mr: 'तुमचा प्लॅन ({file}) वापरत आहोत: ',
  },
  'plan.bath1': { en: '{n} bathroom', hi: '{n} बाथरूम', mr: '{n} बाथरूम' },
  'plan.bathN': { en: '{n} bathrooms', hi: '{n} बाथरूम', mr: '{n} बाथरूम' },
  'plan.kitchenRun': { en: 'kitchen platform {mm} mm', hi: 'किचन प्लेटफ़ॉर्म {mm} mm', mr: 'किचन प्लॅटफॉर्म {mm} mm' },
  'plan.different': { en: 'Use a different plan', hi: 'दूसरा प्लान लगाएँ', mr: 'दुसरा प्लॅन वापरा' },
  'plan.weRead': { en: 'We read {file} — is this right?', hi: 'हमने {file} पढ़ा — क्या यह सही है?', mr: 'आम्ही {file} वाचला — हे बरोबर आहे का?' },
  'plan.bedrooms': { en: 'Bedrooms', hi: 'बेडरूम', mr: 'बेडरूम' },
  'plan.area': { en: 'Carpet area, sq ft', hi: 'कारपेट एरिया, sq ft', mr: 'कार्पेट एरिया, sq ft' },
  'plan.kitchen': { en: 'Kitchen platform, mm', hi: 'किचन प्लेटफ़ॉर्म, mm', mr: 'किचन प्लॅटफॉर्म, mm' },
  'plan.unknown': { en: 'unknown', hi: 'पता नहीं', mr: 'माहीत नाही' },
  'plan.bathrooms': { en: 'Bathrooms', hi: 'बाथरूम', mr: 'बाथरूम' },
  'plan.study': {
    en: 'There is a study as well — counted as a study, not a bedroom.',
    hi: 'एक स्टडी भी है — इसे स्टडी गिना है, बेडरूम नहीं।',
    mr: 'एक स्टडीही आहे — ती स्टडी म्हणून मोजली आहे, बेडरूम म्हणून नाही.',
  },
  'plan.check': {
    en: 'Check the numbers — bedrooms and bathrooms 1–6, area 150–20,000 sq ft, kitchen 1,500–9,000 mm.',
    hi: 'नंबर जाँच लें — बेडरूम और बाथरूम 1–6, एरिया 150–20,000 sq ft, किचन 1,500–9,000 mm।',
    mr: 'आकडे तपासा — बेडरूम आणि बाथरूम 1–6, एरिया 150–20,000 sq ft, किचन 1,500–9,000 mm.',
  },
  'plan.another': { en: 'Try another file', hi: 'दूसरी फ़ाइल आज़माएँ', mr: 'दुसरी फाइल वापरून पाहा' },
  'plan.helps': {
    en: 'Its sizes — never the file, never your name — help the next family in {society}.',
    hi: 'इसके नाप — फ़ाइल नहीं, आपका नाम नहीं — {society} के अगले परिवार के काम आते हैं।',
    mr: 'याची मापे — फाइल नाही, तुमचे नाव नाही — {society} मधील पुढच्या कुटुंबाच्या कामी येतात.',
  },
  'plan.shared': {
    en: '{homes} homes in {society} have shared their plan for this layout: {sizes}.',
    hi: '{society} के {homes} घरों ने इस लेआउट का प्लान शेयर किया है: {sizes}।',
    mr: '{society} मधील {homes} घरांनी या लेआउटचा प्लॅन शेअर केला आहे: {sizes}.',
  },
  'plan.useSizes': { en: 'Use these sizes', hi: 'यही नाप इस्तेमाल करें', mr: 'हीच मापे वापरा' },
  'plan.orUpload': {
    en: 'Or upload your own below — yours is the one to trust.',
    hi: 'या नीचे अपना प्लान अपलोड करें — भरोसा आपके अपने प्लान पर ही करें।',
    mr: 'किंवा खाली तुमचा स्वतःचा प्लॅन अपलोड करा — विश्वास तुमच्या प्लॅनवरच ठेवा.',
  },
  'plan.reading': { en: 'Reading your plan…', hi: 'आपका प्लान पढ़ रहे हैं…', mr: 'तुमचा प्लॅन वाचत आहोत…' },
  'plan.read': { en: 'Read my plan', hi: 'मेरा प्लान पढ़ें', mr: 'माझा प्लॅन वाचा' },
  'plan.formats': { en: 'PDF or photo, up to 4 MB', hi: 'PDF या फ़ोटो, 4 MB तक', mr: 'PDF किंवा फोटो, 4 MB पर्यंत' },
  'plan.privacy': {
    en: 'We read it with an AI service to size your quote, and keep it privately. A studio sees it only when you choose that studio.',
    hi: 'कोटेशन का साइज़ तय करने के लिए हम इसे एक AI सर्विस से पढ़ते हैं, और इसे निजी रखते हैं। स्टूडियो इसे तभी देखता है जब आप उस स्टूडियो को चुनते हैं।',
    mr: 'कोटेशनसाठी मापे काढायला आम्ही हे एका AI सर्व्हिसने वाचतो, आणि खाजगी ठेवतो. तुम्ही एखादा स्टुडिओ निवडल्यावरच तो स्टुडिओ हे पाहू शकतो.',
  },
  'plan.noPlan': {
    en: 'No plan to hand? Your carpet area, if you know it',
    hi: 'प्लान पास नहीं है? अपना कारपेट एरिया, अगर पता हो',
    mr: 'प्लॅन हाताशी नाही? तुमचा कार्पेट एरिया, माहीत असल्यास',
  },
  'plan.blank': {
    en: 'Left blank, we use the typical area for your home and say so on every quote.',
    hi: 'खाली छोड़ने पर हम आपके घर का आम एरिया लेते हैं और हर कोटेशन पर यह लिखते हैं।',
    mr: 'रिकामे सोडल्यास आम्ही तुमच्या घराचा साधारण एरिया धरतो आणि प्रत्येक कोटेशनवर तसे लिहितो.',
  },

  // ── Possession ─────────────────────────────────────────────
  'poss.title': { en: 'Last one — do you have possession yet?', hi: 'आखिरी सवाल — क्या पज़ेशन मिल गया है?', mr: 'शेवटचा प्रश्न — पझेशन मिळाले आहे का?' },
  'poss.hint': {
    en: 'Work starts from the day you get the keys, so everything we plan counts from there.',
    hi: 'काम चाबी मिलने के दिन से शुरू होता है, इसलिए हमारी पूरी प्लानिंग वहीं से गिनी जाती है।',
    mr: 'काम चावी मिळाल्याच्या दिवसापासून सुरू होते, म्हणून आमचे सगळे नियोजन तिथूनच मोजले जाते.',
  },
  'poss.haveKeys': {
    en: 'Work can start as soon as the design is signed off.',
    hi: 'डिज़ाइन फ़ाइनल होते ही काम शुरू हो सकता है।',
    mr: 'डिझाइन फायनल होताच काम सुरू होऊ शकते.',
  },
  'poss.expected': {
    en: 'Tell us the month. Design can start before handover.',
    hi: 'महीना बताइए। हैंडओवर से पहले ही डिज़ाइन शुरू हो सकता है।',
    mr: 'महिना सांगा. हँडओव्हरच्या आधीच डिझाइन सुरू होऊ शकते.',
  },
  'poss.notSure': {
    en: 'That is fine — we will plan from when you know.',
    hi: 'कोई बात नहीं — जब पता चलेगा, तब से प्लान करेंगे।',
    mr: 'काही हरकत नाही — कळेल तेव्हापासून आपण नियोजन करू.',
  },
  'poss.expectedIn': { en: 'Possession expected in', hi: 'पज़ेशन कब तक मिलेगा', mr: 'पझेशन कधी मिळेल' },
  'poss.window': {
    en: 'A full home in Pune usually takes {min} to {max} days from design sign-off. With the design signed off by {when}, yours could be ready between {from} and {to}.',
    hi: 'पुणे में पूरा घर बनने में डिज़ाइन फ़ाइनल होने के बाद आम तौर पर {min} से {max} दिन लगते हैं। अगर डिज़ाइन {when} फ़ाइनल हो जाए, तो आपका घर {from} से {to} के बीच तैयार हो सकता है।',
    mr: 'पुण्यात संपूर्ण घराला डिझाइन फायनल झाल्यानंतर साधारण {min} ते {max} दिवस लागतात. डिझाइन {when} फायनल झाले, तर तुमचे घर {from} ते {to} दरम्यान तयार होऊ शकते.',
  },
  'poss.now': { en: 'now', hi: 'अभी तक', mr: 'आत्तापर्यंत' },
  'poss.keysTime': { en: 'the time you get the keys', hi: 'चाबी मिलने तक', mr: 'चावी मिळेपर्यंत' },
  // The running panel's possession line (English comes from possession.ts).
  'poss.phrase.haveKeys': { en: 'Has the keys', hi: 'चाबी मिल गई है', mr: 'चावी मिळाली आहे' },
  'poss.phrase.expectedMonth': { en: 'Possession expected {month}', hi: 'पज़ेशन {month} में अपेक्षित', mr: 'पझेशन {month} मध्ये अपेक्षित' },
  'poss.phrase.expecting': { en: 'Expecting possession', hi: 'पज़ेशन मिलने वाला है', mr: 'पझेशन मिळणार आहे' },
  'poss.phrase.notSure': { en: 'Possession date not known yet', hi: 'पज़ेशन की तारीख अभी पता नहीं', mr: 'पझेशनची तारीख अजून माहीत नाही' },
  'poss.phrase.moveIn': { en: 'Wants to move in by {month}', hi: '{month} तक शिफ़्ट होना चाहते हैं', mr: '{month} पर्यंत राहायला यायचे आहे' },
  'poss.phrase.month': { en: 'Possession {month}', hi: 'पज़ेशन {month}', mr: 'पझेशन {month}' },

  // ── Scope ──────────────────────────────────────────────────
  'scope.title': { en: 'How much of it are we doing?', hi: 'कितना काम करवाना है?', mr: 'किती काम करायचे आहे?' },
  'scope.hint': {
    en: "Then untick anything you don't want. Every studio is priced on exactly what is ticked.",
    hi: 'फिर जो नहीं चाहिए, उसका टिक हटा दें। हर स्टूडियो का दाम ठीक उन्हीं चीज़ों पर लगेगा जिन पर टिक है।',
    mr: 'मग जे नको त्याची टिक काढा. प्रत्येक स्टुडिओची किंमत नेमक्या टिक केलेल्या गोष्टींवरच ठरेल.',
  },
  'scope.renoRooms': {
    en: 'Any rooms to redo as well as the civil work?',
    hi: 'सिविल काम के साथ कोई कमरा भी नया करवाना है?',
    mr: 'सिव्हिल कामासोबत कोणती खोलीही नव्याने करायची आहे का?',
  },
  'scope.whichRooms': { en: 'Which rooms?', hi: 'कौन-से कमरे?', mr: 'कोणत्या खोल्या?' },
  'scope.price': {
    en: 'What we will price — untick anything you don’t want',
    hi: 'हम किन चीज़ों का दाम लगाएँगे — जो नहीं चाहिए उसका टिक हटा दें',
    mr: 'आम्ही कशाची किंमत काढू — जे नको त्याची टिक काढा',
  },
  'scope.renoWith': { en: 'Renovation — civil work and {list}', hi: 'रिनोवेशन — सिविल काम और {list}', mr: 'नूतनीकरण — सिव्हिल काम आणि {list}' },
  'scope.reno': { en: 'Renovation — civil work', hi: 'रिनोवेशन — सिविल काम', mr: 'नूतनीकरण — सिव्हिल काम' },

  // ── Level / budget ─────────────────────────────────────────
  'budget.title': { en: 'What are you planning to spend?', hi: 'आप कितना खर्च करने की सोच रहे हैं?', mr: 'तुम्ही किती खर्च करायचा विचार करत आहात?' },
  'budget.hint': {
    en: "Priced for a home your size, at three levels of finish. It isn't a commitment — it stops us showing you studios who don't work at your level.",
    hi: 'आपके घर के साइज़ के हिसाब से, फ़िनिश के तीन लेवल पर दाम। यह कोई वादा नहीं है — इससे हम आपको वे स्टूडियो नहीं दिखाते जो आपके लेवल पर काम नहीं करते।',
    mr: 'तुमच्या घराच्या आकारानुसार, फिनिशच्या तीन लेव्हलवर किंमत. हे बंधन नाही — यामुळे तुमच्या लेव्हलवर काम न करणारे स्टुडिओ आम्ही दाखवत नाही.',
  },
  'budget.perSqft': { en: '{rate} / sq ft', hi: '{rate} / sq ft', mr: '{rate} / sq ft' },
  'budget.from': { en: 'From {amount}', hi: '{amount} से शुरू', mr: '{amount} पासून' },
  'budget.civil': {
    en: 'We cannot put a range on civil work yet — each studio prices it on its own rates, and your quotes show it line by line. The level is what they charge per square foot of a home.',
    hi: 'सिविल काम का अंदाज़ा अभी हम नहीं दे सकते — हर स्टूडियो इसे अपने रेट पर लगाता है, और आपके कोटेशन में यह लाइन-दर-लाइन दिखेगा। लेवल का मतलब है कि वे घर के हर स्क्वेयर फ़ुट का कितना लेते हैं।',
    mr: 'सिव्हिल कामाचा अंदाज आम्ही अजून देऊ शकत नाही — प्रत्येक स्टुडिओ ते स्वतःच्या दराने लावतो, आणि तुमच्या कोटेशनमध्ये ते ओळीनुसार दिसेल. लेव्हल म्हणजे ते घराच्या प्रत्येक स्क्वेअर फुटाला किती घेतात.',
  },
  'budget.forScope': {
    en: "For {scope} — the level's price for your home, scaled to the part you are doing.",
    hi: '{scope} के लिए — आपके घर के लिए इस लेवल का दाम, उतने हिस्से के हिसाब से जितना काम आप करवा रहे हैं।',
    mr: 'यासाठी: {scope} — तुमच्या घरासाठी या लेव्हलची किंमत, तुम्ही करत असलेल्या भागानुसार.',
  },
  'budget.yourScope': { en: 'your scope', hi: 'आपके काम', mr: 'तुमचे काम' },
  'budget.typical': {
    en: 'Excluding GST, for a typical {area} sq ft {home} — tell us your carpet area and these tighten.',
    hi: 'GST के बिना, आम तौर पर {area} sq ft वाले {home} के लिए — अपना कारपेट एरिया बताएँ तो ये आँकड़े और सटीक होंगे।',
    mr: 'GST वगळून, साधारण {area} sq ft च्या {home} साठी — तुमचा कार्पेट एरिया सांगा, म्हणजे हे आकडे अजून अचूक होतील.',
  },
  'budget.home': { en: 'home', hi: 'घर', mr: 'घरा' },
  'budget.yours': { en: 'Excluding GST, for your {area} sqft. {rest}', hi: 'GST के बिना, आपके {area} sqft के लिए। {rest}', mr: 'GST वगळून, तुमच्या {area} sqft साठी. {rest}' },
  'budget.realRates': {
    en: "Your real quotes come from each studio's own rates.",
    hi: 'आपके असली कोटेशन हर स्टूडियो के अपने रेट से बनते हैं।',
    mr: 'तुमची खरी कोटेशन्स प्रत्येक स्टुडिओच्या स्वतःच्या दरांवरून बनतात.',
  },
  'budget.followLines': { en: 'Your quotes follow, line by line.', hi: 'आपके कोटेशन इसके बाद, लाइन-दर-लाइन आएँगे।', mr: 'तुमची कोटेशन्स यानंतर, ओळीनुसार येतील.' },

  // ── Taste ──────────────────────────────────────────────────
  'likes.title': { en: 'Which of these feel like your home?', hi: 'इनमें से कौन-से आपके घर जैसे लगते हैं?', mr: 'यातले कोणते तुमच्या घरासारखे वाटतात?' },
  'likes.hint': {
    en: "Pick two or three, on instinct. Don't overthink it — we'll tell you what you chose afterwards.",
    hi: 'दिल से दो या तीन चुनें। ज़्यादा मत सोचिए — बाद में हम बताएँगे कि आपने क्या चुना।',
    mr: 'मनाला वाटेल ते दोन किंवा तीन निवडा. जास्त विचार करू नका — तुम्ही काय निवडले ते आम्ही नंतर सांगू.',
  },
  'likes.lean': {
    en: 'So you lean {styles}. That’s the direction we’ll match on.',
    hi: 'यानी आपका झुकाव {styles} की तरफ़ है। हम इसी हिसाब से मैच करेंगे।',
    mr: 'म्हणजे तुमचा कल {styles} कडे आहे. आम्ही याच दिशेने मॅच करू.',
  },
  'dislikes.title': { en: 'And which two would you never want?', hi: 'और कौन-से दो आपको बिल्कुल नहीं चाहिए?', mr: 'आणि कोणते दोन तुम्हाला अजिबात नको?' },
  'dislikes.hint': {
    en: 'Higher signal than what you like. Almost nobody asks this, and it rules studios out completely.',
    hi: 'यह आपकी पसंद से भी ज़्यादा बताता है। लगभग कोई यह नहीं पूछता, और इससे कुछ स्टूडियो पूरी तरह बाहर हो जाते हैं।',
    mr: 'हे तुमच्या आवडीपेक्षाही जास्त सांगते. जवळजवळ कोणी हे विचारत नाही, आणि यामुळे काही स्टुडिओ पूर्णपणे बाद होतात.',
  },
  'style.optionAria': { en: 'Room option {n}', hi: 'कमरे का विकल्प {n}', mr: 'खोलीचा पर्याय {n}' },
  'style.blocked': { en: 'Already picked', hi: 'पहले ही चुना है', mr: 'आधीच निवडले आहे' },
  'style.room': { en: 'Room {n}', hi: 'कमरा {n}', mr: 'खोली {n}' },
  'style.count': { en: '{n} of {max} selected', hi: '{max} में से {n} चुने', mr: '{max} पैकी {n} निवडले' },
  'style.credits': { en: 'Photo credits', hi: 'फ़ोटो क्रेडिट', mr: 'फोटो श्रेय' },
  'style.studioPhotos': {
    en: 'Some are finished homes by studios on One Interiors, shown with their permission and without their names. ',
    hi: 'कुछ फ़ोटो One Interiors के स्टूडियो के बनाए घरों की हैं, उनकी अनुमति से और बिना नाम के दिखाई गई हैं। ',
    mr: 'काही फोटो One Interiors वरील स्टुडिओंनी पूर्ण केलेल्या घरांचे आहेत, त्यांच्या परवानगीने आणि नावाशिवाय दाखवले आहेत. ',
  },
  'style.unsplash': { en: 'Photographs from Unsplash by {names}.', hi: 'Unsplash से फ़ोटो: {names}।', mr: 'Unsplash वरील फोटो: {names}.' },
  'swipe.none': {
    en: 'None of them — try the grid instead, or come back to it.',
    hi: 'इनमें से कोई नहीं — ग्रिड में देखें, या बाद में फिर आएँ।',
    mr: 'यापैकी काहीच नाही — ग्रिडमध्ये पाहा, किंवा नंतर परत या.',
  },
  'swipe.picked': { en: 'You picked {styles}.', hi: 'आपने {styles} चुना।', mr: 'तुम्ही {styles} निवडले.' },
  'swipe.count': { en: '{i} of {n} · {k} of {max} picked', hi: '{n} में से {i} · {max} में से {k} चुने', mr: '{n} पैकी {i} · {max} पैकी {k} निवडले' },
  'swipe.no': { en: '← Not me', hi: '← मेरे लिए नहीं', mr: '← मला नको' },
  'swipe.yes': { en: 'Yes, this →', hi: 'हाँ, यही →', mr: 'हो, हेच →' },
  'swipe.toGrid': { en: 'See them all at once instead', hi: 'सब एक साथ देखें', mr: 'सगळे एकदम पाहा' },
  'swipe.toSwipe': { en: 'Swipe through them instead', hi: 'एक-एक करके स्वाइप करें', mr: 'एकेक करून स्वाइप करा' },
  'tot.done': {
    en: 'Sharpened: you lean {first} first{rest}.',
    hi: 'और साफ़ हुआ: आपका झुकाव सबसे पहले {first} की तरफ़ है{rest}।',
    mr: 'अजून स्पष्ट झाले: तुमचा कल सर्वात आधी {first} कडे आहे{rest}.',
  },
  'tot.then': { en: ', then {others}', hi: ', फिर {others}', mr: ', मग {others}' },
  'tot.open': {
    en: 'Sharpen it: four quick “this or that” pairs',
    hi: 'और साफ़ करें: चार झटपट “यह या वह” जोड़ियाँ',
    mr: 'अजून स्पष्ट करा: चार झटपट “हे की ते” जोड्या',
  },
  'tot.eyebrow': { en: 'This or that · {i} of {n}', hi: 'यह या वह · {n} में से {i}', mr: 'हे की ते · {n} पैकी {i}' },
  'tot.aria': { en: 'This one — {alt}', hi: 'यह वाला — {alt}', mr: 'हे — {alt}' },
  'tot.skip': { en: 'Skip this', hi: 'इसे छोड़ें', mr: 'हे वगळा' },
  'insp.err': { en: 'We could not read that photo just now.', hi: 'अभी यह फ़ोटो पढ़ नहीं पाए।', mr: 'आत्ता हा फोटो वाचता आला नाही.' },
  'insp.used': {
    en: 'Added from your photo. Change any of them above.',
    hi: 'आपकी फ़ोटो से जोड़ दिए। ऊपर इनमें से कोई भी बदल सकते हैं।',
    mr: 'तुमच्या फोटोवरून जोडले. वर यापैकी काहीही बदलू शकता.',
  },
  'insp.see': { en: 'In your photo we see', hi: 'आपकी फ़ोटो में हमें दिखता है', mr: 'तुमच्या फोटोत आम्हाला दिसते' },
  'insp.ruledOut': {
    en: ' (you ruled this out, so we will leave it)',
    hi: ' (आपने इसे मना किया था, इसलिए इसे नहीं जोड़ेंगे)',
    mr: ' (तुम्ही हे नको म्हटले होते, म्हणून हे जोडणार नाही)',
  },
  'insp.another': { en: 'Try another photo', hi: 'दूसरी फ़ोटो आज़माएँ', mr: 'दुसरा फोटो वापरून पाहा' },
  'insp.title': { en: 'Or show us a room you love', hi: 'या कोई ऐसा कमरा दिखाइए जो आपको पसंद हो', mr: 'किंवा तुम्हाला आवडलेली एखादी खोली दाखवा' },
  'insp.body': {
    en: 'A screenshot from Pinterest or Instagram, a friend’s flat — we tell you which styles it is, and you decide. The photo is read once and not kept.',
    hi: 'Pinterest या Instagram का स्क्रीनशॉट, किसी दोस्त का फ़्लैट — हम बताएँगे कि इसमें कौन-सी स्टाइल है, और फ़ैसला आपका। फ़ोटो एक बार पढ़ी जाती है, रखी नहीं जाती।',
    mr: 'Pinterest किंवा Instagram चा स्क्रीनशॉट, मित्राचा फ्लॅट — यात कोणती स्टाइल आहे ते आम्ही सांगू, आणि निर्णय तुमचा. फोटो एकदाच वाचला जातो, ठेवला जात नाही.',
  },
  'insp.looking': { en: 'Looking…', hi: 'देख रहे हैं…', mr: 'पाहत आहोत…' },
  'insp.read': { en: 'Read my photo', hi: 'मेरी फ़ोटो पढ़ें', mr: 'माझा फोटो वाचा' },

  // ── How you live / work / priorities ───────────────────────
  'hh.title': { en: "Who's going to live there?", hi: 'वहाँ कौन-कौन रहेगा?', mr: 'तिथे कोण कोण राहणार आहे?' },
  'hh.hint': {
    en: 'Your studio sees this before your first meeting, so the design starts from how you actually live.',
    hi: 'पहली मीटिंग से पहले आपका स्टूडियो यह देख लेता है, ताकि डिज़ाइन आपके असली रहन-सहन से शुरू हो।',
    mr: 'पहिल्या मीटिंगआधी तुमचा स्टुडिओ हे पाहतो, म्हणजे डिझाइन तुमच्या खऱ्या राहणीपासून सुरू होते.',
  },
  'hh.adults': { en: 'Adults', hi: 'बड़े', mr: 'मोठी माणसे' },
  'hh.children': { en: 'Children', hi: 'बच्चे', mr: 'मुले' },
  'hh.elderly': { en: 'Parents / elderly', hi: 'माता-पिता / बुज़ुर्ग', mr: 'आई-वडील / ज्येष्ठ' },
  'hh.pets': { en: 'Pets', hi: 'पालतू जानवर', mr: 'पाळीव प्राणी' },
  'hh.wfh': { en: 'Someone works from home', hi: 'कोई घर से काम करता है', mr: 'कोणी घरून काम करते' },
  'counter.dec': { en: 'Decrease {label}', hi: '{label} कम करें', mr: '{label} कमी करा' },
  'counter.inc': { en: 'Increase {label}', hi: '{label} बढ़ाएँ', mr: '{label} वाढवा' },
  'living.needs': {
    en: 'Anything the home needs? Pick any that apply',
    hi: 'घर में कुछ खास चाहिए? जो भी लागू हो, चुनें',
    mr: 'घरात काही खास हवे आहे? लागू असेल ते निवडा',
  },
  'working.title': { en: 'How involved do you want to be?', hi: 'आप कितना शामिल रहना चाहते हैं?', mr: 'तुम्हाला यात किती सहभागी व्हायचे आहे?' },
  'working.hint': {
    en: 'The most common reason a project goes wrong is a mismatch here — not a mismatch in taste.',
    hi: 'प्रोजेक्ट बिगड़ने की सबसे आम वजह यहीं का मेल न बैठना है — पसंद का नहीं।',
    mr: 'प्रोजेक्ट बिघडण्याचे सर्वात सामान्य कारण इथे न जुळणे हे असते — आवड न जुळणे नाही.',
  },
  'prio.title': { en: 'What matters most to you here?', hi: 'आपके लिए सबसे ज़रूरी क्या है?', mr: 'तुमच्यासाठी सर्वात महत्त्वाचे काय आहे?' },
  'prio.hint': {
    en: 'Tap them in order, starting with the most important. Your first choice gets extra weight when we rank studios.',
    hi: 'सबसे ज़रूरी से शुरू करके, क्रम से टैप करें। स्टूडियो की रैंकिंग में आपकी पहली पसंद को ज़्यादा वज़न मिलता है।',
    mr: 'सर्वात महत्त्वाच्यापासून सुरू करून, क्रमाने टॅप करा. स्टुडिओंची क्रमवारी लावताना तुमच्या पहिल्या निवडीला जास्त महत्त्व मिळते.',
  },
  'prio.aria': {
    en: '{label} — ranked {n}. Tap to remove from the ranking.',
    hi: '{label} — क्रम {n}। रैंकिंग से हटाने के लिए टैप करें।',
    mr: '{label} — क्रमांक {n}. क्रमवारीतून काढण्यासाठी टॅप करा.',
  },
  'prio.remove': { en: 'Remove', hi: 'हटाएँ', mr: 'काढा' },

  // ── Contact ────────────────────────────────────────────────
  'contact.titleNamed': { en: '{name}, where should we send your matches?', hi: '{name}, आपके मैच कहाँ भेजें?', mr: '{name}, तुमचे मॅच कुठे पाठवू?' },
  'contact.title': { en: 'Where should we send your matches?', hi: 'आपके मैच कहाँ भेजें?', mr: 'तुमचे मॅच कुठे पाठवू?' },
  'contact.hint': {
    en: 'Your number is how our expert reaches you to book your call. No studio sees it until you choose one.',
    hi: 'इसी नंबर पर हमारे एक्सपर्ट आपसे बात करके कॉल तय करेंगे। जब तक आप कोई स्टूडियो नहीं चुनते, किसी स्टूडियो को यह नंबर नहीं दिखता।',
    mr: 'याच नंबरवर आमचे एक्सपर्ट तुमच्याशी संपर्क करून कॉल ठरवतील. तुम्ही स्टुडिओ निवडेपर्यंत कोणत्याही स्टुडिओला हा नंबर दिसत नाही.',
  },
  'contact.signedInAs': {
    en: 'Signed in as {email}. Your brief is saved to your account.',
    hi: '{email} से साइन इन है। आपका ब्रीफ़ आपके अकाउंट में सेव है।',
    mr: '{email} ने साइन इन केले आहे. तुमचे ब्रीफ तुमच्या अकाउंटमध्ये सेव्ह आहे.',
  },
  'contact.signedIn': {
    en: 'Signed in. Your brief is saved to your account.',
    hi: 'साइन इन है। आपका ब्रीफ़ आपके अकाउंट में सेव है।',
    mr: 'साइन इन केले आहे. तुमचे ब्रीफ तुमच्या अकाउंटमध्ये सेव्ह आहे.',
  },
  'contact.social': {
    en: 'Fills in your name and email and keeps your brief on your account. We still need your mobile below.',
    hi: 'आपका नाम और ईमेल अपने-आप भर जाएगा और ब्रीफ़ आपके अकाउंट में रहेगा। मोबाइल नंबर फिर भी नीचे देना होगा।',
    mr: 'तुमचे नाव आणि ईमेल आपोआप भरले जाईल आणि ब्रीफ तुमच्या अकाउंटमध्ये राहील. मोबाइल नंबर तरीही खाली द्यावा लागेल.',
  },
  'contact.name': { en: 'Your name', hi: 'आपका नाम', mr: 'तुमचे नाव' },
  'contact.mobile': { en: 'Mobile', hi: 'मोबाइल', mr: 'मोबाइल' },
  'contact.email': { en: 'Email, if you like', hi: 'ईमेल, अगर देना चाहें', mr: 'ईमेल, द्यायचा असल्यास' },
  'contact.howWeUse': { en: 'How we use it', hi: 'हम इसका इस्तेमाल कैसे करते हैं', mr: 'आम्ही याचा वापर कसा करतो' },
  'contact.optional': { en: 'optional', hi: 'वैकल्पिक', mr: 'ऐच्छिक' },

  // ── The running brief ("brief so far") ─────────────────────
  'profile.titleNamed': { en: "{name}'s brief so far", hi: '{name} का ब्रीफ़ अब तक', mr: '{name} यांचे आतापर्यंतचे ब्रीफ' },
  'profile.edit': { en: 'Edit', hi: 'बदलें', mr: 'बदला' },
  'profile.editAria': { en: 'Change {what}', hi: '{what} बदलें', mr: '{what} बदला' },
  'cta.backToDetails': { en: 'Back to your details', hi: 'अपनी जानकारी पर वापस', mr: 'तुमच्या माहितीकडे परत' },
  'profile.title': { en: 'Your brief so far', hi: 'आपका ब्रीफ़ अब तक', mr: 'तुमचे आतापर्यंतचे ब्रीफ' },
  'profile.empty': {
    en: 'This fills in as you answer. Nothing is sent anywhere while you do.',
    hi: 'जैसे-जैसे आप जवाब देंगे, यह भरता जाएगा। तब तक कुछ भी कहीं नहीं भेजा जाता।',
    mr: 'तुम्ही उत्तरे देता तसे हे भरत जाईल. तोपर्यंत काहीही कुठेही पाठवले जात नाही.',
  },
  'profile.count': {
    en: 'of {n} verified studios still match',
    hi: 'स्टूडियो अब भी मैच करते हैं (कुल {n} जाँचे हुए में से)',
    mr: 'स्टुडिओ अजूनही जुळतात (एकूण {n} तपासलेल्यांपैकी)',
  },
  'cost.range': { en: '{low} – {high}+ before GST', hi: 'GST से पहले {low} – {high}+', mr: 'GST आधी {low} – {high}+' },
  'row.home': { en: 'Home', hi: 'घर', mr: 'घर' },
  'row.society': { en: 'Society', hi: 'सोसाइटी', mr: 'सोसायटी' },
  'row.scope': { en: 'Scope', hi: 'काम', mr: 'काम' },
  'row.likely': { en: 'Likely cost', hi: 'अंदाज़न खर्च', mr: 'अंदाजे खर्च' },
  'row.budget': { en: 'Budget', hi: 'बजट', mr: 'बजेट' },
  'row.leaning': { en: 'Leaning', hi: 'झुकाव', mr: 'कल' },
  'row.ruledOut': { en: 'Ruled out', hi: 'नहीं चाहिए', mr: 'नको' },
  'row.household': { en: 'Household', hi: 'परिवार', mr: 'कुटुंब' },
  'row.priority': { en: 'Priority', hi: 'प्राथमिकता', mr: 'प्राधान्य' },
  'row.needs': { en: 'Needs', hi: 'ज़रूरतें', mr: 'गरजा' },
  'row.style': { en: 'Working style', hi: 'काम का तरीका', mr: 'कामाची पद्धत' },
  'row.possession': { en: 'Possession', hi: 'पज़ेशन', mr: 'पझेशन' },
  'row.leftOut': { en: '{phrase} · {n} left out', hi: '{phrase} · {n} हटाए गए', mr: '{phrase} · {n} वगळले' },
  'hh.adult1': { en: '{n} adult', hi: '{n} वयस्क', mr: '{n} प्रौढ' },
  'hh.adultN': { en: '{n} adults', hi: '{n} वयस्क', mr: '{n} प्रौढ' },
  'hh.child1': { en: '{n} child', hi: '{n} बच्चा', mr: '{n} मूल' },
  'hh.childN': { en: '{n} children', hi: '{n} बच्चे', mr: '{n} मुले' },
  'hh.elderlyN': { en: '{n} elderly', hi: '{n} बुज़ुर्ग', mr: '{n} ज्येष्ठ' },
  'hh.petsShort': { en: 'pets', hi: 'पालतू जानवर', mr: 'पाळीव प्राणी' },
  'hh.wfhShort': { en: 'WFH', hi: 'वर्क फ़्रॉम होम', mr: 'वर्क फ्रॉम होम' },

  // ── Locality and society fields ────────────────────────────
  'loc.change': { en: 'Change', hi: 'बदलें', mr: 'बदला' },
  'loc.placeholder': {
    en: 'Start typing your area — Baner, Wakad, Kharadi…',
    hi: 'अपना एरिया टाइप करें — Baner, Wakad, Kharadi…',
    mr: 'तुमचा एरिया टाइप करा — Baner, Wakad, Kharadi…',
  },
  'loc.aria': { en: 'Search for your area', hi: 'अपना एरिया खोजें', mr: 'तुमचा एरिया शोधा' },
  'loc.none': {
    en: 'We do not have “{q}” yet. Pick the nearest area from your part of the city below — studios are matched by part of the city, so the nearest one works.',
    hi: '“{q}” अभी हमारी सूची में नहीं है। नीचे अपने शहर के हिस्से में से सबसे पास का एरिया चुनें — स्टूडियो शहर के हिस्से के हिसाब से मैच होते हैं, इसलिए सबसे पास वाला चल जाएगा।',
    mr: '“{q}” अजून आमच्या यादीत नाही. खाली तुमच्या शहराच्या भागातून सर्वात जवळचा एरिया निवडा — स्टुडिओ शहराच्या भागानुसार जुळवले जातात, त्यामुळे जवळचा एरिया चालेल.',
  },
  'soc.placeholder': { en: 'e.g. Gera World of Joy', hi: 'जैसे Gera World of Joy', mr: 'उदा. Gera World of Joy' },
} satisfies Record<string, Tx>;

export type QuizKey = keyof typeof QUIZ_DICT;

/** The step header's chapter names, keyed by the English in `brief/steps.ts` `CHAPTER`. */
export const QUIZ_CHAPTER_TX: Record<string, Tx> = {
  You: { en: 'You', hi: 'आप', mr: 'तुम्ही' },
  'Your home': { en: 'Your home', hi: 'आपका घर', mr: 'तुमचे घर' },
  'The work': { en: 'The work', hi: 'काम', mr: 'काम' },
  'Your taste': { en: 'Your taste', hi: 'आपकी पसंद', mr: 'तुमची आवड' },
  'How you live': { en: 'How you live', hi: 'आपका रहन-सहन', mr: 'तुमची राहणी' },
  'How you work': { en: 'How you work', hi: 'काम करने का तरीका', mr: 'तुमची कामाची पद्धत' },
  'Your matches': { en: 'Your matches', hi: 'आपके मैच', mr: 'तुमचे मॅच' },
};

/**
 * The fixed messages the quiz's server side sends back (`brief/contact.ts`,
 * `app/quiz/actions.ts`), keyed by their English. Those modules are not this
 * dictionary's to change, so the screen looks the English up here; anything
 * not listed (the rate-limit "try again in…" lines) shows as sent.
 */
export const QUIZ_SERVER_TX: Record<string, Tx> = {
  'Tell us what to call you.': { en: 'Tell us what to call you.', hi: 'बताइए, आपको किस नाम से बुलाएँ।', mr: 'तुम्हाला कोणत्या नावाने हाक मारू ते सांगा.' },
  'We need a mobile number to arrange your expert call.': {
    en: 'We need a mobile number to arrange your expert call.',
    hi: 'एक्सपर्ट कॉल तय करने के लिए मोबाइल नंबर चाहिए।',
    mr: 'एक्सपर्ट कॉल ठरवण्यासाठी मोबाइल नंबर हवा.',
  },
  'That does not look like an Indian mobile — check the number.': {
    en: 'That does not look like an Indian mobile — check the number.',
    hi: 'यह भारतीय मोबाइल नंबर नहीं लगता — नंबर जाँच लें।',
    mr: 'हा भारतीय मोबाइल नंबर वाटत नाही — नंबर तपासा.',
  },
  'Check the email address, or leave it empty.': {
    en: 'Check the email address, or leave it empty.',
    hi: 'ईमेल पता जाँच लें, या खाली छोड़ दें।',
    mr: 'ईमेल पत्ता तपासा, किंवा रिकामा सोडा.',
  },
  'We can only find your matches and arrange your call if you agree to this. Nothing is shared with a studio until you choose one.': {
    en: 'We can only find your matches and arrange your call if you agree to this. Nothing is shared with a studio until you choose one.',
    hi: 'इसकी सहमति देने पर ही हम आपके मैच ढूँढ सकते हैं और कॉल तय कर सकते हैं। जब तक आप कोई स्टूडियो नहीं चुनते, उसके साथ कुछ भी शेयर नहीं होता।',
    mr: 'याला संमती दिल्यावरच आम्ही तुमचे मॅच शोधू शकतो आणि कॉल ठरवू शकतो. तुम्ही स्टुडिओ निवडेपर्यंत त्याच्याशी काहीही शेअर होत नाही.',
  },
  'Choose your floor plan first — a PDF or a photo.': {
    en: 'Choose your floor plan first — a PDF or a photo.',
    hi: 'पहले अपना फ़्लोर प्लान चुनें — PDF या फ़ोटो।',
    mr: 'आधी तुमचा फ्लोअर प्लॅन निवडा — PDF किंवा फोटो.',
  },
  'That file type cannot be read. A PDF, JPG, PNG or WebP works.': {
    en: 'That file type cannot be read. A PDF, JPG, PNG or WebP works.',
    hi: 'यह फ़ाइल पढ़ी नहीं जा सकती। PDF, JPG, PNG या WebP चलेगी।',
    mr: 'ही फाइल वाचता येत नाही. PDF, JPG, PNG किंवा WebP चालेल.',
  },
  'That file is over 4 MB. A screenshot or a photo of the plan works just as well.': {
    en: 'That file is over 4 MB. A screenshot or a photo of the plan works just as well.',
    hi: 'यह फ़ाइल 4 MB से बड़ी है। प्लान का स्क्रीनशॉट या फ़ोटो भी उतना ही अच्छा है।',
    mr: 'ही फाइल 4 MB पेक्षा मोठी आहे. प्लॅनचा स्क्रीनशॉट किंवा फोटोही तितकाच चालतो.',
  },
  'Reading plans is not switched on here yet. Type your carpet area on the previous screen instead.': {
    en: 'Reading plans is not switched on here yet. Type your carpet area on the previous screen instead.',
    hi: 'प्लान पढ़ना अभी यहाँ चालू नहीं है। इसकी जगह कारपेट एरिया टाइप कर दें।',
    mr: 'प्लॅन वाचणे अजून इथे चालू नाही. त्याऐवजी कार्पेट एरिया टाइप करा.',
  },
  'We could not find rooms on that — is it the floor plan? Try a clearer photo, or skip this.': {
    en: 'We could not find rooms on that — is it the floor plan? Try a clearer photo, or skip this.',
    hi: 'इसमें कमरे नहीं मिले — क्या यह फ़्लोर प्लान है? साफ़ फ़ोटो आज़माएँ, या इसे छोड़ दें।',
    mr: 'यात खोल्या सापडल्या नाहीत — हा फ्लोअर प्लॅन आहे का? स्पष्ट फोटो वापरून पाहा, किंवा हे सोडून द्या.',
  },
  'We could not read that plan just now. Try a clearer photo, or skip this and we will price a standard kitchen.': {
    en: 'We could not read that plan just now. Try a clearer photo, or skip this and we will price a standard kitchen.',
    hi: 'अभी यह प्लान पढ़ नहीं पाए। साफ़ फ़ोटो आज़माएँ, या इसे छोड़ दें — हम स्टैंडर्ड किचन के हिसाब से दाम लगाएँगे।',
    mr: 'आत्ता हा प्लॅन वाचता आला नाही. स्पष्ट फोटो वापरून पाहा, किंवा हे सोडून द्या — आम्ही स्टँडर्ड किचननुसार किंमत काढू.',
  },
  'Choose a photo first.': { en: 'Choose a photo first.', hi: 'पहले एक फ़ोटो चुनें।', mr: 'आधी एक फोटो निवडा.' },
  'A JPG, PNG or WebP photo works.': { en: 'A JPG, PNG or WebP photo works.', hi: 'JPG, PNG या WebP फ़ोटो चलेगी।', mr: 'JPG, PNG किंवा WebP फोटो चालेल.' },
  'That photo is over 4 MB. A screenshot works just as well.': {
    en: 'That photo is over 4 MB. A screenshot works just as well.',
    hi: 'यह फ़ोटो 4 MB से बड़ी है। स्क्रीनशॉट भी उतना ही अच्छा है।',
    mr: 'हा फोटो 4 MB पेक्षा मोठा आहे. स्क्रीनशॉटही तितकाच चालतो.',
  },
  'Reading photos is not switched on here yet — pick from the styles above.': {
    en: 'Reading photos is not switched on here yet — pick from the styles above.',
    hi: 'फ़ोटो पढ़ना अभी यहाँ चालू नहीं है — ऊपर की स्टाइल में से चुनें।',
    mr: 'फोटो वाचणे अजून इथे चालू नाही — वरच्या स्टाइलमधून निवडा.',
  },
  'We could not see a room in that one. Try a photo of an interior.': {
    en: 'We could not see a room in that one. Try a photo of an interior.',
    hi: 'इसमें कोई कमरा नहीं दिखा। किसी इंटीरियर की फ़ोटो आज़माएँ।',
    mr: 'यात खोली दिसली नाही. एखाद्या इंटिरिअरचा फोटो वापरून पाहा.',
  },
  'We could not read that photo just now. Pick from the styles above instead.': {
    en: 'We could not read that photo just now. Pick from the styles above instead.',
    hi: 'अभी यह फ़ोटो पढ़ नहीं पाए। इसकी जगह ऊपर की स्टाइल में से चुनें।',
    mr: 'आत्ता हा फोटो वाचता आला नाही. त्याऐवजी वरच्या स्टाइलमधून निवडा.',
  },
};

/** A server message in this language when it is a known one; as sent otherwise. */
export function quizServerText(lang: Lang, message: string | undefined): string | undefined {
  if (!message) return message;
  const entry = QUIZ_SERVER_TX[message];
  return entry ? tx(lang, entry) : message;
}

/**
 * A translated sentence with parts that are elements, not text: `{styles}`
 * becomes `<strong>…</strong>`, wherever the language puts it. Placeholders not
 * in `parts` are left as they are.
 */
export function fillParts(text: string, parts: Record<string, ReactNode>): ReactNode {
  return text.split(/(\{\w+\})/g).map((piece, i) => {
    const m = /^\{(\w+)\}$/.exec(piece);
    const node = m && m[1]! in parts ? parts[m[1]!] : piece;
    return createElement(Fragment, { key: i }, node);
  });
}

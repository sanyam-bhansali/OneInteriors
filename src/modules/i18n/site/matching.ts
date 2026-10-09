/**
 * The matching engine's own sentences in English, Hindi and Marathi: the
 * evidence beside each factor, the card's first-priority line, the timing
 * line, the reasons list, the rules-written "why this one fits you", the
 * welcome-back line. Built in modules/matching (signals.ts, score.ts,
 * explain.ts, welcome-back.ts), which take a `lang` and default to English.
 *
 * FIRST DRAFT for native-speaker review — see `modules/i18n/site.ts`.
 * The English must stay identical to what the engine wrote before: the tests
 * in tests/matching*.test.ts, top-priority, regressions and ux-principles
 * quote it word for word.
 *
 * Sentences end in their own full stop ("." / "।"). Studio names, style
 * names, locality names and figures are filled in as they are.
 */

import type { Specialism } from '@/modules/studio/matching-profile';
import { tx, type Lang, type Tx } from '../site';

export const MATCHING_DICT = {
  // ── joining words ──
  'and': { en: 'and', hi: 'और', mr: 'आणि' },
  'stop': { en: '.', hi: '।', mr: '.' },

  // ── style (signals.ts) ──
  'style.picked': {
    en: 'You picked a photograph of their work in the style picker',
    hi: 'स्टाइल चुनते समय आपने इनके काम की एक फ़ोटो चुनी थी',
    mr: 'स्टाइल निवडताना तुम्ही त्यांच्या कामाचा एक फोटो निवडला होता',
  },
  'style.exact': {
    en: '{n} of their project tags are styles you picked',
    hi: 'इनके प्रोजेक्ट के {n} टैग आपकी चुनी स्टाइल के हैं',
    mr: 'त्यांच्या प्रोजेक्टचे {n} टॅग तुम्ही निवडलेल्या स्टाइलचे आहेत',
  },
  'style.near': {
    en: 'Their work sits next to your styles rather than in them',
    hi: 'इनका काम आपकी स्टाइल से मिलता-जुलता है, पर बिल्कुल वही नहीं',
    mr: 'त्यांचे काम तुमच्या स्टाइलच्या जवळचे आहे, पण अगदी तेच नाही',
  },

  // ── budget (signals.ts) ──
  'budget.below': {
    en: 'Their quote for your home comes in below your range',
    hi: 'आपके घर के लिए इनका कोटेशन आपकी रेंज से नीचे है',
    mr: 'तुमच्या घरासाठी त्यांचे कोटेशन तुमच्या रेंजपेक्षा कमी आहे',
  },
  'budget.bottom': {
    en: 'Their quote for your home comes in at the bottom of your range',
    hi: 'आपके घर के लिए इनका कोटेशन आपकी रेंज के सबसे निचले हिस्से में है',
    mr: 'तुमच्या घरासाठी त्यांचे कोटेशन तुमच्या रेंजच्या अगदी खालच्या टोकाला आहे',
  },
  'budget.above': {
    en: 'Their quote for your home comes in above your range',
    hi: 'आपके घर के लिए इनका कोटेशन आपकी रेंज से ऊपर है',
    mr: 'तुमच्या घरासाठी त्यांचे कोटेशन तुमच्या रेंजपेक्षा जास्त आहे',
  },
  'budget.lowerHalf': {
    en: 'Their quote for your home sits in the lower half of your range',
    hi: 'आपके घर के लिए इनका कोटेशन आपकी रेंज के निचले आधे हिस्से में है',
    mr: 'तुमच्या घरासाठी त्यांचे कोटेशन तुमच्या रेंजच्या खालच्या अर्ध्या भागात आहे',
  },
  'budget.upperHalf': {
    en: 'Their quote for your home sits in the upper half of your range',
    hi: 'आपके घर के लिए इनका कोटेशन आपकी रेंज के ऊपरी आधे हिस्से में है',
    mr: 'तुमच्या घरासाठी त्यांचे कोटेशन तुमच्या रेंजच्या वरच्या अर्ध्या भागात आहे',
  },
  'budget.fromDelivered': {
    en: 'From the projects they have delivered',
    hi: 'इनके पूरे किए गए प्रोजेक्ट के आधार पर',
    mr: 'त्यांनी पूर्ण केलेल्या प्रोजेक्टवरून',
  },
  'budget.fromStated': {
    en: 'From their stated project range',
    hi: 'इनकी बताई गई प्रोजेक्ट रेंज के आधार पर',
    mr: 'त्यांनी सांगितलेल्या प्रोजेक्ट रेंजवरून',
  },

  // ── timing (signals.ts) — Hindi and Marathi carry their own subject ──
  'time.now': { en: 'Can start now', hi: 'ये अभी शुरू कर सकते हैं', mr: 'ते आत्ताच सुरू करू शकतात' },
  'time.keys': {
    en: 'Can start in {month}, when you get the keys',
    hi: 'ये {month} में शुरू कर सकते हैं, जब आपको चाबी मिलेगी',
    mr: 'ते {month}मध्ये सुरू करू शकतात, जेव्हा तुम्हाला चावी मिळेल',
  },
  'time.within': {
    en: 'Can start in {month}, within a month of when you can',
    hi: 'ये {month} में शुरू कर सकते हैं, आपके शुरू कर पाने के एक महीने के अंदर',
    mr: 'ते {month}मध्ये सुरू करू शकतात, तुम्ही सुरू करू शकाल त्यानंतर एका महिन्याच्या आत',
  },
  'time.booked': {
    en: 'Booked until {month} — {weeks} weeks after you can start',
    hi: 'ये {month} तक बुक हैं — आपके शुरू कर पाने के {weeks} हफ़्ते बाद तक',
    mr: 'ते {month}पर्यंत बुक आहेत — तुम्ही सुरू करू शकाल त्यानंतर {weeks} आठवडे',
  },
  'time.days': {
    en: 'Typically {days} days from sign-off to handover',
    hi: 'आम तौर पर फ़ाइनल मंज़ूरी से हैंडओवर तक {days} दिन',
    mr: 'साधारणपणे अंतिम मंजुरीपासून हँडओव्हरपर्यंत {days} दिवस',
  },

  // ── design (signals.ts) ──
  'design.includes': { en: 'Includes {list}', hi: 'इसमें शामिल है: {list}', mr: 'यात समाविष्ट: {list}' },
  'design.every': { en: '3D views of every room', hi: 'हर कमरे के 3D व्यू', mr: 'प्रत्येक खोलीचे 3D व्ह्यू' },
  'design.key': { en: '3D views of key rooms', hi: 'मुख्य कमरों के 3D व्यू', mr: 'मुख्य खोल्यांचे 3D व्ह्यू' },
  'design.revisions': {
    en: '{n} design revisions included',
    hi: 'डिज़ाइन में {n} बार बदलाव',
    mr: 'डिझाइनमध्ये {n} वेळा बदल',
  },
  'design.designer': { en: 'a dedicated designer', hi: 'आपके लिए अलग डिज़ाइनर', mr: 'तुमच्यासाठी वेगळा डिझायनर' },

  // ── material (signals.ts) ──
  'material.bwp': { en: 'BWP ply as standard', hi: 'BWP प्लाई स्टैंडर्ड', mr: 'BWP प्लाय स्टँडर्ड' },
  'material.solid': { en: 'solid wood as standard', hi: 'सॉलिड वुड स्टैंडर्ड', mr: 'सॉलिड वुड स्टँडर्ड' },
  'material.warranty': { en: 'a {n}-year warranty', hi: '{n} साल की वारंटी', mr: '{n} वर्षांची वॉरंटी' },
  'material.factory': { en: 'their own factory', hi: 'इनकी अपनी फ़ैक्टरी', mr: 'त्यांचा स्वतःचा कारखाना' },

  // ── similar work (signals.ts) ──
  'similar.society1': {
    en: 'They have done a home in your society',
    hi: 'इन्होंने आपकी सोसाइटी में एक घर किया है',
    mr: 'त्यांनी तुमच्या सोसायटीत एक घर केले आहे',
  },
  'similar.societyN': {
    en: 'They have done {n} homes in your society',
    hi: 'इन्होंने आपकी सोसाइटी में {n} घर किए हैं',
    mr: 'त्यांनी तुमच्या सोसायटीत {n} घरे केली आहेत',
  },
  'similar.area1': {
    en: 'They have completed {n} home in {place}',
    hi: 'इन्होंने {place} में {n} घर पूरा किया है',
    mr: 'त्यांनी {place} मध्ये {n} घर पूर्ण केले आहे',
  },
  'similar.areaN': {
    en: 'They have completed {n} homes in {place}',
    hi: 'इन्होंने {place} में {n} घर पूरे किए हैं',
    mr: 'त्यांनी {place} मध्ये {n} घरे पूर्ण केली आहेत',
  },
  'similar.like': {
    en: '{n} of their projects are like yours',
    hi: 'इनके {n} प्रोजेक्ट आपके जैसे हैं',
    mr: 'त्यांचे {n} प्रोजेक्ट तुमच्यासारखे आहेत',
  },

  // ── working style and household (signals.ts) ──
  'working.same': {
    en: 'They run projects the way you said you want to',
    hi: 'ये प्रोजेक्ट वैसे ही चलाते हैं जैसा आप चाहते हैं',
    mr: 'तुम्हाला हवे तसेच ते प्रोजेक्ट चालवतात',
  },
  'working.different': {
    en: 'They run projects a little differently from how you said you want to',
    hi: 'ये प्रोजेक्ट आपकी चाही गई तरह से थोड़ा अलग चलाते हैं',
    mr: 'तुम्हाला हवे त्यापेक्षा ते प्रोजेक्ट थोडे वेगळ्या पद्धतीने चालवतात',
  },
  'household.experienced': {
    en: 'Experienced in {list}',
    hi: 'इन्हें इसका अनुभव है: {list}',
    mr: 'त्यांना याचा अनुभव आहे: {list}',
  },

  // ── reasons list (score.ts) ──
  'why.leaned': {
    en: 'You leaned toward {styles}. {evidence}.',
    hi: 'आपको {styles} पसंद आया। {evidence}।',
    mr: 'तुम्हाला {styles} आवडले. {evidence}.',
  },
  'why.ruledOutNone': {
    en: 'You ruled out {styles}. None of their portfolio goes there.',
    hi: 'आपने {styles} मना किया था। इनका कोई भी काम उस तरफ़ नहीं है।',
    mr: 'तुम्ही {styles} नाकारले होते. त्यांचे कोणतेही काम त्या दिशेने नाही.',
  },
  'why.ruledOutShare': {
    en: 'You ruled out {styles}. About {pct}% of their work leans that way.',
    hi: 'आपने {styles} मना किया था। इनका लगभग {pct}% काम उस तरफ़ झुकता है।',
    mr: 'तुम्ही {styles} नाकारले होते. त्यांचे सुमारे {pct}% काम त्या दिशेने आहे.',
  },
  'why.noRecord': {
    en: '{name} has not completed a project with us yet, so we have no delivery record for them.',
    hi: '{name} ने हमारे साथ अभी तक कोई प्रोजेक्ट पूरा नहीं किया है, इसलिए समय पर काम पूरा करने का इनका रिकॉर्ड हमारे पास नहीं है।',
    mr: '{name} यांनी आमच्यासोबत अजून एकही प्रोजेक्ट पूर्ण केलेला नाही, त्यामुळे वेळेवर काम पूर्ण करण्याचा त्यांचा रेकॉर्ड आमच्याकडे नाही.',
  },
  'why.onTime': {
    en: 'Their last {n} projects finished on or ahead of the committed date.',
    hi: 'इनके पिछले {n} प्रोजेक्ट वादे की तारीख पर या उससे पहले पूरे हुए।',
    mr: 'त्यांचे शेवटचे {n} प्रोजेक्ट दिलेल्या तारखेला किंवा त्याआधी पूर्ण झाले.',
  },
  'why.late1': {
    en: 'Their last {n} projects averaged {d} day past the committed date.',
    hi: 'इनके पिछले {n} प्रोजेक्ट औसतन वादे की तारीख से {d} दिन देर से पूरे हुए।',
    mr: 'त्यांचे शेवटचे {n} प्रोजेक्ट सरासरी दिलेल्या तारखेपेक्षा {d} दिवस उशिरा पूर्ण झाले.',
  },
  'why.lateN': {
    en: 'Their last {n} projects averaged {d} days past the committed date.',
    hi: 'इनके पिछले {n} प्रोजेक्ट औसतन वादे की तारीख से {d} दिन देर से पूरे हुए।',
    mr: 'त्यांचे शेवटचे {n} प्रोजेक्ट सरासरी दिलेल्या तारखेपेक्षा {d} दिवस उशिरा पूर्ण झाले.',
  },
  'why.few1': {
    en: '{name} has completed {n} project with us — not yet enough to state a reliable delivery average.',
    hi: '{name} ने हमारे साथ {n} प्रोजेक्ट पूरा किया है — समय पर काम का भरोसेमंद औसत बताने के लिए अभी यह काफ़ी नहीं।',
    mr: '{name} यांनी आमच्यासोबत {n} प्रोजेक्ट पूर्ण केला आहे — वेळेवर कामाची खात्रीशीर सरासरी सांगण्यासाठी अजून हे पुरेसे नाही.',
  },
  'why.fewN': {
    en: '{name} has completed {n} projects with us — not yet enough to state a reliable delivery average.',
    hi: '{name} ने हमारे साथ {n} प्रोजेक्ट पूरे किए हैं — समय पर काम का भरोसेमंद औसत बताने के लिए अभी यह काफ़ी नहीं।',
    mr: '{name} यांनी आमच्यासोबत {n} प्रोजेक्ट पूर्ण केले आहेत — वेळेवर कामाची खात्रीशीर सरासरी सांगण्यासाठी अजून हे पुरेसे नाही.',
  },
  'why.dispute1': {
    en: 'Worth knowing: {n} dispute against them was upheld.',
    hi: 'जानना ज़रूरी है: इनके खिलाफ़ {n} शिकायत सही पाई गई।',
    mr: 'माहीत असावे: त्यांच्याविरुद्धची {n} तक्रार योग्य ठरली.',
  },
  'why.disputeN': {
    en: 'Worth knowing: {n} disputes against them were upheld.',
    hi: 'जानना ज़रूरी है: इनके खिलाफ़ {n} शिकायतें सही पाई गईं।',
    mr: 'माहीत असावे: त्यांच्याविरुद्धच्या {n} तक्रारी योग्य ठरल्या.',
  },

  // ── the one-sentence summary (score.ts matchSummary) ──
  'summary.because': { en: 'Because {clauses}.', hi: 'क्योंकि {clauses}।', mr: 'कारण {clauses}.' },
  'summary.style': {
    en: 'you leaned toward {styles} and most of their work sits there',
    hi: 'आपको {styles} पसंद आया और इनका ज़्यादातर काम वहीं है',
    mr: 'तुम्हाला {styles} आवडले आणि त्यांचे बहुतेक काम त्याच शैलीत आहे',
  },

  // ── the first priority, answered (score.ts topPriorityLine) ──
  'top.nothing': {
    en: 'You put {label} first. We have nothing on that for {studio} yet.',
    hi: 'आपकी पहली प्राथमिकता है {label}। इस पर {studio} के बारे में अभी हमारे पास कोई जानकारी नहीं है।',
    mr: 'तुमचे पहिले प्राधान्य: {label}. यावर {studio} बद्दल अजून आमच्याकडे माहिती नाही.',
  },
  'top.line': {
    en: 'You put {label} first: {text}.',
    hi: 'आपकी पहली प्राथमिकता है {label}: {text}।',
    mr: 'तुमचे पहिले प्राधान्य {label}: {text}.',
  },
  'top.budgetWithin': {
    en: 'Their past projects sit within your budget',
    hi: 'इनके पिछले प्रोजेक्ट आपके बजट के अंदर हैं',
    mr: 'त्यांचे आधीचे प्रोजेक्ट तुमच्या बजेटमध्ये बसतात',
  },
  'top.budgetOutside': {
    en: 'Most of their past projects sit outside your budget',
    hi: 'इनके ज़्यादातर पिछले प्रोजेक्ट आपके बजट से बाहर हैं',
    mr: 'त्यांचे बहुतेक आधीचे प्रोजेक्ट तुमच्या बजेटबाहेर आहेत',
  },
  'top.well': { en: 'They measure well on it', hi: 'इसमें ये अच्छे हैं', mr: 'यात ते चांगले आहेत' },
  'top.weak': { en: 'They measure weakly on it', hi: 'इसमें ये कमज़ोर हैं', mr: 'यात ते कमी पडतात' },

  // ── the rules-written read, when nothing better is said (explain.ts) ──
  'explain.matched': {
    en: 'Matched on what you told us about your flat.',
    hi: 'आपने अपने फ़्लैट के बारे में जो बताया, उसके आधार पर मैच किया गया।',
    mr: 'तुम्ही तुमच्या फ्लॅटबद्दल जे सांगितले, त्यावरून मॅच केले.',
  },
  'explain.finished': {
    en: '{n} finished projects are on record.',
    hi: 'हमारे रिकॉर्ड में इनके {n} पूरे प्रोजेक्ट हैं।',
    mr: 'आमच्या रेकॉर्डमध्ये त्यांचे {n} पूर्ण झालेले प्रोजेक्ट आहेत.',
  },
  'explain.none': {
    en: 'They have no finished projects on record with us yet.',
    hi: 'हमारे रिकॉर्ड में इनका अभी तक कोई पूरा प्रोजेक्ट नहीं है।',
    mr: 'आमच्या रेकॉर्डमध्ये त्यांचा अजून एकही पूर्ण प्रोजेक्ट नाही.',
  },

  // ── welcome back (welcome-back.ts) ──
  'since.today': { en: 'since earlier today', hi: 'आज कुछ देर पहले से', mr: 'आज थोड्या वेळापूर्वीपासून' },
  'since.yesterday': { en: 'since yesterday', hi: 'कल से', mr: 'कालपासून' },
  'since.day': { en: 'since {day}', hi: '{day} से', mr: '{day}पासून' },
  'welcome.one': {
    en: 'Welcome back — one new studio fits your brief {since}.',
    hi: 'फिर से स्वागत है — {since} एक नया स्टूडियो आपके ब्रीफ़ में फ़िट बैठता है।',
    mr: 'पुन्हा स्वागत आहे — {since} एक नवीन स्टुडिओ तुमच्या ब्रीफमध्ये बसतो.',
  },
  'welcome.many': {
    en: 'Welcome back — {n} new studios fit your brief {since}.',
    hi: 'फिर से स्वागत है — {since} {n} नए स्टूडियो आपके ब्रीफ़ में फ़िट बैठते हैं।',
    mr: 'पुन्हा स्वागत आहे — {since} {n} नवीन स्टुडिओ तुमच्या ब्रीफमध्ये बसतात.',
  },
} satisfies Record<string, Tx>;

export type MatchingKey = keyof typeof MATCHING_DICT;

/**
 * SPECIALISM_LABELS (modules/studio/matching-profile.ts) for the household
 * evidence. English is lower-cased by the engine as before; Hindi and Marathi
 * are used as they are.
 */
export const SPECIALISM_TX: Record<Specialism, Tx> = {
  CHILDREN: { en: "Children's rooms", hi: 'बच्चों के कमरे', mr: 'मुलांच्या खोल्या' },
  ELDERLY: { en: 'Homes for elderly parents', hi: 'बुज़ुर्ग माता-पिता के लिए घर', mr: 'वृद्ध आई-वडिलांसाठी घरे' },
  PETS: { en: 'Pet-friendly homes', hi: 'पालतू जानवरों के हिसाब से घर', mr: 'पाळीव प्राण्यांसाठी सोयीची घरे' },
  HOME_OFFICE: { en: 'Home offices', hi: 'घर में ऑफ़िस', mr: 'घरातील ऑफिस' },
  VASTU: { en: 'Vastu-compliant layouts', hi: 'वास्तु के हिसाब से लेआउट', mr: 'वास्तुनुसार मांडणी' },
  POOJA_ROOM: { en: 'Pooja rooms', hi: 'पूजा घर', mr: 'देवघर' },
  EXTRA_STORAGE: { en: 'Storage-heavy small homes', hi: 'ज़्यादा स्टोरेज वाले छोटे घर', mr: 'भरपूर स्टोरेज असलेली छोटी घरे' },
  SMART_HOME: { en: 'Smart home / automation', hi: 'स्मार्ट होम / ऑटोमेशन', mr: 'स्मार्ट होम / ऑटोमेशन' },
  BESPOKE_FURNITURE: { en: 'Bespoke furniture', hi: 'ऑर्डर पर बना फ़र्नीचर', mr: 'मागणीनुसार बनवलेले फर्निचर' },
  FAST_RENTAL: { en: 'Fast turnarounds for rentals', hi: 'किराये के घरों का जल्दी काम', mr: 'भाड्याच्या घरांचे झटपट काम' },
};

/** One of the engine's sentences, in this language. English unless told. */
export function say(lang: Lang | undefined, key: MatchingKey, vars?: Record<string, string | number>): string {
  return tx(lang ?? 'en', MATCHING_DICT[key], vars);
}

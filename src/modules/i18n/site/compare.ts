/**
 * The side-by-side page (/compare) and its one-page brief (/compare/brief)
 * in English, Hindi and Marathi: the totals, the starred verdict, where the
 * difference is, the fit block, price by room and by material, "In plain
 * words" and "Ask your quote". Factor names come from MATCH_DICT `factor.*`;
 * room and item names from labels.ts.
 *
 * FIRST DRAFT for native-speaker review — see `modules/i18n/site.ts`.
 * The English must stay identical to what the page said before.
 */

import type { Tx } from '../site';

export const COMPARE_DICT = {
  // ── page metadata ──
  'meta.title': { en: 'Side by side', hi: 'आमने-सामने', mr: 'शेजारी-शेजारी' },
  'meta.description': {
    en: 'Every quote written to the same lines, with the material under each price.',
    hi: 'हर कोटेशन एक जैसी लाइनों पर, हर दाम के नीचे उसका मटीरियल।',
    mr: 'प्रत्येक कोटेशन सारख्याच ओळींवर, प्रत्येक किमतीखाली त्याचे मटेरियल.',
  },
  'meta.briefTitle': { en: 'Comparison brief', hi: 'तुलना का सार', mr: 'तुलनेचा सारांश' },

  // ── the star ──
  'star.on': {
    en: '{label} — starred. Remove from your verdict',
    hi: '{label} — स्टार किया है। अपने फ़ैसले से हटाएँ',
    mr: '{label} — स्टार केले आहे. तुमच्या निर्णयातून काढा',
  },
  'star.off': {
    en: 'Star {label} to count it in your verdict',
    hi: '{label} को अपने फ़ैसले में गिनने के लिए स्टार करें',
    mr: '{label} तुमच्या निर्णयात मोजण्यासाठी स्टार करा',
  },

  // ── fewer than two quotes ──
  eyebrow: { en: 'Side by side', hi: 'आमने-सामने', mr: 'शेजारी-शेजारी' },
  'empty.title': {
    en: 'Two quotes, and this page starts working.',
    hi: 'दो कोटेशन हों, तब यह पेज काम करना शुरू करता है।',
    mr: 'दोन कोटेशन असली की हे पेज काम करू लागते.',
  },
  'empty.body': {
    en: 'One quote compared with nothing is a quote. Price a second studio and every line lands beside its opposite number — same item, same size, their materials and their price.',
    hi: 'किसी से तुलना न हो तो एक कोटेशन बस एक कोटेशन है। दूसरे स्टूडियो का दाम देखें, तो हर लाइन उसकी बराबर वाली लाइन के पास आ जाएगी — वही चीज़, वही साइज़, उनका मटीरियल और उनका दाम।',
    mr: 'कशाशीही तुलना नसेल तर एक कोटेशन फक्त एक कोटेशन असते. दुसऱ्या स्टुडिओची किंमत पाहा, म्हणजे प्रत्येक ओळ तिच्या जोडीच्या ओळीशेजारी येईल — तीच वस्तू, तीच साइज, त्यांचे मटेरियल आणि त्यांची किंमत.',
  },
  back: { en: 'Back to your matches', hi: 'अपने मैच पर वापस', mr: 'तुमच्या मॅचेसकडे परत' },

  // ── the spine and the bar at the bottom ──
  'fact.priced': { en: '{n} priced', hi: '{n} के दाम देखे', mr: '{n} च्या किमती पाहिल्या' },
  'fact.compare': { en: '{n} side by side', hi: '{n} आमने-सामने', mr: '{n} शेजारी-शेजारी' },
  'bar.label': { en: '{n} quotes side by side', hi: '{n} कोटेशन आमने-सामने', mr: '{n} कोटेशन शेजारी-शेजारी' },

  // ── the heading ──
  title: {
    en: '{n} quotes, written to the same lines.',
    hi: '{n} कोटेशन, एक जैसी लाइनों पर लिखे हुए।',
    mr: '{n} कोटेशन, सारख्याच ओळींवर लिहिलेली.',
  },
  aside: {
    en: 'Same item · same size · their materials',
    hi: 'वही चीज़ · वही साइज़ · उनका मटीरियल',
    mr: 'तीच वस्तू · तीच साइज · त्यांचे मटेरियल',
  },
  intro: {
    en: 'Same lines, same sizes, their own rates. Star what you care about. Tap any material you do not recognise.',
    hi: 'वही लाइनें, वही साइज़, उनके अपने रेट। जो आपके लिए ज़रूरी है उसे स्टार करें। जो मटीरियल समझ न आए, उस पर टैप करें।',
    mr: 'त्याच ओळी, त्याच साइज, त्यांचे स्वतःचे रेट. तुमच्यासाठी जे महत्त्वाचे आहे त्याला स्टार करा. जे मटेरियल ओळखीचे नाही त्यावर टॅप करा.',
  },
  prelaunch: {
    en: 'Pre-launch — priced on archive rates, not each studio’s own filed card',
    hi: 'लॉन्च से पहले — पुराने रिकॉर्ड के रेट पर दाम, हर स्टूडियो के अपने जमा किए रेट कार्ड पर नहीं',
    mr: 'लॉन्चपूर्वी — जुन्या नोंदींच्या रेटवर किंमत, प्रत्येक स्टुडिओच्या स्वतःच्या जमा केलेल्या रेट कार्डवर नाही',
  },

  // ── the totals ──
  'remove.aria': {
    en: 'Remove {name} from the comparison',
    hi: '{name} को तुलना से हटाएँ',
    mr: '{name} ला तुलनेतून काढा',
  },
  remove: { en: 'Remove', hi: 'हटाएँ', mr: 'काढा' },
  factory: { en: 'Factory {factory} · site {site}', hi: 'फ़ैक्ट्री {factory} · साइट {site}', mr: 'फॅक्टरी {factory} · साइट {site}' },
  lowest: {
    en: 'Lowest total — read the materials below',
    hi: 'सबसे कम टोटल — नीचे मटीरियल ज़रूर पढ़ें',
    mr: 'सर्वात कमी टोटल — खालचे मटेरियल नक्की वाचा',
  },

  // ── your verdict ──
  'starred.one': { en: 'On your {n} starred line', hi: 'आपकी {n} स्टार की हुई लाइन पर', mr: 'तुमच्या {n} स्टार केलेल्या ओळीवर' },
  'starred.many': { en: 'On your {n} starred lines', hi: 'आपकी {n} स्टार की हुई लाइनों पर', mr: 'तुमच्या {n} स्टार केलेल्या ओळींवर' },
  clearStars: { en: 'Clear stars', hi: 'स्टार हटाएँ', mr: 'स्टार काढा' },
  didNotQuote: { en: 'did not quote {items}', hi: '{items} का दाम नहीं दिया', mr: '{items} ची किंमत दिली नाही' },
  partOnly: { en: 'part only', hi: 'सिर्फ़ कुछ हिस्सा', mr: 'फक्त काही भाग' },
  'verdict.cheaper': {
    en: '{name} is {gap} cheaper than the next on the work you picked.',
    hi: 'आपके चुने हुए काम पर {name} अगले स्टूडियो से {gap} सस्ता है।',
    mr: 'तुम्ही निवडलेल्या कामावर {name} पुढच्या स्टुडिओपेक्षा {gap} स्वस्त आहे.',
  },
  'verdict.level': {
    en: 'Level on price across these lines. The materials are the only thing left to separate them.',
    hi: 'इन लाइनों पर दाम बराबर है। अब इन्हें अलग करने वाली चीज़ सिर्फ़ मटीरियल है।',
    mr: 'या ओळींवर किंमत सारखीच आहे. आता त्यांना वेगळे करणारी गोष्ट फक्त मटेरियल आहे.',
  },
  'verdict.onlyOne': {
    en: 'Only one studio priced all of these, so there is no comparison to make yet — star a line they all quoted, or read what the others left out above.',
    hi: 'इन सब का दाम सिर्फ़ एक स्टूडियो ने दिया है, इसलिए अभी तुलना नहीं हो सकती — ऐसी लाइन स्टार करें जिसका दाम सबने दिया हो, या ऊपर पढ़ें कि बाकियों ने क्या छोड़ा।',
    mr: 'या सगळ्यांची किंमत फक्त एका स्टुडिओने दिली आहे, त्यामुळे अजून तुलना करता येत नाही — सगळ्यांनी किंमत दिलेली ओळ स्टार करा, किंवा इतरांनी काय सोडले ते वर वाचा.',
  },
  caveat: {
    en: 'Before you read that as better value — they are not quoting the same material on {items}',
    hi: 'इसे बेहतर सौदा मानने से पहले — {items} पर ये एक जैसा मटीरियल नहीं दे रहे',
    mr: 'याला चांगला सौदा समजण्याआधी — {items} वर ते सारखे मटेरियल देत नाहीत',
  },
  starHint: {
    en: 'Star the lines you care about and we will total just those.',
    hi: 'जो लाइनें आपके लिए ज़रूरी हैं उन्हें स्टार करें, हम सिर्फ़ उन्हीं का टोटल करेंगे।',
    mr: 'तुमच्यासाठी महत्त्वाच्या ओळींना स्टार करा, आम्ही फक्त त्यांचीच बेरीज करू.',
  },
  starHintSub: {
    en: 'The bottom row compares two slightly different houses.',
    hi: 'सबसे नीचे का टोटल दो थोड़े अलग घरों की तुलना करता है।',
    mr: 'सर्वात खालची ओळ दोन थोड्या वेगळ्या घरांची तुलना करते.',
  },

  // ── where the difference is ──
  'diff.title': { en: 'Where the difference is', hi: 'फ़र्क कहाँ है', mr: 'फरक कुठे आहे' },
  'diff.apart': { en: '{amount} apart', hi: '{amount} का फ़र्क', mr: '{amount} चा फरक' },
  notQuotedLower: { en: 'not quoted', hi: 'दाम नहीं दिया', mr: 'किंमत दिली नाही' },
  'diff.didNot': {
    en: '{names} did not quote this at all — which is usually why a total is lower.',
    hi: '{names} ने इसका दाम दिया ही नहीं — अक्सर टोटल कम होने की यही वजह होती है।',
    mr: '{names} यांनी याची किंमतच दिली नाही — बहुतेक वेळा टोटल कमी असण्याचे हेच कारण असते.',
  },
  'diff.same': {
    en: 'Same material both sides. This one is a straight price difference.',
    hi: 'दोनों तरफ़ एक ही मटीरियल। यहाँ सीधा दाम का फ़र्क है।',
    mr: 'दोन्ही बाजूंना तेच मटेरियल. इथे सरळ किमतीचा फरक आहे.',
  },
  briefLink: {
    en: 'The one-page brief — to print, save or send to family →',
    hi: 'एक पेज का सार — प्रिंट करें, सेव करें या परिवार को भेजें →',
    mr: 'एका पानाचा सारांश — प्रिंट करा, सेव्ह करा किंवा कुटुंबाला पाठवा →',
  },

  // ── every line ──
  notQuoted: { en: 'Not quoted', hi: 'दाम नहीं दिया', mr: 'किंमत दिली नाही' },
  total: { en: 'Total · GST incl.', hi: 'टोटल · GST सहित', mr: 'टोटल · GST सह' },
  lineItem: { en: 'Line item', hi: 'आइटम', mr: 'आयटम' },

  // ── the close ──
  pitchLead: {
    en: 'Every studio here comes with the same benefits through us',
    hi: 'हमारे ज़रिए यहाँ हर स्टूडियो के साथ एक जैसे फ़ायदे मिलते हैं',
    mr: 'आमच्यामार्फत इथल्या प्रत्येक स्टुडिओसोबत सारखेच फायदे मिळतात',
  },
  another: { en: 'Price another studio', hi: 'दूसरे स्टूडियो का दाम देखें', mr: 'दुसऱ्या स्टुडिओची किंमत पाहा' },
  footnote: {
    en: 'Standard scope, priced before anybody has stood in your flat — the bands say how far each could move. Your architect is paid by us, never by a studio.',
    hi: 'स्टैंडर्ड काम, आपके फ़्लैट को किसी के देखे बिना लगाया गया दाम — रेंज बताती है कि हर दाम कितना ऊपर-नीचे हो सकता है। आपके आर्किटेक्ट को पैसे हम देते हैं, कोई स्टूडियो कभी नहीं।',
    mr: 'स्टँडर्ड काम, तुमचा फ्लॅट कोणी पाहण्याआधी लावलेली किंमत — रेंज सांगते की प्रत्येक किंमत किती कमी-जास्त होऊ शकते. तुमच्या आर्किटेक्टला पैसे आम्ही देतो, कोणताही स्टुडिओ कधीच नाही.',
  },

  // ── who fits ──
  'fit.eyebrow': { en: 'Who fits, side by side', hi: 'कौन सही बैठता है, आमने-सामने', mr: 'कोण योग्य आहे, शेजारी-शेजारी' },
  'fit.fit': { en: 'Fit', hi: 'मेल', mr: 'जुळणी' },
  'fit.score': {
    en: '{score}% · {scored} of {total} measured',
    hi: '{score}% · {total} में से {scored} मापे गए',
    mr: '{score}% · {total} पैकी {scored} मोजले',
  },
  'fit.notInMatches': { en: 'Not in your matches now', hi: 'अभी आपके मैच में नहीं', mr: 'सध्या तुमच्या मॅचमध्ये नाही' },
  notKnown: { en: 'Not known yet', hi: 'अभी पता नहीं', mr: 'अजून माहीत नाही' },
  'fit.checks': { en: 'Checks cleared', hi: 'पास हुई जाँचें', mr: 'पूर्ण झालेल्या तपासण्या' },
  'fit.checksCell': { en: '{passed} of {total}', hi: '{total} में से {passed}', mr: '{total} पैकी {passed}' },
  'fit.delivered': { en: 'Delivered with us', hi: 'हमारे साथ पूरे किए', mr: 'आमच्यासोबत पूर्ण केलेले' },
  'fit.deliveredNone': { en: 'No projects with us yet', hi: 'हमारे साथ अभी कोई प्रोजेक्ट नहीं', mr: 'आमच्यासोबत अजून एकही प्रोजेक्ट नाही' },
  'fit.projects': { en: '{n} projects', hi: '{n} प्रोजेक्ट', mr: '{n} प्रोजेक्ट' },
  'fit.onTime': { en: ', on time on average', hi: ', औसतन समय पर', mr: ', सरासरी वेळेवर' },
  'fit.late': { en: ', +{d} days on average', hi: ', औसतन +{d} दिन', mr: ', सरासरी +{d} दिवस' },

  // ── price by room, by material ──
  'room.eyebrow': { en: 'Price by room', hi: 'कमरे के हिसाब से दाम', mr: 'खोलीनुसार किंमत' },
  notPriced: { en: 'not priced', hi: 'दाम नहीं लगाया', mr: 'किंमत लावली नाही' },
  'mat.eyebrow': { en: 'By material', hi: 'मटीरियल के हिसाब से', mr: 'मटेरियलनुसार' },
  'mat.intro': {
    en: 'The same item at the same size — what each studio charges for it, and what it is made of.',
    hi: 'वही चीज़, वही साइज़ — हर स्टूडियो इसका कितना लेता है, और यह किस चीज़ से बना है।',
    mr: 'तीच वस्तू, तीच साइज — प्रत्येक स्टुडिओ तिचे किती घेतो, आणि ती कशापासून बनलेली आहे.',
  },
  'mat.same': {
    en: 'Same material at {n} studios: {list}.',
    hi: '{n} स्टूडियो पर एक ही मटीरियल: {list}।',
    mr: '{n} स्टुडिओंमध्ये तेच मटेरियल: {list}.',
  },
  'mat.at': { en: '{amount} at {name}', hi: '{name} पर {amount}', mr: '{name} येथे {amount}' },

  // ── in plain words ──
  'explain.eyebrow': { en: 'In plain words', hi: 'आसान शब्दों में', mr: 'सोप्या शब्दांत' },
  'explain.langAria': { en: 'Language', hi: 'भाषा', mr: 'भाषा' },
  'explain.pending': { en: 'Reading the numbers…', hi: 'आँकड़े पढ़ रहे हैं…', mr: 'आकडे वाचत आहोत…' },
  'explain.button': { en: 'Explain the differences', hi: 'फ़र्क समझाइए', mr: 'फरक समजावून सांगा' },
  'explain.byAI': {
    en: 'Written by AI from these quotes — every figure in it was checked against them',
    hi: 'इन कोटेशन से AI ने लिखा — इसका हर आँकड़ा इन्हीं से मिलाकर जाँचा गया',
    mr: 'या कोटेशनवरून AI ने लिहिले — यातला प्रत्येक आकडा त्यांच्याशी जुळवून तपासला',
  },
  'explain.byRules': {
    en: 'From the numbers above, by our rules',
    hi: 'ऊपर के आँकड़ों से, हमारे नियमों के हिसाब से',
    mr: 'वरच्या आकड्यांवरून, आमच्या नियमांनुसार',
  },
  'explain.byRulesEnglish': {
    en: 'From the numbers above, by our rules — in English, because a written version was not available just now',
    hi: 'ऊपर के आँकड़ों से, हमारे नियमों के हिसाब से — अंग्रेज़ी में, क्योंकि अभी लिखा हुआ अनुवाद नहीं मिल पाया',
    mr: 'वरच्या आकड्यांवरून, आमच्या नियमांनुसार — इंग्रजीत, कारण आत्ता लिहिलेली आवृत्ती मिळाली नाही',
  },
  worthAsking: { en: 'Worth asking every studio', hi: 'हर स्टूडियो से पूछने लायक', mr: 'प्रत्येक स्टुडिओला विचारण्यासारखे' },
  'explain.failed': {
    en: 'Could not write it just now — everything it would say is in the sections below.',
    hi: 'अभी लिख नहीं पाए — जो इसमें होता, वह सब नीचे के हिस्सों में है।',
    mr: 'आत्ता लिहिता आले नाही — यात जे असते ते सगळे खालच्या भागांत आहे.',
  },
  'explain.intro': {
    en: 'Where the cost changes, how the materials differ, and what each studio charges for the same material — in a few sentences.',
    hi: 'खर्च कहाँ बदलता है, मटीरियल में क्या फ़र्क है, और एक ही मटीरियल का हर स्टूडियो कितना लेता है — कुछ वाक्यों में।',
    mr: 'खर्च कुठे बदलतो, मटेरियलमध्ये काय फरक आहे, आणि तेच मटेरियल प्रत्येक स्टुडिओ किती घेतो — काही वाक्यांत.',
  },

  // ── ask your quote ──
  'ask.eyebrow': { en: 'Ask your quote', hi: 'अपने कोटेशन से पूछें', mr: 'तुमच्या कोटेशनला विचारा' },
  'ask.intro': {
    en: 'Answered only from the figures on these quotes — nothing made up, and every number checked.',
    hi: 'जवाब सिर्फ़ इन कोटेशन के आँकड़ों से — कुछ भी मनगढ़ंत नहीं, और हर नंबर जाँचा हुआ।',
    mr: 'उत्तर फक्त या कोटेशनमधल्या आकड्यांवरून — काहीही मनाने नाही, आणि प्रत्येक आकडा तपासलेला.',
  },
  'ask.ex1': {
    en: 'Why is the kitchen so different between them?',
    hi: 'इनके बीच किचन का दाम इतना अलग क्यों है?',
    mr: 'यांच्यात किचनची किंमत इतकी वेगळी का आहे?',
  },
  'ask.ex2': {
    en: 'Where does most of the money go?',
    hi: 'सबसे ज़्यादा पैसा कहाँ जाता है?',
    mr: 'सर्वात जास्त पैसा कुठे जातो?',
  },
  'ask.placeholder': {
    en: 'Why is one studio’s kitchen more?',
    hi: 'एक स्टूडियो का किचन महँगा क्यों है?',
    mr: 'एका स्टुडिओचे किचन महाग का आहे?',
  },
  'ask.aria': {
    en: 'Your question about these quotes',
    hi: 'इन कोटेशन के बारे में आपका सवाल',
    mr: 'या कोटेशनबद्दल तुमचा प्रश्न',
  },
  'ask.pending': { en: 'Reading your quotes…', hi: 'आपके कोटेशन पढ़ रहे हैं…', mr: 'तुमची कोटेशन वाचत आहोत…' },
  'ask.button': { en: 'Ask', hi: 'पूछें', mr: 'विचारा' },
  'ask.error': {
    en: 'Could not answer just now. Try again in a minute.',
    hi: 'अभी जवाब नहीं दे पाए। एक मिनट बाद फिर कोशिश करें।',
    mr: 'आत्ता उत्तर देता आले नाही. एका मिनिटाने पुन्हा प्रयत्न करा.',
  },

  // ── the one-page brief ──
  'brief.needTwo': {
    en: 'Put at least two quotes side by side first.',
    hi: 'पहले कम से कम दो कोटेशन आमने-सामने रखें।',
    mr: 'आधी किमान दोन कोटेशन शेजारी-शेजारी ठेवा.',
  },
  'brief.backToCompare': { en: 'Back to compare', hi: 'तुलना पर वापस', mr: 'तुलनेकडे परत' },
  'brief.eyebrow': { en: 'Comparison brief · {date}', hi: 'तुलना का सार · {date}', mr: 'तुलनेचा सारांश · {date}' },
  'brief.preparedFor': { en: 'Prepared for {who}', hi: '{who} के लिए तैयार', mr: '{who} यांच्यासाठी तयार' },
  'brief.print': { en: 'Print or save as PDF', hi: 'प्रिंट करें या PDF में सेव करें', mr: 'प्रिंट करा किंवा PDF म्हणून सेव्ह करा' },
  'brief.footer': {
    en: 'One Interiors — every studio priced on the same lines and sizes. No studio pays to be shown.',
    hi: 'One Interiors — हर स्टूडियो का दाम एक जैसी लाइनों और साइज़ पर। दिखने के लिए कोई स्टूडियो पैसे नहीं देता।',
    mr: 'One Interiors — प्रत्येक स्टुडिओची किंमत सारख्याच ओळी आणि साइजवर. दिसण्यासाठी कोणताही स्टुडिओ पैसे देत नाही.',
  },
} satisfies Record<string, Tx>;

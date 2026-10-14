import type { Entry } from './entry';

/**
 * Words for Choose & sign (Meet studios, Final quote, Sign), in the
 * website's own wording (src/app/app/choose). The plan words are under
 * `plan.*` in plan.ts. First draft of the Hindi and Marathi: Sanyam reviews.
 */
export const chooseWords = {
  // The 4-step header.
  'choose.meta': {
    en: 'Choose & sign',
    hi: 'चुनें और साइन करें',
    mr: 'निवडा आणि सही करा',
  },
  'choose.progress': {
    en: 'Choosing your studio',
    hi: 'आपका स्टूडियो चुनना',
    mr: 'तुमचा स्टुडिओ निवडणे',
  },
  'choose.step': {
    en: 'Step {n} of 4 · {name}',
    hi: 'चरण {n} / 4 · {name}',
    mr: 'टप्पा {n} / 4 · {name}',
  },
  'choose.step1': { en: 'Expert call', hi: 'एक्सपर्ट कॉल', mr: 'तज्ज्ञ कॉल' },
  'choose.step2': {
    en: 'Meet studios',
    hi: 'स्टूडियो से मिलें',
    mr: 'स्टुडिओंना भेटा',
  },
  'choose.step3': {
    en: 'Final quote',
    hi: 'फ़ाइनल कोटेशन',
    mr: 'अंतिम कोटेशन',
  },
  'choose.step4': { en: 'Sign', hi: 'साइन', mr: 'सही' },

  // Meet studios (#18).
  'choose.h1': {
    en: 'Meet your studios',
    hi: 'अपने स्टूडियो से मिलें',
    mr: 'तुमच्या स्टुडिओंना भेटा',
  },
  'choose.sub': {
    en: '{expert} introduced {names}. Each one measures your flat and sends a final quote here.',
    hi: '{expert} ने {names} से मिलवाया। हर स्टूडियो आपका फ़्लैट नापकर यहाँ फ़ाइनल कोटेशन भेजता है।',
    mr: '{expert} यांनी {names} यांची ओळख करून दिली. प्रत्येक स्टुडिओ तुमचा फ्लॅट मोजून इथे अंतिम कोटेशन पाठवतो.',
  },
  'choose.and': { en: 'and', hi: 'और', mr: 'आणि' },
  'choose.empty.call': {
    en: 'After your call on {when}, {expert} is arranging visits with the studios you want to meet. They appear here, and each one measures your flat and sends a final quote.',
    hi: '{when} की आपकी कॉल के बाद, {expert} उन स्टूडियो से मुलाक़ात तय कर रही हैं जिनसे आप मिलना चाहते हैं। वे यहाँ दिखेंगे, और हर एक आपका फ़्लैट नापकर फ़ाइनल कोटेशन भेजेगा।',
    mr: '{when} च्या तुमच्या कॉलनंतर, {expert} तुम्हाला भेटायच्या स्टुडिओंसोबत भेटी ठरवत आहेत. ते इथे दिसतील, आणि प्रत्येक जण तुमचा फ्लॅट मोजून अंतिम कोटेशन पाठवेल.',
  },
  'choose.empty': {
    en: 'Once you have spoken to {expert}, she arranges visits with the studios you want to meet. They appear here, with their visits and their final quotes.',
    hi: '{expert} से बात करने के बाद, वे उन स्टूडियो से मुलाक़ात तय करती हैं जिनसे आप मिलना चाहते हैं। वे यहाँ अपनी मुलाक़ातों और फ़ाइनल कोटेशन के साथ दिखेंगे।',
    mr: '{expert} यांच्याशी बोलल्यानंतर, तुम्हाला भेटायच्या स्टुडिओंसोबत त्या भेटी ठरवतात. ते इथे त्यांच्या भेटी आणि अंतिम कोटेशनसह दिसतील.',
  },
  'choose.signedWith': {
    en: 'Signed with {studio}',
    hi: '{studio} के साथ साइन किया',
    mr: '{studio} सोबत सही केली',
  },
  'choose.chip.signed': { en: 'Signed', hi: 'साइन हुआ', mr: 'सही झाली' },
  'choose.chip.quote': {
    en: 'Final quote in',
    hi: 'फ़ाइनल कोटेशन आया',
    mr: 'अंतिम कोटेशन आले',
  },
  'choose.chip.pick': {
    en: 'Confirm a time',
    hi: 'समय पक्का करें',
    mr: 'वेळ निश्चित करा',
  },
  'choose.chip.booked': { en: 'Booked', hi: 'बुक हुआ', mr: 'बुक झाले' },
  'choose.chip.waiting': {
    en: 'Waiting on the studio',
    hi: 'स्टूडियो के जवाब का इंतज़ार',
    mr: 'स्टुडिओच्या उत्तराची वाट',
  },
  'choose.noVisits': {
    en: '{studio} will propose a time to meet and to measure your flat. You confirm it here.',
    hi: '{studio} मिलने और आपका फ़्लैट नापने का समय सुझाएगा। आप उसे यहाँ पक्का करें।',
    mr: '{studio} भेटण्याची आणि तुमचा फ्लॅट मोजण्याची वेळ सुचवेल. तुम्ही ती इथे निश्चित करा.',
  },
  'choose.kind.first_meeting': {
    en: 'Studio visit',
    hi: 'स्टूडियो विज़िट',
    mr: 'स्टुडिओ भेट',
  },
  'choose.kind.site_visit': {
    en: 'Site measurement',
    hi: 'साइट का नाप',
    mr: 'साइटचे मोजमाप',
  },
  'choose.kind.follow_up': {
    en: 'Follow-up visit',
    hi: 'दोबारा मुलाक़ात',
    mr: 'पुन्हा भेट',
  },
  'choose.proposed': {
    en: '{studio} proposed this time. Can you make it?',
    hi: '{studio} ने यह समय सुझाया है। क्या आप आ पाएँगे?',
    mr: '{studio} ने ही वेळ सुचवली आहे. तुम्हाला जमेल का?',
  },
  'choose.confirm': {
    en: 'Confirm {when}',
    hi: '{when} पक्का करें',
    mr: '{when} निश्चित करा',
  },
  'choose.cantMake': {
    en: 'I can’t make it',
    hi: 'मैं नहीं आ पाऊँगा',
    mr: 'मला जमणार नाही',
  },
  'choose.state.completed': { en: 'Done', hi: 'हो गया', mr: 'झाले' },
  'choose.state.confirmed': { en: 'Confirmed', hi: 'पक्का', mr: 'निश्चित' },
  'choose.quoteIn': {
    en: 'Final quote has arrived',
    hi: 'फ़ाइनल कोटेशन आ गया है',
    mr: 'अंतिम कोटेशन आले आहे',
  },
  'choose.quoteSigned': {
    en: 'Your signed quote',
    hi: 'आपका साइन किया कोटेशन',
    mr: 'तुम्ही सही केलेले कोटेशन',
  },
  'choose.beforeGst': {
    en: '{amount} before GST',
    hi: 'GST से पहले {amount}',
    mr: 'GST आधी {amount}',
  },
  'choose.gstNote': { en: 'before GST', hi: 'GST से पहले', mr: 'GST आधी' },
  'choose.arrived': {
    en: '{studio}’s final quote has arrived',
    hi: '{studio} का फ़ाइनल कोटेशन आ गया है',
    mr: '{studio} चे अंतिम कोटेशन आले आहे',
  },
  'choose.seeQuote': {
    en: 'See the final quote',
    hi: 'फ़ाइनल कोटेशन देखें',
    mr: 'अंतिम कोटेशन पाहा',
  },
  'choose.seeSigned': {
    en: 'See your signed quote',
    hi: 'अपना साइन किया कोटेशन देखें',
    mr: 'सही केलेले कोटेशन पाहा',
  },
  'choose.expert.title': {
    en: '{expert}, your expert',
    hi: '{expert}, आपकी एक्सपर्ट',
    mr: '{expert}, तुमच्या तज्ज्ञ',
  },
  'choose.expert.body': {
    en: 'Not sure about a studio or a visit? Ask her before you sign. She earns the same whichever studio you pick.',
    hi: 'किसी स्टूडियो या मुलाक़ात को लेकर पक्का नहीं? साइन करने से पहले उनसे पूछें। आप कोई भी स्टूडियो चुनें, उनकी कमाई उतनी ही रहती है।',
    mr: 'एखाद्या स्टुडिओबद्दल किंवा भेटीबद्दल खात्री नाही? सही करण्याआधी त्यांना विचारा. तुम्ही कोणताही स्टुडिओ निवडा, त्यांची कमाई तेवढीच राहते.',
  },
  'choose.ask': {
    en: 'Ask {expert}',
    hi: '{expert} से पूछें',
    mr: '{expert} यांना विचारा',
  },
  'choose.open': {
    en: 'Open my project',
    hi: 'मेरा प्रोजेक्ट खोलें',
    mr: 'माझा प्रोजेक्ट उघडा',
  },
  'choose.retry': {
    en: 'Try again',
    hi: 'फिर से कोशिश करें',
    mr: 'पुन्हा प्रयत्न करा',
  },

  // Final quote (#19).
  'final.meta': {
    en: '{studio} · after measuring your flat',
    hi: '{studio} · आपका फ़्लैट नापने के बाद',
    mr: '{studio} · तुमचा फ्लॅट मोजल्यानंतर',
  },
  'final.h1': {
    en: 'Your final quote',
    hi: 'आपका फ़ाइनल कोटेशन',
    mr: 'तुमचे अंतिम कोटेशन',
  },
  'final.totalFor': {
    en: 'Total for all {n} lines, before GST',
    hi: 'सभी {n} लाइनों का कुल, GST से पहले',
    mr: 'सर्व {n} ओळींची एकूण रक्कम, GST आधी',
  },
  'final.same': {
    en: 'Same as your first quote',
    hi: 'आपके पहले कोटेशन जितना ही',
    mr: 'तुमच्या पहिल्या कोटेशनइतकेच',
  },
  'final.above': {
    en: '{amount} above your first quote',
    hi: 'आपके पहले कोटेशन से {amount} ज़्यादा',
    mr: 'तुमच्या पहिल्या कोटेशनपेक्षा {amount} जास्त',
  },
  'final.below': {
    en: '{amount} below your first quote',
    hi: 'आपके पहले कोटेशन से {amount} कम',
    mr: 'तुमच्या पहिल्या कोटेशनपेक्षा {amount} कमी',
  },
  'final.measured': {
    en: 'Now that they have measured your flat. Both are before GST.',
    hi: 'अब जब उन्होंने आपका फ़्लैट नाप लिया है। दोनों GST से पहले हैं।',
    mr: 'आता त्यांनी तुमचा फ्लॅट मोजला आहे. दोन्ही GST आधीच्या आहेत.',
  },
  'final.rooms': {
    en: 'Room by room',
    hi: 'कमरे के हिसाब से',
    mr: 'खोलीनुसार',
  },
  'final.lines': { en: '{n} lines', hi: '{n} लाइनें', mr: '{n} ओळी' },
  'final.line1': { en: '1 line', hi: '1 लाइन', mr: '1 ओळ' },
  'final.work': {
    en: 'Work, all lines',
    hi: 'काम, सभी लाइनें',
    mr: 'काम, सर्व ओळी',
  },
  'final.fee': {
    en: 'Design and site fee',
    hi: 'डिज़ाइन और साइट फ़ीस',
    mr: 'डिझाइन आणि साइट फी',
  },
  'final.discount': {
    en: 'Discount on modular work',
    hi: 'मॉड्यूलर काम पर छूट',
    mr: 'मॉड्युलर कामावर सूट',
  },
  'final.onSpot': {
    en: 'Further discount',
    hi: 'अतिरिक्त छूट',
    mr: 'अतिरिक्त सूट',
  },
  'final.beforeTax': {
    en: 'Total, before GST',
    hi: 'कुल, GST से पहले',
    mr: 'एकूण, GST आधी',
  },
  'final.gst': { en: 'GST 18%', hi: 'GST 18%', mr: 'GST 18%' },
  'final.pay': { en: 'You pay', hi: 'आप देंगे', mr: 'तुम्ही द्याल' },
  'final.locked': {
    en: 'Locked once you sign',
    hi: 'साइन करते ही तय',
    mr: 'सही केल्यावर निश्चित',
  },
  'final.lock.price': {
    en: 'The price of every line above',
    hi: 'ऊपर की हर लाइन की क़ीमत',
    mr: 'वरील प्रत्येक ओळीची किंमत',
  },
  'final.lock.materials': {
    en: 'The materials named on each line',
    hi: 'हर लाइन में लिखा मटीरियल',
    mr: 'प्रत्येक ओळीत लिहिलेले मटेरियल',
  },
  'final.lock.handover': {
    en: 'Handover in about {weeks} weeks from signing',
    hi: 'साइन करने के लगभग {weeks} हफ़्ते में हैंडओवर',
    mr: 'सही केल्यापासून सुमारे {weeks} आठवड्यांत हँडओव्हर',
  },
  'final.lock.stages': {
    en: 'Payment in {n} stages: {pcts}',
    hi: '{n} चरणों में भुगतान: {pcts}',
    mr: '{n} टप्प्यांत पेमेंट: {pcts}',
  },
  'final.lock.stagesN': {
    en: 'Payment in {n} stages',
    hi: '{n} चरणों में भुगतान',
    mr: '{n} टप्प्यांत पेमेंट',
  },
  'final.lock.terms': {
    en: '{studio}’s own terms, as written on the quote',
    hi: '{studio} की अपनी शर्तें, जैसी कोटेशन पर लिखी हैं',
    mr: '{studio} च्या स्वतःच्या अटी, कोटेशनवर लिहिल्याप्रमाणे',
  },
  'final.cta': {
    en: 'Looks right, go to signing',
    hi: 'सही है, साइन करने चलें',
    mr: 'बरोबर आहे, सही करायला चला',
  },
  'final.ask': {
    en: 'Ask {expert} to check it first',
    hi: 'पहले {expert} से जाँच करवाएँ',
    mr: 'आधी {expert} यांना तपासायला सांगा',
  },

  // Sign (#20).
  'sign.h1': {
    en: 'Sign with {studio}',
    hi: '{studio} के साथ साइन करें',
    mr: '{studio} सोबत सही करा',
  },
  'sign.total': { en: 'Total, locked', hi: 'कुल, तय', mr: 'एकूण, निश्चित' },
  'sign.totalLine': {
    en: '{amount} for {n} lines',
    hi: '{n} लाइनों के लिए {amount}',
    mr: '{n} ओळींसाठी {amount}',
  },
  'sign.gst': { en: 'GST', hi: 'GST', mr: 'GST' },
  'sign.gstIn': {
    en: '{amount}, included above',
    hi: '{amount}, ऊपर शामिल',
    mr: '{amount}, वर समाविष्ट',
  },
  'sign.gstInvoice': {
    en: 'On the studio’s invoice',
    hi: 'स्टूडियो के बिल पर',
    mr: 'स्टुडिओच्या बिलावर',
  },
  'sign.handover': { en: 'Handover', hi: 'हैंडओवर', mr: 'हँडओव्हर' },
  'sign.handoverLine': {
    en: 'About {weeks} weeks from signing',
    hi: 'साइन करने के लगभग {weeks} हफ़्ते बाद',
    mr: 'सही केल्यापासून सुमारे {weeks} आठवडे',
  },
  'sign.updates': { en: 'Site updates', hi: 'साइट अपडेट', mr: 'साइट अपडेट' },
  'sign.updatesLine': {
    en: 'Here, as the studio posts them',
    hi: 'यहीं, जैसे-जैसे स्टूडियो डाले',
    mr: 'इथेच, स्टुडिओ टाकेल तसे',
  },
  'sign.pay': {
    en: 'How you pay',
    hi: 'आप कैसे भुगतान करेंगे',
    mr: 'तुम्ही पेमेंट कसे कराल',
  },
  'sign.direct': {
    en: 'You pay the studio directly. Every payment and receipt is kept in your Home locker.',
    hi: 'आप सीधे स्टूडियो को भुगतान करते हैं। हर भुगतान और रसीद आपके होम लॉकर में रहती है।',
    mr: 'तुम्ही थेट स्टुडिओला पेमेंट करता. प्रत्येक पेमेंट आणि पावती तुमच्या होम लॉकरमध्ये राहते.',
  },
  'sign.terms': {
    en: 'Read {studio}’s terms',
    hi: '{studio} की शर्तें पढ़ें',
    mr: '{studio} च्या अटी वाचा',
  },
  'sign.termsSub': {
    en: 'Their own, as written on the quote',
    hi: 'उनकी अपनी, जैसी कोटेशन पर लिखी हैं',
    mr: 'त्यांच्या स्वतःच्या, कोटेशनवर लिहिल्याप्रमाणे',
  },
  'sign.agree': {
    en: 'I have read the quote and agree to the price, timeline and payment stages.',
    hi: 'मैंने कोटेशन पढ़ लिया है और क़ीमत, समय-सीमा और भुगतान के चरणों से सहमत हूँ।',
    mr: 'मी कोटेशन वाचले आहे आणि किंमत, वेळापत्रक आणि पेमेंटच्या टप्प्यांशी सहमत आहे.',
  },
  'sign.agreeTerms': {
    en: 'I have read the quote and the terms and agree to the price, timeline and payment stages.',
    hi: 'मैंने कोटेशन और शर्तें पढ़ ली हैं और क़ीमत, समय-सीमा और भुगतान के चरणों से सहमत हूँ।',
    mr: 'मी कोटेशन आणि अटी वाचल्या आहेत आणि किंमत, वेळापत्रक आणि पेमेंटच्या टप्प्यांशी सहमत आहे.',
  },
  'sign.tick': {
    en: 'Tick the box to sign',
    hi: 'साइन करने के लिए बॉक्स पर टिक करें',
    mr: 'सही करण्यासाठी बॉक्सवर टिक करा',
  },
  'sign.withCode': {
    en: 'Sign with a code',
    hi: 'कोड से साइन करें',
    mr: 'कोडने सही करा',
  },
  'sign.codeTo': {
    en: '6-digit code sent to {phone}',
    hi: '{phone} पर भेजा गया 6 अंकों का कोड',
    mr: '{phone} वर पाठवलेला 6 अंकी कोड',
  },
  'sign.codeToYou': {
    en: '6-digit code sent to your number',
    hi: 'आपके नंबर पर भेजा गया 6 अंकों का कोड',
    mr: 'तुमच्या नंबरवर पाठवलेला 6 अंकी कोड',
  },
  'sign.cta': {
    en: 'Sign with {studio}',
    hi: '{studio} के साथ साइन करें',
    mr: '{studio} सोबत सही करा',
  },
  'sign.done.eyebrow': {
    en: 'Your project is unlocked',
    hi: 'आपका प्रोजेक्ट खुल गया है',
    mr: 'तुमचा प्रोजेक्ट सुरू झाला आहे',
  },
  'sign.done.h1': {
    en: 'Signed. Your home starts now, {name}.',
    hi: 'साइन हो गया। आपका घर अब शुरू होता है, {name}।',
    mr: 'सही झाली. तुमचे घर आता सुरू होते, {name}.',
  },
  'sign.done.h1Anon': {
    en: 'Signed. Your home starts now.',
    hi: 'साइन हो गया। आपका घर अब शुरू होता है।',
    mr: 'सही झाली. तुमचे घर आता सुरू होते.',
  },
  'sign.done.body': {
    en: '{studio} has your signed quote and starts the detailed design. Your project, its stages and every site update are in the app from today.',
    hi: '{studio} के पास आपका साइन किया कोटेशन है और वे डिटेल्ड डिज़ाइन शुरू करते हैं। आपका प्रोजेक्ट, उसके चरण और हर साइट अपडेट आज से ऐप में हैं।',
    mr: '{studio} कडे तुमचे सही केलेले कोटेशन आहे आणि ते सविस्तर डिझाइन सुरू करतात. तुमचा प्रोजेक्ट, त्याचे टप्पे आणि प्रत्येक साइट अपडेट आजपासून ॲपमध्ये आहेत.',
  },
  'sign.done.assured': {
    en: 'You asked for Assured',
    hi: 'आपने अश्योर्ड माँगा है',
    mr: 'तुम्ही अश्योर्ड मागितले आहे',
  },
} satisfies Record<string, Entry>;

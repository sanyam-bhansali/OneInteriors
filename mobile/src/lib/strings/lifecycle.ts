import type { Entry } from './entry';

/**
 * "Where your project is" (owner, 13 Oct 2026; docs/studio-os/PROJECT-LIFECYCLE.md):
 * the current step, the next, and what unlocks it, in English, Hindi and
 * Marathi (first draft: Sanyam reviews). A copy of the website's
 * src/modules/app/lifecycle-words.ts, kept identical by
 * tests/customer-lifecycle.test.ts.
 */
export const lifecycleWords = {
  'life.title': { en: 'Where your project is', hi: 'आपका प्रोजेक्ट कहाँ है', mr: 'तुमचा प्रोजेक्ट कुठे आहे' },
  'life.now': { en: 'Now', hi: 'अभी', mr: 'आता' },
  'life.next': { en: 'Next', hi: 'अगला', mr: 'पुढचे' },
  'life.yourTurn': { en: 'To unlock it', hi: 'इसे खोलने के लिए', mr: 'हे उघडण्यासाठी' },
  'life.nothing': { en: 'Nothing needed from you', hi: 'आपसे कुछ नहीं चाहिए', mr: 'तुमच्याकडून काहीही नको' },
  'life.phase.design': { en: 'Design', hi: 'डिज़ाइन', mr: 'डिझाइन' },
  'life.phase.execution': { en: 'Work on site', hi: 'साइट पर काम', mr: 'साइटवर काम' },
  'life.phase.closure': { en: 'Project closure', hi: 'प्रोजेक्ट क्लोज़र', mr: 'प्रोजेक्ट क्लोजर' },
  'life.phase.snags': { en: 'Snags', hi: 'कमियाँ (स्नैग)', mr: 'त्रुटी (स्नॅग)' },
  'life.phase.warranty': { en: 'Warranty', hi: 'वारंटी', mr: 'वॉरंटी' },
  'life.phase.closed': { en: 'Closed', hi: 'पूरा हुआ', mr: 'पूर्ण झाले' },
  'life.step.design_done': { en: 'Design sign-off', hi: 'डिज़ाइन साइन-ऑफ़', mr: 'डिझाइन साइन-ऑफ' },
  'life.step.closure': { en: 'Project closure: the final account', hi: 'प्रोजेक्ट क्लोज़र: अंतिम हिसाब', mr: 'प्रोजेक्ट क्लोजर: अंतिम हिशोब' },
  'life.step.snags': { en: 'Closing the last snags', hi: 'आखिरी कमियाँ ठीक करना', mr: 'शेवटच्या त्रुटी दुरुस्त करणे' },
  'life.step.sign_off': { en: 'You sign off the handover', hi: 'आप हैंडओवर पर साइन-ऑफ़ करें', mr: 'तुम्ही हँडओव्हरवर साइन-ऑफ करा' },
  'life.step.warranty': { en: 'In warranty', hi: 'वारंटी में', mr: 'वॉरंटीमध्ये' },
  'life.step.closed': { en: 'Project closed', hi: 'प्रोजेक्ट बंद', mr: 'प्रोजेक्ट बंद' },
  'life.step.stage': { en: 'Work on site', hi: 'साइट पर काम', mr: 'साइटवर काम' },
  'life.block.pay': { en: 'Pay the {label} {amount}', hi: '{label} का भुगतान करें {amount}', mr: '{label} भरा {amount}' },
  'life.block.payFinal': { en: 'Pay the final payment {amount}', hi: 'अंतिम भुगतान करें {amount}', mr: 'अंतिम रक्कम भरा {amount}' },
  'life.block.confirm_payment': { en: 'Confirm the payment your studio recorded', hi: 'स्टूडियो का दर्ज किया भुगतान पक्का करें', mr: 'स्टुडिओने नोंदवलेले पेमेंट निश्चित करा' },
  'life.block.answer_drawing': { en: 'Answer the {label}', hi: '{label} पर जवाब दें', mr: '{label} वर उत्तर द्या' },
  'life.block.your_step': { en: 'Your step: {label}', hi: 'आपका काम: {label}', mr: 'तुमचे काम: {label}' },
  'life.block.decide': { en: 'Choose: {label}', hi: 'चुनें: {label}', mr: 'निवडा: {label}' },
  'life.block.confirm_snag': { en: 'Confirm the snag is fixed', hi: 'पक्का करें कि कमी ठीक हो गई', mr: 'त्रुटी दुरुस्त झाली याची खात्री करा' },
  'life.block.confirm_snags': { en: 'Confirm {n} snags are fixed', hi: 'पक्का करें कि {n} कमियाँ ठीक हो गईं', mr: '{n} त्रुटी दुरुस्त झाल्याची खात्री करा' },
  'life.block.sign_off': { en: 'Sign off your handover', hi: 'अपने हैंडओवर पर साइन-ऑफ़ करें', mr: 'तुमच्या हँडओव्हरवर साइन-ऑफ करा' },
  'life.doing.design': { en: '{studio} is working on your design.', hi: '{studio} आपके डिज़ाइन पर काम कर रहा है।', mr: '{studio} तुमच्या डिझाइनवर काम करत आहे.' },
  'life.doing.site': { en: '{studio} is working on site.', hi: '{studio} साइट पर काम कर रहा है।', mr: '{studio} साइटवर काम करत आहे.' },
  'life.doing.closure': { en: '{studio} is working out the final account.', hi: '{studio} अंतिम हिसाब बना रहा है।', mr: '{studio} अंतिम हिशोब तयार करत आहे.' },
  'life.doing.snags': { en: '{studio} is fixing the open snags.', hi: '{studio} बची कमियाँ ठीक कर रहा है।', mr: '{studio} उरलेल्या त्रुटी दुरुस्त करत आहे.' },
  'life.doing.warranty': { en: 'Raise a snag if anything goes wrong.', hi: 'कुछ भी गड़बड़ हो तो कमी दर्ज करें।', mr: 'काही बिघडले तर त्रुटी नोंदवा.' },
  'life.doing.closed': { en: 'Your project is complete.', hi: 'आपका प्रोजेक्ट पूरा हो गया।', mr: 'तुमचा प्रोजेक्ट पूर्ण झाला.' },
  'life.warrantyUntil': { en: 'In warranty until {date}', hi: '{date} तक वारंटी में', mr: '{date} पर्यंत वॉरंटीमध्ये' },
  'life.warrantyEnded': { en: 'Warranty ended on {date}', hi: 'वारंटी {date} को खत्म हुई', mr: 'वॉरंटी {date} ला संपली' },
  'life.signoff.title': { en: 'Sign off your handover', hi: 'अपने हैंडओवर पर साइन-ऑफ़ करें', mr: 'तुमच्या हँडओव्हरवर साइन-ऑफ करा' },
  'life.signoff.body': {
    en: 'There are no open snags. Signing off says your home is handed over as agreed; your warranty starts today.',
    hi: 'कोई कमी बाकी नहीं है। साइन-ऑफ़ का मतलब है कि आपका घर तय के अनुसार सौंप दिया गया; आपकी वारंटी आज से शुरू होती है।',
    mr: 'कोणतीही त्रुटी उरलेली नाही. साइन-ऑफ म्हणजे तुमचे घर ठरल्याप्रमाणे सोपवले गेले; तुमची वॉरंटी आजपासून सुरू होते.',
  },
  'life.signoff.button': { en: 'Sign off the handover', hi: 'हैंडओवर पर साइन-ऑफ़ करें', mr: 'हँडओव्हरवर साइन-ऑफ करा' },
  'life.signoff.done': { en: 'Signed off. Your warranty runs until {date}.', hi: 'साइन-ऑफ़ हो गया। आपकी वारंटी {date} तक है।', mr: 'साइन-ऑफ झाले. तुमची वॉरंटी {date} पर्यंत आहे.' },
  'life.signoff.failed': { en: 'Could not sign off. Try again.', hi: 'साइन-ऑफ़ नहीं हो सका। फिर कोशिश करें।', mr: 'साइन-ऑफ झाले नाही. पुन्हा प्रयत्न करा.' },
  'life.warrantySnag': { en: 'Warranty', hi: 'वारंटी', mr: 'वॉरंटी' },
} satisfies Record<string, Entry>;

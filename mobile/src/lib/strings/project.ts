import type { Entry } from './entry';

/** The project screen's words, English, Hindi and Marathi (first draft: Sanyam reviews). */
export const project = {
  'project.title': { en: 'Your project', hi: 'आपका प्रोजेक्ट', mr: 'तुमचा प्रोजेक्ट' },
  'project.since': { en: '{studio}, since {date}', hi: '{studio}, {date} से', mr: '{studio}, {date} पासून' },
  'project.none.body': {
    en: 'The timeline appears here the day you sign with a studio.',
    hi: 'जिस दिन आप किसी स्टूडियो के साथ साइन करेंगे, उसी दिन से पूरा टाइमलाइन यहाँ दिखेगा।',
    mr: 'ज्या दिवशी तुम्ही एखाद्या स्टुडिओसोबत सही कराल, त्या दिवसापासून संपूर्ण टाइमलाइन इथे दिसेल.',
  },
  'project.none.title': { en: 'Nothing started yet.', hi: 'अभी कुछ शुरू नहीं हुआ है।', mr: 'अजून काही सुरू झालेले नाही.' },

  'project.overall': { en: 'Overall', hi: 'कुल मिलाकर', mr: 'एकूण' },
  'project.daysLate': { en: '{n} days late', hi: '{n} दिन देरी', mr: '{n} दिवस उशीर' },
  'project.dayLate': { en: '1 day late', hi: '1 दिन देरी', mr: '1 दिवस उशीर' },
  'project.onTime': { en: 'On time', hi: 'समय पर', mr: 'वेळेवर' },
  'project.paid': { en: 'Paid', hi: 'भुगतान हुआ', mr: 'भरलेले' },
  'project.paidOf': { en: 'of {total}', hi: '{total} में से', mr: '{total} पैकी' },
  'project.handover': { en: 'Handover', hi: 'हैंडओवर', mr: 'हँडओव्हर' },

  'project.snags': { en: 'Snags', hi: 'कमियाँ', mr: 'त्रुटी' },
  'project.snagsCount': { en: '{open} open · {fixed} fixed', hi: '{open} बाकी · {fixed} ठीक हुईं', mr: '{open} बाकी · {fixed} दुरुस्त' },
  'project.snagsNone': { en: 'Nothing raised yet', hi: 'अभी कुछ नहीं बताया गया', mr: 'अजून काही नोंदवलेले नाही' },
  'project.decision': { en: 'Your decision', hi: 'आपका फ़ैसला', mr: 'तुमचा निर्णय' },
  'project.decisionDue': { en: '{title} · due {day}', hi: '{title} · {day} तक', mr: '{title} · {day} पर्यंत' },
  'project.decisionChosen': { en: '{title} · chosen', hi: '{title} · चुन लिया', mr: '{title} · निवडले' },
  'project.decisionNone': { en: 'Nothing waiting on you', hi: 'अभी आपसे कुछ नहीं चाहिए', mr: 'सध्या तुमच्याकडून काही हवे नाही' },
  'project.decisions': { en: 'Decisions', hi: 'फ़ैसले', mr: 'निर्णय' },

  'project.stages': { en: 'Stages', hi: 'चरण', mr: 'टप्पे' },
  'project.stageNow': { en: '{stage}, now', hi: '{stage}, अभी चल रहा है', mr: '{stage}, सध्या सुरू' },
  'project.plannedDone': { en: 'Planned {date}, done', hi: '{date} तय था, पूरा हुआ', mr: '{date} ठरले होते, पूर्ण झाले' },
  'project.planned': { en: 'Planned {date}', hi: '{date} तय है', mr: '{date} ठरले आहे' },
  'project.dueOnTrack': { en: 'Due {date}, on track', hi: '{date} तक, समय पर चल रहा है', mr: '{date} पर्यंत, वेळेत सुरू आहे' },
  'project.dueLate': { en: 'Due {date}, running late', hi: '{date} तक था, देरी से चल रहा है', mr: '{date} पर्यंत होते, उशिराने सुरू आहे' },
  'project.late.eyebrow': { en: 'Past its date', hi: 'तारीख निकल गई', mr: 'तारीख उलटून गेली' },
  'project.late.body': {
    en: 'Planned for {date} and not marked done yet. Your expert is following it up.',
    hi: '{date} के लिए तय था और अभी पूरा नहीं हुआ। आपकी एक्सपर्ट इस पर नज़र रख रही हैं।',
    mr: '{date} साठी ठरले होते आणि अजून पूर्ण झालेले नाही. तुमच्या एक्सपर्ट याचा पाठपुरावा करत आहेत.',
  },
  'project.lateDone.eyebrow': { en: 'Finished late', hi: 'देरी से पूरा हुआ', mr: 'उशिरा पूर्ण झाले' },
  'project.lateDone.body': {
    en: 'This stage finished after its planned date of {date}.',
    hi: 'यह चरण अपनी तय तारीख {date} के बाद पूरा हुआ।',
    mr: 'हा टप्पा ठरलेल्या {date} तारखेनंतर पूर्ण झाला.',
  },
  'project.chooseLink': { en: 'Choose: {title}', hi: 'चुनिए: {title}', mr: 'निवडा: {title}' },
  'project.footnote': {
    en: 'Your expert checks each stage against site photos before it shows as done.',
    hi: 'हर चरण को “पूरा” दिखाने से पहले आपकी एक्सपर्ट साइट की फ़ोटो से उसकी जाँच करती हैं।',
    mr: 'प्रत्येक टप्पा “पूर्ण” दाखवण्याआधी तुमच्या एक्सपर्ट साइटच्या फोटोंवरून तो तपासतात.',
  },

  'project.payments': { en: 'Payments', hi: 'भुगतान', mr: 'पेमेंट' },
  'project.paymentPlan': { en: 'Payment plan', hi: 'भुगतान की योजना', mr: 'पेमेंटची योजना' },
  'project.youPay': { en: 'You pay the studio', hi: 'भुगतान सीधे स्टूडियो को', mr: 'पेमेंट थेट स्टुडिओला' },
  'project.payPaid': { en: 'Paid {date}', hi: '{date} को भुगतान हुआ', mr: '{date} रोजी भरले' },
  'project.payDue': { en: 'Due {date}', hi: '{date} तक देना है', mr: '{date} पर्यंत भरायचे' },
  'project.payNext': { en: 'Next · the studio sets the date', hi: 'अगला · तारीख स्टूडियो तय करेगा', mr: 'पुढचे · तारीख स्टुडिओ ठरवेल' },
  'project.payLater': { en: 'Later', hi: 'बाद में', mr: 'नंतर' },
  'project.payNote': {
    en: 'You pay the studio directly. Every payment and receipt is kept in your Home locker.',
    hi: 'आप सीधे स्टूडियो को भुगतान करते हैं। हर भुगतान और रसीद आपके होम लॉकर में रखी जाती है।',
    mr: 'तुम्ही थेट स्टुडिओला पैसे देता. प्रत्येक पेमेंट आणि पावती तुमच्या होम लॉकरमध्ये ठेवली जाते.',
  },
  'project.changes': { en: 'Changes so far', hi: 'अब तक के बदलाव', mr: 'आतापर्यंतचे बदल' },
  'project.changesOne': { en: '+{amount} from 1 decision', hi: '1 फ़ैसले से +{amount}', mr: '1 निर्णयामुळे +{amount}' },
  'project.changesMany': { en: '+{amount} across {n} decisions', hi: '{n} फ़ैसलों से +{amount}', mr: '{n} निर्णयांमुळे +{amount}' },
  'project.changesNone': { en: 'Nothing added to your quote', hi: 'आपके कोटेशन में कुछ नहीं जुड़ा', mr: 'तुमच्या कोटेशनमध्ये काही वाढलेले नाही' },
} satisfies Record<string, Entry>;

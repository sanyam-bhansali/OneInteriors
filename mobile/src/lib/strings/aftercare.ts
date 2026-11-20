import type { Entry } from './entry';

/**
 * Warranty and service after the handover (owner, 20 Nov 2026;
 * docs/studio-os/AFTERCARE.md). English, Hindi and Marathi (first draft:
 * Sanyam reviews). The server's own sentences (the payment gate, "not
 * covered", the coverage areas) come in English, as the snag lines do.
 */
export const aftercareWords = {
  'after.eyebrow': { en: 'After your handover', hi: 'हैंडओवर के बाद', mr: 'हँडओव्हरनंतर' },
  'after.title': { en: 'Warranty and service', hi: 'वॉरंटी और सर्विस', mr: 'वॉरंटी आणि सर्व्हिस' },
  'after.link': { en: 'Warranty claim or service visit', hi: 'वॉरंटी क्लेम या सर्विस विज़िट', mr: 'वॉरंटी क्लेम किंवा सर्व्हिस भेट' },
  'after.tabWarranty': { en: 'Warranty claim', hi: 'वॉरंटी क्लेम', mr: 'वॉरंटी क्लेम' },
  'after.tabService': { en: 'Service visit', hi: 'सर्विस विज़िट', mr: 'सर्व्हिस भेट' },
  'after.warrantyIntro': {
    en: 'Your warranty covers manufacturing defects in your modular woodwork. Tell us what is wrong and add photos; we check it straight away.',
    hi: 'आपकी वॉरंटी मॉड्यूलर वुडवर्क में निर्माण की खराबी को कवर करती है। बताइए क्या गलत है और फ़ोटो जोड़िए; हम तुरंत जाँचते हैं।',
    mr: 'तुमची वॉरंटी मॉड्युलर वुडवर्कमधील उत्पादन दोष कव्हर करते. काय चुकले ते सांगा आणि फोटो जोडा; आम्ही लगेच तपासतो.',
  },
  'after.area': { en: 'What is it about', hi: 'यह किस बारे में है', mr: 'हे कशाबद्दल आहे' },
  'after.what': { en: 'What is wrong', hi: 'क्या गलत है', mr: 'काय चुकले आहे' },
  'after.whatHint': { en: 'The kitchen drawer next to the hob does not close', hi: 'हॉब के पास वाला किचन ड्रॉअर बंद नहीं होता', mr: 'हॉबजवळचा किचन ड्रॉवर बंद होत नाही' },
  'after.addPhoto': { en: 'Add a photo', hi: 'फ़ोटो जोड़ें', mr: 'फोटो जोडा' },
  'after.photos': { en: '{n} of 4 photos', hi: '4 में से {n} फ़ोटो', mr: '4 पैकी {n} फोटो' },
  'after.raise': { en: 'Raise warranty claim', hi: 'वॉरंटी क्लेम करें', mr: 'वॉरंटी क्लेम करा' },
  'after.raiseReason': { en: 'Pick what it is about, say what is wrong and add a photo', hi: 'चुनें, बताइए और एक फ़ोटो जोड़िए', mr: 'निवडा, सांगा आणि एक फोटो जोडा' },
  'after.toService': { en: 'Book a service visit', hi: 'सर्विस विज़िट बुक करें', mr: 'सर्व्हिस भेट बुक करा' },
  'after.serviceIntro': {
    en: 'Each kind of visit has a fixed visiting charge. Pick a slot and pay it; the visit is booked once it is paid.',
    hi: 'हर तरह की विज़िट का तय विज़िटिंग चार्ज है। स्लॉट चुनें और भुगतान करें; भुगतान होते ही विज़िट बुक हो जाती है।',
    mr: 'प्रत्येक प्रकारच्या भेटीचा ठरलेला व्हिजिटिंग चार्ज आहे. स्लॉट निवडा आणि पैसे भरा; पैसे भरल्यावर भेट बुक होते.',
  },
  'after.kind': { en: 'Kind of work', hi: 'काम का प्रकार', mr: 'कामाचा प्रकार' },
  'after.needs': { en: 'What needs doing', hi: 'क्या करना है', mr: 'काय करायचे आहे' },
  'after.needsHint': { en: 'The LED strip in the wardrobe stopped working', hi: 'वॉर्डरोब की LED पट्टी बंद हो गई', mr: 'वॉर्डरोबमधील LED पट्टी बंद पडली' },
  'after.day': { en: 'Day', hi: 'दिन', mr: 'दिवस' },
  'after.time': { en: 'Time', hi: 'समय', mr: 'वेळ' },
  'after.full': { en: 'full', hi: 'भरा', mr: 'भरलेले' },
  'after.pay': { en: 'Pay {amount} and book', hi: '{amount} भरें और बुक करें', mr: '{amount} भरा आणि बुक करा' },
  'after.payReason': { en: 'Pick the work, say what needs doing and pick a time', hi: 'काम चुनें, बताइए और समय चुनें', mr: 'काम निवडा, सांगा आणि वेळ निवडा' },
  'after.noCharges': { en: '{studio} has not opened service visits yet.', hi: '{studio} ने अभी सर्विस विज़िट शुरू नहीं की हैं।', mr: '{studio} ने अजून सर्व्हिस भेटी सुरू केल्या नाहीत.' },
  'after.payOff': { en: 'Paying for a visit is not switched on yet.', hi: 'विज़िट का भुगतान अभी चालू नहीं है।', mr: 'भेटीचे पैसे भरणे अजून सुरू नाही.' },
  'after.paid': { en: 'Back from payment. If it went through, your visit shows as booked below.', hi: 'भुगतान से वापस। भुगतान हुआ हो तो विज़िट नीचे बुक दिखेगी।', mr: 'पेमेंटवरून परत. पैसे भरले असल्यास भेट खाली बुक दिसेल.' },
  'after.visits': { en: 'Your visits', hi: 'आपकी विज़िट', mr: 'तुमच्या भेटी' },
  'after.claims': { en: 'Your warranty claims', hi: 'आपके वॉरंटी क्लेम', mr: 'तुमचे वॉरंटी क्लेम' },
  'after.held': { en: 'Waiting for payment', hi: 'भुगतान बाकी', mr: 'पेमेंट बाकी' },
  'after.booked': { en: 'Booked', hi: 'बुक', mr: 'बुक' },
  'after.expired': { en: 'Not paid in time', hi: 'समय पर भुगतान नहीं हुआ', mr: 'वेळेत पैसे भरले नाहीत' },
  'after.cancelled': { en: 'Cancelled', hi: 'रद्द', mr: 'रद्द' },
  'after.done': { en: 'Done', hi: 'पूरी हुई', mr: 'पूर्ण' },
  'after.refunded': { en: 'refunded', hi: 'रिफ़ंड हुआ', mr: 'परतावा झाला' },
  'after.payNow': { en: 'Pay {amount}', hi: '{amount} भरें', mr: '{amount} भरा' },
  'after.covered': { en: 'Covered, raised as a snag', hi: 'वॉरंटी में, कमी के रूप में दर्ज', mr: 'वॉरंटीत, त्रुटी म्हणून नोंद' },
  'after.notCovered': { en: 'Not covered', hi: 'वॉरंटी में नहीं', mr: 'वॉरंटीत नाही' },
  'after.free': { en: 'Free', hi: 'मुफ़्त', mr: 'मोफत' },
  'after.freeIntro': {
    en: 'Your first service visit is free when you book it within 30 days of the handover. Pick a slot and book.',
    hi: 'हैंडओवर के 30 दिनों के अंदर बुक करने पर पहली सर्विस विज़िट मुफ़्त है। स्लॉट चुनें और बुक करें।',
    mr: 'हँडओव्हरनंतर 30 दिवसांत बुक केल्यास पहिली सर्व्हिस भेट मोफत आहे. स्लॉट निवडा आणि बुक करा.',
  },
  'after.bookFree': { en: 'Book free visit', hi: 'मुफ़्त विज़िट बुक करें', mr: 'मोफत भेट बुक करा' },
  'after.bookedFree': {
    en: 'Booked: {when}. Your free visit after the handover.',
    hi: 'बुक हो गई: {when}। हैंडओवर के बाद आपकी मुफ़्त विज़िट।',
    mr: 'बुक झाली: {when}. हँडओव्हरनंतरची तुमची मोफत भेट.',
  },
  'after.closed': { en: 'Not open for your project yet.', hi: 'आपके प्रोजेक्ट के लिए अभी खुला नहीं है।', mr: 'तुमच्या प्रोजेक्टसाठी अजून सुरू नाही.' },
} satisfies Record<string, Entry>;

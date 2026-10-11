import type { Entry } from './entry';

/**
 * Words for the quote part of the first visit: Phone (#12), Quote (#13),
 * Compare (#14) and the expert call (#15). The Phone screen also reuses the
 * website's `verify.*` words from i18n-dict.ts. Lines marked MUST NOT DRIFT
 * carry promises (COPY-AND-LANGUAGES.md). Hindi and Marathi are a first
 * draft: Sanyam reviews. No WhatsApp anywhere: customers never get it.
 */
export const quoteWords = {
  // Phone and consent (#12)
  'phone.code': { en: '6-digit code', hi: '6 अंकों का कोड', mr: '6 अंकी कोड' },
  'phone.send': { en: 'Send me a code', hi: 'मुझे कोड भेजें', mr: 'मला कोड पाठवा' },
  'phone.needSend': { en: 'Send yourself a code first', hi: 'पहले अपने नंबर पर कोड भेजें', mr: 'आधी तुमच्या नंबरवर कोड पाठवा' },
  'phone.offers': {
    en: 'Send me tips and offers by email and in the app (optional)',
    hi: 'मुझे ईमेल और ऐप में टिप्स और ऑफ़र भी भेजें (ज़रूरी नहीं)',
    mr: 'मला ईमेल आणि ॲपमध्ये टिप्स आणि ऑफरही पाठवा (ऐच्छिक)',
  },
  'phone.privacyHint': { en: 'Opens the privacy policy', hi: 'प्राइवेसी पॉलिसी खोलता है', mr: 'प्रायव्हसी पॉलिसी उघडते' },

  // Quote (#13)
  'quoteApp.meta': { en: 'First quotes · {n} studios', hi: 'पहले कोटेशन · {n} स्टूडियो', mr: 'पहिली कोटेशन · {n} स्टुडिओ' },
  'quoteApp.metaOne': { en: 'First quote · 1 studio', hi: 'पहला कोटेशन · 1 स्टूडियो', mr: 'पहिले कोटेशन · 1 स्टुडिओ' },
  'quoteApp.h1': { en: 'A quote you can actually read.', hi: 'ऐसा कोटेशन जिसे आप सच में पढ़ सकें।', mr: 'खरंच वाचता येईल असे कोटेशन.' },
  // MUST NOT DRIFT: quoteApp.first + quoteApp.final together are the promised line.
  'quoteApp.first': {
    en: 'First quote, from each studio’s own rate card.',
    hi: 'पहला कोटेशन, हर स्टूडियो के अपने रेट कार्ड से।',
    mr: 'पहिले कोटेशन, प्रत्येक स्टुडिओच्या स्वतःच्या रेट कार्डवरून.',
  },
  'quoteApp.final': {
    en: 'Final price comes after they measure your flat. It usually moves by less than 5%.',
    hi: 'आख़िरी कीमत आपके फ़्लैट का नाप लेने के बाद आती है। यह आमतौर पर 5% से कम बदलती है।',
    mr: 'अंतिम किंमत तुमच्या फ्लॅटचे मोजमाप घेतल्यानंतर येते. ती साधारणपणे 5% पेक्षा कमी बदलते.',
  },
  'quoteApp.valid': { en: 'Valid till {date}.', hi: '{date} तक मान्य।', mr: '{date} पर्यंत वैध.' },
  'quoteApp.band': {
    en: 'Measured on site, the total lands between {low} and {high}.',
    hi: 'साइट पर नाप के बाद कुल रकम {low} और {high} के बीच आती है।',
    mr: 'साइटवर मोजमाप झाल्यावर एकूण रक्कम {low} ते {high} दरम्यान येते.',
  },
  'quoteApp.studios': { en: 'Studios', hi: 'स्टूडियो', mr: 'स्टुडिओ' },
  'quoteApp.lines': { en: '{n} lines', hi: '{n} लाइनें', mr: '{n} ओळी' },
  'quoteApp.line': { en: '1 line', hi: '1 लाइन', mr: '1 ओळ' },
  'quoteApp.total': { en: 'Total for all {n} lines', hi: 'सभी {n} लाइनों का कुल', mr: 'सर्व {n} ओळींची एकूण रक्कम' },
  // MUST NOT DRIFT
  'quoteApp.included': {
    en: 'GST, labour and installation included. No hidden charges.',
    hi: 'GST, मज़दूरी और इंस्टॉलेशन शामिल। कोई छिपा हुआ चार्ज नहीं।',
    mr: 'GST, मजुरी आणि इन्स्टॉलेशन समाविष्ट. कोणतेही लपलेले शुल्क नाही.',
  },
  // MUST NOT DRIFT (changes if the paid plan's fee is ever added to quotes; see DECISIONS.md)
  'quoteApp.ownCard': {
    en: 'Priced from each studio’s own rate card. One Interiors adds nothing on top.',
    hi: 'हर स्टूडियो के अपने रेट कार्ड से। One Interiors ऊपर से कुछ नहीं जोड़ता।',
    mr: 'प्रत्येक स्टुडिओच्या स्वतःच्या रेट कार्डवरून. One Interiors वरून काहीही जोडत नाही.',
  },
  'quoteApp.preLaunch': {
    en: 'Pre-launch rates: not yet each studio’s own.',
    hi: 'लॉन्च से पहले के रेट: अभी हर स्टूडियो के अपने नहीं।',
    mr: 'लाँचपूर्वीचे दर: अजून प्रत्येक स्टुडिओचे स्वतःचे नाहीत.',
  },
  'quoteApp.geio': { en: 'Not sure what a line means? Ask GEIO', hi: 'किसी लाइन का मतलब नहीं समझे? GEIO से पूछें', mr: 'एखाद्या ओळीचा अर्थ कळला नाही? GEIO ला विचारा' },
  'quoteApp.compare': { en: 'Compare all {n}, row by row', hi: 'सभी {n} की लाइन-दर-लाइन तुलना करें', mr: 'सर्व {n} ची ओळीनुसार तुलना करा' },
  'quoteApp.none.h1': { en: 'Your quotes come from your answers.', hi: 'आपके कोटेशन आपके जवाबों से बनते हैं।', mr: 'तुमची कोटेशन तुमच्या उत्तरांवरून तयार होतात.' },
  'quoteApp.none.sub': {
    en: 'Finish the seven questions and the three studios that fit price the same lines for you.',
    hi: 'सातों सवाल पूरे कीजिए, फिर आपके लिए सही तीन स्टूडियो वही लाइनें प्राइस करेंगे।',
    mr: 'सातही प्रश्न पूर्ण करा, मग तुम्हाला जुळणारे तीन स्टुडिओ त्याच ओळींची किंमत देतील.',
  },
  'quoteApp.none.cta': { en: 'Start the brief', hi: 'ब्रीफ़ शुरू करें', mr: 'ब्रीफ सुरू करा' },
  'quoteApp.retry': { en: 'Try again', hi: 'फिर से कोशिश करें', mr: 'पुन्हा प्रयत्न करा' },

  // Compare (#14)
  'compare.meta': { en: 'Same lines, same units', hi: 'वही लाइनें, वही यूनिट', mr: 'त्याच ओळी, तीच एकके' },
  'compare.h1': { en: 'In plain words', hi: 'सीधे शब्दों में', mr: 'सोप्या शब्दांत' },
  'compare.total': { en: 'Total', hi: 'कुल', mr: 'एकूण' },
  'compare.board': { en: 'Wardrobe board', hi: 'वॉर्डरोब बोर्ड', mr: 'वॉर्डरोब बोर्ड' },
  'compare.shutter': { en: 'Kitchen shutter', hi: 'किचन शटर', mr: 'किचन शटर' },
  'compare.counter': { en: 'Kitchen counter', hi: 'किचन काउंटर', mr: 'किचन काउंटर' },
  'compare.weeks': { en: 'Time to handover', hi: 'हैंडओवर तक का समय', mr: 'हँडओव्हरपर्यंतचा वेळ' },
  'compare.weeksN': { en: '{n} weeks', hi: '{n} हफ़्ते', mr: '{n} आठवडे' },
  'compare.late': { en: 'Usually late by', hi: 'आमतौर पर इतनी देर', mr: 'साधारणपणे इतका उशीर' },
  'compare.lateN': { en: '{n} days', hi: '{n} दिन', mr: '{n} दिवस' },
  'compare.lateOne': { en: '1 day', hi: '1 दिन', mr: '1 दिवस' },
  'compare.onTime': { en: 'On time', hi: 'समय पर', mr: 'वेळेवर' },
  'compare.early': { en: '{n} days early', hi: '{n} दिन पहले', mr: '{n} दिवस आधी' },
  'compare.noData': { en: 'Not enough data yet', hi: 'अभी पूरा डेटा नहीं', mr: 'अजून पुरेसा डेटा नाही' },
  'compare.noRecord': { en: 'No record', hi: 'कोई रिकॉर्ड नहीं', mr: 'रेकॉर्ड नाही' },
  'compare.checks': { en: 'Checks passed', hi: 'पास हुई जाँचें', mr: 'पास झालेल्या तपासण्या' },
  'compare.differs': { en: '{value}, differs from the others', hi: '{value}, बाकियों से अलग', mr: '{value}, इतरांपेक्षा वेगळे' },
  'compare.preLaunch': {
    en: 'Pre-launch: these totals use archive rates, not yet each studio’s own.',
    hi: 'लॉन्च से पहले: ये कुल रकम पुराने रेट से हैं, अभी हर स्टूडियो के अपने नहीं।',
    mr: 'लाँचपूर्वी: या एकूण रकमा जुन्या दरांवरून आहेत, अजून प्रत्येक स्टुडिओच्या स्वतःच्या नाहीत.',
  },
  'compare.cta': { en: 'Talk it through with an expert', hi: 'किसी एक्सपर्ट से बात करें', mr: 'तज्ज्ञाशी बोलून ठरवा' },
  'compare.ctaNote': {
    en: 'Free, 30 minutes, no studio on the call',
    hi: 'मुफ़्त, 30 मिनट, कॉल पर कोई स्टूडियो नहीं',
    mr: 'मोफत, 30 मिनिटे, कॉलवर कोणताही स्टुडिओ नाही',
  },
  'compare.none.h1': { en: 'Nothing to compare yet.', hi: 'अभी तुलना के लिए कुछ नहीं।', mr: 'अजून तुलना करण्यासारखे काही नाही.' },
  'compare.none.sub': {
    en: 'A comparison needs at least two studios priced on your brief.',
    hi: 'तुलना के लिए आपके ब्रीफ़ पर कम से कम दो स्टूडियो के दाम चाहिए।',
    mr: 'तुलनेसाठी तुमच्या ब्रीफवर किमान दोन स्टुडिओंच्या किमती हव्यात.',
  },
  'compare.error': { en: 'We could not put the quotes side by side.', hi: 'हम कोटेशन साथ-साथ नहीं दिखा सके।', mr: 'आम्ही कोटेशन शेजारी-शेजारी दाखवू शकलो नाही.' },

  // Expert call (#15)
  'expert.meta': { en: 'Free, 30 minutes', hi: 'मुफ़्त, 30 मिनट', mr: 'मोफत, 30 मिनिटे' },
  // MUST NOT DRIFT: expert.h1 and expert.same
  'expert.h1': {
    en: 'Your expert is on our payroll. Never a studio’s.',
    hi: 'आपकी एक्सपर्ट हमारे पेरोल पर हैं। किसी स्टूडियो के नहीं।',
    mr: 'तुमच्या तज्ज्ञ आमच्या पेरोलवर आहेत. कोणत्याही स्टुडिओच्या नाहीत.',
  },
  'expert.reads': {
    en: '{name} reads your answers and all {n} quotes first.',
    hi: '{name} पहले आपके जवाब और सभी {n} कोटेशन पढ़ती हैं।',
    mr: '{name} आधी तुमची उत्तरे आणि सर्व {n} कोटेशन वाचतात.',
  },
  'expert.same': {
    en: 'She earns the same whichever studio you pick.',
    hi: 'आप कोई भी स्टूडियो चुनें, उनकी कमाई उतनी ही रहती है।',
    mr: 'तुम्ही कोणताही स्टुडिओ निवडा, त्यांची कमाई तेवढीच राहते.',
  },
  'expert.free': {
    en: 'This call is free for everyone. It never counts against a plan.',
    hi: 'यह कॉल सबके लिए मुफ़्त है। यह किसी प्लान में नहीं गिनी जाती।',
    mr: 'हा कॉल सर्वांसाठी मोफत आहे. तो कोणत्याही प्लॅनमध्ये मोजला जात नाही.',
  },
  'expert.day': { en: 'Pick a day', hi: 'दिन चुनें', mr: 'दिवस निवडा' },
  'expert.time': { en: 'Pick a time', hi: 'समय चुनें', mr: 'वेळ निवडा' },
  'expert.book': { en: 'Book {when}', hi: '{when} बुक करें', mr: '{when} बुक करा' },
  'expert.gone': {
    en: 'That time was just taken. Here are the times still open.',
    hi: 'वह समय अभी-अभी किसी और ने ले लिया। ये समय अभी खाली हैं।',
    mr: 'ती वेळ आत्ताच कोणीतरी घेतली. या वेळा अजून मोकळ्या आहेत.',
  },
  'expert.none.h': { en: 'No open times this week', hi: 'इस हफ़्ते कोई खाली समय नहीं', mr: 'या आठवड्यात मोकळी वेळ नाही' },
  'expert.none.sub': {
    en: 'Tell us when suits you and we will call to fix a time.',
    hi: 'बताइए आपको कब ठीक रहेगा, हम कॉल करके समय तय करेंगे।',
    mr: 'तुम्हाला कधी सोयीचे आहे ते सांगा, आम्ही कॉल करून वेळ ठरवू.',
  },
  'expert.none.cta': { en: 'Ask for a call', hi: 'कॉल के लिए कहें', mr: 'कॉलसाठी विनंती करा' },
  'expert.error': { en: 'We could not load the open times.', hi: 'हम खाली समय नहीं दिखा सके।', mr: 'आम्ही मोकळ्या वेळा दाखवू शकलो नाही.' },
  'expert.seeYou': { en: 'See you {when}.', hi: '{when} मिलते हैं।', mr: '{when} भेटू.' },
  'expert.calls': {
    en: '{name} reads your answers and all your quotes first, then calls you on {phone}.',
    hi: '{name} पहले आपके जवाब और सारे कोटेशन पढ़ेंगी, फिर आपको {phone} पर कॉल करेंगी।',
    mr: '{name} आधी तुमची उत्तरे आणि सर्व कोटेशन वाचतील, मग तुम्हाला {phone} वर कॉल करतील.',
  },
  'expert.callsNoPhone': {
    en: '{name} reads your answers and all your quotes first, then calls you.',
    hi: '{name} पहले आपके जवाब और सारे कोटेशन पढ़ेंगी, फिर आपको कॉल करेंगी।',
    mr: '{name} आधी तुमची उत्तरे आणि सर्व कोटेशन वाचतील, मग तुम्हाला कॉल करतील.',
  },
  'expert.next1': { en: 'Talk through the {n} quotes with {name}', hi: '{name} के साथ {n} कोटेशन पर बात करें', mr: '{name} यांच्यासोबत {n} कोटेशनवर बोला' },
  'expert.next1Any': { en: 'Talk through your quotes with {name}', hi: '{name} के साथ अपने कोटेशन पर बात करें', mr: '{name} यांच्यासोबत तुमच्या कोटेशनवर बोला' },
  'expert.next2': {
    en: 'Meet the studios you like, at their office or your flat',
    hi: 'पसंद के स्टूडियो से मिलें, उनके ऑफ़िस में या आपके फ़्लैट पर',
    mr: 'आवडलेल्या स्टुडिओंना भेटा, त्यांच्या ऑफिसमध्ये किंवा तुमच्या फ्लॅटवर',
  },
  'expert.next3': {
    en: 'See the final quote, sign, and watch your home come together here',
    hi: 'आख़िरी कोटेशन देखें, साइन करें, और अपना घर बनते हुए यहीं देखें',
    mr: 'अंतिम कोटेशन पाहा, सही करा, आणि तुमचे घर तयार होताना इथेच पाहा',
  },
  'expert.nextCta': { en: 'Next: meet your studios', hi: 'आगे: अपने स्टूडियो से मिलें', mr: 'पुढे: तुमच्या स्टुडिओंना भेटा' },
  'expert.booked': { en: 'Call booked', hi: 'कॉल बुक हो गई', mr: 'कॉल बुक झाला' },
} satisfies Record<string, Entry>;

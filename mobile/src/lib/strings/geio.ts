import type { Entry } from './entry';

/** The geio screen's words, English, Hindi and Marathi (first draft: Sanyam reviews). */
export const geio = {
  // Welcome (#30)
  'geioApp.greet.morning': { en: 'Good morning', hi: 'सुप्रभात', mr: 'शुभ सकाळ' },
  'geioApp.greet.afternoon': { en: 'Good afternoon', hi: 'नमस्ते', mr: 'नमस्कार' },
  'geioApp.greet.evening': { en: 'Good evening', hi: 'शुभ संध्या', mr: 'शुभ संध्याकाळ' },
  'geioApp.hello': { en: '{greet}, {name}.', hi: '{greet}, {name}।', mr: '{greet}, {name}.' },
  'geioApp.helloAlone': { en: '{greet}.', hi: '{greet}।', mr: '{greet}.' },
  'geioApp.ask': { en: "What's on your mind?", hi: 'आज क्या पूछना है?', mr: 'आज काय विचारायचे आहे?' },
  'geioApp.intro': {
    en: "I'm GEIO, your interior design expert. Ask me anything about your home.",
    hi: 'मैं GEIO हूँ, आपका इंटीरियर डिज़ाइन एक्सपर्ट। अपने घर के बारे में मुझसे कुछ भी पूछिए।',
    mr: 'मी GEIO, तुमचा इंटिरियर डिझाइन तज्ज्ञ. तुमच्या घराबद्दल मला काहीही विचारा.',
  },
  'geioApp.langs': { en: 'Languages GEIO speaks', hi: 'GEIO की भाषाएँ', mr: 'GEIO च्या भाषा' },
  'geioApp.knows': { en: 'What GEIO knows about your home', hi: 'GEIO आपके घर के बारे में क्या जानता है', mr: 'GEIO ला तुमच्या घराबद्दल काय माहीत आहे' },
  'geioApp.fact.now': { en: 'Now: {stage}', hi: 'अभी: {stage}', mr: 'आता: {stage}' },
  'geioApp.suggestions': { en: 'Suggestions', hi: 'सुझाव', mr: 'सुचवलेले प्रश्न' },
  'geioApp.s.site': { en: "What's happening on site today?", hi: 'आज साइट पर क्या काम हो रहा है?', mr: 'आज साइटवर काय काम चालू आहे?' },
  'geioApp.s.decision': { en: 'What do I need to decide next?', hi: 'अगला फ़ैसला मुझे किस बात का लेना है?', mr: 'पुढचा निर्णय मला कशाचा घ्यायचा आहे?' },
  'geioApp.s.handover': { en: 'What should I check at handover?', hi: 'हैंडओवर के समय मुझे क्या-क्या देखना चाहिए?', mr: 'हँडओव्हरच्या वेळी मी काय काय तपासावे?' },
  'geioApp.s.term': { en: 'What does BWP ply in my quote mean?', hi: 'मेरे कोटेशन में BWP प्लाई का क्या मतलब है?', mr: 'माझ्या कोटेशनमधील BWP प्लाय म्हणजे काय?' },

  // Composer
  'geioApp.placeholder': { en: 'Ask in English, हिंदी or मराठी', hi: 'English, हिंदी या मराठी में पूछें', mr: 'English, हिंदी किंवा मराठीत विचारा' },
  'geioApp.placeholderMore': { en: 'Ask GEIO anything', hi: 'GEIO से कुछ भी पूछें', mr: 'GEIO ला काहीही विचारा' },
  'geioApp.input': { en: 'Message GEIO', hi: 'GEIO को लिखें', mr: 'GEIO ला लिहा' },
  'geioApp.send': { en: 'Send', hi: 'भेजें', mr: 'पाठवा' },
  'geioApp.disclaimer': {
    en: 'GEIO can make mistakes. Prices and dates are confirmed by your studio.',
    hi: 'GEIO से गलती हो सकती है। कीमत और तारीख़ आपका स्टूडियो पक्की करता है।',
    mr: 'GEIO कडून चूक होऊ शकते. किंमत आणि तारखा तुमचा स्टुडिओ निश्चित करतो.',
  },
  'geioApp.startOver': { en: 'Start a new conversation', hi: 'नई बातचीत शुरू करें', mr: 'नवीन संभाषण सुरू करा' },
  'geioApp.talkTo': { en: 'Talk to {expert}, your expert', hi: '{expert} से बात करें, आपकी एक्सपर्ट', mr: '{expert} शी बोला, तुमच्या तज्ज्ञ' },
  'geioApp.askExpert': { en: "I'd like to talk to {expert}, my expert.", hi: 'मुझे अपनी एक्सपर्ट {expert} से बात करनी है।', mr: 'मला माझ्या तज्ज्ञ {expert} शी बोलायचे आहे.' },

  // Chat (#31)
  'geioApp.reading': { en: 'Reading your project…', hi: 'आपका प्रोजेक्ट पढ़ रहा हूँ…', mr: 'तुमचा प्रोजेक्ट वाचत आहे…' },
  'geioApp.follow': { en: 'Ask next', hi: 'आगे पूछें', mr: 'पुढे विचारा' },
  'geioApp.next.by': { en: 'Your next step, by {date}', hi: 'आपका अगला कदम, {date} तक', mr: 'तुमची पुढची पायरी, {date} पर्यंत' },
  'geioApp.next.open': { en: 'Open this decision', hi: 'यह फ़ैसला खोलें', mr: 'हा निर्णय उघडा' },
  'geioApp.sources': { en: 'From your signed quote', hi: 'आपके साइन किए कोटेशन से', mr: 'तुमच्या सही केलेल्या कोटेशनमधून' },
  'geioApp.source.line': { en: 'Line {line}', hi: 'लाइन {line}', mr: 'ओळ {line}' },
  'geioApp.see': { en: 'What I see', hi: 'मुझे क्या दिख रहा है', mr: 'मला काय दिसते' },
  'geioApp.watch': { en: 'Keep an eye on this', hi: 'इस पर नज़र रखें', mr: 'यावर लक्ष ठेवा' },

  // Hand-over (#33)
  'geioApp.handover.title': { en: '{expert} will pick this up', hi: '{expert} इसे देखेंगी', mr: '{expert} हे पाहतील' },
  'geioApp.handover.payroll': {
    en: "Your expert is on our payroll. Never a studio's.",
    hi: 'आपकी एक्सपर्ट हमारी कर्मचारी हैं, किसी स्टूडियो की नहीं।',
    mr: 'तुमच्या तज्ज्ञ आमच्या कर्मचारी आहेत, कोणत्याही स्टुडिओच्या नाहीत.',
  },
  'geioApp.handover.passed': { en: 'GEIO passed this to {expert}', hi: 'GEIO ने यह {expert} को भेज दिया', mr: 'GEIO ने हे {expert} कडे पाठवले' },

  // Errors: the question stays, so they can try again.
  'geioApp.err.busy': {
    en: 'That was a lot of questions at once. Wait a few minutes, then try again.',
    hi: 'एक साथ बहुत सारे सवाल हो गए। कुछ मिनट रुककर फिर पूछें।',
    mr: 'एकदम बरेच प्रश्न झाले. काही मिनिटे थांबून पुन्हा विचारा.',
  },
  'geioApp.err.unavailable': {
    en: 'GEIO is taking a short break. Try again in a little while, or talk to {expert}.',
    hi: 'GEIO अभी थोड़ा आराम कर रहा है। थोड़ी देर में फिर पूछें, या {expert} से बात करें।',
    mr: 'GEIO सध्या थोडी विश्रांती घेत आहे. थोड्या वेळाने पुन्हा विचारा, किंवा {expert} शी बोला.',
  },
  'geioApp.err.empty': { en: 'Type a question first.', hi: 'पहले अपना सवाल लिखें।', mr: 'आधी तुमचा प्रश्न लिहा.' },
  'geioApp.err.other': {
    en: 'We could not reach GEIO. Check your connection and try again.',
    hi: 'GEIO तक नहीं पहुँच पाए। अपना इंटरनेट देखें और फिर कोशिश करें।',
    mr: 'GEIO पर्यंत पोहोचता आले नाही. तुमचे इंटरनेट तपासा आणि पुन्हा प्रयत्न करा.',
  },
  'geioApp.retry': { en: 'Try again', hi: 'फिर से पूछें', mr: 'पुन्हा विचारा' },
} satisfies Record<string, Entry>;

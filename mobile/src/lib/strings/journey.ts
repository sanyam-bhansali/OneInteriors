import type { Entry } from './entry';

/**
 * The first-visit quiz (Name, Q1–Q7, Style DNA): only the words the
 * website's dictionary (../i18n-dict.ts: name.*, q1.*…q7.*, scope.*, tier.*,
 * prio.*, inv.*, style.*) does not already have. First draft: Sanyam reviews
 * the Hindi and Marathi.
 */
export const journey = {
  'quiz.name.need': { en: 'Type your first name to continue', hi: 'आगे बढ़ने के लिए अपना पहला नाम लिखिए', mr: 'पुढे जाण्यासाठी तुमचे पहिले नाव लिहा' },
  'quiz.pickOne': { en: 'Pick one to continue', hi: 'आगे बढ़ने के लिए एक चुनिए', mr: 'पुढे जाण्यासाठी एक निवडा' },
  'quiz.villa': { en: 'Villa / Row house', hi: 'विला / रो हाउस', mr: 'व्हिला / रो हाऊस' },
  'quiz.q1.need': { en: 'Pick your home type and area to continue', hi: 'आगे बढ़ने के लिए घर का प्रकार और इलाका चुनिए', mr: 'पुढे जाण्यासाठी घराचा प्रकार आणि परिसर निवडा' },
  'quiz.q1.areaPh': { en: 'For example 960', hi: 'जैसे 960', mr: 'उदा. 960' },
  'quiz.q1.less': { en: 'Show fewer areas', hi: 'कम इलाके दिखाइए', mr: 'कमी परिसर दाखवा' },
  'quiz.q2.needRooms': { en: 'Pick at least one room to continue', hi: 'आगे बढ़ने के लिए कम से कम एक कमरा चुनिए', mr: 'पुढे जाण्यासाठी किमान एक खोली निवडा' },
  'quiz.room.KITCHEN': { en: 'Kitchen', hi: 'किचन', mr: 'किचन' },
  'quiz.room.MASTER_BEDROOM': { en: 'Master bedroom', hi: 'मास्टर बेडरूम', mr: 'मास्टर बेडरूम' },
  'quiz.room.SECOND_BEDROOM': { en: 'Second bedroom', hi: 'दूसरा बेडरूम', mr: 'दुसरी बेडरूम' },
  'quiz.room.THIRD_BEDROOM': { en: 'Third bedroom', hi: 'तीसरा बेडरूम', mr: 'तिसरी बेडरूम' },
  'quiz.room.LIVING_DINING': { en: 'Living & dining', hi: 'लिविंग और डाइनिंग', mr: 'लिव्हिंग आणि डायनिंग' },
  'quiz.room.BATHROOMS': { en: 'Bathrooms', hi: 'बाथरूम', mr: 'बाथरूम' },
  'quiz.q4.more': { en: 'Pick {n} more to continue', hi: 'आगे बढ़ने के लिए {n} और चुनिए', mr: 'पुढे जाण्यासाठी आणखी {n} निवडा' },
  'quiz.q5.fewer': { en: 'One fewer: {x}', hi: 'एक कम: {x}', mr: 'एक कमी: {x}' },
  'quiz.q5.more': { en: 'One more: {x}', hi: 'एक और: {x}', mr: 'आणखी एक: {x}' },
  'quiz.q6.tapTop': { en: 'Tap your top priority', hi: 'सबसे ज़रूरी चीज़ पर टैप कीजिए', mr: 'सर्वात महत्त्वाच्या गोष्टीवर टॅप करा' },
  'quiz.q6.now': { en: 'Now your number {n}', hi: 'अब आपका नंबर {n}', mr: 'आता तुमचा क्रमांक {n}' },
  'quiz.q6.more': { en: 'Rank {n} more to continue', hi: 'आगे बढ़ने के लिए {n} और का क्रम दीजिए', mr: 'पुढे जाण्यासाठी आणखी {n} क्रमाने लावा' },
  'quiz.q6.ranking': { en: 'Your ranking', hi: 'आपका क्रम', mr: 'तुमचा क्रम' },
  'quiz.q6.left': { en: 'Still to rank', hi: 'अभी क्रम देना बाकी', mr: 'अजून क्रम लावायचे' },
  'quiz.style.card': { en: 'Your style DNA', hi: 'आपका स्टाइल DNA', mr: 'तुमचा स्टाइल DNA' },
  'quiz.style.lived': { en: 'Planned to be easy to live in with {list}.', hi: '{list} के साथ आराम से रहने लायक बनाया जाएगा।', mr: '{list} यांच्यासोबत आरामात राहता येईल असे नियोजन.' },
  'quiz.style.parent': { en: 'a parent at home', hi: 'घर पर माता-पिता', mr: 'घरी आई-वडील' },
  'quiz.style.parents': { en: 'parents at home', hi: 'घर पर बुज़ुर्ग', mr: 'घरी ज्येष्ठ' },
  'quiz.style.child': { en: 'a child', hi: 'एक बच्चा', mr: 'एक मूल' },
  'quiz.style.children': { en: 'children', hi: 'बच्चे', mr: 'मुले' },
  'quiz.style.pet': { en: 'a pet', hi: 'पालतू जानवर', mr: 'पाळीव प्राणी' },
  'quiz.style.wfh': { en: 'someone working from home', hi: 'घर से काम करने वाला कोई', mr: 'घरून काम करणारे कोणी' },
  'quiz.style.and': { en: 'and', hi: 'और', mr: 'आणि' },
  'quiz.style.none.h1': { en: 'Pick a style or two first.', hi: 'पहले एक-दो स्टाइल चुनिए।', mr: 'आधी एक-दोन स्टाइल निवडा.' },
  'quiz.style.none.sub': {
    en: 'Your style DNA is made from the rooms you liked.',
    hi: 'आपका स्टाइल DNA आपके पसंद किए कमरों से बनता है।',
    mr: 'तुमचा स्टाइल DNA तुम्हाला आवडलेल्या खोल्यांवरून बनतो.',
  },
  'quiz.style.none.cta': { en: 'Choose styles', hi: 'स्टाइल चुनिए', mr: 'स्टाइल निवडा' },
} satisfies Record<string, Entry>;

import type { Tx } from '@/modules/i18n/site';
import type { StudioRoleName } from '@/modules/studio/roles';

/**
 * The words of the role-picking sign-in (the owner's UI handoff,
 * StudioSignIn / StudioSignInWeb), in English, Hindi and Marathi. The
 * refusals and the code wording the page already had stay in
 * modules/i18n/studio.ts.
 *
 * FIRST DRAFT: the Hindi and Marathi need a native speaker's review, as the
 * rest of the studio words do.
 */
export const SI_WORDS = {
  'role.h1': { en: "Who's signing in?", hi: 'कौन साइन इन कर रहा है?', mr: 'कोण साइन इन करत आहे?' },
  'role.sub': {
    en: "Pick your role. You'll land straight on the apps you use, and nothing else.",
    hi: 'अपना काम चुनें। आप सीधे अपने ऐप पर पहुँचेंगे, और कुछ नहीं।',
    mr: 'तुमचे काम निवडा. तुम्ही थेट तुमच्या ॲप्सवर पोहोचाल, बाकी काही नाही.',
  },
  'role.group': { en: 'Your role', hi: 'आपका काम', mr: 'तुमचे काम' },
  'apps.SALES': { en: 'Leads, quotations, meetings', hi: 'लीड, कोटेशन, मीटिंग', mr: 'लीड, कोटेशन, मीटिंग' },
  'apps.DESIGNER': { en: 'Quotations, projects, vendors', hi: 'कोटेशन, प्रोजेक्ट, वेंडर', mr: 'कोटेशन, प्रोजेक्ट, वेंडर' },
  'apps.PM': { en: 'Sites, vendors, quotations', hi: 'साइट, वेंडर, कोटेशन', mr: 'साइट, वेंडर, कोटेशन' },
  'apps.OWNER': { en: 'Every app, team and money', hi: 'सभी ऐप, टीम और पैसे', mr: 'सर्व ॲप्स, टीम आणि पैसे' },
  'site.h': { en: 'On site today?', hi: 'आज साइट पर हैं?', mr: 'आज साइटवर आहात?' },
  'site.sub': {
    en: 'Site supervisors sign in with their mobile number',
    hi: 'साइट सुपरवाइज़र अपने मोबाइल नंबर से साइन इन करते हैं',
    mr: 'साइट सुपरवायझर त्यांच्या मोबाइल नंबरने साइन इन करतात',
  },
  'role.pick': { en: 'Pick your role to continue', hi: 'आगे बढ़ने के लिए काम चुनें', mr: 'पुढे जाण्यासाठी काम निवडा' },
  'role.continue': { en: 'Continue as {role}', hi: '{role} के रूप में आगे बढ़ें', mr: '{role} म्हणून पुढे जा' },

  back: { en: 'Back', hi: 'वापस', mr: 'मागे' },
  as: { en: 'Signing in as {role}', hi: '{role} के रूप में साइन इन', mr: '{role} म्हणून साइन इन' },
  change: { en: 'Change', hi: 'बदलें', mr: 'बदला' },
  'contact.email.h1': { en: 'Your work email', hi: 'आपका काम का ईमेल', mr: 'तुमचा कामाचा ईमेल' },
  'contact.email.sub': {
    en: 'Owners sign in with the email we approved the studio on. Prefer your phone? Switch to mobile.',
    hi: 'मालिक उसी ईमेल से साइन इन करते हैं जिस पर स्टूडियो मंज़ूर हुआ। फ़ोन से करना है? मोबाइल चुनें।',
    mr: 'मालक स्टुडिओ मंजूर झालेल्या ईमेलने साइन इन करतात. फोनने करायचे? मोबाइल निवडा.',
  },
  'contact.phone.h1': { en: 'Your mobile number', hi: 'आपका मोबाइल नंबर', mr: 'तुमचा मोबाइल नंबर' },
  'contact.phone.sub': {
    en: 'The number your studio added you with. We send a 6-digit code on WhatsApp.',
    hi: 'वही नंबर जिससे स्टूडियो ने आपको जोड़ा। हम WhatsApp पर 6 अंकों का कोड भेजते हैं।',
    mr: 'स्टुडिओने ज्या नंबरने तुम्हाला जोडले तो. आम्ही WhatsApp वर 6 अंकी कोड पाठवतो.',
  },
  via: { en: 'Sign in with', hi: 'किससे साइन इन', mr: 'कशाने साइन इन' },
  'via.email': { en: 'Email', hi: 'ईमेल', mr: 'ईमेल' },
  'via.phone': { en: 'Mobile number', hi: 'मोबाइल नंबर', mr: 'मोबाइल नंबर' },
  'email.note': {
    en: 'No code to type here: the email sign-in sends you a link, or takes your password if you set one.',
    hi: 'यहाँ कोड नहीं डालना: ईमेल साइन-इन आपको लिंक भेजता है, या आपका पासवर्ड लेता है।',
    mr: 'इथे कोड टाकायचा नाही: ईमेल साइन-इन तुम्हाला लिंक पाठवते, किंवा तुमचा पासवर्ड घेते.',
  },
  'email.cta': { en: 'Continue with email', hi: 'ईमेल से आगे बढ़ें', mr: 'ईमेलने पुढे जा' },
  'email.hint': { en: 'Opens the email sign-in for studio owners.', hi: 'स्टूडियो मालिकों का ईमेल साइन-इन खुलेगा।', mr: 'स्टुडिओ मालकांचे ईमेल साइन-इन उघडेल.' },
  'phone.note': {
    en: 'No password. We send a one-time code. Use the number your studio owner invited you with.',
    hi: 'पासवर्ड नहीं। हम एक बार का कोड भेजते हैं। वही नंबर डालें जिस पर स्टूडियो मालिक ने बुलाया।',
    mr: 'पासवर्ड नाही. आम्ही एकदाच वापरायचा कोड पाठवतो. स्टुडिओ मालकाने ज्या नंबरवर बोलावले तो वापरा.',
  },
  'phone.hintOk': { en: 'Codes expire in 10 minutes.', hi: 'कोड 10 मिनट में खत्म हो जाता है।', mr: 'कोड 10 मिनिटांत संपतो.' },
  'phone.hintMore': { en: 'Enter all 10 digits', hi: 'पूरे 10 अंक डालें', mr: 'पूर्ण 10 अंक टाका' },

  'code.h1': { en: 'Enter the 6-digit code', hi: '6 अंकों का कोड डालें', mr: '6 अंकी कोड टाका' },
  'code.sent': { en: 'Sent on WhatsApp to {phone}.', hi: '{phone} पर WhatsApp से भेजा।', mr: '{phone} वर WhatsApp ने पाठवला.' },
  'code.label': { en: '6-digit code', hi: '6 अंकों का कोड', mr: '6 अंकी कोड' },
  'code.verify': { en: 'Verify and sign in', hi: 'जाँचें और साइन इन करें', mr: 'तपासा आणि साइन इन करा' },
  'code.stay': {
    en: 'You stay signed in on this device for {days} days.',
    hi: 'आप इस फ़ोन पर {days} दिन साइन इन रहेंगे।',
    mr: 'तुम्ही या फोनवर {days} दिवस साइन इन राहाल.',
  },
  'code.help': {
    en: "Didn't get it? Ask your studio owner to check your number in Settings, Team.",
    hi: 'नहीं मिला? स्टूडियो मालिक से Settings, Team में अपना नंबर जाँचने को कहें।',
    mr: 'मिळाला नाही? स्टुडिओ मालकाला Settings, Team मध्ये तुमचा नंबर तपासायला सांगा.',
  },

  'mis.h': { en: '{studio} added you as {real}, not {picked}.', hi: '{studio} ने आपको {real} के रूप में जोड़ा है, {picked} नहीं।', mr: '{studio} ने तुम्हाला {real} म्हणून जोडले आहे, {picked} नाही.' },
  'mis.p': {
    en: 'You can only open the apps your owner gave you. Sign in as {real}, or ask your studio owner to change your role in Settings, Team.',
    hi: 'आप सिर्फ़ वही ऐप खोल सकते हैं जो मालिक ने दिए हैं। {real} के रूप में साइन इन करें, या मालिक से Settings, Team में काम बदलने को कहें।',
    mr: 'मालकाने दिलेली ॲप्सच तुम्ही उघडू शकता. {real} म्हणून साइन इन करा, किंवा मालकाला Settings, Team मध्ये काम बदलायला सांगा.',
  },
  'mis.go': { en: 'Sign in as {real}', hi: '{real} के रूप में साइन इन', mr: '{real} म्हणून साइन इन' },
  'mis.again': { en: 'Pick again', hi: 'फिर से चुनें', mr: 'पुन्हा निवडा' },

  'done.h1': { en: 'Welcome back, {name}', hi: 'फिर से स्वागत है, {name}', mr: 'पुन्हा स्वागत, {name}' },
  'done.h1NoName': { en: 'Welcome back', hi: 'फिर से स्वागत है', mr: 'पुन्हा स्वागत' },
  'done.sub': { en: "{studio} · {role}. Here's what's waiting on your home:", hi: '{studio} · {role}। आपके होम पर यह इंतज़ार कर रहा है:', mr: '{studio} · {role}. तुमच्या होमवर हे वाट पाहत आहे:' },
  'done.subNone': { en: '{studio} · {role}. Nothing is waiting on you right now.', hi: '{studio} · {role}। अभी कुछ बाकी नहीं।', mr: '{studio} · {role}. आत्ता काही बाकी नाही.' },
  'done.open': { en: 'Open {home}', hi: '{home} खोलें', mr: '{home} उघडा' },
  'done.home.site': { en: 'My sites today', hi: 'आज की मेरी साइट', mr: 'आजच्या माझ्या साइट' },
  'done.home.office': { en: 'your home', hi: 'अपना होम', mr: 'तुमचे होम' },
  'done.signOut': { en: 'Not you? Sign out', hi: 'आप नहीं? साइन आउट करें', mr: 'तुम्ही नाही? साइन आउट करा' },

  'w.calls': { en: '{n} calls to make', hi: '{n} कॉल करनी हैं', mr: '{n} कॉल करायचे' },
  'w.call1': { en: '1 call to make', hi: '1 कॉल करनी है', mr: '1 कॉल करायचा' },
  'w.quotes': { en: '{n} quotes to chase', hi: '{n} कोटेशन पर बात करनी है', mr: '{n} कोटेशनचा पाठपुरावा' },
  'w.quote1': { en: '1 quote to chase', hi: '1 कोटेशन पर बात करनी है', mr: '1 कोटेशनचा पाठपुरावा' },
  'w.meetings': { en: '{n} meetings today', hi: 'आज {n} मीटिंग', mr: 'आज {n} मीटिंग' },
  'w.meeting1': { en: '1 meeting today', hi: 'आज 1 मीटिंग', mr: 'आज 1 मीटिंग' },
  'w.tasks': { en: '{n} tasks due', hi: '{n} काम बाकी', mr: '{n} कामे बाकी' },
  'w.task1': { en: '1 task due', hi: '1 काम बाकी', mr: '1 काम बाकी' },
  'w.projects': { en: '{n} projects in design', hi: 'डिज़ाइन में {n} प्रोजेक्ट', mr: 'डिझाइनमध्ये {n} प्रोजेक्ट' },
  'w.project1': { en: '1 project in design', hi: 'डिज़ाइन में 1 प्रोजेक्ट', mr: 'डिझाइनमध्ये 1 प्रोजेक्ट' },
  'w.steps': { en: '{n} steps due this week', hi: 'इस हफ़्ते {n} स्टेप', mr: 'या आठवड्यात {n} स्टेप' },
  'w.late': { en: '{n} running late', hi: '{n} देर से', mr: '{n} उशिरा' },
  'w.sites': { en: '{n} sites today', hi: 'आज {n} साइट', mr: 'आज {n} साइट' },
  'w.site1': { en: '1 site today', hi: 'आज 1 साइट', mr: 'आज 1 साइट' },
  'w.snags': { en: '{n} snags to fix', hi: '{n} कमियाँ ठीक करनी हैं', mr: '{n} त्रुटी दुरुस्त करायच्या' },
  'w.snag1': { en: '1 snag to fix', hi: '1 कमी ठीक करनी है', mr: '1 त्रुटी दुरुस्त करायची' },

  'bp.h': { en: 'One sign-in. The right apps for your role.', hi: 'एक साइन-इन। आपके काम के सही ऐप।', mr: 'एक साइन-इन. तुमच्या कामाची योग्य ॲप्स.' },
  'bp.p': {
    en: "Everything your team does here reaches your client's One Interiors app, the moment it's done.",
    hi: 'आपकी टीम यहाँ जो करती है, वह उसी पल ग्राहक के One Interiors ऐप में पहुँचता है।',
    mr: 'तुमची टीम इथे जे करते ते त्याच क्षणी ग्राहकाच्या One Interiors ॲपमध्ये पोहोचते.',
  },
  'bp.f1': { en: 'Site photo with a voice note', hi: 'आवाज़ के साथ साइट फ़ोटो', mr: 'आवाजासह साइट फोटो' },
  'bp.f1to': { en: "client's site feed", hi: 'ग्राहक की साइट फ़ीड', mr: 'ग्राहकाची साइट फीड' },
  'bp.f2': { en: 'Signed quotation', hi: 'साइन किया कोटेशन', mr: 'सही केलेले कोटेशन' },
  'bp.f2to': { en: 'project tracker', hi: 'प्रोजेक्ट ट्रैकर', mr: 'प्रोजेक्ट ट्रॅकर' },
  'bp.f3': { en: 'Snag fixed', hi: 'कमी ठीक हुई', mr: 'त्रुटी दुरुस्त' },
  'bp.f3to': { en: 'client sees it closed', hi: 'ग्राहक को बंद दिखती है', mr: 'ग्राहकाला बंद दिसते' },
  'bp.studio': { en: 'For interior studios', hi: 'इंटीरियर स्टूडियो के लिए', mr: 'इंटिरियर स्टुडिओसाठी' },
  'bp.studioSub': { en: 'Pune · invite-only, from your studio owner', hi: 'पुणे · सिर्फ़ स्टूडियो मालिक के बुलावे से', mr: 'पुणे · फक्त स्टुडिओ मालकाच्या आमंत्रणाने' },
  powered: { en: 'Powered by', hi: 'Powered by', mr: 'Powered by' },
} satisfies Record<string, Tx>;

export type SiWord = keyof typeof SI_WORDS;

/** Each role's name on this page, in the three languages. */
export const ROLE_TX: Record<StudioRoleName, Tx> = {
  SALES: { en: 'Sales', hi: 'सेल्स', mr: 'सेल्स' },
  DESIGNER: { en: 'Designer', hi: 'डिज़ाइनर', mr: 'डिझायनर' },
  PM: { en: 'Project manager', hi: 'प्रोजेक्ट मैनेजर', mr: 'प्रोजेक्ट मॅनेजर' },
  OWNER: { en: 'Owner / admin', hi: 'मालिक / एडमिन', mr: 'मालक / ॲडमिन' },
  SUPERVISOR: { en: 'Site supervisor', hi: 'साइट सुपरवाइज़र', mr: 'साइट सुपरवायझर' },
  ACCOUNTS: { en: 'Accounts', hi: 'अकाउंट्स', mr: 'अकाउंट्स' },
};

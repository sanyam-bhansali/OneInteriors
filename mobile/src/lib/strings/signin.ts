import type { Entry } from './entry';

/** Sign-in for a returning customer (first draft: Sanyam reviews the Hindi and Marathi). */
export const signin = {
  'signin.meta': { en: 'Welcome back', hi: 'फिर से स्वागत है', mr: 'पुन्हा स्वागत आहे' },
  'signin.h1': { en: 'Sign in with your mobile number.', hi: 'अपने मोबाइल नंबर से साइन इन करें।', mr: 'तुमच्या मोबाईल नंबरने साइन इन करा.' },
  'signin.sub': {
    en: 'No password. We send a one-time code on WhatsApp, and that is your sign-in.',
    hi: 'कोई पासवर्ड नहीं। हम WhatsApp पर एक बार का कोड भेजते हैं, वही आपका साइन-इन है।',
    mr: 'पासवर्ड नाही. आम्ही WhatsApp वर एकदाच वापरायचा कोड पाठवतो, तोच तुमचा साइन-इन.',
  },
  'signin.cta': { en: 'Verify and sign in', hi: 'पुष्टि करें और साइन इन करें', mr: 'पडताळणी करा आणि साइन इन करा' },
  'signin.needCode': { en: 'Enter the 6-digit code to continue', hi: 'आगे बढ़ने के लिए 6 अंकों का कोड डालें', mr: 'पुढे जाण्यासाठी 6 अंकी कोड टाका' },
  'signin.needNumber': { en: 'Enter a 10-digit mobile number', hi: '10 अंकों का मोबाइल नंबर डालें', mr: '10 अंकी मोबाईल नंबर टाका' },
  'signin.other': { en: 'Use a different number', hi: 'दूसरा नंबर इस्तेमाल करें', mr: 'दुसरा नंबर वापरा' },
  'signin.dev': { en: 'Test build: your code is {code}.', hi: 'टेस्ट बिल्ड: आपका कोड {code} है।', mr: 'टेस्ट बिल्ड: तुमचा कोड {code} आहे.' },
  'signin.new': { en: 'New here? Find your designer', hi: 'नए हैं? अपना डिज़ाइनर खोजिए', mr: 'नवीन आहात? तुमचा डिझायनर शोधा' },
  /* The clients' password sign-in while codes are not live (owner, 1 Nov 2026). */
  'pw.h1': { en: 'Good to see you again.', hi: 'आपको फिर देखकर अच्छा लगा।', mr: 'तुम्हाला पुन्हा पाहून आनंद झाला.' },
  'pw.sub': { en: 'Your mobile number, and the password your designer gave you.', hi: 'आपका मोबाइल नंबर, और आपके डिज़ाइनर का दिया पासवर्ड।', mr: 'तुमचा मोबाईल नंबर, आणि तुमच्या डिझायनरने दिलेला पासवर्ड.' },
  'pw.password': { en: 'Password', hi: 'पासवर्ड', mr: 'पासवर्ड' },
  'pw.cta': { en: 'Sign in', hi: 'साइन इन करें', mr: 'साइन इन करा' },
  'pw.need': { en: 'Enter your number and password', hi: 'अपना नंबर और पासवर्ड डालें', mr: 'तुमचा नंबर आणि पासवर्ड टाका' },
  'pw.forgot': { en: 'Forgot it, or locked out? Ask your designer for a new one-time password.', hi: 'भूल गए या लॉक हो गया? अपने डिज़ाइनर से नया एक-बार का पासवर्ड माँगें।', mr: 'विसरलात किंवा लॉक झाले? तुमच्या डिझायनरकडून नवीन एकदाचा पासवर्ड मागा.' },
  'pw.choose.h1': { en: 'Choose your own password.', hi: 'अपना पासवर्ड चुनें।', mr: 'तुमचा स्वतःचा पासवर्ड निवडा.' },
  'pw.choose.sub': {
    en: 'The one your designer gave you works only once. At least 12 characters; a short sentence is easiest to remember.',
    hi: 'डिज़ाइनर का दिया पासवर्ड एक ही बार चलता है। कम से कम 12 अक्षर; एक छोटा वाक्य याद रखना सबसे आसान है।',
    mr: 'डिझायनरने दिलेला पासवर्ड एकदाच चालतो. किमान 12 अक्षरे; एक छोटे वाक्य लक्षात ठेवणे सर्वात सोपे.',
  },
  'pw.new': { en: 'New password', hi: 'नया पासवर्ड', mr: 'नवीन पासवर्ड' },
  'pw.again': { en: 'Once more', hi: 'एक बार और', mr: 'पुन्हा एकदा' },
  'pw.mismatch': { en: 'The two passwords are not the same.', hi: 'दोनों पासवर्ड एक जैसे नहीं हैं।', mr: 'दोन्ही पासवर्ड सारखे नाहीत.' },
  'pw.save': { en: 'Save and open my project', hi: 'सेव करें और प्रोजेक्ट खोलें', mr: 'सेव्ह करा आणि प्रोजेक्ट उघडा' },
  'pw.short': { en: 'At least 12 characters', hi: 'कम से कम 12 अक्षर', mr: 'किमान 12 अक्षरे' },
  'connect.meta': { en: 'Open my project', hi: 'मेरा प्रोजेक्ट खोलें', mr: 'माझा प्रोजेक्ट उघडा' },
  'connect.h1': { en: 'Connect your project', hi: 'अपना प्रोजेक्ट जोड़ें', mr: 'तुमचा प्रोजेक्ट जोडा' },
  'connect.sub': { en: 'Your designer sends you a project link. Paste it here, or type its code, and your home opens.', hi: 'आपके डिज़ाइनर एक प्रोजेक्ट लिंक भेजते हैं। उसे यहाँ पेस्ट करें या उसका कोड लिखें, आपका घर खुल जाएगा।', mr: 'तुमचे डिझायनर एक प्रोजेक्ट लिंक पाठवतात. ती इथे पेस्ट करा किंवा कोड लिहा, तुमचे घर उघडेल.' },
  'connect.label': { en: 'Project link or code', hi: 'प्रोजेक्ट लिंक या कोड', mr: 'प्रोजेक्ट लिंक किंवा कोड' },
  'connect.none': { en: 'No link yet? Ask your designer for it.', hi: 'अभी लिंक नहीं? अपने डिज़ाइनर से माँगें।', mr: 'अजून लिंक नाही? तुमच्या डिझायनरकडे मागा.' },
  'connect.cta': { en: 'Open my project', hi: 'मेरा प्रोजेक्ट खोलें', mr: 'माझा प्रोजेक्ट उघडा' },
  'connect.need': { en: 'Paste the link or type the code', hi: 'लिंक पेस्ट करें या कोड लिखें', mr: 'लिंक पेस्ट करा किंवा कोड लिहा' },
} satisfies Record<string, Entry>;

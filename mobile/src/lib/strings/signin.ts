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
} satisfies Record<string, Entry>;

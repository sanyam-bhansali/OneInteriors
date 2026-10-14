/**
 * The studio side's words in English, Hindi and Marathi — for the screens a
 * site team uses in phase 1: the phone sign-in and the supervisor's "My
 * sites today" (PHASE-1-PLAN §7). Office screens stay English in phase 1.
 *
 * Same convention as the customer site (`site.ts`): the `oa.lang` cookie,
 * `tx` / `translator`, `{name}` placeholders.
 *
 * FIRST DRAFT, from the StudioSignIn design. The Hindi and Marathi need a
 * native speaker's review before launch. Plain, everyday words, as a site
 * team in Pune speaks; "One Interiors", "WhatsApp", "Settings" and "Team"
 * stay in English because that is what the owner's screen says.
 */

import type { Lang, Tx } from './site';

export const STUDIO_LANG_LABEL: Record<Lang, { short: string; full: string }> = {
  en: { short: 'EN', full: 'English' },
  hi: { short: 'हिं', full: 'हिंदी' },
  mr: { short: 'मरा', full: 'मराठी' },
};

/** A User.locale for the language chosen on the studio sign-in. */
export function localeFor(lang: Lang): string {
  return `${lang}-IN`;
}

/** The language a User.locale names; English for anything else. */
export function langOfLocale(locale: string | null | undefined): Lang {
  const l = (locale ?? '').slice(0, 2).toLowerCase();
  return l === 'hi' || l === 'mr' ? l : 'en';
}

export const STUDIO_WORDS = {
  'signin.h1': { en: 'Sign in to your studio', hi: 'अपने स्टूडियो में साइन इन करें', mr: 'तुमच्या स्टुडिओमध्ये साइन इन करा' },
  'signin.sub': {
    en: 'Use the mobile number your studio added you with. No password.',
    hi: 'वही मोबाइल नंबर डालें जिससे स्टूडियो ने आपको जोड़ा है। पासवर्ड नहीं चाहिए।',
    mr: 'स्टुडिओने ज्या मोबाइल नंबरने तुम्हाला जोडले तो वापरा. पासवर्ड नको.',
  },
  'signin.phone': { en: 'Mobile number', hi: 'मोबाइल नंबर', mr: 'मोबाइल नंबर' },
  'signin.code': { en: '6-digit code', hi: '6 अंकों का कोड', mr: '6 अंकी कोड' },
  'signin.getCode': { en: 'Send me a code', hi: 'कोड भेजें', mr: 'कोड पाठवा' },
  'signin.sent': { en: 'Sent on WhatsApp to {phone}.', hi: '{phone} पर WhatsApp से भेजा गया।', mr: '{phone} वर WhatsApp ने पाठवला.' },
  'signin.resendIn': { en: 'New code in 0:{s}', hi: 'नया कोड 0:{s} में', mr: 'नवा कोड 0:{s} मध्ये' },
  'signin.resend': { en: 'Send a new code', hi: 'नया कोड भेजें', mr: 'नवा कोड पाठवा' },
  'signin.otherNumber': { en: 'Use another number', hi: 'दूसरा नंबर डालें', mr: 'दुसरा नंबर वापरा' },
  'signin.devCode': {
    en: 'Local development: no message was sent. The code is {code}.',
    hi: 'लोकल डेवलपमेंट: कोई संदेश नहीं भेजा गया। कोड {code} है।',
    mr: 'लोकल डेव्हलपमेंट: संदेश पाठवला नाही. कोड {code} आहे.',
  },
  'signin.cta': { en: 'Sign in', hi: 'साइन इन करें', mr: 'साइन इन करा' },
  'signin.note': {
    en: 'Your studio owner adds team members from Settings, Team. Once you are in, you only see the sites you are working on.',
    hi: 'स्टूडियो के मालिक Settings, Team से लोगों को जोड़ते हैं। अंदर आने के बाद आपको सिर्फ़ अपनी साइट दिखेंगी।',
    mr: 'स्टुडिओचे मालक Settings, Team मधून लोक जोडतात. आत आल्यावर तुम्हाला फक्त तुमच्या साइट दिसतील.',
  },
  'signin.owner': {
    en: 'Studio owner signing in with email? Use the email sign-in',
    hi: 'स्टूडियो मालिक, ईमेल से साइन इन? ईमेल साइन-इन खोलें',
    mr: 'स्टुडिओ मालक, ईमेलने साइन इन? ईमेल साइन-इन उघडा',
  },
  'signin.newStudio': { en: 'New studio? Apply to join One Interiors', hi: 'नया स्टूडियो? One Interiors से जुड़ें', mr: 'नवा स्टुडिओ? One Interiors मध्ये सामील व्हा' },

  // Refusals. Each one says what to do.
  'err.invalid_phone': {
    en: 'That does not look like an Indian mobile number.',
    hi: 'यह भारतीय मोबाइल नंबर नहीं लगता।',
    mr: 'हा भारतीय मोबाइल नंबर वाटत नाही.',
  },
  'err.not_member': {
    en: 'This number is not on a studio team. Ask your studio owner to add you from Settings, Team.',
    hi: 'यह नंबर किसी स्टूडियो टीम में नहीं है। स्टूडियो के मालिक से कहें कि Settings, Team से आपको जोड़ें।',
    mr: 'हा नंबर कोणत्याही स्टुडिओ टीममध्ये नाही. स्टुडिओच्या मालकांना Settings, Team मधून तुम्हाला जोडायला सांगा.',
  },
  'err.suspended': {
    en: 'Your access to this studio is paused. Ask your studio owner.',
    hi: 'इस स्टूडियो में आपकी पहुँच रोकी गई है। स्टूडियो के मालिक से बात करें।',
    mr: 'या स्टुडिओमधील तुमचा प्रवेश थांबवला आहे. स्टुडिओच्या मालकांशी बोला.',
  },
  'err.rate_limited': {
    en: 'Too many codes asked for. Try again in a little while.',
    hi: 'बहुत सारे कोड माँगे गए। थोड़ी देर बाद फिर कोशिश करें।',
    mr: 'खूप कोड मागितले. थोड्या वेळाने पुन्हा प्रयत्न करा.',
  },
  'err.cooldown': {
    en: 'Give it a few seconds before asking for another code.',
    hi: 'नया कोड माँगने से पहले कुछ सेकंड रुकें।',
    mr: 'नवा कोड मागण्याआधी काही सेकंद थांबा.',
  },
  'err.invalid_code': {
    en: 'That code is not right. Check the message and try again.',
    hi: 'यह कोड सही नहीं है। संदेश देखकर फिर से डालें।',
    mr: 'हा कोड बरोबर नाही. संदेश पाहून पुन्हा टाका.',
  },
  'err.expired': { en: 'That code has expired. Ask for a new one.', hi: 'यह कोड पुराना हो गया। नया कोड माँगें।', mr: 'हा कोड जुना झाला. नवा कोड मागा.' },
  'err.too_many': {
    en: 'Too many wrong attempts. Ask for a new code.',
    hi: 'बहुत बार गलत कोड डाला। नया कोड माँगें।',
    mr: 'खूप वेळा चुकीचा कोड टाकला. नवा कोड मागा.',
  },
  'err.unavailable': {
    en: 'Sign-in is not working right now. This is our problem, not yours. Try again shortly.',
    hi: 'अभी साइन-इन नहीं हो रहा। गलती हमारी है, आपकी नहीं। थोड़ी देर में फिर कोशिश करें।',
    mr: 'आत्ता साइन-इन होत नाही. चूक आमची आहे, तुमची नाही. थोड्या वेळाने पुन्हा प्रयत्न करा.',
  },

  // Site mode placeholder: "My sites today".
  'site.hello': { en: 'Hello, {name}', hi: 'नमस्ते, {name}', mr: 'नमस्कार, {name}' },
  'site.helloNoName': { en: 'Hello', hi: 'नमस्ते', mr: 'नमस्कार' },
  'site.h1': { en: 'My sites today', hi: 'आज मेरी साइट', mr: 'आज माझ्या साइट' },
  'site.none': {
    en: 'No sites yet. Your studio owner picks which sites you work on, from Settings, Team.',
    hi: 'अभी कोई साइट नहीं। आप किन साइट पर काम करेंगे, यह स्टूडियो के मालिक Settings, Team से चुनते हैं।',
    mr: 'अजून साइट नाहीत. तुम्ही कोणत्या साइटवर काम करणार हे स्टुडिओचे मालक Settings, Team मधून निवडतात.',
  },
  'site.stages': { en: '{done} of {total} stages done', hi: '{total} में से {done} चरण पूरे', mr: '{total} पैकी {done} टप्पे पूर्ण' },
  'site.started': { en: 'Started {date}', hi: '{date} को शुरू', mr: '{date} ला सुरू' },
  'site.lastUpdate': { en: 'Last update {date}', hi: 'आखिरी अपडेट {date}', mr: 'शेवटचा अपडेट {date}' },
  'site.noUpdate': { en: 'No update posted yet', hi: 'अभी कोई अपडेट नहीं', mr: 'अजून अपडेट नाही' },
  'site.soon': {
    en: 'Posting today’s update and fixing snags from this phone comes next. Until then, your office posts them.',
    hi: 'आज का अपडेट और स्नैग ठीक करना इसी फ़ोन से जल्द होगा। तब तक ऑफ़िस इन्हें डालता है।',
    mr: 'आजचा अपडेट आणि स्नॅग दुरुस्ती याच फोनवरून लवकरच. तोपर्यंत ऑफिस ते टाकते.',
  },
  'site.signOut': { en: 'Sign out', hi: 'साइन आउट', mr: 'साइन आउट' },
} satisfies Record<string, Tx>;

export type StudioWord = keyof typeof STUDIO_WORDS;

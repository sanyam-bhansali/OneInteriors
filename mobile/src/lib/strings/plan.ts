import type { Entry } from './entry';

/**
 * The two plans (owner decision, 11 Oct 2026), and the Basic wording of the
 * lines that promise One Interiors' oversight. First draft of the Hindi and
 * Marathi: Sanyam reviews.
 */
export const plan = {
  'plan.basic': { en: 'Basic', hi: 'बेसिक', mr: 'बेसिक' },
  'plan.assured': { en: 'Assured', hi: 'अश्योर्ड', mr: 'अश्योर्ड' },
  'plan.basic.price': { en: 'Free', hi: 'मुफ़्त', mr: 'मोफत' },
  'plan.assured.price': { en: 'Fee confirmed by our team', hi: 'फ़ीस हमारी टीम बताएगी', mr: 'फी आमची टीम सांगेल' },
  'plan.basic.line': {
    en: 'The app, for you and your studio to run the project together.',
    hi: 'ऐप, ताकि आप और आपका स्टूडियो मिलकर प्रोजेक्ट चलाएँ।',
    mr: 'ॲप, म्हणजे तुम्ही आणि तुमचा स्टुडिओ मिळून प्रोजेक्ट चालवा.',
  },
  'plan.assured.line': {
    en: 'One Interiors watches over the project with you, every day.',
    hi: 'One Interiors हर दिन आपके साथ प्रोजेक्ट पर नज़र रखता है।',
    mr: 'One Interiors दररोज तुमच्यासोबत प्रोजेक्टवर लक्ष ठेवते.',
  },
  'plan.f.tracker': { en: 'Project tracker, site updates and snags', hi: 'प्रोजेक्ट ट्रैकर, साइट अपडेट और कमियाँ', mr: 'प्रोजेक्ट ट्रॅकर, साइट अपडेट आणि त्रुटी' },
  'plan.f.payments': { en: 'Payment stages and receipts in your locker', hi: 'भुगतान के चरण और रसीदें लॉकर में', mr: 'पेमेंटचे टप्पे आणि पावत्या लॉकरमध्ये' },
  'plan.f.decisions': { en: 'Decisions with deadlines and family votes', hi: 'समय-सीमा वाले फ़ैसले और परिवार के वोट', mr: 'मुदतीचे निर्णय आणि कुटुंबाची मते' },
  'plan.f.agree': {
    en: 'You and your studio agree to keep it up to date; One Interiors does not check it',
    hi: 'आप और आपका स्टूडियो इसे अपडेट रखने पर सहमत होते हैं; One Interiors इसकी जाँच नहीं करता',
    mr: 'तुम्ही आणि तुमचा स्टुडिओ हे अपडेट ठेवण्यास सहमत होता; One Interiors हे तपासत नाही',
  },
  'plan.f.everything': { en: 'Everything in Basic', hi: 'बेसिक में जो कुछ है, सब', mr: 'बेसिकमधील सर्व काही' },
  'plan.f.daily': {
    en: 'We make sure the site and tracker are updated every day',
    hi: 'हम पक्का करते हैं कि साइट और ट्रैकर हर दिन अपडेट हों',
    mr: 'साइट आणि ट्रॅकर दररोज अपडेट होतील याची आम्ही खात्री करतो',
  },
  'plan.f.chase': {
    en: 'A day missed, we call the studio and find out why',
    hi: 'कोई दिन छूटा, तो हम स्टूडियो को फ़ोन करके वजह पूछते हैं',
    mr: 'एखादा दिवस चुकला, तर आम्ही स्टुडिओला फोन करून कारण विचारतो',
  },
  'plan.f.geio': { en: 'GEIO, your interior design expert, any time', hi: 'GEIO, आपका इंटीरियर डिज़ाइन एक्सपर्ट, कभी भी', mr: 'GEIO, तुमचा इंटिरियर डिझाइन तज्ज्ञ, केव्हाही' },
  'plan.f.calls': {
    en: '5 calls with your One Interiors expert, whenever you need her',
    hi: 'ज़रूरत पड़ने पर अपनी One Interiors एक्सपर्ट से 5 कॉल',
    mr: 'गरज पडेल तेव्हा तुमच्या One Interiors तज्ज्ञांशी 5 कॉल',
  },
  'plan.feeNote': {
    en: 'Your fee is confirmed by our team before anything is charged. You start on Basic until then.',
    hi: 'कुछ भी लेने से पहले हमारी टीम आपकी फ़ीस बताएगी। तब तक आप बेसिक पर रहेंगे।',
    mr: 'काहीही आकारण्याआधी आमची टीम तुमची फी सांगेल. तोपर्यंत तुम्ही बेसिकवर राहाल.',
  },
  'plan.choose': { en: 'Choose your plan', hi: 'अपना प्लान चुनें', mr: 'तुमचा प्लॅन निवडा' },
  'plan.current': { en: 'Your plan', hi: 'आपका प्लान', mr: 'तुमचा प्लॅन' },
  'plan.upgrade.h1': { en: 'Have One Interiors watch over your home.', hi: 'One Interiors को अपने घर पर नज़र रखने दें।', mr: 'One Interiors ला तुमच्या घरावर लक्ष ठेवू द्या.' },
  'plan.upgrade.cta': { en: 'I want Assured', hi: 'मुझे अश्योर्ड चाहिए', mr: 'मला अश्योर्ड हवे' },
  'plan.upgrade.done.h1': { en: 'Our team will call you.', hi: 'हमारी टीम आपको फ़ोन करेगी।', mr: 'आमची टीम तुम्हाला फोन करेल.' },
  'plan.upgrade.done.body': {
    en: 'They will confirm your Assured fee and switch your project over. Nothing is charged before you agree.',
    hi: 'वे आपकी अश्योर्ड फ़ीस बताएँगे और आपका प्रोजेक्ट बदल देंगे। आपकी सहमति से पहले कुछ नहीं लिया जाएगा।',
    mr: 'ते तुमची अश्योर्ड फी सांगतील आणि तुमचा प्रोजेक्ट बदलतील. तुमच्या संमतीशिवाय काहीही आकारले जाणार नाही.',
  },
  'plan.requested': { en: 'Assured requested, our team will call you', hi: 'अश्योर्ड का अनुरोध भेजा, हमारी टीम फ़ोन करेगी', mr: 'अश्योर्डची विनंती पाठवली, आमची टीम फोन करेल' },
  'plan.calls': { en: 'Expert calls: {used} of {total} used', hi: 'एक्सपर्ट कॉल: {total} में से {used} इस्तेमाल', mr: 'तज्ज्ञ कॉल: {total} पैकी {used} वापरले' },
  'plan.see': { en: 'See what Assured adds', hi: 'देखें अश्योर्ड में क्या मिलता है', mr: 'अश्योर्डमध्ये काय मिळते ते पाहा' },
  'plan.err': { en: 'We could not send that. Please try again.', hi: 'यह नहीं भेज पाए। कृपया फिर से कोशिश करें।', mr: 'हे पाठवता आले नाही. कृपया पुन्हा प्रयत्न करा.' },

  'plan.geio.h1': { en: 'GEIO comes with Assured.', hi: 'GEIO अश्योर्ड के साथ मिलता है।', mr: 'GEIO अश्योर्डसोबत मिळतो.' },
  'plan.geio.body': {
    en: 'Ask anything about your home, in English, हिंदी or मराठी, and get a plain answer from your own project. When it needs a person, GEIO hands it to your expert.',
    hi: 'अपने घर के बारे में कुछ भी पूछें, अंग्रेज़ी, हिंदी या मराठी में, और अपने ही प्रोजेक्ट से सीधा जवाब पाएँ। जब किसी इंसान की ज़रूरत हो, GEIO आपकी एक्सपर्ट को सौंप देता है।',
    mr: 'तुमच्या घराबद्दल काहीही विचारा, इंग्रजी, हिंदी किंवा मराठीत, आणि तुमच्याच प्रोजेक्टमधून सोपे उत्तर मिळवा. माणसाची गरज असेल तेव्हा GEIO तुमच्या तज्ज्ञांकडे देतो.',
  },

  'plan.basic.footnote': {
    en: 'Your studio marks each stage done. On Basic, you and your studio keep this up to date together.',
    hi: 'हर चरण को आपका स्टूडियो पूरा मार्क करता है। बेसिक पर आप और आपका स्टूडियो मिलकर इसे अपडेट रखते हैं।',
    mr: 'प्रत्येक टप्पा तुमचा स्टुडिओ पूर्ण म्हणून नोंदवतो. बेसिकवर तुम्ही आणि तुमचा स्टुडिओ मिळून हे अपडेट ठेवता.',
  },
  'plan.basic.late': {
    en: 'Planned for {date} and not marked done yet. Ask {studio} when it will finish.',
    hi: '{date} के लिए तय था और अभी पूरा नहीं हुआ। {studio} से पूछें कि कब पूरा होगा।',
    mr: '{date} साठी ठरले होते आणि अजून पूर्ण झालेले नाही. {studio} ला विचारा कधी पूर्ण होईल.',
  },
  'plan.basic.snags': { en: 'Photograph it and your studio is told', hi: 'फ़ोटो लें, आपके स्टूडियो को बता दिया जाएगा', mr: 'फोटो काढा, तुमच्या स्टुडिओला कळवले जाईल' },
  'plan.basic.walk': {
    en: 'Walk the flat with your studio room by room and add everything here. The last payment is due once these are closed.',
    hi: 'अपने स्टूडियो के साथ फ़्लैट का हर कमरा देखें और सब कुछ यहाँ जोड़ें। आख़िरी भुगतान इनके ठीक होने के बाद देना है।',
    mr: 'तुमच्या स्टुडिओसोबत फ्लॅटची प्रत्येक खोली पाहा आणि सगळे इथे नोंदवा. हे दुरुस्त झाल्यावर शेवटचे पेमेंट द्यायचे.',
  },
  'plan.basic.gap': {
    en: '{studio} posted no photos or note for this working day. You can ask them directly.',
    hi: '{studio} ने इस कामकाजी दिन की कोई फ़ोटो या नोट नहीं डाली। आप उनसे सीधे पूछ सकते हैं।',
    mr: '{studio} ने या कामाच्या दिवसाचे कोणतेही फोटो किंवा नोट टाकले नाहीत. तुम्ही त्यांना थेट विचारू शकता.',
  },
  'plan.assured.gap': {
    en: '{studio} posted no photos or note for this working day. On Assured, we call them to find out why and tell you here.',
    hi: '{studio} ने इस कामकाजी दिन की कोई फ़ोटो या नोट नहीं डाली। अश्योर्ड पर हम उन्हें फ़ोन करके वजह पूछते हैं और आपको यहाँ बताते हैं।',
    mr: '{studio} ने या कामाच्या दिवसाचे कोणतेही फोटो किंवा नोट टाकले नाहीत. अश्योर्डवर आम्ही त्यांना फोन करून कारण विचारतो आणि तुम्हाला इथे सांगतो.',
  },
} satisfies Record<string, Entry>;

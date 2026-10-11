import type { Entry } from './entry';

/**
 * Words for Matches (#11), All studios (#16) and the studio profile (#17):
 * only those the website's dictionary (../i18n-dict.ts: matches.*) does not
 * already have. The English follows the website's own screens. First draft:
 * Sanyam reviews the Hindi and Marathi.
 */
export const matchesWords = {
  // Matches
  'matches.three': { en: 'Three studios', hi: 'तीन स्टूडियो', mr: 'तीन स्टुडिओ' },
  'matches.tiers': { en: 'Finish level', hi: 'फ़िनिश का स्तर', mr: 'फिनिशचा स्तर' },
  'matches.yourPick': { en: 'Your pick', hi: 'आपकी पसंद', mr: 'तुमची निवड' },
  'matches.noData': { en: 'Not enough data yet', hi: 'अभी पूरा डेटा नहीं', mr: 'अजून पुरेसा डेटा नाही' },
  'matches.open': { en: 'Open {name}, match {score}', hi: '{name} खोलें, मैच {score}', mr: '{name} उघडा, मॅच {score}' },
  'matches.rates': {
    en: 'Pre-launch: these prices use archive rates, not yet each studio’s own.',
    hi: 'लॉन्च से पहले: ये कीमतें पुराने रेट से हैं, अभी हर स्टूडियो के अपने रेट से नहीं।',
    mr: 'लॉन्चपूर्वी: या किमती जुन्या दरांवर आहेत, अजून प्रत्येक स्टुडिओच्या स्वतःच्या दरांवर नाहीत.',
  },
  'matches.first.h1': { en: 'Seven questions first.', hi: 'पहले सात सवाल।', mr: 'आधी सात प्रश्न.' },
  'matches.first.sub': {
    en: 'Your matches are worked out from your answers, so they come after the brief.',
    hi: 'आपके मैच आपके जवाबों से तय होते हैं, इसलिए वे सवालों के बाद आते हैं।',
    mr: 'तुमचे मॅच तुमच्या उत्तरांवरून ठरतात, म्हणून ते प्रश्नांनंतर येतात.',
  },
  'matches.first.cta': { en: 'Start the brief', hi: 'सवाल शुरू करें', mr: 'प्रश्न सुरू करा' },
  'matches.none.h1': { en: 'No studio fits all of that yet.', hi: 'अभी कोई स्टूडियो इन सब पर खरा नहीं उतरता।', mr: 'अजून कोणताही स्टुडिओ या सगळ्यात बसत नाही.' },
  'matches.none.sub': {
    en: 'We would rather say so than show you a studio that does not fit. Change an answer and we will look again.',
    hi: 'जो स्टूडियो सही न बैठे उसे दिखाने से अच्छा है हम सीधे बता दें। कोई जवाब बदलिए, हम फिर देखेंगे।',
    mr: 'न बसणारा स्टुडिओ दाखवण्यापेक्षा आम्ही सरळ सांगतो. एखादे उत्तर बदला, आम्ही पुन्हा पाहू.',
  },
  'matches.none.cta': { en: 'Change my answers', hi: 'मेरे जवाब बदलें', mr: 'माझी उत्तरे बदला' },
  'matches.retry': { en: 'Try again', hi: 'फिर से कोशिश करें', mr: 'पुन्हा प्रयत्न करा' },

  // All studios
  'studios.meta': { en: 'Every studio passed our checks', hi: 'हर स्टूडियो हमारी जाँच में पास हुआ', mr: 'प्रत्येक स्टुडिओ आमच्या तपासणीत पास झाला' },
  'studios.h1': { en: 'All {n} studios in Pune', hi: 'पुणे के सभी {n} स्टूडियो', mr: 'पुण्यातील सर्व {n} स्टुडिओ' },
  'studios.filters': { en: 'Filters', hi: 'फ़िल्टर', mr: 'फिल्टर' },
  'studios.f.tier': { en: '{tier} tier', hi: '{tier} स्तर', mr: '{tier} स्तर' },
  'studios.f.near': { en: 'Near {place}', hi: '{place} के पास', mr: '{place} जवळ' },
  'studios.f.onTime': { en: 'Usually on time', hi: 'अक्सर समय पर', mr: 'बहुधा वेळेवर' },
  'studios.count': { en: '{n} studios, best match first', hi: '{n} स्टूडियो, सबसे अच्छा मैच पहले', mr: '{n} स्टुडिओ, सर्वोत्तम मॅच आधी' },
  'studios.countOne': { en: '1 studio, best match first', hi: '1 स्टूडियो, सबसे अच्छा मैच पहले', mr: '1 स्टुडिओ, सर्वोत्तम मॅच आधी' },
  'studios.countPlain': {
    en: '{n} studios. Finish the brief to see how each one matches.',
    hi: '{n} स्टूडियो। हर एक का मैच देखने के लिए सवाल पूरे करें।',
    mr: '{n} स्टुडिओ. प्रत्येकाचा मॅच पाहण्यासाठी प्रश्न पूर्ण करा.',
  },
  'studios.match': { en: 'match', hi: 'मैच', mr: 'मॅच' },
  'studios.none': { en: 'No studio fits that filter yet.', hi: 'इस फ़िल्टर में अभी कोई स्टूडियो नहीं।', mr: 'या फिल्टरमध्ये अजून कोणताही स्टुडिओ नाही.' },

  // Studio profile
  'studio.verified': { en: 'Verified by One Interiors', hi: 'One Interiors द्वारा जाँचा गया', mr: 'One Interiors ने तपासलेले' },
  'studio.since': { en: 'since {year}', hi: '{year} से', mr: '{year} पासून' },
  'studio.team': { en: 'team of {n}', hi: '{n} लोगों की टीम', mr: '{n} जणांची टीम' },
  'studio.save': { en: 'Save studio', hi: 'स्टूडियो सेव करें', mr: 'स्टुडिओ सेव्ह करा' },
  'studio.saved': { en: 'Saved on this phone', hi: 'इस फ़ोन पर सेव किया', mr: 'या फोनवर सेव्ह केले' },
  'studio.tile.match': { en: 'Match for you', hi: 'आपके लिए मैच', mr: 'तुमच्यासाठी मॅच' },
  'studio.tile.unscored': { en: 'Finish the brief to score', hi: 'अंक के लिए सवाल पूरे करें', mr: 'गुणांसाठी प्रश्न पूर्ण करा' },
  'studio.tile.checks': { en: 'Checks passed', hi: 'जाँच पास', mr: 'तपासण्या पास' },
  'studio.tile.homes': { en: 'Homes handed over with us', hi: 'हमारे साथ सौंपे गए घर', mr: 'आमच्यासोबत सुपूर्द केलेली घरे' },
  'studio.tile.reviews': { en: '{n} verified reviews', hi: '{n} पक्के रिव्यू', mr: '{n} पडताळलेले रिव्ह्यू' },
  'studio.tabs': { en: 'About this studio', hi: 'इस स्टूडियो के बारे में', mr: 'या स्टुडिओबद्दल' },
  'studio.tab.homes': { en: 'Past homes', hi: 'पिछले घर', mr: 'आधीची घरे' },
  'studio.tab.checks': { en: 'Checks', hi: 'जाँच', mr: 'तपासण्या' },
  'studio.tab.record': { en: 'Delivery record', hi: 'डिलीवरी रिकॉर्ड', mr: 'डिलिव्हरी रेकॉर्ड' },
  'studio.tab.reviews': { en: 'Reviews', hi: 'रिव्यू', mr: 'रिव्ह्यू' },
  'studio.homes.none': { en: 'No past homes on file yet.', hi: 'अभी कोई पिछला घर दर्ज नहीं।', mr: 'अजून आधीचे कोणतेही घर नोंदलेले नाही.' },
  'studio.homes.alt': { en: '{caption}, by {name}', hi: '{caption}, {name} का काम', mr: '{caption}, {name} यांचे काम' },
  'studio.homes.work': { en: 'Work by {name}', hi: '{name} का काम', mr: '{name} यांचे काम' },
  'studio.render': { en: 'Render', hi: 'रेंडर', mr: 'रेंडर' },
  'studio.checks.h': { en: '{a} of {b} checks passed', hi: '{b} में से {a} जाँच पास', mr: '{b} पैकी {a} तपासण्या पास' },
  'studio.checks.last': { en: 'Last checked {date}.', hi: 'आख़िरी जाँच {date}।', mr: 'शेवटची तपासणी {date}.' },
  'studio.checks.sub': {
    en: 'Every studio goes through the same checks before it can be matched. We show the result and the date, never the documents.',
    hi: 'मैच होने से पहले हर स्टूडियो की एक जैसी जाँच होती है। हम नतीजा और तारीख दिखाते हैं, दस्तावेज़ कभी नहीं।',
    mr: 'मॅच होण्यापूर्वी प्रत्येक स्टुडिओची सारखीच तपासणी होते. आम्ही निकाल आणि तारीख दाखवतो, कागदपत्रे कधीच नाही.',
  },
  'studio.check.passed': { en: 'Passed', hi: 'पास', mr: 'पास' },
  'studio.check.pending': { en: 'Not done yet', hi: 'अभी बाकी', mr: 'अजून बाकी' },
  'studio.record.label': { en: 'From our own project data', hi: 'हमारे अपने प्रोजेक्ट डेटा से', mr: 'आमच्या स्वतःच्या प्रकल्प डेटावरून' },
  'studio.record.none': { en: 'No delivery record yet', hi: 'अभी कोई डिलीवरी रिकॉर्ड नहीं', mr: 'अजून डिलिव्हरी रेकॉर्ड नाही' },
  'studio.record.late': { en: 'Usually {n} days late', hi: 'अक्सर {n} दिन देर से', mr: 'बहुधा {n} दिवस उशिरा' },
  'studio.record.lateOne': { en: 'Usually 1 day late', hi: 'अक्सर 1 दिन देर से', mr: 'बहुधा 1 दिवस उशिरा' },
  'studio.record.note': {
    en: 'Counted only on homes that went through One Interiors, planned handover against actual.',
    hi: 'सिर्फ़ One Interiors से हुए घरों पर गिना गया, तय हैंडओवर बनाम असली।',
    mr: 'फक्त One Interiors मार्फत झालेल्या घरांवर मोजले, ठरलेले हँडओव्हर विरुद्ध प्रत्यक्ष.',
  },
  'studio.reviews.none': { en: 'No reviews yet', hi: 'अभी कोई रिव्यू नहीं', mr: 'अजून रिव्ह्यू नाहीत' },
  'studio.reviews.sub': {
    en: 'Only customers whose project went through One Interiors can review, after handover. Reviews appear here as they come in.',
    hi: 'सिर्फ़ वही ग्राहक रिव्यू दे सकते हैं जिनका प्रोजेक्ट One Interiors से हुआ, हैंडओवर के बाद। रिव्यू आते ही यहाँ दिखेंगे।',
    mr: 'फक्त ज्यांचा प्रकल्प One Interiors मार्फत झाला ते ग्राहक, हँडओव्हरनंतर, रिव्ह्यू देऊ शकतात. रिव्ह्यू आल्यावर इथे दिसतील.',
  },
  'studio.reviews.h': { en: '{stars} from {n} customers', hi: '{n} ग्राहकों से {stars}', mr: '{n} ग्राहकांकडून {stars}' },
  'studio.reviews.verified': { en: 'Verified project', hi: 'पक्का प्रोजेक्ट', mr: 'पडताळलेला प्रकल्प' },
  'studio.cta': { en: 'Get my quote from {name}', hi: '{name} से मेरा कोटेशन लें', mr: '{name} कडून माझे कोटेशन घ्या' },
  'studio.start': { en: 'Start my brief', hi: 'मेरे सवाल शुरू करें', mr: 'माझे प्रश्न सुरू करा' },
  'studio.missing.h1': { en: 'We could not find that studio.', hi: 'वह स्टूडियो हमें नहीं मिला।', mr: 'तो स्टुडिओ आम्हाला सापडला नाही.' },
  'studio.missing.sub': {
    en: 'It may have paused new work. Every studio taking work is on the full list.',
    hi: 'हो सकता है उन्होंने नया काम रोक दिया हो। काम ले रहे सभी स्टूडियो पूरी सूची में हैं।',
    mr: 'त्यांनी नवीन काम थांबवले असेल. काम घेणारे सर्व स्टुडिओ पूर्ण यादीत आहेत.',
  },
  'studio.missing.cta': { en: 'See all studios', hi: 'सभी स्टूडियो देखें', mr: 'सर्व स्टुडिओ पाहा' },
} satisfies Record<string, Entry>;

/**
 * The website's shared labels in English, Hindi and Marathi: the words for a
 * home, a scope, a priority, a finish level, a verification check — anything
 * more than one page shows. Page-only words live in that page's dictionary.
 *
 * FIRST DRAFT for native-speaker review — see `modules/i18n/site.ts`.
 * The English must stay identical to the `*_LABELS` maps it mirrors.
 */

import { tx, type Lang, type Tx } from '../site';
import type { HomeNeed, Involvement, PossessionStatus, PriorityFactor, PropertyType, PuneZone, ScopeType } from '@/modules/brief/types';
import type { Room } from '@/modules/quotation/catalogue';
import type { CheckType, VerificationTier } from '@/modules/studio/types';
import type { Tier } from '@/modules/quotation/tiers';

export const PROPERTY_TX: Record<PropertyType, Tx> = {
  BHK_1: { en: '1 BHK', hi: '1 BHK', mr: '1 BHK' },
  BHK_2: { en: '2 BHK', hi: '2 BHK', mr: '2 BHK' },
  BHK_3: { en: '3 BHK', hi: '3 BHK', mr: '3 BHK' },
  BHK_4_PLUS: { en: '4+ BHK', hi: '4+ BHK', mr: '4+ BHK' },
  VILLA: { en: 'Villa / Row house', hi: 'विला / रो हाउस', mr: 'व्हिला / रो हाऊस' },
};

export const SCOPE_TX: Record<ScopeType, Tx> = {
  FULL_HOME: { en: 'Full home', hi: 'पूरा घर', mr: 'संपूर्ण घर' },
  KITCHEN_WARDROBE: { en: 'Kitchen & wardrobes', hi: 'किचन और वॉर्डरोब', mr: 'किचन आणि वॉर्डरोब' },
  SINGLE_ROOM: { en: 'One room', hi: 'एक कमरा', mr: 'एक खोली' },
  RENOVATION: { en: 'Renovation', hi: 'रिनोवेशन', mr: 'नूतनीकरण' },
};

export const POSSESSION_TX: Record<PossessionStatus, Tx> = {
  HAVE_KEYS: { en: 'I have the keys', hi: 'चाबी मिल गई है', mr: 'चावी मिळाली आहे' },
  EXPECTED: { en: 'Expecting possession', hi: 'पज़ेशन मिलने वाला है', mr: 'पझेशन मिळणार आहे' },
  NOT_SURE: { en: 'Not sure yet', hi: 'अभी पक्का नहीं', mr: 'अजून नक्की नाही' },
};

export const INVOLVEMENT_TX: Record<Involvement, Tx> = {
  DECIDE_FOR_ME: { en: 'Decide most things for me', hi: 'ज़्यादातर चीज़ें आप तय करें', mr: 'बहुतेक गोष्टी तुम्हीच ठरवा' },
  COLLABORATE: { en: 'Work through it together', hi: 'मिलकर तय करेंगे', mr: 'मिळून ठरवू' },
  APPROVE_EVERYTHING: { en: 'I want to approve every detail', hi: 'हर बात मैं खुद मंज़ूर करूँगा/करूँगी', mr: 'प्रत्येक गोष्ट मी स्वतः मंजूर करेन' },
};

export const PRIORITY_TX: Record<PriorityFactor, Tx> = {
  BUDGET: { en: 'Staying in budget', hi: 'बजट में रहना', mr: 'बजेटमध्ये राहणे' },
  SPEED: { en: 'Finishing on time', hi: 'समय पर पूरा होना', mr: 'वेळेवर पूर्ण होणे' },
  DESIGN_AMBITION: { en: 'Design ambition', hi: 'शानदार डिज़ाइन', mr: 'उत्तम डिझाइन' },
  MATERIAL_QUALITY: { en: 'Material quality', hi: 'मटीरियल की क्वालिटी', mr: 'मटेरियलची क्वालिटी' },
};

export const HOME_NEED_TX: Record<HomeNeed, Tx> = {
  VASTU: { en: 'Vastu-compliant layout', hi: 'वास्तु के हिसाब से लेआउट', mr: 'वास्तुनुसार मांडणी' },
  POOJA_ROOM: { en: 'A pooja room or mandir', hi: 'पूजा घर या मंदिर', mr: 'देवघर किंवा मंदिर' },
  EXTRA_STORAGE: { en: 'A lot of storage', hi: 'ज़्यादा स्टोरेज', mr: 'भरपूर स्टोरेज' },
  SMART_HOME: { en: 'Smart home / automation', hi: 'स्मार्ट होम / ऑटोमेशन', mr: 'स्मार्ट होम / ऑटोमेशन' },
  LOW_MAINTENANCE: { en: 'Easy to keep clean', hi: 'साफ़ रखना आसान', mr: 'स्वच्छ ठेवायला सोपे' },
  ENTERTAINING: { en: 'Room to host people', hi: 'मेहमानों के लिए जगह', mr: 'पाहुण्यांसाठी जागा' },
};

export const ZONE_TX: Record<PuneZone, Tx> = {
  west: { en: 'West — Baner, Aundh, Pashan', hi: 'पश्चिम — बाणेर, औंध, पाषाण', mr: 'पश्चिम — बाणेर, औंध, पाषाण' },
  pcmc: { en: 'Pimpri-Chinchwad & Hinjewadi', hi: 'पिंपरी-चिंचवड और हिंजवडी', mr: 'पिंपरी-चिंचवड आणि हिंजवडी' },
  'south-west': { en: 'Kothrud, Warje & Sinhagad Road', hi: 'कोथरूड, वारजे और सिंहगड रोड', mr: 'कोथरूड, वारजे आणि सिंहगड रोड' },
  central: { en: 'Central Pune', hi: 'मध्य पुणे', mr: 'मध्य पुणे' },
  east: { en: 'East — Kharadi, Viman Nagar, Hadapsar', hi: 'पूर्व — खराडी, विमान नगर, हडपसर', mr: 'पूर्व — खराडी, विमान नगर, हडपसर' },
  south: { en: 'South — Kondhwa, NIBM, Bibwewadi', hi: 'दक्षिण — कोंढवा, NIBM, बिबवेवाडी', mr: 'दक्षिण — कोंढवा, NIBM, बिबवेवाडी' },
};

export const ROOM_TX: Record<Room, Tx> = {
  KITCHEN: { en: 'Kitchen', hi: 'किचन', mr: 'किचन' },
  MASTER_BEDROOM: { en: 'Master bedroom', hi: 'मास्टर बेडरूम', mr: 'मास्टर बेडरूम' },
  SECOND_BEDROOM: { en: 'Second bedroom', hi: 'दूसरा बेडरूम', mr: 'दुसरी बेडरूम' },
  THIRD_BEDROOM: { en: 'Third bedroom', hi: 'तीसरा बेडरूम', mr: 'तिसरी बेडरूम' },
  LIVING_DINING: { en: 'Living & dining', hi: 'लिविंग और डाइनिंग', mr: 'लिव्हिंग आणि डायनिंग' },
  BATHROOMS: { en: 'Bathrooms', hi: 'बाथरूम', mr: 'बाथरूम' },
  WHOLE_HOME: { en: 'Whole home', hi: 'पूरा घर', mr: 'संपूर्ण घर' },
  CIVIL: { en: 'Civil & renovation', hi: 'सिविल और रिनोवेशन', mr: 'सिव्हिल आणि नूतनीकरण' },
};

export const VERIFICATION_TIER_TX: Record<VerificationTier, Tx> = {
  UNVERIFIED: { en: 'Unverified', hi: 'जाँच बाकी', mr: 'तपासणी बाकी' },
  LISTED: { en: 'Listed', hi: 'लिस्टेड', mr: 'लिस्टेड' },
  VERIFIED: { en: 'Verified', hi: 'जाँचा हुआ', mr: 'तपासलेले' },
  PROVEN: { en: 'Proven', hi: 'भरोसेमंद', mr: 'विश्वासार्ह' },
};

export const CHECK_TX: Record<CheckType, Tx> = {
  PAN_NAME_MATCH: { en: 'PAN name match', hi: 'PAN पर नाम मेल खाता है', mr: 'PAN वरील नाव जुळते' },
  AADHAAR_KYC: { en: 'Identity of the principal', hi: 'मालिक की पहचान', mr: 'मालकाची ओळख' },
  ADDRESS_VISIT: { en: 'Business address visited', hi: 'ऑफ़िस का पता जाकर देखा', mr: 'ऑफिसच्या पत्त्याला भेट दिली' },
  CONTACT_REACHABLE: { en: 'Phone and email reachable', hi: 'फ़ोन और ईमेल चालू', mr: 'फोन आणि ईमेल चालू' },
  CODE_OF_CONDUCT: { en: 'Code of conduct signed', hi: 'आचार संहिता पर हस्ताक्षर', mr: 'आचारसंहितेवर सही' },
  GSTIN_ACTIVE: { en: 'GST registration active', hi: 'GST रजिस्ट्रेशन चालू', mr: 'GST नोंदणी चालू' },
  GST_FILING_HISTORY: { en: '12 months of GST filings', hi: '12 महीने के GST रिटर्न', mr: '12 महिन्यांचे GST रिटर्न' },
  MCA_STATUS: { en: 'Company filings current', hi: 'कंपनी की फ़ाइलिंग अप-टू-डेट', mr: 'कंपनीचे फाइलिंग अद्ययावत' },
  UDYAM: { en: 'Udyam / MSME registration', hi: 'उद्यम / MSME रजिस्ट्रेशन', mr: 'उद्यम / MSME नोंदणी' },
  CLIENT_REFERENCE: { en: 'Past clients contacted', hi: 'पुराने ग्राहकों से बात की', mr: 'जुन्या ग्राहकांशी बोललो' },
  SITE_INSPECTION: { en: 'Completed sites inspected', hi: 'पूरे हुए काम जाकर देखे', mr: 'पूर्ण झालेली कामे जाऊन पाहिली' },
  LITIGATION_SEARCH: { en: 'Litigation and consumer forum search', hi: 'कोर्ट केस और उपभोक्ता फ़ोरम की जाँच', mr: 'कोर्ट केस आणि ग्राहक मंचाची तपासणी' },
  RATE_CARD_FILED: { en: 'Rate card filed and locked', hi: 'रेट कार्ड जमा और लॉक', mr: 'रेट कार्ड जमा आणि लॉक' },
  WARRANTY_TERMS: { en: 'Workmanship warranty on paper', hi: 'काम की वॉरंटी लिखित में', mr: 'कामाची वॉरंटी लेखी' },
  LABOUR_INSURANCE: { en: 'Labour insurance and site safety', hi: 'मज़दूरों का बीमा और साइट सुरक्षा', mr: 'कामगार विमा आणि साइट सुरक्षा' },
};

/** The finish levels' words. Essential / Premium / Luxury stay in English. */
export const FINISH_TX: Record<Tier, { promise: Tx; notFor: Tx; materials: Tx[] }> = {
  ESSENTIAL: {
    promise: {
      en: 'Everything you need, made well, with nothing spent on show.',
      hi: 'ज़रूरत की हर चीज़, अच्छी बनी हुई, दिखावे पर कोई खर्च नहीं।',
      mr: 'गरजेच्या सगळ्या गोष्टी, चांगल्या बनवलेल्या, दिखाव्यावर खर्च नाही.',
    },
    notFor: {
      en: 'Want wood veneer, imported fittings or lots of custom-made furniture? Choose Premium — at this budget a studio would have to cut corners to fit them in.',
      hi: 'वुड वीनियर, इम्पोर्टेड फ़िटिंग या बहुत सारा कस्टम फ़र्नीचर चाहिए? Premium चुनिए — इस बजट में स्टूडियो को कहीं न कहीं कटौती करनी पड़ेगी।',
      mr: 'वुड व्हिनियर, इम्पोर्टेड फिटिंग किंवा खूप कस्टम फर्निचर हवे आहे? Premium निवडा — या बजेटमध्ये स्टुडिओला कुठेतरी काटकसर करावी लागेल.',
    },
    materials: [
      { en: 'Branded laminate finishes', hi: 'ब्रांडेड लैमिनेट फ़िनिश', mr: 'ब्रँडेड लॅमिनेट फिनिश' },
      { en: 'Standard soft-close hardware', hi: 'स्टैंडर्ड सॉफ़्ट-क्लोज़ हार्डवेयर', mr: 'स्टँडर्ड सॉफ्ट-क्लोज हार्डवेअर' },
      { en: 'False ceiling in the living room and bedrooms', hi: 'लिविंग रूम और बेडरूम में फ़ॉल्स सीलिंग', mr: 'लिव्हिंग रूम आणि बेडरूममध्ये फॉल्स सीलिंग' },
      { en: 'Modular kitchen with a standard counter', hi: 'स्टैंडर्ड काउंटर के साथ मॉड्यूलर किचन', mr: 'स्टँडर्ड काउंटरसह मॉड्युलर किचन' },
    ],
  },
  PREMIUM: {
    promise: {
      en: 'Better materials where they are touched, and more design time.',
      hi: 'जिन चीज़ों को रोज़ छूते हैं उनमें बेहतर मटीरियल, और डिज़ाइन पर ज़्यादा समय।',
      mr: 'रोज हात लागणाऱ्या गोष्टींमध्ये चांगले मटेरियल, आणि डिझाइनवर जास्त वेळ.',
    },
    notFor: {
      en: 'Want imported marble, furniture designed just for you, or walls moved and floors redone? Choose Luxury — at this budget a studio would have to cut corners to fit them in.',
      hi: 'इम्पोर्टेड मार्बल, सिर्फ़ आपके लिए डिज़ाइन किया फ़र्नीचर, या दीवारें हटवाना और फ़र्श बदलवाना चाहते हैं? Luxury चुनिए — इस बजट में स्टूडियो को कहीं न कहीं कटौती करनी पड़ेगी।',
      mr: 'इम्पोर्टेड मार्बल, खास तुमच्यासाठी डिझाइन केलेले फर्निचर, किंवा भिंती हलवणे आणि फरशी बदलणे हवे आहे? Luxury निवडा — या बजेटमध्ये स्टुडिओला कुठेतरी काटकसर करावी लागेल.',
    },
    materials: [
      { en: 'Veneer and acrylic on the pieces you see and touch', hi: 'दिखने और छूने वाली चीज़ों पर वीनियर और एक्रेलिक', mr: 'दिसणाऱ्या आणि हात लागणाऱ्या भागांवर व्हिनियर आणि ॲक्रेलिक' },
      { en: 'Hettich or Hafele hardware throughout', hi: 'हर जगह Hettich या Hafele हार्डवेयर', mr: 'सगळीकडे Hettich किंवा Hafele हार्डवेअर' },
      { en: 'Designed lighting rather than standard fittings', hi: 'स्टैंडर्ड फ़िटिंग की जगह डिज़ाइन की गई लाइटिंग', mr: 'स्टँडर्ड फिटिंगऐवजी डिझाइन केलेली लायटिंग' },
      { en: 'Quartz or granite counters', hi: 'क्वार्ट्ज़ या ग्रेनाइट काउंटर', mr: 'क्वार्ट्झ किंवा ग्रॅनाइट काउंटर' },
      { en: 'More design revisions before anything is cut', hi: 'काम शुरू होने से पहले डिज़ाइन में ज़्यादा बदलाव', mr: 'काम सुरू होण्यापूर्वी डिझाइनमध्ये जास्त बदल' },
    ],
  },
  LUXURY: {
    promise: {
      en: 'Made to your drawings, in the materials you chose.',
      hi: 'आपकी ड्रॉइंग के हिसाब से, आपके चुने हुए मटीरियल में।',
      mr: 'तुमच्या ड्रॉइंगनुसार, तुम्ही निवडलेल्या मटेरियलमध्ये.',
    },
    notFor: {
      en: 'Not the fastest option. Custom work takes longer to make, so be careful of any studio that promises Luxury work in a hurry.',
      hi: 'यह सबसे तेज़ विकल्प नहीं है। कस्टम काम में समय लगता है, इसलिए जल्दी Luxury काम का वादा करने वाले स्टूडियो से सावधान रहें।',
      mr: 'हा सर्वात जलद पर्याय नाही. कस्टम कामाला वेळ लागतो, त्यामुळे घाईत Luxury कामाचे वचन देणाऱ्या स्टुडिओपासून सावध राहा.',
    },
    materials: [
      { en: 'Imported veneer, stone and specialist finishes', hi: 'इम्पोर्टेड वीनियर, स्टोन और खास फ़िनिश', mr: 'इम्पोर्टेड व्हिनियर, स्टोन आणि खास फिनिश' },
      { en: 'Furniture designed for the room rather than selected', hi: 'चुना हुआ नहीं, कमरे के लिए डिज़ाइन किया गया फ़र्नीचर', mr: 'निवडलेले नाही, खोलीसाठी डिझाइन केलेले फर्निचर' },
      { en: 'Full lighting and automation design', hi: 'पूरी लाइटिंग और ऑटोमेशन डिज़ाइन', mr: 'संपूर्ण लायटिंग आणि ऑटोमेशन डिझाइन' },
      { en: 'Civil changes where the layout needs them', hi: 'लेआउट के लिए ज़रूरी सिविल बदलाव', mr: 'मांडणीसाठी आवश्यक सिव्हिल बदल' },
      { en: 'A dedicated designer for the length of the project', hi: 'पूरे प्रोजेक्ट के लिए एक अलग डिज़ाइनर', mr: 'संपूर्ण प्रोजेक्टसाठी एक खास डिझायनर' },
    ],
  },
};

/** `lbl(lang, SCOPE_TX, brief.scope)` — tolerant of a value the map does not know, like `propertyLabel`. */
export function lbl<K extends string>(lang: Lang, map: Record<K, Tx>, key: K | string | null | undefined): string {
  if (!key) return '';
  const entry = (map as Record<string, Tx>)[key];
  return entry ? tx(lang, entry) : tx(lang, { en: 'Other', hi: 'अन्य', mr: 'इतर' });
}

/**
 * Quotation item names, keyed by the catalogue's English label
 * (`modules/quotation/catalogue.ts`). Keyed by label, not code, because the
 * same piece ("Wardrobe") appears under several rooms with one name.
 * A label not listed here shows in English.
 */
const ITEM_LABEL_TX: Record<string, Tx> = {
  'Base cabinets': { en: 'Base cabinets', hi: 'नीचे के कैबिनेट', mr: 'खालचे कॅबिनेट' },
  'Wall cabinets': { en: 'Wall cabinets', hi: 'दीवार पर लगे कैबिनेट', mr: 'भिंतीवरचे कॅबिनेट' },
  Loft: { en: 'Loft', hi: 'लॉफ़्ट', mr: 'माळा' },
  'Tandem drawers': { en: 'Tandem drawers', hi: 'टैंडम ड्रॉअर', mr: 'टँडम ड्रॉवर' },
  Wardrobe: { en: 'Wardrobe', hi: 'वॉर्डरोब', mr: 'वॉर्डरोब' },
  'Loft over wardrobe': { en: 'Loft over wardrobe', hi: 'वॉर्डरोब के ऊपर लॉफ़्ट', mr: 'वॉर्डरोबवरचा माळा' },
  'Dressing unit & mirror': { en: 'Dressing unit & mirror', hi: 'ड्रेसिंग यूनिट और शीशा', mr: 'ड्रेसिंग युनिट आणि आरसा' },
  'Bed & headboard': { en: 'Bed & headboard', hi: 'बेड और हेडबोर्ड', mr: 'बेड आणि हेडबोर्ड' },
  'Study / workstation': { en: 'Study / workstation', hi: 'स्टडी / वर्क टेबल', mr: 'स्टडी / वर्क टेबल' },
  'TV unit': { en: 'TV unit', hi: 'TV यूनिट', mr: 'TV युनिट' },
  'Console & shoe rack': { en: 'Console & shoe rack', hi: 'कंसोल और जूते का रैक', mr: 'कन्सोल आणि चप्पल स्टँड' },
  Mandir: { en: 'Mandir', hi: 'मंदिर', mr: 'देव्हारा' },
  'Safety door': { en: 'Safety door', hi: 'सेफ़्टी डोर', mr: 'सेफ्टी डोअर' },
  'False ceiling': { en: 'False ceiling', hi: 'फ़ॉल्स सीलिंग', mr: 'फॉल्स सीलिंग' },
  Painting: { en: 'Painting', hi: 'पेंटिंग', mr: 'रंगकाम' },
  Electrical: { en: 'Electrical', hi: 'बिजली का काम', mr: 'इलेक्ट्रिकल काम' },
  Vanity: { en: 'Vanity', hi: 'वैनिटी', mr: 'व्हॅनिटी' },
  'Flooring — remove and relay': { en: 'Flooring — remove and relay', hi: 'फ़र्श — निकालकर नया लगाना', mr: 'फरशी — काढून नवी बसवणे' },
  'Bathroom renovation': { en: 'Bathroom renovation', hi: 'बाथरूम रिनोवेशन', mr: 'बाथरूम नूतनीकरण' },
  'Kitchen civil work': { en: 'Kitchen civil work', hi: 'किचन का सिविल काम', mr: 'किचनचे सिव्हिल काम' },
  'Electrical rewiring': { en: 'Electrical rewiring', hi: 'नई वायरिंग', mr: 'नवीन वायरिंग' },
  'Study unit': { en: 'Study unit', hi: 'स्टडी यूनिट', mr: 'स्टडी युनिट' },
  'Extra lofts — passage and over doors': { en: 'Extra lofts — passage and over doors', hi: 'अतिरिक्त लॉफ़्ट — पैसेज और दरवाज़ों के ऊपर', mr: 'जादा माळे — पॅसेज आणि दारांवर' },
};

/** A catalogue item's name in this language; the English label when unlisted. */
export function itemLabel(lang: Lang, english: string): string {
  const entry = ITEM_LABEL_TX[english];
  return entry ? tx(lang, entry) : english;
}

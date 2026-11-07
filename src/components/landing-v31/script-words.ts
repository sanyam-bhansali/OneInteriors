import type { Tx } from '@/modules/i18n/site';

/**
 * Words the v3.1 page's script writes at run time (step labels, the home
 * showroom, the FAQ hints). First draft of the Hindi and
 * Marathi: the owner has a native speaker read them before launch.
 */
export const SCRIPT_WORDS = {
  stepOf: { en: 'Step {n} of 5', hi: 'कदम {n} / 5', mr: 'पाऊल {n} / 5' },
  unlit: { en: 'Unlit', hi: 'अँधेरा', mr: 'अंधार' },
  from: { en: 'From {x}', hi: '{x} से', mr: '{x} पासून' },
  sqft: { en: '{n} sq ft', hi: '{n} sq ft', mr: '{n} sq ft' },
  copied: { en: 'Copied ✓', hi: 'कॉपी हो गया ✓', mr: 'कॉपी झाले ✓' },
  copyEmail: { en: 'Copy email', hi: 'ईमेल कॉपी करें', mr: 'ईमेल कॉपी करा' },
  selectEmail: { en: 'Select the email above', hi: 'ऊपर दिया ईमेल चुनिए', mr: 'वरचा ईमेल निवडा' },
  faqFound: { en: 'We found a matching answer: it is open in the circle.', hi: 'हमें एक मिलता-जुलता जवाब मिला: वह गोले में खुला है।', mr: 'आम्हाला जुळणारे उत्तर सापडले: ते वर्तुळात उघडले आहे.' },
  faqNone: {
    en: 'No ready answer yet. Press <b>Ask us</b> and send it to hello@oneinteriors.in.',
    hi: 'अभी तैयार जवाब नहीं है। <b>हमसे पूछें</b> दबाइए और इसे hello@oneinteriors.in पर भेजिए।',
    mr: 'अजून तयार उत्तर नाही. <b>आम्हाला विचारा</b> दाबा आणि ते hello@oneinteriors.in वर पाठवा.',
  },
  faqCopied: {
    en: 'Copied your question. Paste it in an email to <b>hello@oneinteriors.in</b> and an expert will reply.',
    hi: 'आपका सवाल कॉपी हो गया। इसे <b>hello@oneinteriors.in</b> पर ईमेल में डालिए, एक एक्सपर्ट जवाब देगा।',
    mr: 'तुमचा प्रश्न कॉपी झाला. तो <b>hello@oneinteriors.in</b> वर ईमेलमध्ये टाका, एक एक्सपर्ट उत्तर देईल.',
  },
  faqSend: {
    en: 'Send your question to <b>hello@oneinteriors.in</b> and an expert will reply.',
    hi: 'अपना सवाल <b>hello@oneinteriors.in</b> पर भेजिए, एक एक्सपर्ट जवाब देगा।',
    mr: 'तुमचा प्रश्न <b>hello@oneinteriors.in</b> वर पाठवा, एक एक्सपर्ट उत्तर देईल.',
  },
  sampleUntilLaunch: { en: 'Sample until launch', hi: 'लॉन्च तक नमूना', mr: 'लॉन्चपर्यंत नमुना' },
} satisfies Record<string, Tx>;

const t = (en: string, hi: string, mr: string): Tx => ({ en, hi, mr });

/** The six sample homes in the showroom. Sample until launch, as the page says. */
export const SHOWROOM: { cat: Tx; meta: Tx; name: Tx; desc: Tx; loc: Tx; area: Tx; finish: Tx; cost: string; studio: string }[] = [
  {
    cat: t('Calm', 'शांत', 'शांत'), meta: t('3 BHK · Solitaire Heights', '3 BHK · Solitaire Heights', '3 BHK · Solitaire Heights'), name: t('Linen & Light', 'Linen & Light', 'Linen & Light'),
    desc: t('Open living and kitchen in oat linen, oak and paper lanterns. Nothing loud anywhere.', 'ओट लिनन, ओक और काग़ज़ की लालटेनों में खुला लिविंग और किचन। कहीं भी कुछ भड़कीला नहीं।', 'ओट लिनन, ओक आणि कागदी कंदिलांमधील मोकळी लिव्हिंग आणि किचन. कुठेही भडक काही नाही.'),
    loc: t('Baner', 'बानेर', 'बाणेर'), area: t('1,180 sq ft', '1,180 sq ft', '1,180 sq ft'), finish: t('Premium', 'Premium', 'Premium'), cost: '₹18.4 L', studio: 'Teakline Studio',
  },
  {
    cat: t('Traditional', 'पारंपरिक', 'पारंपरिक'), meta: t('2 BHK · Kalpataru Gardens', '2 BHK · Kalpataru Gardens', '2 BHK · Kalpataru Gardens'), name: t('Pichwai & Cane', 'Pichwai & Cane', 'Pichwai & Cane'),
    desc: t('Tree-of-life art, a brass jaali pendant, cane armchair and teak, in a bright city flat.', 'ट्री-ऑफ़-लाइफ़ आर्ट, पीतल का जाली पेंडेंट, बेंत की आरामकुर्सी और सागौन, एक उजले शहरी फ़्लैट में।', 'ट्री-ऑफ-लाइफ आर्ट, पितळी जाळी पेंडंट, वेताची आरामखुर्ची आणि सागवान, एका उजळ शहरी फ्लॅटमध्ये.'),
    loc: t('Wakad', 'वाकड', 'वाकड'), area: t('880 sq ft', '880 sq ft', '880 sq ft'), finish: t('Premium', 'Premium', 'Premium'), cost: '₹9.6 L', studio: 'Maya Workshop',
  },
  {
    cat: t('Luxury', 'लग्ज़री', 'लक्झरी'), meta: t('4 BHK · Skyline Residences', '4 BHK · Skyline Residences', '4 BHK · Skyline Residences'), name: t('Charcoal & Brass', 'Charcoal & Brass', 'Charcoal & Brass'),
    desc: t('Charcoal walls, a channel-tufted bed and a brass chandelier facing the city lights.', 'चारकोल दीवारें, चैनल-टफ़्टेड बेड और शहर की रोशनी की ओर पीतल का झूमर।', 'चारकोल भिंती, चॅनल-टफ्टेड बेड आणि शहराच्या दिव्यांकडे पाहणारे पितळी झुंबर.'),
    loc: t('Koregaon Park', 'कोरेगाँव पार्क', 'कोरेगाव पार्क'), area: t('1,650 sq ft', '1,650 sq ft', '1,650 sq ft'), finish: t('Luxury', 'Luxury', 'Luxury'), cost: '₹34.5 L', studio: 'Chitra & Co.',
  },
  {
    cat: t('Modern', 'मॉडर्न', 'मॉडर्न'), meta: t('1 BHK · Nirvana Greens', '1 BHK · Nirvana Greens', '1 BHK · Nirvana Greens'), name: t('The Mustard Chair', 'The Mustard Chair', 'The Mustard Chair'),
    desc: t('White walls, oak floor and one bold chair. Honest laminate, good hinges, no false ceiling.', 'सफ़ेद दीवारें, ओक फ़र्श और एक बोल्ड कुर्सी। सच्चा लैमिनेट, अच्छे कब्ज़े, कोई फ़ॉल्स सीलिंग नहीं।', 'पांढऱ्या भिंती, ओक फरशी आणि एक ठळक खुर्ची. प्रामाणिक लॅमिनेट, चांगल्या बिजागऱ्या, फॉल्स सीलिंग नाही.'),
    loc: t('Hinjawadi', 'हिंजवडी', 'हिंजवडी'), area: t('640 sq ft', '640 sq ft', '640 sq ft'), finish: t('Essential', 'Essential', 'Essential'), cost: '₹5.95 L', studio: 'Maya Workshop',
  },
  {
    cat: t('Modern', 'मॉडर्न', 'मॉडर्न'), meta: t('2 BHK · Amaltas Residences', '2 BHK · Amaltas Residences', '2 BHK · Amaltas Residences'), name: t('Oak & Stone Kitchen', 'Oak & Stone Kitchen', 'Oak & Stone Kitchen'),
    desc: t('Quartz island, oak tall units and branded channels rated for ten years of use.', 'क्वार्ट्ज़ आइलैंड, ओक की ऊँची यूनिट और दस साल के इस्तेमाल के लिए बने ब्रांडेड चैनल।', 'क्वार्ट्झ आयलंड, ओकची उंच युनिट आणि दहा वर्षांच्या वापरासाठी बनवलेले ब्रँडेड चॅनल.'),
    loc: t('Baner', 'बानेर', 'बाणेर'), area: t('960 sq ft', '960 sq ft', '960 sq ft'), finish: t('Premium', 'Premium', 'Premium'), cost: '₹11.2 L', studio: 'Chitra & Co.',
  },
  {
    cat: t('Luxury', 'लग्ज़री', 'लक्झरी'), meta: t('3 BHK · Veda Vista', '3 BHK · Veda Vista', '3 BHK · Veda Vista'), name: t('The Halo Suite', 'The Halo Suite', 'The Halo Suite'),
    desc: t('Fluted panels, a backlit round mirror and full-height wardrobes with slim black pulls.', 'फ़्लूटेड पैनल, पीछे से रोशन गोल शीशा और पतले काले हैंडल वाले पूरी ऊँचाई के वॉर्डरोब।', 'फ्लूटेड पॅनेल, मागून उजळणारा गोल आरसा आणि सडपातळ काळ्या हँडलचे पूर्ण उंचीचे वॉर्डरोब.'),
    loc: t('Aundh', 'औंध', 'औंध'), area: t('1,050 sq ft', '1,050 sq ft', '1,050 sq ft'), finish: t('Luxury', 'Luxury', 'Luxury'), cost: '₹21.6 L', studio: 'Teakline Studio',
  },
];

/** Home sizes on the estimator's buttons, by the carpet area each starts at. */
export const HOME_SIZES: Record<number, Tx> = {
  550: t('1 BHK', '1 BHK', '1 BHK'),
  850: t('2 BHK', '2 BHK', '2 BHK'),
  1150: t('3 BHK', '3 BHK', '3 BHK'),
  1650: t('4 BHK', '4 BHK', '4 BHK'),
  2200: t('Villa', 'विला', 'व्हिला'),
};

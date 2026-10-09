/**
 * The shared customer pieces in `components/oi/` — the quote document and
 * its build, the quote canvas, the material cards, the home sketch, the
 * bottom bar, "directly or through us" — in English, Hindi and Marathi.
 *
 * FIRST DRAFT for native-speaker review — see `modules/i18n/site.ts`.
 * The English must stay identical to what those components showed.
 */

import { tx, type Lang, type Tx } from '../site';
import { ROOM_TX } from './labels';

export const OI_DICT = {
  // ── DirectVsUs ──
  'dvu.doesWork': { en: '{studio} does the work', hi: 'काम {studio} ही करेगा', mr: 'काम {studio} च करेल' },
  'dvu.caption': { en: 'Directly, or through us', hi: 'सीधे, या हमारे ज़रिए', mr: 'थेट, की आमच्यामार्फत' },
  'dvu.worth': {
    en: 'Worth up to {amount} through us, and nothing directly.',
    hi: 'हमारे ज़रिए {amount} तक का फ़ायदा, सीधे जाने पर कुछ नहीं।',
    mr: 'आमच्यामार्फत {amount} पर्यंतचा फायदा, थेट गेल्यास काहीच नाही.',
  },
  'dvu.direct': { en: 'Ringing them directly', hi: 'सीधे कॉल करने पर', mr: 'थेट फोन केल्यास' },
  'dvu.through': { en: 'Through One Interiors', hi: 'One Interiors के ज़रिए', mr: 'One Interiors मार्फत' },
  'dvu.yes': { en: 'Yes', hi: 'हाँ', mr: 'हो' },
  'dvu.lead': { en: 'Before you ring {studio}', hi: '{studio} को कॉल करने से पहले', mr: '{studio} ला फोन करण्याआधी' },

  // ── NextStepBar ──
  'bar.note': {
    en: '30 minutes with our architect, before you meet any studio',
    hi: 'किसी भी स्टूडियो से मिलने से पहले, हमारे आर्किटेक्ट के साथ 30 मिनट',
    mr: 'कोणत्याही स्टुडिओला भेटण्याआधी, आमच्या आर्किटेक्टसोबत 30 मिनिटं',
  },
  'bar.inclGst': { en: 'incl. GST', hi: 'GST सहित', mr: 'GST सह' },
  'bar.bookShort': { en: 'Book the call', hi: 'कॉल बुक करें', mr: 'कॉल बुक करा' },
  'bar.bookFreeShort': { en: 'Book free call', hi: 'मुफ़्त कॉल बुक करें', mr: 'मोफत कॉल बुक करा' },
  'bar.bookLong': { en: 'Book your architect call', hi: 'आर्किटेक्ट के साथ कॉल बुक करें', mr: 'आर्किटेक्टसोबत कॉल बुक करा' },
  'bar.bookFreeLong': {
    en: 'Book your free architect call',
    hi: 'आर्किटेक्ट के साथ मुफ़्त कॉल बुक करें',
    mr: 'आर्किटेक्टसोबत मोफत कॉल बुक करा',
  },

  // ── StyleDnaCard ──
  'dna.title': { en: 'Your style DNA', hi: 'आपका स्टाइल DNA', mr: 'तुमचा स्टाइल DNA' },
  'dna.share': { en: 'Share on WhatsApp', hi: 'WhatsApp पर शेयर करें', mr: 'WhatsApp वर शेअर करा' },

  // ── HomeSketch ──
  'sketch.empty': {
    en: 'Your home appears here as you answer.',
    hi: 'जैसे-जैसे आप जवाब देंगे, आपका घर यहाँ बनता जाएगा।',
    mr: 'तुम्ही उत्तरं देत जाल तसं तुमचं घर इथे दिसत जाईल.',
  },
  'sketch.aria': { en: 'A sketch of your {bhk} BHK', hi: 'आपके {bhk} BHK का स्केच', mr: 'तुमच्या {bhk} BHK चं स्केच' },
  'sketch.master': { en: 'Master', hi: 'मास्टर', mr: 'मास्टर' },
  'sketch.bed2': { en: 'Bed 2', hi: 'बेड 2', mr: 'बेड 2' },
  'sketch.bed3': { en: 'Bed 3', hi: 'बेड 3', mr: 'बेड 3' },
  'sketch.living': { en: 'Living & dining', hi: 'लिविंग और डाइनिंग', mr: 'लिव्हिंग आणि डायनिंग' },
  'sketch.bath': { en: 'Bath', hi: 'बाथ', mr: 'बाथ' },
  'sketch.bed4': { en: 'Bed 4', hi: 'बेड 4', mr: 'बेड 4' },
  'sketch.balcony': { en: 'Balcony', hi: 'बालकनी', mr: 'बाल्कनी' },
  'sketch.note': {
    en: 'A typical {bhk} BHK, furnished in your style. Not your floor plan — the studio measures that.',
    hi: 'एक आम {bhk} BHK, आपकी स्टाइल में सजा हुआ। यह आपका फ़्लोर प्लान नहीं है — वह स्टूडियो नापकर बनाएगा।',
    mr: 'एक साधारण {bhk} BHK, तुमच्या स्टाइलमध्ये सजवलेले. हा तुमचा फ्लोअर प्लॅन नाही — तो स्टुडिओ मोजून बनवेल.',
  },
  'sketch.kitchen': { en: 'Kitchen', hi: 'किचन', mr: 'किचन' },
  'sketch.adult': { en: '{n} adult', hi: '{n} बड़ा', mr: '{n} मोठी व्यक्ती' },
  'sketch.adults': { en: '{n} adults', hi: '{n} बड़े', mr: '{n} मोठी माणसं' },
  'sketch.child': { en: '{n} child', hi: '{n} बच्चा', mr: '{n} मूल' },
  'sketch.children': { en: '{n} children', hi: '{n} बच्चे', mr: '{n} मुलं' },
  'sketch.elderly': { en: '{n} elderly', hi: '{n} बुज़ुर्ग', mr: '{n} ज्येष्ठ' },
  'sketch.pets': { en: 'pets', hi: 'पालतू जानवर', mr: 'पाळीव प्राणी' },
  'sketch.wfh': { en: 'works from home', hi: 'घर से काम', mr: 'घरून काम' },
  'sketch.keysInHand': { en: 'Keys in hand', hi: 'चाबी मिल गई', mr: 'चावी मिळाली' },
  'sketch.keysOn': { en: 'Keys {month}', hi: 'चाबी: {month}', mr: 'चावी: {month}' },
  'sketch.keysExpected': { en: 'Keys expected', hi: 'चाबी मिलने वाली है', mr: 'चावी मिळणार आहे' },

  // ── Flat3D ──
  'flat3d.fail': {
    en: 'This browser cannot draw the 3D view.',
    hi: 'यह ब्राउज़र 3D व्यू नहीं दिखा सकता।',
    mr: 'हा ब्राउझर 3D व्ह्यू दाखवू शकत नाही.',
  },

  // ── QuotePlan ──
  'plan.notIn': { en: 'Not in this quote', hi: 'इस कोटेशन में नहीं', mr: 'या कोटेशनमध्ये नाही' },
  'plan.label': {
    en: 'Your home, room by room — tap a room to see its lines',
    hi: 'आपका घर, कमरा-दर-कमरा — किसी कमरे पर टैप करें और उसकी लाइनें देखें',
    mr: 'तुमचं घर, खोलीनुसार — खोलीवर टॅप करा आणि तिच्या ओळी बघा',
  },
  'plan.schematic': {
    en: 'A schematic of a typical layout, not your floor plan.',
    hi: 'यह आम लेआउट का नक्शा है, आपका फ़्लोर प्लान नहीं।',
    mr: 'हा नेहमीच्या लेआउटचा नकाशा आहे, तुमचा फ्लोअर प्लॅन नाही.',
  },

  // ── StudioQuotePanel ──
  'panel.eyebrow': { en: 'Your quote', hi: 'आपका कोटेशन', mr: 'तुमचं कोटेशन' },
  'panel.noBrief': {
    en: 'About four minutes on your flat and we will price this studio line by line — in about ten seconds, with every line carrying a quantity.',
    hi: 'अपने फ़्लैट के बारे में लगभग चार मिनट, और हम इस स्टूडियो का लाइन-दर-लाइन दाम निकाल देंगे — लगभग दस सेकंड में, हर लाइन में मात्रा के साथ।',
    mr: 'तुमच्या फ्लॅटबद्दल सुमारे चार मिनिटं, आणि आम्ही या स्टुडिओचे ओळीने ओळ दर काढू — सुमारे दहा सेकंदांत, प्रत्येक ओळीत प्रमाणासह.',
  },
  'panel.start': { en: 'Start the brief', hi: 'अपनी ज़रूरतें बताएँ', mr: 'तुमच्या गरजा सांगा' },
  'panel.inCompare': { en: 'In your comparison', hi: 'आपकी तुलना में है', mr: 'तुमच्या तुलनेत आहे' },
  'panel.addCompare': { en: 'Add to compare', hi: 'तुलना में जोड़ें', mr: 'तुलनेत जोडा' },
  'panel.compareN': { en: 'Compare {n} line for line', hi: '{n} की लाइन-दर-लाइन तुलना करें', mr: '{n} ची ओळीने ओळ तुलना करा' },
  'panel.priceOneMore': {
    en: 'Price one more studio to compare them.',
    hi: 'तुलना के लिए एक और स्टूडियो का दाम निकालें।',
    mr: 'तुलनेसाठी आणखी एका स्टुडिओचे दर काढा.',
  },
  'panel.addSecond': {
    en: 'Add a second quote to compare.',
    hi: 'तुलना के लिए दूसरा कोटेशन जोड़ें।',
    mr: 'तुलनेसाठी दुसरं कोटेशन जोडा.',
  },
  'panel.built': { en: 'Built {date}', hi: 'बना: {date}', mr: 'बनवलं: {date}' },

  // ── QuoteFlow: the gate ──
  'gate.eyebrow': { en: 'Before we price it', hi: 'दाम निकालने से पहले', mr: 'दर काढण्याआधी' },
  'gate.h2': {
    en: 'One number decides most of the quote.',
    hi: 'एक नंबर से ज़्यादातर कोटेशन तय होता है।',
    mr: 'एका आकड्यावर बहुतेक कोटेशन ठरतं.',
  },
  'gate.body': {
    en: 'The length of your kitchen platform. Measure it and we price your kitchen; skip it and we price a typical one for a {bhk} BHK, and say so on the quote.',
    hi: 'आपके किचन प्लैटफ़ॉर्म की लंबाई। नापकर बताएँगे तो हम आपके किचन का दाम निकालेंगे; छोड़ देंगे तो {bhk} BHK के आम किचन का दाम निकालेंगे, और कोटेशन पर यह लिख देंगे।',
    mr: 'तुमच्या किचन प्लॅटफॉर्मची लांबी. मोजून सांगितलीत तर आम्ही तुमच्या किचनचे दर काढू; सोडून दिलीत तर {bhk} BHK च्या नेहमीच्या किचनचे दर काढू, आणि कोटेशनवर तसं लिहू.',
  },
  'gate.standard': {
    en: 'Price it now on a standard {bhk} BHK kitchen',
    hi: 'अभी {bhk} BHK के स्टैंडर्ड किचन पर दाम निकालें',
    mr: 'आत्ता {bhk} BHK च्या स्टँडर्ड किचनवर दर काढा',
  },
  'gate.standardNote': {
    en: 'A {mm}mm platform, which is what a {bhk} BHK usually has. Every other size in the quote is standard anyway. The range is ±16%, and the document says so.',
    hi: '{mm}mm का प्लैटफ़ॉर्म, जो आम तौर पर {bhk} BHK में होता है। कोटेशन के बाकी सारे साइज़ वैसे भी स्टैंडर्ड हैं। रेंज ±16% है, और कोटेशन में यह लिखा है।',
    mr: '{mm}mm चा प्लॅटफॉर्म, जो साधारणपणे {bhk} BHK मध्ये असतो. कोटेशनमधले बाकी सगळे साइझ तसेही स्टँडर्ड आहेत. रेंज ±16% आहे, आणि कोटेशनमध्ये तसं लिहिलंय.',
  },
  'gate.own': {
    en: 'Or tell us your kitchen platform, in mm',
    hi: 'या अपने किचन प्लैटफ़ॉर्म की लंबाई mm में बताएँ',
    mr: 'किंवा तुमच्या किचन प्लॅटफॉर्मची लांबी mm मध्ये सांगा',
  },
  'gate.placeholder': { en: 'e.g. 3600', hi: 'जैसे 3600', mr: 'उदा. 3600' },
  'gate.measureHelp': {
    en: 'Measure the run your counter sits on. Most Pune flats are between 3,000 and 5,500mm. A rough number is worth more than none, and it narrows the range to ±12%.',
    hi: 'जिस पर काउंटर बैठा है, उसकी लंबाई नापें। पुणे के ज़्यादातर फ़्लैट में यह 3,000 से 5,500mm के बीच होती है। अंदाज़न नंबर भी कुछ न होने से बेहतर है, और इससे रेंज ±12% तक आ जाती है।',
    mr: 'ज्यावर काउंटर बसतो, त्याची लांबी मोजा. पुण्यातल्या बहुतेक फ्लॅट्समध्ये ती 3,000 ते 5,500mm असते. अंदाजे आकडाही काहीच नसण्यापेक्षा चांगला, आणि त्याने रेंज ±12% पर्यंत येते.',
  },
  'gate.build': { en: 'Build it on {mm}mm', hi: '{mm}mm पर कोटेशन बनाएँ', mr: '{mm}mm वर कोटेशन बनवा' },
  'gate.outside': {
    en: 'That is outside 1,500–9,000mm — check the number, or use the standard kitchen above.',
    hi: 'यह 1,500–9,000mm से बाहर है — नंबर जाँचें, या ऊपर वाला स्टैंडर्ड किचन चुनें।',
    mr: 'हे 1,500–9,000mm च्या बाहेर आहे — आकडा तपासा, किंवा वरचं स्टँडर्ड किचन वापरा.',
  },

  // ── QuoteFlow: the document ──
  'doc.eyebrow': { en: 'First quote · generated', hi: 'पहला कोटेशन · तैयार', mr: 'पहिलं कोटेशन · तयार' },
  'doc.preparedFor': { en: 'Prepared for {name}', hi: '{name} के लिए', mr: '{name} यांच्यासाठी' },
  'doc.archive': {
    en: 'Pre-launch — priced on archive rates, not this studio’s own filed card',
    hi: 'लॉन्च से पहले — पुराने रेट पर दाम, इस स्टूडियो के अपने दिए रेट पर नहीं',
    mr: 'लॉन्चपूर्वी — जुन्या दरांवर, या स्टुडिओच्या स्वतःच्या दिलेल्या दरांवर नाही',
  },
  'doc.howMade': { en: 'How the total is made', hi: 'कुल रक़म कैसे बनी', mr: 'एकूण रक्कम कशी झाली' },
  'doc.work': { en: 'Work · all {n} lines', hi: 'काम · सभी {n} लाइनें', mr: 'काम · सगळ्या {n} ओळी' },
  'doc.split': {
    en: '{factory} made in the factory · {site} built on site',
    hi: '{factory} फ़ैक्टरी में बना · {site} साइट पर बना',
    mr: '{factory} फॅक्टरीत बनलेलं · {site} साइटवर बनलेलं',
  },
  'doc.fee': { en: '+ Professional fee · 7%', hi: '+ प्रोफ़ेशनल फ़ीस · 7%', mr: '+ प्रोफेशनल फी · 7%' },
  'doc.factoryDiscount': { en: '− Factory discount · 10%', hi: '− फ़ैक्टरी छूट · 10%', mr: '− फॅक्टरी सूट · 10%' },
  'doc.curatedDiscount': {
    en: '− One Interiors discount · {pct}%',
    hi: '− One Interiors छूट · {pct}%',
    mr: '− One Interiors सूट · {pct}%',
  },
  'doc.beforeGst': { en: '= Before GST', hi: '= GST से पहले', mr: '= GST आधी' },
  'doc.gst': { en: '+ GST · 18%', hi: '+ GST · 18%', mr: '+ GST · 18%' },
  'doc.total': { en: '= Total', hi: '= कुल', mr: '= एकूण' },
  'doc.notPricedOne': {
    en: '{n} item not in this total — this studio has not filed a rate for them',
    hi: '{n} चीज़ इस रक़म में नहीं है — इस स्टूडियो ने उसका रेट नहीं दिया है',
    mr: '{n} वस्तू या रकमेत नाही — या स्टुडिओने तिचा दर दिलेला नाही',
  },
  'doc.notPricedMany': {
    en: '{n} items not in this total — this studio has not filed a rate for them',
    hi: '{n} चीज़ें इस रक़म में नहीं हैं — इस स्टूडियो ने उनका रेट नहीं दिया है',
    mr: '{n} वस्तू या रकमेत नाहीत — या स्टुडिओने त्यांचे दर दिलेले नाहीत',
  },
  'doc.builtOn': { en: 'What this is built on', hi: 'यह किस आधार पर बना है', mr: 'हे कशाच्या आधारावर बनलंय' },
  'doc.runMeasured': {
    en: 'Kitchen run as you measured it.',
    hi: 'किचन की लंबाई आपके नाप के हिसाब से।',
    mr: 'किचनची लांबी तुम्ही मोजल्याप्रमाणे.',
  },
  'doc.runStandard': {
    en: 'No measurement — a standard kitchen was used.',
    hi: 'कोई नाप नहीं — स्टैंडर्ड किचन लिया गया।',
    mr: 'मोजमाप नाही — स्टँडर्ड किचन धरलं.',
  },
  'doc.phases': { en: 'Payment phases', hi: 'पेमेंट की किस्तें', mr: 'पेमेंटचे हप्ते' },
  'doc.advanceHigh': {
    en: '{studio} asks {pct}% at booking — more than most Pune studios. Worth asking what it covers before you pay it.',
    hi: '{studio} बुकिंग पर {pct}% माँगता है — पुणे के ज़्यादातर स्टूडियो से ज़्यादा। देने से पहले पूछ लेना ठीक रहेगा कि इसमें क्या-क्या आता है।',
    mr: '{studio} बुकिंगला {pct}% मागतो — पुण्यातल्या बहुतेक स्टुडिओंपेक्षा जास्त. देण्याआधी त्यात काय काय येतं ते विचारून घ्या.',
  },
  'doc.noPhases': {
    en: '{studio} has not filed its payment schedule with us yet. Our expert confirms it with them before you meet — and how much is paid before anything is installed is worth asking.',
    hi: '{studio} ने अभी तक अपना पेमेंट शेड्यूल हमें नहीं दिया है। आपकी मुलाक़ात से पहले हमारे एक्सपर्ट उनसे पक्का कर लेंगे — और कुछ भी लगने से पहले कितना पैसा देना है, यह पूछना ज़रूरी है।',
    mr: '{studio} ने अजून त्यांचं पेमेंट शेड्यूल आम्हाला दिलेलं नाही. तुमच्या भेटीआधी आमचे एक्सपर्ट त्यांच्याकडून ते नक्की करतील — आणि काहीही बसवण्याआधी किती पैसे द्यायचे, हे विचारणं महत्त्वाचं आहे.',
  },
  'doc.underlined': {
    en: 'Underlined materials open an explanation — what it is, and what the cheaper version costs',
    hi: 'अंडरलाइन किए मटीरियल पर टैप करें — वह क्या है, और सस्ता विकल्प कितने का है',
    mr: 'अधोरेखित मटेरियलवर टॅप करा — ते काय आहे, आणि स्वस्त पर्याय किती पडतो',
  },
  'doc.keep': {
    en: 'Book this quote through One Interiors to keep:',
    hi: 'ये फ़ायदे पाने के लिए यह कोटेशन One Interiors के ज़रिए बुक करें:',
    mr: 'हे फायदे मिळवण्यासाठी हे कोटेशन One Interiors मार्फत बुक करा:',
  },
  'doc.printCta': {
    en: 'Start with your expert call at oneinteriors.in/expert — {studio} is introduced to you through us.',
    hi: 'oneinteriors.in/expert पर अपनी एक्सपर्ट कॉल से शुरुआत करें — {studio} से आपकी मुलाक़ात हमारे ज़रिए होगी।',
    mr: 'oneinteriors.in/expert वर तुमच्या एक्सपर्ट कॉलने सुरुवात करा — {studio} शी तुमची ओळख आमच्यामार्फत होईल.',
  },
  'doc.cta': {
    en: 'Start with your expert call — {studio} is introduced to you through us →',
    hi: 'अपनी एक्सपर्ट कॉल से शुरुआत करें — {studio} से आपकी मुलाक़ात हमारे ज़रिए होगी →',
    mr: 'तुमच्या एक्सपर्ट कॉलने सुरुवात करा — {studio} शी तुमची ओळख आमच्यामार्फत होईल →',
  },
  'doc.powered': { en: 'Powered by One Interiors', hi: 'One Interiors द्वारा', mr: 'One Interiors द्वारे' },
  'doc.print': { en: 'Print or save as PDF', hi: 'प्रिंट करें या PDF सेव करें', mr: 'प्रिंट करा किंवा PDF सेव्ह करा' },

  // ── QuoteFlow: tighten ──
  'measure.label': { en: 'Tighten this quote', hi: 'कोटेशन और सटीक करें', mr: 'कोटेशन अजून अचूक करा' },
  'measure.body': {
    en: 'Measure your kitchen platform and every studio is re-priced on it — the range narrows from ±16% to ±12%.',
    hi: 'अपना किचन प्लैटफ़ॉर्म नापें, और हर स्टूडियो का दाम उसी पर दोबारा निकलेगा — रेंज ±16% से घटकर ±12% हो जाएगी।',
    mr: 'तुमचा किचन प्लॅटफॉर्म मोजा, आणि प्रत्येक स्टुडिओचे दर त्यावर पुन्हा निघतील — रेंज ±16% वरून ±12% होईल.',
  },
  'measure.placeholder': { en: 'Platform length, mm', hi: 'प्लैटफ़ॉर्म की लंबाई, mm', mr: 'प्लॅटफॉर्मची लांबी, mm' },
  'measure.reprice': { en: 'Re-price every studio', hi: 'हर स्टूडियो का दाम दोबारा निकालें', mr: 'प्रत्येक स्टुडिओचे दर पुन्हा काढा' },
  'measure.range': { en: 'Between 1,500 and 9,000 mm.', hi: '1,500 से 9,000 mm के बीच।', mr: '1,500 ते 9,000 mm दरम्यान.' },

  // ── Building ──
  'build.eyebrow': { en: 'Building your first quote', hi: 'आपका पहला कोटेशन बन रहा है', mr: 'तुमचं पहिलं कोटेशन बनतंय' },
  'build.h1': { en: 'Pricing {studio} on your flat.', hi: 'आपके फ़्लैट पर {studio} का दाम निकाल रहे हैं।', mr: 'तुमच्या फ्लॅटवर {studio} चे दर काढतोय.' },
  'build.ready': { en: 'Quotation ready', hi: 'कोटेशन तैयार', mr: 'कोटेशन तयार' },
  'build.skipAll': { en: 'Skip to the quote', hi: 'सीधे कोटेशन पर जाएँ', mr: 'थेट कोटेशनवर जा' },
  'build.questionAria': { en: 'One question while you wait', hi: 'इंतज़ार के दौरान एक सवाल', mr: 'वाट पाहताना एक प्रश्न' },
  'build.yourTurn': { en: 'Your turn', hi: 'अब आपकी बारी', mr: 'आता तुमची पाळी' },
  'build.skip': { en: 'Skip', hi: 'छोड़ें', mr: 'सोडा' },
  'build.right': { en: 'That is the one', hi: 'यही सही है', mr: 'हेच बरोबर' },
  'build.wrong': { en: 'Not this time', hi: 'इस बार नहीं', mr: 'या वेळी नाही' },
  'build.see': { en: 'See your quote', hi: 'अपना कोटेशन देखें', mr: 'तुमचं कोटेशन बघा' },
  'build.waitAria': { en: 'While you wait', hi: 'इंतज़ार के दौरान', mr: 'वाट पाहताना' },
  'build.worth': { en: 'Worth knowing about your quote', hi: 'आपके कोटेशन के बारे में जानने लायक', mr: 'तुमच्या कोटेशनबद्दल माहीत असावं असं' },
  'stage.measured': {
    en: 'Taking the kitchen platform run you measured',
    hi: 'आपके नापे हुए किचन प्लैटफ़ॉर्म की लंबाई ले रहे हैं',
    mr: 'तुम्ही मोजलेली किचन प्लॅटफॉर्मची लांबी घेतोय',
  },
  'stage.standard': {
    en: 'Sizing a standard {bhk} BHK kitchen',
    hi: '{bhk} BHK के स्टैंडर्ड किचन का साइज़ ले रहे हैं',
    mr: '{bhk} BHK च्या स्टँडर्ड किचनचा साइझ घेतोय',
  },
  'stage.rooms': {
    en: 'Sizing each room against the standard template',
    hi: 'हर कमरे का साइज़ स्टैंडर्ड टेम्पलेट से मिला रहे हैं',
    mr: 'प्रत्येक खोलीचा साइझ स्टँडर्ड टेम्प्लेटशी जुळवतोय',
  },
  'stage.quantity': { en: 'Giving every line a quantity', hi: 'हर लाइन की मात्रा तय कर रहे हैं', mr: 'प्रत्येक ओळीचं प्रमाण ठरवतोय' },
  'stage.filed': {
    en: 'Applying the studio’s own filed rates',
    hi: 'स्टूडियो के अपने दिए रेट लगा रहे हैं',
    mr: 'स्टुडिओचे स्वतःचे दिलेले दर लावतोय',
  },
  'stage.archive': {
    en: 'Pricing on archive rates — this studio has not filed its own yet',
    hi: 'पुराने रेट पर दाम — इस स्टूडियो ने अपने रेट अभी नहीं दिए हैं',
    mr: 'जुन्या दरांवर किंमत — या स्टुडिओने स्वतःचे दर अजून दिलेले नाहीत',
  },
  'stage.writing': {
    en: 'Writing the quotation, line by line',
    hi: 'कोटेशन लाइन-दर-लाइन लिख रहे हैं',
    mr: 'कोटेशन ओळीने ओळ लिहितोय',
  },
  'aside.0': { en: 'Three weeks, down to ten seconds.', hi: 'तीन हफ़्ते का काम, दस सेकंड में।', mr: 'तीन आठवड्यांचं काम, दहा सेकंदांत.' },
  'aside.1': { en: 'Not phoning anyone. Not even once.', hi: 'किसी को फ़ोन नहीं। एक बार भी नहीं।', mr: 'कोणालाही फोन नाही. एकदाही नाही.' },
  'aside.2': {
    en: 'No “ma’am, please visit our office”.',
    hi: 'कोई “मैडम, प्लीज़ हमारे ऑफ़िस आइए” नहीं।',
    mr: 'कोणतंही “मॅडम, प्लीज आमच्या ऑफिसला या” नाही.',
  },
  'aside.3': {
    en: 'Measuring in millimetres, like a grown-up.',
    hi: 'मिलीमीटर में नाप, पूरी समझदारी से।',
    mr: 'मिलिमीटरमध्ये मोजमाप, पूर्ण समजुतीने.',
  },
  'aside.4': {
    en: 'Resisting the urge to write “premium ply”.',
    hi: '“प्रीमियम प्लाई” लिखने का मन रोक रहे हैं।',
    mr: '“प्रीमियम प्लाय” लिहायचा मोह टाळतोय.',
  },
  'aside.5': { en: 'Every line is getting a quantity.', hi: 'हर लाइन को मात्रा मिल रही है।', mr: 'प्रत्येक ओळीला प्रमाण मिळतंय.' },
  'aside.6': {
    en: 'No WhatsApp forward is being prepared.',
    hi: 'कोई WhatsApp फ़ॉरवर्ड तैयार नहीं हो रहा।',
    mr: 'कोणताही WhatsApp फॉरवर्ड तयार होत नाहीये.',
  },
  'aside.7': {
    en: 'Checking that “soft-close” means something.',
    hi: 'देख रहे हैं कि “सॉफ़्ट-क्लोज़” का सच में कोई मतलब है।',
    mr: '“सॉफ्ट-क्लोज” चा खरंच काही अर्थ आहे का ते बघतोय.',
  },

  // ── Material ──
  'mat.what': { en: 'What {name} means', hi: '{name} का मतलब', mr: '{name} म्हणजे काय' },
  'mat.saves': { en: 'to skip it', hi: 'छोड़ने पर', mr: 'वगळल्यास' },
  'mat.either': { en: 'either way', hi: 'दोनों तरह से', mr: 'दोन्हीकडे' },
  'mat.close': { en: 'Close', hi: 'बंद करें', mr: 'बंद करा' },
  'mat.long': { en: 'The long version', hi: 'पूरी जानकारी', mr: 'सविस्तर माहिती' },
  'mat.closeAria': { en: 'Close the explanation', hi: 'जानकारी बंद करें', mr: 'माहिती बंद करा' },
  'mat.photo': { en: 'Photo: {name} / Unsplash', hi: 'फ़ोटो: {name} / Unsplash', mr: 'फोटो: {name} / Unsplash' },

  // ── QuoteCanvas ──
  'canvas.eyebrow': { en: 'Shape this quote', hi: 'यह कोटेशन अपने हिसाब से बदलें', mr: 'हे कोटेशन तुमच्या हिशोबाने बदला' },
  'canvas.h2': {
    en: 'Change it, and every studio re-prices.',
    hi: 'बदलिए, और हर स्टूडियो का दाम फिर से निकलेगा।',
    mr: 'बदला, आणि प्रत्येक स्टुडिओचे दर पुन्हा निघतील.',
  },
  'canvas.body': {
    en: 'Take things out, put them back, set your kitchen size. Nothing is saved until you say so.',
    hi: 'चीज़ें हटाइए, वापस जोड़िए, किचन का साइज़ सेट कीजिए। जब तक आप न कहें, कुछ भी सेव नहीं होगा।',
    mr: 'वस्तू काढा, परत टाका, किचनचा साइझ ठरवा. तुम्ही सांगेपर्यंत काहीही सेव्ह होणार नाही.',
  },
  'canvas.nothing': { en: 'Nothing in the quote', hi: 'कोटेशन में कुछ नहीं', mr: 'कोटेशनमध्ये काहीच नाही' },
  'canvas.inQuote': { en: '{n} of {of} in the quote', hi: '{of} में से {n} कोटेशन में', mr: '{of} पैकी {n} कोटेशनमध्ये' },
  'canvas.notPriced': { en: 'not priced', hi: 'दाम नहीं', mr: 'दर नाही' },
  'canvas.out': { en: 'out', hi: 'हटाया', mr: 'काढलं' },
  'canvas.run': { en: 'Kitchen platform length', hi: 'किचन प्लैटफ़ॉर्म की लंबाई', mr: 'किचन प्लॅटफॉर्मची लांबी' },
  'canvas.runReal': {
    en: 'Priced on your real length, so every studio’s range is narrower.',
    hi: 'आपकी असली लंबाई पर दाम, इसलिए हर स्टूडियो की रेंज कम है।',
    mr: 'तुमच्या खऱ्या लांबीवर दर, त्यामुळे प्रत्येक स्टुडिओची रेंज कमी आहे.',
  },
  'canvas.runGuess': {
    en: 'Measured your platform? Set the real length — the biggest guess on the quote goes away.',
    hi: 'प्लैटफ़ॉर्म नाप लिया? असली लंबाई डालिए — कोटेशन का सबसे बड़ा अंदाज़ा हट जाएगा।',
    mr: 'प्लॅटफॉर्म मोजलात? खरी लांबी टाका — कोटेशनमधला सगळ्यात मोठा अंदाज निघून जाईल.',
  },
  'canvas.thisQuote': { en: '{name} · this quote', hi: '{name} · यह कोटेशन', mr: '{name} · हे कोटेशन' },
  'canvas.inclGst': { en: '· incl. GST', hi: '· GST सहित', mr: '· GST सह' },
  'canvas.fromHad': { en: '{delta} from the quote you had', hi: 'पिछले कोटेशन से {delta}', mr: 'आधीच्या कोटेशनपेक्षा {delta}' },
  'canvas.live': { en: 'Every match, live', hi: 'हर मैच, लाइव', mr: 'प्रत्येक मॅच, लाइव्ह' },
  'canvas.thisOne': { en: 'this one', hi: 'यह वाला', mr: 'हा' },
  'canvas.save': { en: 'Save to my brief', hi: 'मेरी ज़रूरतों में सेव करें', mr: 'माझ्या गरजांमध्ये सेव्ह करा' },
  'canvas.undo': { en: 'Undo changes', hi: 'बदलाव हटाएँ', mr: 'बदल रद्द करा' },
  'canvas.tap': {
    en: 'Tap a room to take things out or put them back.',
    hi: 'चीज़ें हटाने या वापस जोड़ने के लिए किसी कमरे पर टैप करें।',
    mr: 'वस्तू काढायला किंवा परत टाकायला खोलीवर टॅप करा.',
  },
} satisfies Record<string, Tx>;

/** Descriptions of the material drawings (MaterialArt), for screen readers. Keyed by the English. */
export const ART_TX: Record<string, Tx> = {
  'Two board edges standing in water: one holds together, one swells apart': {
    en: 'Two board edges standing in water: one holds together, one swells apart',
    hi: 'पानी में खड़े दो बोर्ड के किनारे: एक जुड़ा रहता है, दूसरा फूलकर बिखर जाता है',
    mr: 'पाण्यात उभ्या दोन बोर्डच्या कडा: एक टिकून राहते, दुसरी फुगून सुटते',
  },
  'A board in a dry room, intact': {
    en: 'A board in a dry room, intact',
    hi: 'सूखे कमरे में एक बोर्ड, बिल्कुल ठीक',
    mr: 'कोरड्या खोलीतला एक बोर्ड, अगदी व्यवस्थित',
  },
  'Grain showing through paint on one panel, none on the other': {
    en: 'Grain showing through paint on one panel, none on the other',
    hi: 'एक पैनल पर पेंट के नीचे से लकड़ी के रेशे दिखते हैं, दूसरे पर नहीं',
    mr: 'एका पॅनलवर रंगाखालून लाकडाचे धागे दिसतात, दुसऱ्यावर नाही',
  },
  'A board made of glued wood chips': {
    en: 'A board made of glued wood chips',
    hi: 'चिपकाए गए लकड़ी के टुकड़ों से बना बोर्ड',
    mr: 'चिकटवलेल्या लाकडी तुकड्यांपासून बनलेला बोर्ड',
  },
  'A thick shelf staying flat and a thin one bowing under the same load': {
    en: 'A thick shelf staying flat and a thin one bowing under the same load',
    hi: 'एक जैसे वज़न में मोटी शेल्फ़ सीधी रहती है और पतली झुक जाती है',
    mr: 'सारख्याच वजनाखाली जाड शेल्फ सरळ राहतो आणि पातळ वाकतो',
  },
  'A magnified board edge: thick skin intact, thin skin worn through to the core': {
    en: 'A magnified board edge: thick skin intact, thin skin worn through to the core',
    hi: 'बोर्ड का बड़ा किया किनारा: मोटी परत ठीक है, पतली परत घिसकर अंदर तक पहुँच गई',
    mr: 'मोठी करून दाखवलेली बोर्डची कड: जाड थर व्यवस्थित, पातळ थर झिजून आतपर्यंत गेलेला',
  },
  'A shutter corner: one edge sealed, the other chipped away': {
    en: 'A shutter corner: one edge sealed, the other chipped away',
    hi: 'शटर का कोना: एक किनारा सील, दूसरा टूटकर उखड़ा हुआ',
    mr: 'शटरचा कोपरा: एक कड सील केलेली, दुसरी तुटून निघालेली',
  },
  'Two dials: one filled a quarter of the way, one nearly full': {
    en: 'Two dials: one filled a quarter of the way, one nearly full',
    hi: 'दो डायल: एक चौथाई भरा, एक लगभग पूरा',
    mr: 'दोन डायल: एक पाव भरलेला, एक जवळजवळ पूर्ण',
  },
  'One drawer pulled fully clear of the cabinet, one stopping short': {
    en: 'One drawer pulled fully clear of the cabinet, one stopping short',
    hi: 'एक दराज़ कैबिनेट से पूरी बाहर निकलती है, दूसरी बीच में रुक जाती है',
    mr: 'एक ड्रॉवर कॅबिनेटमधून पूर्ण बाहेर येतो, दुसरा मधेच थांबतो',
  },
  'A bed base lifted on a gas strut': {
    en: 'A bed base lifted on a gas strut',
    hi: 'गैस स्ट्रट पर उठा हुआ बेड का बेस',
    mr: 'गॅस स्ट्रटवर उचललेला बेडचा बेस',
  },
  'The same ceiling board on close framing and on wide framing': {
    en: 'The same ceiling board on close framing and on wide framing',
    hi: 'एक ही सीलिंग बोर्ड, पास-पास फ़्रेमिंग पर और दूर-दूर फ़्रेमिंग पर',
    mr: 'एकच सीलिंग बोर्ड, जवळजवळ फ्रेमिंगवर आणि लांबलांब फ्रेमिंगवर',
  },
  'One welded joint sealed, the other bleeding rust': {
    en: 'One welded joint sealed, the other bleeding rust',
    hi: 'एक वेल्ड जोड़ सील है, दूसरे से ज़ंग रिस रहा है',
    mr: 'एक वेल्ड जोड सील केलेला, दुसऱ्यातून गंज झिरपतोय',
  },
  'A ground mirror edge beside a square-cut one': {
    en: 'A ground mirror edge beside a square-cut one',
    hi: 'घिसकर चिकना किया आईने का किनारा, सीधे कटे किनारे के बगल में',
    mr: 'घासून गुळगुळीत केलेली आरशाची कड, सरळ कापलेल्या कडेशेजारी',
  },
  'Four paint layers on one wall, the primer missing from the other': {
    en: 'Four paint layers on one wall, the primer missing from the other',
    hi: 'एक दीवार पर पेंट की चार परतें, दूसरी पर प्राइमर ही नहीं',
    mr: 'एका भिंतीवर रंगाचे चार थर, दुसऱ्यावर प्रायमरच नाही',
  },
  'Cable inside a pipe, and cable buried straight into plaster': {
    en: 'Cable inside a pipe, and cable buried straight into plaster',
    hi: 'पाइप के अंदर केबल, और सीधे प्लास्टर में दबी केबल',
    mr: 'पाइपमधली केबल, आणि थेट प्लास्टरमध्ये गाडलेली केबल',
  },
};

/** A room's name in the visitor's language; the quote's own label when the room is not one we know. */
export function roomName(lang: Lang, room: string, fallback: string): string {
  const entry = (ROOM_TX as Record<string, Tx>)[room];
  return entry && entry.en === fallback ? tx(lang, entry) : fallback;
}

/** A build stage (Building's `stagesFor`), translated while its English still matches. */
export function stageText(lang: Lang, label: string): string {
  if (lang === 'en') return label;
  const std = /^Sizing a standard (\d+) BHK kitchen$/.exec(label);
  if (std) return tx(lang, OI_DICT['stage.standard'], { bhk: std[1]! });
  for (const key of ['stage.measured', 'stage.rooms', 'stage.quantity', 'stage.filed', 'stage.archive', 'stage.writing'] as const) {
    if (OI_DICT[key].en === label) return tx(lang, OI_DICT[key]);
  }
  return label;
}

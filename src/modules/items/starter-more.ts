/**
 * The rest of the starter items: everything else on the product master a new
 * studio starts with (studio-quote/starter-catalogue.ts), so no studio is held
 * up by a line from its own starter list. Same rules as starter.ts.
 *
 * Written as [name, summary, whatItDoes, materials, finishes, typicalSize]
 * per language to keep the file readable. Hindi and Marathi are FIRST DRAFTS.
 */

import type { ItemWords } from './rules';
import type { StarterItem } from './starter';

type W = [string, string, string, string[], string[], string];

const w = ([name, summary, whatItDoes, materials, finishes, typicalSize]: W): ItemWords => ({ name, summary, whatItDoes, materials, finishes, typicalSize });

function item(slug: string, room: string, aliases: string[], en: W, hi: W, mr: W): StarterItem {
  return { slug, room, aliases, catalogueCodes: [], ...w(en), hi: w(hi), mr: w(mr) };
}

export const MORE_STARTER_ITEMS: StarterItem[] = [
  item(
    'sink-and-plumbing-fittings',
    'Kitchen',
    ['sink tap and plumbing fittings', 'sink', 'kitchen sink', 'plumbing points', 'plumbing', 'taps', 'cp fittings'],
    [
      'Sink, taps and plumbing',
      'The kitchen sink, its tap and the water and drain points behind them.',
      'Where the washing-up happens. A stainless-steel or quartz sink with a mixer tap, connected to new water and drain points where the layout needs them.',
      ['Stainless-steel or quartz sink', 'Mixer tap', 'CPVC water lines'],
      ['Brushed steel', 'Matt black', 'Granite-quartz'],
      'Single or double bowl, about 900 mm wide',
    ],
    [
      'सिंक, नल और प्लंबिंग',
      'किचन का सिंक, उसका नल और उसके पीछे पानी और निकासी के पॉइंट।',
      'बर्तन यहीं धुलते हैं। स्टेनलेस स्टील या क्वार्ट्ज़ का सिंक, मिक्सर नल के साथ, लेआउट के हिसाब से नए पानी और निकासी पॉइंट से जुड़ा।',
      ['स्टेनलेस स्टील या क्वार्ट्ज़ सिंक', 'मिक्सर नल', 'CPVC पानी की लाइन'],
      ['ब्रश्ड स्टील', 'मैट काला', 'ग्रेनाइट-क्वार्ट्ज़'],
      'सिंगल या डबल बाउल, लगभग 900 mm चौड़ा',
    ],
    [
      'सिंक, नळ आणि प्लंबिंग',
      'किचनचे सिंक, त्याचा नळ आणि त्यामागचे पाणी व निचऱ्याचे पॉइंट.',
      'भांडी इथेच धुतली जातात. स्टेनलेस स्टील किंवा क्वार्ट्झ सिंक, मिक्सर नळासह, लेआउटनुसार नव्या पाणी आणि निचरा पॉइंटला जोडलेले.',
      ['स्टेनलेस स्टील किंवा क्वार्ट्झ सिंक', 'मिक्सर नळ', 'CPVC पाण्याची लाइन'],
      ['ब्रश्ड स्टील', 'मॅट काळा', 'ग्रॅनाइट-क्वार्ट्झ'],
      'सिंगल किंवा डबल बाउल, सुमारे 900 mm रुंद',
    ],
  ),
  item(
    'bedside-tables',
    'Bedroom',
    ['bedside tables', 'bedside table', 'side tables', 'night stand'],
    [
      'Bedside tables',
      'Small tables with a drawer on each side of the bed.',
      'A place for a lamp, a phone and a glass of water at night, with a drawer for the things you reach for in bed.',
      ['18 mm BWP plywood', 'Laminate or veneer'],
      ['Matt laminate', 'Veneer', 'Fluted front'],
      'About 450 mm wide, a pair',
    ],
    [
      'बेडसाइड टेबल',
      'बेड के दोनों तरफ़ ड्रॉअर वाली छोटी टेबल।',
      'रात को लैंप, फ़ोन और पानी का गिलास रखने की जगह, और बिस्तर से हाथ बढ़ाकर लेने वाली चीज़ों का ड्रॉअर।',
      ['18 mm BWP प्लाईवुड', 'लैमिनेट या विनियर'],
      ['मैट लैमिनेट', 'विनियर', 'फ़्लूटेड सामने'],
      'लगभग 450 mm चौड़ी, एक जोड़ी',
    ],
    [
      'बेडसाइड टेबल',
      'बेडच्या दोन्ही बाजूंना ड्रॉवर असलेली छोटी टेबल.',
      'रात्री दिवा, फोन आणि पाण्याचा ग्लास ठेवण्याची जागा, आणि बिछान्यातून हात लांब करून घेण्याच्या वस्तूंसाठी ड्रॉवर.',
      ['18 mm BWP प्लायवूड', 'लॅमिनेट किंवा व्हिनियर'],
      ['मॅट लॅमिनेट', 'व्हिनियर', 'फ्लूटेड पुढचा भाग'],
      'सुमारे 450 mm रुंद, एक जोडी',
    ],
  ),
  item(
    'sofa-and-upholstery',
    'Living',
    ['sofa and upholstery', 'sofa', 'upholstery', 'sectional sofa', 'couch'],
    [
      'Sofa and upholstery',
      'The living-room sofa, made to size, or new fabric on one you have.',
      'Seating for the family and guests, sized to your wall, with cushions and fabric chosen for how the room is used.',
      ['Hardwood or ply frame', 'High-density foam', 'Upholstery fabric'],
      ['Fabric', 'Leatherette', 'Velvet'],
      '3-seater about 2100 mm wide',
    ],
    [
      'सोफ़ा और अपहोल्स्ट्री',
      'नाप से बना लिविंग रूम का सोफ़ा, या पुराने पर नया कपड़ा।',
      'परिवार और मेहमानों के बैठने की जगह, आपकी दीवार के नाप की, कुशन और कपड़ा कमरे के इस्तेमाल के हिसाब से।',
      ['हार्डवुड या प्लाई फ़्रेम', 'हाई-डेंसिटी फ़ोम', 'अपहोल्स्ट्री कपड़ा'],
      ['कपड़ा', 'लेदरेट', 'वेलवेट'],
      '3-सीटर लगभग 2100 mm चौड़ा',
    ],
    [
      'सोफा आणि अपहोल्स्ट्री',
      'मापाने बनवलेला लिव्हिंग रूमचा सोफा, किंवा जुन्यावर नवे कापड.',
      'कुटुंब आणि पाहुण्यांसाठी बसण्याची जागा, तुमच्या भिंतीच्या मापाची, कुशन आणि कापड खोलीच्या वापरानुसार.',
      ['हार्डवुड किंवा प्लाय फ्रेम', 'हाय-डेन्सिटी फोम', 'अपहोल्स्ट्री कापड'],
      ['कापड', 'लेदरेट', 'व्हेल्वेट'],
      '3-सीटर सुमारे 2100 mm रुंद',
    ],
  ),
  item(
    'pu-polish',
    'Whole home',
    ['pu polish on woodwork', 'pu polish', 'polish', 'duco', 'melamine polish'],
    [
      'PU polish on woodwork',
      'A hard, smooth lacquer on wood veneer or painted woodwork.',
      'Brings out the grain of a veneer, or gives a painted shutter an even colour, and protects it from stains and scratches.',
      ['PU sealer', 'PU top coat', 'Sanding between coats'],
      ['Matt', 'Satin', 'High gloss'],
      'Priced per square foot of surface',
    ],
    [
      'लकड़ी पर PU पॉलिश',
      'विनियर या पेंट की हुई लकड़ी पर सख़्त, चिकनी परत।',
      'विनियर का रेशा उभारती है, या पेंट वाले शटर को एक-सा रंग देती है, और दाग़-खरोंच से बचाती है।',
      ['PU सीलर', 'PU टॉप कोट', 'हर कोट के बीच घिसाई'],
      ['मैट', 'सैटिन', 'हाई ग्लॉस'],
      'दाम सतह के वर्ग फ़ुट पर',
    ],
    [
      'लाकडावर PU पॉलिश',
      'व्हिनियर किंवा रंगवलेल्या लाकडावर कडक, गुळगुळीत थर.',
      'व्हिनियरच्या रेषा उठवते, किंवा रंगवलेल्या शटरला एकसारखा रंग देते, आणि डाग-ओरखड्यांपासून वाचवते.',
      ['PU सीलर', 'PU टॉप कोट', 'प्रत्येक हातामध्ये घासणी'],
      ['मॅट', 'सॅटिन', 'हाय ग्लॉस'],
      'किंमत पृष्ठभागाच्या चौरस फुटावर',
    ],
  ),
  item(
    'civil-breaking-and-making',
    'Civil',
    ['civil breaking and making', 'breaking and making', 'civil work', 'demolition', 'wall breaking'],
    [
      'Civil breaking and making',
      'Walls or platforms taken down and built again where the new layout needs it.',
      'Opens a kitchen, moves a door or closes a passage, then plasters the new wall so it is ready for paint.',
      ['Brick or block work', 'Cement plaster', 'Debris removal'],
      ['Plastered and ready to paint'],
      'Priced per job or per square foot of wall',
    ],
    [
      'सिविल तोड़-फोड़ और निर्माण',
      'नए लेआउट के लिए दीवारें या प्लेटफ़ॉर्म तोड़कर दोबारा बनाना।',
      'किचन खोलना, दरवाज़ा खिसकाना या पैसेज बंद करना, फिर नई दीवार पर प्लास्टर ताकि पेंट हो सके।',
      ['ईंट या ब्लॉक का काम', 'सीमेंट प्लास्टर', 'मलबा हटाना'],
      ['प्लास्टर और पेंट के लिए तैयार'],
      'दाम काम पर या दीवार के वर्ग फ़ुट पर',
    ],
    [
      'सिव्हिल तोडफोड आणि बांधकाम',
      'नव्या लेआउटसाठी भिंती किंवा ओटा पाडून पुन्हा बांधणे.',
      'किचन मोकळे करणे, दार हलवणे किंवा पॅसेज बंद करणे, मग नव्या भिंतीला प्लास्टर म्हणजे रंगासाठी तयार.',
      ['विटा किंवा ब्लॉकचे काम', 'सिमेंट प्लास्टर', 'राडारोडा हटवणे'],
      ['प्लास्टर करून रंगासाठी तयार'],
      'किंमत कामावर किंवा भिंतीच्या चौरस फुटावर',
    ],
  ),
  item(
    'glass-partition',
    'Whole home',
    ['glass partition', 'partition', 'glass partitions', 'shower partition'],
    [
      'Glass partition',
      'A toughened-glass screen that divides a space without closing it off.',
      'Separates a shower, a study corner or a dining area while letting the light through.',
      ['Toughened glass', 'Aluminium or steel profile', 'Hinges or fixed clamps'],
      ['Clear', 'Frosted', 'Fluted', 'Black-framed'],
      'Priced per square foot of glass',
    ],
    [
      'काँच का पार्टीशन',
      'टफ़न काँच की स्क्रीन जो जगह को बाँटती है पर बंद नहीं करती।',
      'शावर, स्टडी कॉर्नर या डाइनिंग को अलग करता है और रोशनी आने देता है।',
      ['टफ़न काँच', 'एल्यूमिनियम या स्टील प्रोफ़ाइल', 'हिंज या फ़िक्स क्लैम्प'],
      ['साफ़', 'फ़्रॉस्टेड', 'फ़्लूटेड', 'काले फ़्रेम वाला'],
      'दाम काँच के वर्ग फ़ुट पर',
    ],
    [
      'काचेचे पार्टिशन',
      'टफन काचेची स्क्रीन जी जागा विभागते पण बंद करत नाही.',
      'शॉवर, स्टडी कोपरा किंवा डायनिंग वेगळे करते आणि प्रकाश येऊ देते.',
      ['टफन काच', 'ॲल्युमिनियम किंवा स्टील प्रोफाइल', 'बिजागऱ्या किंवा फिक्स क्लॅम्प'],
      ['साधी', 'फ्रॉस्टेड', 'फ्लूटेड', 'काळ्या फ्रेमची'],
      'किंमत काचेच्या चौरस फुटावर',
    ],
  ),
  item(
    'wall-mirror',
    'Whole home',
    ['mirror edge polished', 'mirror', 'wall mirror', 'full length mirror'],
    [
      'Wall mirror',
      'A mirror cut to size with polished edges, fixed to the wall.',
      'Makes a small room feel bigger and gives a full-length view by the wardrobe or the door.',
      ['5 mm mirror', 'Polished or bevelled edge', 'Concealed fixing'],
      ['Clear', 'Bronze tint', 'Grey tint', 'Back-lit'],
      'Priced per square foot',
    ],
    [
      'दीवार का शीशा',
      'नाप से कटा, पॉलिश किनारों वाला दीवार पर लगा शीशा।',
      'छोटा कमरा बड़ा लगता है, और वॉर्डरोब या दरवाज़े के पास पूरा दिखता है।',
      ['5 mm शीशा', 'पॉलिश या बेवल किनारा', 'छिपी फ़िटिंग'],
      ['साफ़', 'ब्रॉन्ज़ टिंट', 'ग्रे टिंट', 'बैक-लिट'],
      'दाम वर्ग फ़ुट पर',
    ],
    [
      'भिंतीवरचा आरसा',
      'मापाने कापलेला, पॉलिश कडांचा भिंतीवर बसवलेला आरसा.',
      'छोटी खोली मोठी वाटते, आणि वॉर्डरोब किंवा दाराजवळ पूर्ण दिसते.',
      ['5 mm आरसा', 'पॉलिश किंवा बेवल कड', 'लपवलेली फिटिंग'],
      ['साधा', 'ब्राँझ टिंट', 'ग्रे टिंट', 'बॅक-लिट'],
      'किंमत चौरस फुटावर',
    ],
  ),
  item(
    'wallpaper',
    'Whole home',
    ['wallpaper', 'wall paper', 'wall covering'],
    [
      'Wallpaper',
      'Printed paper or vinyl on one wall, usually behind the bed or the TV.',
      'Adds pattern or texture to a room without paint work, and comes off cleanly when you want a change.',
      ['Vinyl or non-woven paper', 'Wall primer', 'Adhesive'],
      ['Textured', 'Printed pattern', 'Plain'],
      'Priced per roll or per square foot',
    ],
    [
      'वॉलपेपर',
      'एक दीवार पर छपा कागज़ या विनाइल, अक्सर बेड या टीवी के पीछे।',
      'पेंट के बिना कमरे में डिज़ाइन या टेक्सचर लाता है, और बदलना हो तो साफ़ उतर जाता है।',
      ['विनाइल या नॉन-वूवन पेपर', 'वॉल प्राइमर', 'चिपकाने का गोंद'],
      ['टेक्सचर्ड', 'छपा डिज़ाइन', 'सादा'],
      'दाम रोल या वर्ग फ़ुट पर',
    ],
    [
      'वॉलपेपर',
      'एका भिंतीवर छापलेला कागद किंवा व्हिनाइल, बहुधा बेड किंवा टीव्हीमागे.',
      'रंगकामाशिवाय खोलीत डिझाइन किंवा टेक्स्चर आणतो, आणि बदलायचा असेल तर स्वच्छ निघतो.',
      ['व्हिनाइल किंवा नॉन-वूव्हन पेपर', 'वॉल प्रायमर', 'चिकटवण्याचा गोंद'],
      ['टेक्स्चर्ड', 'छापील डिझाइन', 'साधा'],
      'किंमत रोल किंवा चौरस फुटावर',
    ],
  ),
  item(
    'curtains-and-blinds',
    'Whole home',
    ['curtains and blinds', 'curtains', 'blinds', 'drapes', 'roller blinds'],
    [
      'Curtains and blinds',
      'Curtains on rods or tracks, and roller or roman blinds, for every window.',
      'Control light and privacy, keep the afternoon sun out, and soften the room.',
      ['Curtain fabric with lining', 'Rods or ceiling tracks', 'Roller or roman blind mechanism'],
      ['Sheer', 'Blackout', 'Dim-out', 'Motorised'],
      'Priced per window or per running foot',
    ],
    [
      'पर्दे और ब्लाइंड',
      'हर खिड़की के लिए रॉड या ट्रैक पर पर्दे, और रोलर या रोमन ब्लाइंड।',
      'रोशनी और प्राइवेसी सँभालते हैं, दोपहर की धूप रोकते हैं, और कमरे को नरम बनाते हैं।',
      ['लाइनिंग वाला पर्दे का कपड़ा', 'रॉड या छत का ट्रैक', 'रोलर या रोमन ब्लाइंड मैकेनिज़्म'],
      ['शीयर', 'ब्लैकआउट', 'डिम-आउट', 'मोटराइज़्ड'],
      'दाम हर खिड़की या रनिंग फ़ुट पर',
    ],
    [
      'पडदे आणि ब्लाइंड',
      'प्रत्येक खिडकीसाठी रॉड किंवा ट्रॅकवर पडदे, आणि रोलर किंवा रोमन ब्लाइंड.',
      'प्रकाश आणि प्रायव्हसी सांभाळतात, दुपारचे ऊन रोखतात, आणि खोली सौम्य करतात.',
      ['लायनिंग असलेले पडद्याचे कापड', 'रॉड किंवा छताचा ट्रॅक', 'रोलर किंवा रोमन ब्लाइंड यंत्रणा'],
      ['शीअर', 'ब्लॅकआउट', 'डिम-आउट', 'मोटराइज्ड'],
      'किंमत प्रत्येक खिडकीवर किंवा रनिंग फुटावर',
    ],
  ),
  item(
    'site-supervision',
    'Whole home',
    ['site supervision and project management', 'site supervision', 'project management', 'supervision'],
    [
      'Site supervision and project management',
      'A supervisor who runs the site and a manager who keeps the work on plan.',
      'Someone checks the work every day, coordinates carpenters, electricians and painters, and keeps you updated until handover.',
      ['Daily site visits', 'Quality checks at each stage', 'Updates to you'],
      ['Included with the work'],
      'For the whole project',
    ],
    [
      'साइट सुपरविज़न और प्रोजेक्ट मैनेजमेंट',
      'साइट चलाने वाला सुपरवाइज़र और काम को योजना पर रखने वाला मैनेजर।',
      'कोई रोज़ काम जाँचता है, बढ़ई, इलेक्ट्रीशियन और पेंटर का तालमेल रखता है, और हैंडओवर तक आपको बताता रहता है।',
      ['रोज़ साइट विज़िट', 'हर चरण पर क्वालिटी जाँच', 'आपको अपडेट'],
      ['काम के साथ शामिल'],
      'पूरे प्रोजेक्ट के लिए',
    ],
    [
      'साइट सुपरव्हिजन आणि प्रोजेक्ट मॅनेजमेंट',
      'साइट चालवणारा सुपरवायझर आणि काम योजनेवर ठेवणारा मॅनेजर.',
      'कोणीतरी रोज काम तपासते, सुतार, इलेक्ट्रिशियन आणि पेंटरचा मेळ घालते, आणि हँडओव्हरपर्यंत तुम्हाला कळवत राहते.',
      ['रोज साइट भेट', 'प्रत्येक टप्प्यावर गुणवत्ता तपासणी', 'तुम्हाला अपडेट'],
      ['कामासोबत समाविष्ट'],
      'संपूर्ण प्रोजेक्टसाठी',
    ],
  ),
];

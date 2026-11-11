/**
 * The item pages (/items, /items/<slug>) in English, Hindi and Marathi.
 *
 * FIRST DRAFT for native-speaker review — see `modules/i18n/site.ts`. The
 * item's own words (name, what it does, materials) live on the item itself,
 * edited in /ops/items; this is the page around them.
 */

import type { Tx } from '../site';

export const ITEMS_DICT = {
  'meta.indexTitle': { en: 'What goes into a home interior in Pune', hi: 'पुणे में घर के इंटीरियर में क्या-क्या आता है', mr: 'पुण्यात घराच्या इंटीरियरमध्ये काय काय येते' },
  'meta.indexDescription': {
    en: 'Every line on a One Interiors quotation, explained with photos: what it is, what it does, what it is made of and its usual size.',
    hi: 'One Interiors कोटेशन की हर लाइन, फ़ोटो के साथ: यह क्या है, क्या काम करती है, किससे बनती है और आम साइज़।',
    mr: 'One Interiors कोटेशनची प्रत्येक ओळ, फोटोसह: हे काय आहे, काय काम करते, कशापासून बनते आणि नेहमीचा आकार.',
  },
  'meta.itemTitle': { en: '{name}: what it is, materials and price in Pune', hi: '{name}: यह क्या है, मटीरियल और पुणे में दाम', mr: '{name}: हे काय आहे, मटेरियल आणि पुण्यातील किंमत' },

  'crumb.items': { en: 'Quotation items', hi: 'कोटेशन की चीज़ें', mr: 'कोटेशनमधील गोष्टी' },
  'index.eyebrow': { en: 'On your quotation', hi: 'आपके कोटेशन में', mr: 'तुमच्या कोटेशनमध्ये' },
  'index.title': { en: 'Every line, with a photo.', hi: 'हर लाइन, फ़ोटो के साथ।', mr: 'प्रत्येक ओळ, फोटोसह.' },
  'index.lede': {
    en: 'A quotation is easier to trust when you can see each line. Here is what each one is, what it does and what it is made of.',
    hi: 'जब हर लाइन दिखे, तो कोटेशन पर भरोसा आसान होता है। यहाँ हर चीज़ है: यह क्या है, क्या करती है और किससे बनती है।',
    mr: 'प्रत्येक ओळ दिसली की कोटेशनवर विश्वास ठेवणे सोपे होते. इथे प्रत्येक गोष्ट आहे: ती काय आहे, काय करते आणि कशापासून बनते.',
  },
  'index.empty': { en: 'Items are being added. Check back soon.', hi: 'चीज़ें जोड़ी जा रही हैं। जल्द फिर देखें।', mr: 'गोष्टी जोडल्या जात आहेत. लवकरच पुन्हा पाहा.' },

  'room.Kitchen': { en: 'Kitchen', hi: 'किचन', mr: 'किचन' },
  'room.Bedroom': { en: 'Bedroom', hi: 'बेडरूम', mr: 'बेडरूम' },
  'room.Living': { en: 'Living', hi: 'लिविंग', mr: 'लिव्हिंग' },
  'room.Bathroom': { en: 'Bathroom', hi: 'बाथरूम', mr: 'बाथरूम' },
  'room.Whole home': { en: 'Whole home', hi: 'पूरा घर', mr: 'संपूर्ण घर' },
  'room.Civil': { en: 'Civil and renovation', hi: 'सिविल और रिनोवेशन', mr: 'सिव्हिल आणि नूतनीकरण' },

  'item.whatItDoes': { en: 'What it does', hi: 'यह क्या करता है', mr: 'हे काय करते' },
  'item.materials': { en: 'What it is made of', hi: 'यह किससे बनता है', mr: 'हे कशापासून बनते' },
  'item.finishes': { en: 'Finish options', hi: 'फ़िनिश के विकल्प', mr: 'फिनिशचे पर्याय' },
  'item.size': { en: 'Typical size', hi: 'आम साइज़', mr: 'नेहमीचा आकार' },
  'item.price': { en: 'Typical price in Pune', hi: 'पुणे में आम दाम', mr: 'पुण्यातील नेहमीची किंमत' },
  'item.priceNote': {
    en: 'The middle of what {n} studios on One Interiors charge for it at its usual size, before GST. Your quote depends on your size and finish.',
    hi: 'One Interiors के {n} स्टूडियो इसकी आम साइज़ के लिए जो लेते हैं, उसका बीच का हिस्सा, GST से पहले। आपका कोटेशन आपके साइज़ और फ़िनिश पर निर्भर है।',
    mr: 'One Interiors वरील {n} स्टुडिओ याच्या नेहमीच्या आकारासाठी जे घेतात, त्याचा मधला भाग, GST आधी. तुमचे कोटेशन तुमच्या आकारावर आणि फिनिशवर अवलंबून आहे.',
  },
  'item.noPrice': {
    en: 'Its price depends on your size and finish. You see it, line by line, on your first quote.',
    hi: 'इसका दाम आपके साइज़ और फ़िनिश पर निर्भर है। यह आपको पहले कोटेशन में लाइन-दर-लाइन दिखता है।',
    mr: 'याची किंमत तुमच्या आकारावर आणि फिनिशवर अवलंबून आहे. ती तुम्हाला पहिल्या कोटेशनमध्ये ओळीनुसार दिसते.',
  },
  'item.photoNote': {
    en: 'Photos show this kind of item. The one built for you follows your design and finish.',
    hi: 'फ़ोटो इस तरह की चीज़ दिखाती हैं। आपके लिए बनने वाली आपके डिज़ाइन और फ़िनिश पर चलेगी।',
    mr: 'फोटो अशा प्रकारची गोष्ट दाखवतात. तुमच्यासाठी बनणारी तुमच्या डिझाइन आणि फिनिशनुसार असेल.',
  },
  'item.examplePhoto': { en: 'Example photo', hi: 'उदाहरण फ़ोटो', mr: 'उदाहरण फोटो' },
  'item.noPhoto': { en: 'Photo coming soon', hi: 'फ़ोटो जल्द आएगी', mr: 'फोटो लवकरच येईल' },
  'item.related': { en: 'Often on the same quotation', hi: 'अक्सर उसी कोटेशन में', mr: 'बहुधा त्याच कोटेशनमध्ये' },
  'item.all': { en: 'See every item', hi: 'सभी चीज़ें देखें', mr: 'सर्व गोष्टी पाहा' },
  'item.cta': { en: 'Get your first quote, line by line', hi: 'अपना पहला कोटेशन पाएँ, लाइन-दर-लाइन', mr: 'तुमचे पहिले कोटेशन मिळवा, ओळीनुसार' },
  'item.ctaLede': {
    en: 'Verified Pune studios price your home on these same lines, in seconds.',
    hi: 'पुणे के जाँचे हुए स्टूडियो आपके घर का दाम इन्हीं लाइनों पर, सेकंडों में लगाते हैं।',
    mr: 'पुण्यातील तपासलेले स्टुडिओ तुमच्या घराची किंमत याच ओळींवर, काही सेकंदांत लावतात.',
  },
  'item.photoOf': { en: '{name}, photo {n}', hi: '{name}, फ़ोटो {n}', mr: '{name}, फोटो {n}' },
} satisfies Record<string, Tx>;

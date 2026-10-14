/**
 * Site mode's words in English, Hindi and Marathi (studio workspace Phase 2:
 * My sites today, Post today's update, Nobody on site, Me). Same convention
 * as modules/i18n/studio.ts — the `oa.lang` cookie, `tx`, `{name}`
 * placeholders — kept beside the screens so the snag screens (Phase 4) can
 * have their own file without both editing one.
 *
 * FIRST DRAFT: the Hindi and Marathi need a native speaker's review before
 * launch. Plain words, as a site team in Pune speaks; short, because they
 * are read on a phone in one hand.
 */

import { translator, type Lang, type Tx } from '@/modules/i18n/site';

export const SITE_WORDS = {
  'hello': { en: 'Hello, {name}', hi: 'नमस्ते, {name}', mr: 'नमस्कार, {name}' },
  'helloNoName': { en: 'Hello', hi: 'नमस्ते', mr: 'नमस्कार' },
  'today.h1': { en: 'My sites today', hi: 'आज मेरी साइट', mr: 'आज माझ्या साइट' },
  'today.who': { en: '{studio} · Site supervisor', hi: '{studio} · साइट सुपरवाइज़र', mr: '{studio} · साइट सुपरवायझर' },
  'crews.h': { en: 'Crews on your sites', hi: 'आपकी साइट पर टीम', mr: 'तुमच्या साइटवर टीम' },
  'today.count1': { en: '{date} · 1 site', hi: '{date} · 1 साइट', mr: '{date} · 1 साइट' },
  'today.count': { en: '{date} · {n} sites', hi: '{date} · {n} साइट', mr: '{date} · {n} साइट' },
  'today.none': {
    en: 'No sites yet. Your studio owner picks which sites you work on, from Settings, Team.',
    hi: 'अभी कोई साइट नहीं। आप किन साइट पर काम करेंगे, यह स्टूडियो के मालिक Settings, Team से चुनते हैं।',
    mr: 'अजून साइट नाहीत. तुम्ही कोणत्या साइटवर काम करणार हे स्टुडिओचे मालक Settings, Team मधून निवडतात.',
  },
  'today.note': {
    en: 'What you post here shows in the customer’s app right away. Photos are taken in this app, with the time and place.',
    hi: 'यहाँ जो डालेंगे, वह ग्राहक के ऐप में तुरंत दिखेगा। फ़ोटो इसी ऐप से, समय और जगह के साथ ली जाती हैं।',
    mr: 'इथे जे टाकाल ते ग्राहकाच्या ॲपमध्ये लगेच दिसते. फोटो याच ॲपमधून, वेळ आणि ठिकाणासह घेतले जातात.',
  },

  'card.line': { en: '{customer} · {stage}, day {day} of {of}', hi: '{customer} · {stage}, {of} में से दिन {day}', mr: '{customer} · {stage}, {of} पैकी दिवस {day}' },
  'card.lineNoStage': { en: '{customer} · day {day} of {of}', hi: '{customer} · {of} में से दिन {day}', mr: '{customer} · {of} पैकी दिवस {day}' },
  'card.notPosted': { en: 'Not posted yet today', hi: 'आज अभी अपडेट नहीं डाला', mr: 'आज अजून अपडेट टाकले नाही' },
  'card.notNeeded': { en: 'No post needed today', hi: 'आज अपडेट ज़रूरी नहीं', mr: 'आज अपडेट गरजेचे नाही' },
  'card.posted': { en: 'Posted {time} · {n} photos', hi: '{time} पर डाला · {n} फ़ोटो', mr: '{time} ला टाकले · {n} फोटो' },
  'card.posted1': { en: 'Posted {time} · 1 photo', hi: '{time} पर डाला · 1 फ़ोटो', mr: '{time} ला टाकले · 1 फोटो' },
  'card.postedNoPhoto': { en: 'Posted {time}', hi: '{time} पर डाला', mr: '{time} ला टाकले' },
  'card.nobody': { en: 'Nobody on site · {reason}', hi: 'साइट पर कोई नहीं · {reason}', mr: 'साइटवर कोणी नाही · {reason}' },
  'card.added': { en: '{n} added later', hi: 'बाद में {n} जोड़े', mr: 'नंतर {n} जोडले' },
  'card.post': { en: 'Post today’s update', hi: 'आज का अपडेट डालें', mr: 'आजचे अपडेट टाका' },
  'card.addMore': { en: 'Add to today’s update', hi: 'आज के अपडेट में जोड़ें', mr: 'आजच्या अपडेटमध्ये जोडा' },
  'card.nobodyBtn': { en: 'Nobody on site', hi: 'साइट पर कोई नहीं', mr: 'साइटवर कोणी नाही' },
  'card.snags1': { en: '1 snag to fix', hi: '1 स्नैग ठीक करना है', mr: '1 स्नॅग दुरुस्त करायचा' },
  'card.snags': { en: '{n} snags to fix', hi: '{n} स्नैग ठीक करने हैं', mr: '{n} स्नॅग दुरुस्त करायचे' },
  'card.noSnags': { en: 'No snags', hi: 'कोई स्नैग नहीं', mr: 'स्नॅग नाहीत' },

  'queue.waiting': { en: 'Waiting to send', hi: 'भेजने का इंतज़ार', mr: 'पाठवण्याची वाट' },
  'queue.sending': { en: 'Sending…', hi: 'भेज रहे हैं…', mr: 'पाठवत आहे…' },
  'queue.sent': { en: 'Sent', hi: 'भेज दिया', mr: 'पाठवले' },
  'queue.failed': { en: 'Not sent: {error}', hi: 'नहीं भेजा: {error}', mr: 'पाठवले नाही: {error}' },
  'queue.retry': { en: 'Try again', hi: 'फिर कोशिश करें', mr: 'पुन्हा प्रयत्न करा' },
  'queue.offline': { en: 'No signal. Saved on this phone; it sends by itself.', hi: 'नेटवर्क नहीं। फ़ोन में सेव है, अपने-आप भेजा जाएगा।', mr: 'नेटवर्क नाही. फोनमध्ये सेव्ह आहे, आपोआप पाठवले जाईल.' },

  'nobody.q': { en: 'Why is nobody on site?', hi: 'साइट पर कोई क्यों नहीं है?', mr: 'साइटवर कोणी का नाही?' },
  'reason.WAITING_MATERIAL': { en: 'Waiting for material', hi: 'सामान का इंतज़ार', mr: 'सामानाची वाट' },
  'reason.WAITING_CUSTOMER_DECISION': { en: 'Waiting for customer decision', hi: 'ग्राहक के फ़ैसले का इंतज़ार', mr: 'ग्राहकाच्या निर्णयाची वाट' },
  'reason.CREW_ELSEWHERE': { en: 'Crew on another job', hi: 'टीम दूसरे काम पर', mr: 'टीम दुसऱ्या कामावर' },
  'reason.HOLIDAY': { en: 'Holiday', hi: 'छुट्टी', mr: 'सुट्टी' },
  'reason.CUSTOMER_ASKED': { en: 'Customer asked us not to come', hi: 'ग्राहक ने आने से मना किया', mr: 'ग्राहकाने येऊ नका सांगितले' },
  'reason.OTHER': { en: 'Other', hi: 'कुछ और', mr: 'दुसरे काही' },
  'nobody.counts': {
    en: '{customer} sees this day as nobody on site. It counts in the studio delay.',
    hi: '{customer} को यह दिन "साइट पर कोई नहीं" दिखेगा। यह स्टूडियो की देरी में गिना जाएगा।',
    mr: '{customer} ला हा दिवस "साइटवर कोणी नाही" असा दिसेल. हा स्टुडिओच्या उशिरात मोजला जाईल.',
  },
  'nobody.free': {
    en: '{customer} sees this day as nobody on site. It does not count against the studio.',
    hi: '{customer} को यह दिन "साइट पर कोई नहीं" दिखेगा। यह स्टूडियो के खिलाफ़ नहीं गिना जाएगा।',
    mr: '{customer} ला हा दिवस "साइटवर कोणी नाही" असा दिसेल. हा स्टुडिओच्या विरोधात मोजला जाणार नाही.',
  },
  'nobody.save': { en: 'Save for today', hi: 'आज के लिए सेव करें', mr: 'आजसाठी सेव्ह करा' },
  'nobody.saved': { en: 'Saved. {customer} can see it', hi: 'सेव हो गया। {customer} देख सकते हैं', mr: 'सेव्ह झाले. {customer} पाहू शकतात' },
  'cancel': { en: 'Cancel', hi: 'रद्द करें', mr: 'रद्द करा' },

  'bar.today': { en: 'Today', hi: 'आज', mr: 'आज' },
  'bar.snags': { en: 'Snags', hi: 'स्नैग', mr: 'स्नॅग' },
  'bar.me': { en: 'Me', hi: 'मैं', mr: 'मी' },

  'post.h1': { en: 'Today on site', hi: 'आज साइट पर', mr: 'आज साइटवर' },
  'post.back': { en: 'Back to my sites', hi: 'मेरी साइट पर वापस', mr: 'माझ्या साइटवर परत' },
  'post.adding': {
    en: 'You posted at {time} today. This adds to it: {customer} sees both, side by side. The first post stays as it was.',
    hi: 'आपने आज {time} पर डाला था। यह उसमें जुड़ेगा: {customer} दोनों साथ-साथ देखेंगे। पहला अपडेट वैसा ही रहेगा।',
    mr: 'तुम्ही आज {time} ला टाकले होते. हे त्यात जोडले जाईल: {customer} दोन्ही शेजारी पाहतील. पहिले अपडेट तसेच राहील.',
  },
  's1.h': { en: '1 · Photos, and say what you did', hi: '1 · फ़ोटो, और बताइए क्या किया', mr: '1 · फोटो, आणि काय केले ते सांगा' },
  's1.sub': {
    en: 'Tap the mic under a photo and speak, in any language. No typing.',
    hi: 'फ़ोटो के नीचे माइक दबाएँ और किसी भी भाषा में बोलें। टाइप नहीं करना।',
    mr: 'फोटोखालचा माइक दाबा आणि कोणत्याही भाषेत बोला. टाइप करायचे नाही.',
  },
  'photo.first': { en: 'Take the first photo', hi: 'पहली फ़ोटो लें', mr: 'पहिला फोटो घ्या' },
  'photo.corner': {
    en: 'From the same corner as every day, so the customer sees the room grow.',
    hi: 'रोज़ वाले कोने से ही, ताकि ग्राहक कमरा बनते देखें।',
    mr: 'रोजच्याच कोपऱ्यातून, म्हणजे ग्राहकाला खोली घडताना दिसेल.',
  },
  'photo.another': { en: 'Another photo', hi: 'एक और फ़ोटो', mr: 'अजून एक फोटो' },
  'photo.gallery': { en: 'From gallery', hi: 'गैलरी से', mr: 'गॅलरीतून' },
  'photo.galleryTag': { en: 'From gallery · the customer sees this', hi: 'गैलरी से · ग्राहक को यह दिखेगा', mr: 'गॅलरीतून · ग्राहकाला हे दिसेल' },
  'photo.remove': { en: 'Remove', hi: 'हटाएँ', mr: 'काढा' },
  'photo.removed': { en: 'Photo removed', hi: 'फ़ोटो हटाई', mr: 'फोटो काढला' },
  'undo': { en: 'Undo', hi: 'वापस लाएँ', mr: 'परत आणा' },
  'photo.room': { en: 'Which room?', hi: 'कौन सा कमरा?', mr: 'कोणती खोली?' },
  'photo.working': { en: 'Getting the photo ready…', hi: 'फ़ोटो तैयार हो रही है…', mr: 'फोटो तयार होत आहे…' },
  'photo.bad': { en: 'That photo could not be read. Take it again.', hi: 'यह फ़ोटो नहीं खुली। फिर से लें।', mr: 'हा फोटो उघडला नाही. पुन्हा घ्या.' },
  'photo.n': { en: 'Photo {n}', hi: 'फ़ोटो {n}', mr: 'फोटो {n}' },

  'mic.speak': { en: 'Speak about this', hi: 'इसके बारे में बोलें', mr: 'याबद्दल बोला' },
  'mic.other': { en: 'Say something else', hi: 'कुछ और बताएँ', mr: 'अजून काही सांगा' },
  'mic.stop': { en: 'Listening… tap to stop', hi: 'सुन रहे हैं… रोकने के लिए दबाएँ', mr: 'ऐकत आहे… थांबवण्यासाठी दाबा' },
  'mic.working': { en: 'Writing it down…', hi: 'लिख रहे हैं…', mr: 'लिहित आहे…' },
  'mic.redo': { en: 'Redo', hi: 'फिर से', mr: 'पुन्हा' },
  'mic.heard': { en: 'You said', hi: 'आपने कहा', mr: 'तुम्ही म्हणालात' },
  'mic.reads': { en: '{customer} reads', hi: '{customer} पढ़ेंगे', mr: '{customer} वाचतील' },
  'mic.offline': {
    en: 'No signal. Your voice is saved; the sentence is written when it sends.',
    hi: 'नेटवर्क नहीं। आपकी आवाज़ सेव है; भेजते समय वाक्य लिखा जाएगा।',
    mr: 'नेटवर्क नाही. तुमचा आवाज सेव्ह आहे; पाठवताना वाक्य लिहिले जाईल.',
  },
  'mic.off': {
    en: 'Your voice is saved for your team. No sentence for the customer yet: speech is not switched on.',
    hi: 'आपकी आवाज़ टीम के लिए सेव है। ग्राहक के लिए वाक्य अभी नहीं: स्पीच चालू नहीं है।',
    mr: 'तुमचा आवाज टीमसाठी सेव्ह आहे. ग्राहकासाठी वाक्य अजून नाही: स्पीच चालू नाही.',
  },
  'mic.denied': {
    en: 'The microphone is blocked. Allow it for this site in the browser, then tap again.',
    hi: 'माइक बंद है। ब्राउज़र में इस साइट के लिए माइक चालू करें, फिर दबाएँ।',
    mr: 'माइक बंद आहे. ब्राउझरमध्ये या साइटसाठी माइक चालू करा, मग पुन्हा दाबा.',
  },
  'mic.sample': { en: 'Sample words: speech is not connected yet', hi: 'नमूना शब्द: स्पीच अभी जुड़ा नहीं', mr: 'नमुना शब्द: स्पीच अजून जोडलेले नाही' },

  's2.h': { en: '2 · Who is on site?', hi: '2 · साइट पर कौन है?', mr: '2 · साइटवर कोण आहे?' },
  'crew.add': { en: '+ Add someone', hi: '+ किसी को जोड़ें', mr: '+ कोणाला तरी जोडा' },
  'crew.none': { en: 'No crew list yet. Add the people working here.', hi: 'अभी कोई टीम लिस्ट नहीं। यहाँ काम करने वालों को जोड़ें।', mr: 'अजून टीम लिस्ट नाही. इथे काम करणाऱ्यांना जोडा.' },
  'crew.name': { en: 'Name', hi: 'नाम', mr: 'नाव' },
  'crew.role': { en: 'Work', hi: 'काम', mr: 'काम' },
  'crew.save': { en: 'Add', hi: 'जोड़ें', mr: 'जोडा' },
  'crew.keep': { en: 'Also keep on the crew list', hi: 'टीम लिस्ट में भी रखें', mr: 'टीम लिस्टमध्येही ठेवा' },
  'crew.since': { en: 'On site since', hi: 'कब से साइट पर', mr: 'केव्हापासून साइटवर' },
  'role.Carpenter': { en: 'Carpenter', hi: 'कारपेंटर', mr: 'सुतार' },
  'role.Helper': { en: 'Helper', hi: 'हेल्पर', mr: 'हेल्पर' },
  'role.Electrician': { en: 'Electrician', hi: 'इलेक्ट्रीशियन', mr: 'इलेक्ट्रिशियन' },
  'role.Plumber': { en: 'Plumber', hi: 'प्लंबर', mr: 'प्लंबर' },
  'role.Painter': { en: 'Painter', hi: 'पेंटर', mr: 'पेंटर' },
  'role.Mason': { en: 'Mason', hi: 'मिस्त्री', mr: 'गवंडी' },

  's3.h': { en: '3 · What got done today?', hi: '3 · आज क्या काम हुआ?', mr: '3 · आज काय काम झाले?' },
  's3.sub': {
    en: 'Tick each step finished today. Each one needs its own photo and a sentence: say it or type it.',
    hi: 'आज पूरा हुआ हर काम टिक करें। हर एक के लिए उसकी अपनी फ़ोटो और एक वाक्य चाहिए: बोलें या लिखें।',
    mr: 'आज पूर्ण झालेले प्रत्येक काम टिक करा. प्रत्येकासाठी त्याचा स्वतःचा फोटो आणि एक वाक्य हवे: बोला किंवा लिहा.',
  },
  's3.none': { en: 'No steps left open in this stage.', hi: 'इस चरण में कोई काम बाकी नहीं।', mr: 'या टप्प्यात कोणतेही काम बाकी नाही.' },
  'step.photo': { en: 'Add the photo that shows it done', hi: 'वह फ़ोटो लें जिसमें यह पूरा दिखे', mr: 'हे पूर्ण झालेले दिसेल असा फोटो घ्या' },
  'step.take': { en: 'Take its photo', hi: 'इसकी फ़ोटो लें', mr: 'याचा फोटो घ्या' },
  'step.retake': { en: 'Take again', hi: 'फिर से लें', mr: 'पुन्हा घ्या' },
  'step.sentence': { en: 'What was done ({customer} reads this)', hi: 'क्या काम हुआ ({customer} यह पढ़ेंगे)', mr: 'काय काम झाले ({customer} हे वाचतील)' },
  'step.sentencePh': {
    en: 'e.g. POP framing is up in the living room.',
    hi: 'जैसे: लिविंग रूम में POP फ्रेमिंग हो गई।',
    mr: 'उदा. लिव्हिंग रूममध्ये POP फ्रेमिंग झाले.',
  },
  'step.say': { en: 'Or say it', hi: 'या बोलकर बताएँ', mr: 'किंवा बोलून सांगा' },
  'step.done': { en: 'Done: {step}', hi: 'पूरा हुआ: {step}', mr: 'पूर्ण झाले: {step}' },
  'step.need1': { en: 'Add its photo and a sentence', hi: 'इसकी फ़ोटो और एक वाक्य जोड़ें', mr: 'याचा फोटो आणि एक वाक्य जोडा' },
  'step.need': {
    en: 'Add a photo and a sentence for {n} ticked step(s)',
    hi: '{n} टिक किए काम के लिए फ़ोटो और वाक्य जोड़ें',
    mr: '{n} टिक केलेल्या कामासाठी फोटो आणि वाक्य जोडा',
  },
  'tick.voice': { en: 'from your voice note', hi: 'आपके वॉइस नोट से', mr: 'तुमच्या व्हॉइस नोटमधून' },
  'tick.earlier': { en: 'Done before', hi: 'पहले हो चुका', mr: 'आधीच झाले' },

  's4.h': { en: '{customer} will read, in {lang}', hi: '{customer} पढ़ेंगे, {lang} में', mr: '{customer} वाचतील, {lang} मध्ये' },
  's4.empty': { en: 'Tap a mic under a photo and say what was done.', hi: 'फ़ोटो के नीचे माइक दबाएँ और बताएँ क्या हुआ।', mr: 'फोटोखालचा माइक दाबा आणि काय झाले ते सांगा.' },
  's4.note': {
    en: 'Each sentence sits under its own photo in their app. Your voice stays with your team.',
    hi: 'हर वाक्य उनके ऐप में अपनी फ़ोटो के नीचे दिखेगा। आपकी आवाज़ सिर्फ़ आपकी टीम के पास रहेगी।',
    mr: 'प्रत्येक वाक्य त्यांच्या ॲपमध्ये त्याच फोटोखाली दिसेल. तुमचा आवाज फक्त तुमच्या टीमकडे राहील.',
  },
  'lang.en': { en: 'English', hi: 'अंग्रेज़ी', mr: 'इंग्रजी' },
  'lang.hi': { en: 'Hindi', hi: 'हिंदी', mr: 'हिंदी' },
  'lang.mr': { en: 'Marathi', hi: 'मराठी', mr: 'मराठी' },

  'post.btn': { en: 'Post update', hi: 'अपडेट डालें', mr: 'अपडेट टाका' },
  'post.needPhoto': { en: 'Take a photo first', hi: 'पहले फ़ोटो लें', mr: 'आधी फोटो घ्या' },
  'post.posting': { en: 'Posting in {s}…', hi: '{s} में डाल रहे हैं…', mr: '{s} मध्ये टाकत आहे…' },
  'done.saved.h': { en: 'Saved on this phone', hi: 'फ़ोन में सेव हो गया', mr: 'फोनमध्ये सेव्ह झाले' },
  'done.saved.p': {
    en: 'It goes to {customer} as soon as there is signal, with the time you took it. You can close the app.',
    hi: 'नेटवर्क आते ही {customer} को चला जाएगा, फ़ोटो के समय के साथ। आप ऐप बंद कर सकते हैं।',
    mr: 'नेटवर्क येताच {customer} कडे जाईल, फोटोच्या वेळेसह. तुम्ही ॲप बंद करू शकता.',
  },
  'done.sent.h': { en: 'Posted. {customer} can see it now.', hi: 'डाल दिया। {customer} अब देख सकते हैं।', mr: 'टाकले. {customer} आता पाहू शकतात.' },
  'done.line': {
    en: '{photos} photos, {crew} on site, {ticked} ticked off',
    hi: '{photos} फ़ोटो, {crew} लोग साइट पर, {ticked} काम टिक',
    mr: '{photos} फोटो, {crew} जण साइटवर, {ticked} कामे टिक',
  },
  'done.where': { en: 'Updated in {customer}’s app', hi: '{customer} के ऐप में अपडेट', mr: '{customer} च्या ॲपमध्ये अपडेट' },
  'done.where2': { en: 'Site feed · Home “Today on site” · Project tracker', hi: 'साइट फ़ीड · होम "आज साइट पर" · प्रोजेक्ट ट्रैकर', mr: 'साइट फीड · होम "आज साइटवर" · प्रोजेक्ट ट्रॅकर' },
  'done.fix': {
    en: 'A posted update cannot be edited. To fix a mistake, add to today’s update from Today.',
    hi: 'डाला हुआ अपडेट बदला नहीं जाता। गलती ठीक करने के लिए "आज" से आज के अपडेट में जोड़ें।',
    mr: 'टाकलेले अपडेट बदलता येत नाही. चूक दुरुस्त करण्यासाठी "आज" मधून आजच्या अपडेटमध्ये जोडा.',
  },

  'me.h1': { en: 'Me', hi: 'मैं', mr: 'मी' },
  'me.lang': { en: 'Language', hi: 'भाषा', mr: 'भाषा' },
  'me.queue': { en: 'On this phone', hi: 'इस फ़ोन में', mr: 'या फोनमध्ये' },
  'me.queueNone': { en: 'Nothing waiting to send.', hi: 'भेजने के लिए कुछ बाकी नहीं।', mr: 'पाठवायचे काही बाकी नाही.' },
  'me.sendNow': { en: 'Send now', hi: 'अभी भेजें', mr: 'आत्ता पाठवा' },
  'me.nobody': { en: 'Nobody on site', hi: 'साइट पर कोई नहीं', mr: 'साइटवर कोणी नाही' },
  'me.update': { en: 'Update · {n} photos', hi: 'अपडेट · {n} फ़ोटो', mr: 'अपडेट · {n} फोटो' },

  'err.sign_in': { en: 'Sign in again, then it sends.', hi: 'फिर से साइन इन करें, फिर यह चला जाएगा।', mr: 'पुन्हा साइन इन करा, मग हे जाईल.' },
  'err.not_yours': { en: 'This site is no longer yours. Ask your studio owner.', hi: 'यह साइट अब आपकी नहीं है। स्टूडियो मालिक से पूछें।', mr: 'ही साइट आता तुमची नाही. स्टुडिओ मालकांना विचारा.' },
  'err.not_your_role': { en: 'Your role cannot post here. Ask your studio owner.', hi: 'आपकी भूमिका में यहाँ डालना नहीं है। स्टूडियो मालिक से पूछें।', mr: 'तुमच्या भूमिकेत इथे टाकता येत नाही. स्टुडिओ मालकांना विचारा.' },
  'err.too_old': { en: 'This was saved more than 30 days ago and cannot be sent now.', hi: 'यह 30 दिन से पुराना है, अब भेजा नहीं जा सकता।', mr: 'हे 30 दिवसांपेक्षा जुने आहे, आता पाठवता येत नाही.' },
  'err.storage': { en: 'Photos cannot be stored right now. It will try again.', hi: 'अभी फ़ोटो सेव नहीं हो रहीं। फिर से कोशिश होगी।', mr: 'आत्ता फोटो सेव्ह होत नाहीत. पुन्हा प्रयत्न होईल.' },
  'err.tick_photo': {
    en: 'Each ticked step needs its own photo with a sentence. Post it again from Today.',
    hi: 'हर टिक किए काम के लिए उसकी अपनी फ़ोटो और वाक्य चाहिए। "आज" से फिर से डालें।',
    mr: 'प्रत्येक टिक केलेल्या कामासाठी त्याचा स्वतःचा फोटो आणि वाक्य हवे. "आज" मधून पुन्हा टाका.',
  },
  'err.other': { en: 'Something is wrong with this post. Ask your office.', hi: 'इस अपडेट में कुछ गड़बड़ है। ऑफ़िस से पूछें।', mr: 'या अपडेटमध्ये काहीतरी चूक आहे. ऑफिसला विचारा.' },
} satisfies Record<string, Tx>;

export type SiteWord = keyof typeof SITE_WORDS;

export const siteWords = (lang: Lang) => translator(lang, SITE_WORDS);
export type SiteT = ReturnType<typeof siteWords>;

export const CREW_ROLES = ['Carpenter', 'Helper', 'Electrician', 'Plumber', 'Painter', 'Mason'] as const;

/** A failure code from the site routes, as words. */
export function errorWords(t: SiteT, code: string | undefined): string {
  if (code === 'sign_in' || code === 'not_yours' || code === 'not_your_role' || code === 'too_old' || code === 'storage' || code === 'tick_photo') return t(`err.${code}`);

  return t('err.other');
}

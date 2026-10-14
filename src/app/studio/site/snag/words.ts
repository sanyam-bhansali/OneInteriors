import type { Tx } from '@/modules/i18n/site';

/**
 * Site mode's *Fix a snag* words, English, Hindi and Marathi (first draft:
 * Sanyam reviews). Short, plain, spoken-style: a supervisor reads these on a
 * ladder. `{name}` is the customer's first name.
 */
export const SNAG_WORDS = {
  'list.h1': { en: 'Snags to fix', hi: 'ठीक करनी हैं', mr: 'दुरुस्त करायच्या' },
  'list.sub': {
    en: 'Fix it, take the after photo, say what you did.',
    hi: 'ठीक करें, बाद की फ़ोटो लें, बोलकर बताएँ क्या किया।',
    mr: 'दुरुस्त करा, नंतरचा फोटो काढा, काय केले ते बोलून सांगा.',
  },
  'list.none': { en: 'No snags waiting for you. Good.', hi: 'आपके लिए कोई कमी बाकी नहीं। बढ़िया।', mr: 'तुमच्यासाठी काही बाकी नाही. छान.' },
  'list.mine': { en: 'Given to you', hi: 'आपको दी गई', mr: 'तुम्हाला दिलेल्या' },
  'list.others': { en: 'Others on your sites', hi: 'आपकी साइट पर बाकी', mr: 'तुमच्या साइटवरील इतर' },
  'list.open': { en: 'Fix this', hi: 'ठीक करें', mr: 'दुरुस्त करा' },
  'list.today': { en: 'Today on site', hi: 'आज साइट पर', mr: 'आज साइटवर' },
  fixBy: { en: 'Fix by {date}', hi: '{date} तक ठीक करें', mr: '{date} पर्यंत दुरुस्त करा' },
  late: { en: 'Late · was due {date}', hi: 'देर · {date} तक करना था', mr: 'उशीर · {date} पर्यंत करायचे होते' },
  noDate: { en: 'No fix-by date yet', hi: 'अभी तारीख तय नहीं', mr: 'अजून तारीख ठरलेली नाही' },
  reopened: { en: '{name} says it is not fixed', hi: '{name} कहते हैं ठीक नहीं हुआ', mr: '{name} म्हणतात दुरुस्त झाले नाही' },
  back: { en: 'Back to snags', hi: 'वापस', mr: 'मागे' },
  snagOf: { en: 'Snag · {home}', hi: 'कमी · {home}', mr: 'त्रुटी · {home}' },
  assignedYou: { en: 'Given to you', hi: 'आपको दी गई', mr: 'तुम्हाला दिली' },
  assignedTo: { en: 'With {who}', hi: '{who} के पास', mr: '{who} कडे' },
  wrote: { en: '{name} wrote, {date}', hi: '{name} ने लिखा, {date}', mr: '{name} यांनी लिहिले, {date}' },
  teamWrote: { en: 'Your team noted, {date}', hi: 'आपकी टीम ने लिखा, {date}', mr: 'तुमच्या टीमने नोंदवले, {date}' },
  noteFor: { en: 'Note for you · only your team', hi: 'आपके लिए नोट · सिर्फ़ आपकी टीम', mr: 'तुमच्यासाठी नोट · फक्त तुमची टीम' },
  notFixedSaid: { en: '{name}: “{reason}”', hi: '{name}: “{reason}”', mr: '{name}: “{reason}”' },
  before: { en: 'Before · {name}’s photo', hi: 'पहले · {name} की फ़ोटो', mr: 'आधी · {name} यांचा फोटो' },
  beforeTeam: { en: 'Before', hi: 'पहले', mr: 'आधी' },
  noBefore: { en: 'No photo', hi: 'फ़ोटो नहीं', mr: 'फोटो नाही' },
  after: { en: 'After · from the same spot', hi: 'बाद में · उसी जगह से', mr: 'नंतर · त्याच जागेवरून' },
  takeAfter: { en: 'Take the after photo', hi: 'बाद की फ़ोटो लें', mr: 'नंतरचा फोटो काढा' },
  retake: { en: 'Take again', hi: 'फिर से लें', mr: 'पुन्हा काढा' },
  gallery: { en: 'Choose from photos', hi: 'गैलरी से चुनें', mr: 'गॅलरीतून निवडा' },
  fromGallery: { en: 'From gallery', hi: 'गैलरी से', mr: 'गॅलरीतून' },
  saving: { en: 'Saving the photo…', hi: 'फ़ोटो सेव हो रही है…', mr: 'फोटो सेव्ह होत आहे…' },
  saveFailed: { en: 'The photo did not save. Tap to try again.', hi: 'फ़ोटो सेव नहीं हुई। फिर से दबाएँ।', mr: 'फोटो सेव्ह झाला नाही. पुन्हा दाबा.' },
  say: { en: 'Say what you fixed', hi: 'बोलकर बताएँ क्या ठीक किया', mr: 'काय दुरुस्त केले ते बोला' },
  listening: { en: 'Listening… tap to stop', hi: 'सुन रहे हैं… रोकने के लिए दबाएँ', mr: 'ऐकत आहोत… थांबवण्यासाठी दाबा' },
  hearing: { en: 'Writing it down…', hi: 'लिख रहे हैं…', mr: 'लिहित आहोत…' },
  reads: { en: '{name} reads this', hi: '{name} यह पढ़ेंगे', mr: '{name} हे वाचतील' },
  redo: { en: 'Redo', hi: 'फिर से', mr: 'पुन्हा' },
  speechOff: {
    en: 'Recording kept. No sentence this time; {name} still sees both photos.',
    hi: 'रिकॉर्डिंग रख ली। इस बार वाक्य नहीं बना; {name} दोनों फ़ोटो देखेंगे।',
    mr: 'रेकॉर्डिंग ठेवले. या वेळी वाक्य नाही; {name} दोन्ही फोटो पाहतील.',
  },
  micBlocked: {
    en: 'The microphone is off. You can mark it fixed without speaking.',
    hi: 'माइक बंद है। बिना बोले भी ठीक हुआ बता सकते हैं।',
    mr: 'माइक बंद आहे. न बोलताही दुरुस्त झाले असे सांगू शकता.',
  },
  markFixed: { en: 'Mark fixed', hi: 'ठीक हो गया', mr: 'दुरुस्त झाले' },
  sending: { en: 'Sending…', hi: 'भेज रहे हैं…', mr: 'पाठवत आहोत…' },
  marked: { en: 'Marked fixed', hi: 'ठीक बताया', mr: 'दुरुस्त सांगितले' },
  hintNoPhoto: { en: 'Take the after photo first.', hi: 'पहले बाद की फ़ोटो लें।', mr: 'आधी नंतरचा फोटो काढा.' },
  hintSaving: { en: 'Wait for the photo to save.', hi: 'फ़ोटो सेव होने दें।', mr: 'फोटो सेव्ह होऊ द्या.' },
  hintReady: { en: '{name} will see the before and after photos.', hi: '{name} पहले और बाद की फ़ोटो देखेंगे।', mr: '{name} आधीचा आणि नंतरचा फोटो पाहतील.' },
  sentTitle: { en: 'Sent to {name} to confirm', hi: '{name} को पुष्टि के लिए भेजा', mr: '{name} यांना खात्रीसाठी पाठवले' },
  sentBody: {
    en: 'It closes when {name} taps Confirm, or by itself in 7 days. If {name} says it is not fixed, it comes back here.',
    hi: '{name} के पुष्टि करने पर, या 7 दिन में अपने आप बंद होगी। {name} ने कहा ठीक नहीं हुआ, तो यहीं वापस आएगी।',
    mr: '{name} यांनी खात्री केल्यावर, किंवा 7 दिवसांत आपोआप बंद होईल. {name} म्हणाल्या दुरुस्त झाले नाही, तर इथे परत येईल.',
  },
  allSnags: { en: 'Back to snags', hi: 'सारी कमियाँ', mr: 'सगळ्या त्रुटी' },
  failed: { en: 'Not sent. Check the connection and tap again.', hi: 'नहीं गया। नेटवर्क देखें और फिर दबाएँ।', mr: 'गेले नाही. नेटवर्क पाहा आणि पुन्हा दाबा.' },
  notYours: { en: 'Only your team on this site can fix this.', hi: 'इसे इस साइट की टीम ही ठीक कर सकती है।', mr: 'हे या साइटची टीमच दुरुस्त करू शकते.' },
  waiting: { en: 'Waiting for {name} to confirm.', hi: '{name} की पुष्टि का इंतज़ार।', mr: '{name} यांच्या खात्रीची वाट.' },
} satisfies Record<string, Tx>;

export type SnagWordKey = keyof typeof SNAG_WORDS;

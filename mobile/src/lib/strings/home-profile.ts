import type { Entry } from './entry';

/** My Home Profile's words (owner, 4 Nov 2026), English, Hindi and Marathi (first draft: Sanyam reviews). */
export const homeProfileWords = {
  'me.profile': { en: 'My Home Profile', hi: 'मेरी होम प्रोफ़ाइल', mr: 'माझी होम प्रोफाइल' },
  'me.profile.sub': { en: 'Your answers and your style DNA', hi: 'आपके जवाब और आपका स्टाइल DNA', mr: 'तुमची उत्तरे आणि तुमचा स्टाइल DNA' },
  'hp.dna': { en: 'Your style DNA', hi: 'आपका स्टाइल DNA', mr: 'तुमचा स्टाइल DNA' },
  'hp.materials': { en: 'Materials that suit it: {list}', hi: 'इसके लिए सही मटीरियल: {list}', mr: 'याला शोभणारे मटेरियल: {list}' },
  'hp.details': { en: 'Your details', hi: 'आपकी जानकारी', mr: 'तुमची माहिती' },
  'hp.name': { en: 'Name', hi: 'नाम', mr: 'नाव' },
  'hp.mobile': { en: 'Mobile', hi: 'मोबाइल', mr: 'मोबाइल' },
  'hp.email': { en: 'Email', hi: 'ईमेल', mr: 'ईमेल' },
  'hp.empty': { en: 'You have not told us about your home yet. It takes about four minutes.', hi: 'आपने अभी अपने घर के बारे में नहीं बताया है। लगभग चार मिनट लगते हैं।', mr: 'तुम्ही अजून तुमच्या घराबद्दल सांगितले नाही. सुमारे चार मिनिटे लागतात.' },
  'hp.start': { en: 'Start my Home Profile', hi: 'मेरी होम प्रोफ़ाइल शुरू करें', mr: 'माझी होम प्रोफाइल सुरू करा' },
  'hp.change': { en: 'Change an answer', hi: 'कोई जवाब बदलें', mr: 'एखादे उत्तर बदला' },
  'hp.unfinished': { en: 'Not finished yet', hi: 'अभी पूरा नहीं हुआ', mr: 'अजून पूर्ण नाही' },
} satisfies Record<string, Entry>;

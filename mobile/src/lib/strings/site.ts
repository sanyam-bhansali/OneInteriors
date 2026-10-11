import type { Entry } from './entry';

/** The site screen's words, English, Hindi and Marathi (first draft: Sanyam reviews). */
export const site = {
  'site.eyebrow': { en: 'Every working day', hi: 'हर कामकाजी दिन', mr: 'प्रत्येक कामाचा दिवस' },
  'site.h1': { en: 'On site', hi: 'साइट पर', mr: 'साइटवर' },
  'site.view3d': { en: 'View in 3D', hi: '3D में देखें', mr: '3D मध्ये पाहा' },
  'site.week': { en: 'This week', hi: 'इस हफ़्ते', mr: 'या आठवड्यात' },
  'site.week.count': {
    en: '{n} of {m} days with an update',
    hi: '{m} में से {n} दिन अपडेट आया',
    mr: '{m} पैकी {n} दिवस अपडेट आले',
  },
  'site.day.mon': { en: 'MON', hi: 'सोम', mr: 'सोम' },
  'site.day.tue': { en: 'TUE', hi: 'मंगल', mr: 'मंगळ' },
  'site.day.wed': { en: 'WED', hi: 'बुध', mr: 'बुध' },
  'site.day.thu': { en: 'THU', hi: 'गुरु', mr: 'गुरु' },
  'site.day.fri': { en: 'FRI', hi: 'शुक्र', mr: 'शुक्र' },
  'site.day.sat': { en: 'SAT', hi: 'शनि', mr: 'शनि' },
  'site.day.a11y.done': { en: '{day}: update posted', hi: '{day}: अपडेट आया', mr: '{day}: अपडेट आले' },
  'site.day.a11y.missed': { en: '{day}: no update posted', hi: '{day}: कोई अपडेट नहीं आया', mr: '{day}: अपडेट आले नाही' },
  'site.day.a11y.today': { en: '{day}: today, no update yet', hi: '{day}: आज, अभी अपडेट नहीं आया', mr: '{day}: आज, अजून अपडेट आले नाही' },
  'site.day.a11y.later': { en: '{day}: still to come', hi: '{day}: अभी बाकी', mr: '{day}: अजून बाकी' },
  'site.today': { en: 'Today, {date}', hi: 'आज, {date}', mr: 'आज, {date}' },
  'site.gap.title': { en: '{date}, no update posted', hi: '{date}, कोई अपडेट नहीं आया', mr: '{date}, कोणतेही अपडेट आले नाही' },
  'site.gap.body': {
    en: '{studio} posted no photos or note for this working day. To find out whether anyone was on site, ask GEIO.',
    hi: '{studio} ने इस कामकाजी दिन की कोई फ़ोटो या नोट नहीं डाली। साइट पर कोई आया था या नहीं, यह जानने के लिए GEIO से पूछें।',
    mr: '{studio} ने या कामाच्या दिवसाचे कोणतेही फोटो किंवा नोट टाकले नाहीत. साइटवर कोणी आले होते का, हे जाणून घेण्यासाठी GEIO ला विचारा.',
  },
  'site.by.studio': { en: 'Posted by {studio}', hi: '{studio} ने डाला', mr: '{studio} ने टाकले' },
  'site.by.us': { en: 'Posted by One Interiors', hi: 'One Interiors ने डाला', mr: 'One Interiors ने टाकले' },
  'site.photo': { en: 'Site photo, {date}', hi: 'साइट की फ़ोटो, {date}', mr: 'साइटचा फोटो, {date}' },
  'site.none': {
    en: 'Site photos and notes appear here once your project starts.',
    hi: 'प्रोजेक्ट शुरू होते ही साइट की फ़ोटो और नोट यहाँ दिखेंगे।',
    mr: 'प्रोजेक्ट सुरू झाल्यावर साइटचे फोटो आणि नोट इथे दिसतील.',
  },
  'site.empty': {
    en: 'Nothing yet. The first update from {studio} appears here as soon as it is posted.',
    hi: 'अभी कुछ नहीं। {studio} का पहला अपडेट आते ही यहाँ दिखेगा।',
    mr: 'अजून काही नाही. {studio} चे पहिले अपडेट येताच इथे दिसेल.',
  },
  'site.stale': {
    en: 'Showing the copy saved on this phone. Pull down to refresh.',
    hi: 'इस फ़ोन में सेव की गई कॉपी दिख रही है। रिफ़्रेश करने के लिए नीचे खींचें।',
    mr: 'या फोनमध्ये सेव्ह केलेली प्रत दिसत आहे. रिफ्रेश करण्यासाठी खाली ओढा.',
  },
} satisfies Record<string, Entry>;

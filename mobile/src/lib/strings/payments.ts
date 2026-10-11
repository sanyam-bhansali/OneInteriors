import type { Entry } from './entry';

/** The project screen's payments card (Phase 5: entries to confirm), English, Hindi and Marathi (first draft: Sanyam reviews). */
export const paymentsWords = {
  'pay.toConfirm': { en: 'Did you pay this?', hi: 'क्या आपने यह भुगतान किया?', mr: 'तुम्ही हे पैसे दिले का?' },
  'pay.entry': { en: '{amount} for {stage}', hi: '{stage} के लिए {amount}', mr: '{stage} साठी {amount}' },
  'pay.entryMeta': { en: 'Marked received {date}{mode}', hi: '{date} को मिला बताया गया{mode}', mr: '{date} रोजी मिळाले असे नोंदवले{mode}' },
  'pay.confirm': { en: 'Yes, I paid', hi: 'हाँ, मैंने दिया', mr: 'हो, मी दिले' },
  'pay.dispute': { en: "I didn't pay this", hi: 'मैंने यह नहीं दिया', mr: 'मी हे दिले नाहीत' },
  'pay.confirmed': { en: 'You confirmed this', hi: 'आपने इसकी पुष्टि की', mr: 'तुम्ही याची खात्री केली' },
  'pay.earlier': {
    en: 'Recorded before confirmations started. Counted as paid.',
    hi: 'पुष्टि शुरू होने से पहले दर्ज। भुगतान माना गया।',
    mr: 'खात्री सुरू होण्याआधी नोंदवले. भरलेले धरले आहे.',
  },
  'pay.disputed': {
    en: 'You said you did not pay this. Our team will call you.',
    hi: 'आपने बताया कि यह भुगतान आपने नहीं किया। हमारी टीम आपको कॉल करेगी।',
    mr: 'तुम्ही सांगितले की हे पैसे तुम्ही दिले नाहीत. आमची टीम तुम्हाला कॉल करेल.',
  },
  'pay.waitingNote': {
    en: 'It counts as paid once you confirm.',
    hi: 'आपकी पुष्टि के बाद ही इसे भुगतान माना जाएगा।',
    mr: 'तुम्ही खात्री केल्यावरच हे भरलेले धरले जाईल.',
  },
  'pay.sentToTeam': {
    en: 'Sent to One Interiors. Our team will call you; the studio sees only that we are checking.',
    hi: 'One Interiors को भेज दिया। हमारी टीम आपको कॉल करेगी; स्टूडियो को सिर्फ़ इतना दिखेगा कि हम जाँच कर रहे हैं।',
    mr: 'One Interiors कडे पाठवले. आमची टीम तुम्हाला कॉल करेल; स्टुडिओला फक्त आम्ही तपासत आहोत एवढेच दिसेल.',
  },
  'pay.mode.UPI': { en: ' · UPI', hi: ' · UPI', mr: ' · UPI' },
  'pay.mode.BANK': { en: ' · bank transfer', hi: ' · बैंक ट्रांसफ़र', mr: ' · बँक ट्रान्सफर' },
  'pay.mode.CHEQUE': { en: ' · cheque', hi: ' · चेक', mr: ' · चेक' },
  'pay.mode.CASH': { en: ' · cash', hi: ' · नकद', mr: ' · रोख' },
  'pay.stageWaiting': { en: 'Recorded · waiting for you', hi: 'दर्ज · आपकी पुष्टि बाकी', mr: 'नोंदवले · तुमची खात्री बाकी' },
  'pay.stagePart': { en: '{paid} of {total} paid', hi: '{total} में से {paid} भुगतान हुआ', mr: '{total} पैकी {paid} भरले' },
  'pay.includesChanges': { en: 'Includes {amount} from your decisions', hi: 'आपके फ़ैसलों से {amount} शामिल', mr: 'तुमच्या निर्णयांमुळे {amount} समाविष्ट' },
  'pay.balance': { en: 'Still to pay', hi: 'अभी देना बाकी', mr: 'अजून भरायचे' },
} satisfies Record<string, Entry>;

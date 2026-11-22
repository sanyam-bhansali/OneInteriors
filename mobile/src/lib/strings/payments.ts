import type { Entry } from './entry';

/** The project screen's payments card (Phase 5; nothing to confirm since 22 Nov 2026), English, Hindi and Marathi (first draft: Sanyam reviews). */
export const paymentsWords = {
  'pay.entry': { en: '{amount} for {stage}', hi: '{stage} के लिए {amount}', mr: '{stage} साठी {amount}' },
  'pay.entryMeta': { en: 'Received {date}{mode}', hi: '{date} को मिला{mode}', mr: '{date} रोजी मिळाले{mode}' },
  'pay.paid': { en: 'Paid', hi: 'भुगतान हो गया', mr: 'भरले' },
  'pay.disputed': {
    en: 'You said you did not pay this. Our team will call you.',
    hi: 'आपने बताया कि यह भुगतान आपने नहीं किया। हमारी टीम आपको कॉल करेगी।',
    mr: 'तुम्ही सांगितले की हे पैसे तुम्ही दिले नाहीत. आमची टीम तुम्हाला कॉल करेल.',
  },
  'pay.mode.UPI': { en: ' · UPI', hi: ' · UPI', mr: ' · UPI' },
  'pay.mode.BANK': { en: ' · bank transfer', hi: ' · बैंक ट्रांसफ़र', mr: ' · बँक ट्रान्सफर' },
  'pay.mode.CHEQUE': { en: ' · cheque', hi: ' · चेक', mr: ' · चेक' },
  'pay.mode.CASH': { en: ' · cash', hi: ' · नकद', mr: ' · रोख' },
  'pay.stagePart': { en: '{paid} of {total} paid', hi: '{total} में से {paid} भुगतान हुआ', mr: '{total} पैकी {paid} भरले' },
  'pay.includesChanges': { en: 'Includes {amount} from your decisions', hi: 'आपके फ़ैसलों से {amount} शामिल', mr: 'तुमच्या निर्णयांमुळे {amount} समाविष्ट' },
  'pay.balance': { en: 'Still to pay', hi: 'अभी देना बाकी', mr: 'अजून भरायचे' },
} satisfies Record<string, Entry>;

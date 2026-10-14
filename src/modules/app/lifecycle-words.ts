/**
 * The words for "where your project is" (owner, 13 Oct 2026; docs/studio-os/
 * PROJECT-LIFECYCLE.md): the current step, the next, and what the customer
 * must do to unlock it, in English, Hindi and Marathi (first draft: Sanyam
 * reviews). The projection (portal/lifecycle-view.ts) sends kinds and
 * values; this says them. The phone app keeps an identical copy in
 * mobile/src/lib/strings/lifecycle.ts (tests/customer-lifecycle.test.ts
 * checks they match).
 */

import type { CustomerLifecycle, CustomerLifecycleStep } from '@/modules/portal/lifecycle-view';

type Lang = 'en' | 'hi' | 'mr';
type Entry = { en: string; hi: string; mr: string };

export const lifecycleWords = {
  'life.title': { en: 'Where your project is', hi: 'आपका प्रोजेक्ट कहाँ है', mr: 'तुमचा प्रोजेक्ट कुठे आहे' },
  'life.now': { en: 'Now', hi: 'अभी', mr: 'आता' },
  'life.next': { en: 'Next', hi: 'अगला', mr: 'पुढचे' },
  'life.yourTurn': { en: 'To unlock it', hi: 'इसे खोलने के लिए', mr: 'हे उघडण्यासाठी' },
  'life.nothing': { en: 'Nothing needed from you', hi: 'आपसे कुछ नहीं चाहिए', mr: 'तुमच्याकडून काहीही नको' },
  'life.phase.design': { en: 'Design', hi: 'डिज़ाइन', mr: 'डिझाइन' },
  'life.phase.execution': { en: 'Work on site', hi: 'साइट पर काम', mr: 'साइटवर काम' },
  'life.phase.closure': { en: 'Project closure', hi: 'प्रोजेक्ट क्लोज़र', mr: 'प्रोजेक्ट क्लोजर' },
  'life.phase.snags': { en: 'Snags', hi: 'कमियाँ (स्नैग)', mr: 'त्रुटी (स्नॅग)' },
  'life.phase.warranty': { en: 'Warranty', hi: 'वारंटी', mr: 'वॉरंटी' },
  'life.phase.closed': { en: 'Closed', hi: 'पूरा हुआ', mr: 'पूर्ण झाले' },
  'life.step.design_done': { en: 'Design sign-off', hi: 'डिज़ाइन साइन-ऑफ़', mr: 'डिझाइन साइन-ऑफ' },
  'life.step.closure': { en: 'Project closure: the final account', hi: 'प्रोजेक्ट क्लोज़र: अंतिम हिसाब', mr: 'प्रोजेक्ट क्लोजर: अंतिम हिशोब' },
  'life.step.snags': { en: 'Closing the last snags', hi: 'आखिरी कमियाँ ठीक करना', mr: 'शेवटच्या त्रुटी दुरुस्त करणे' },
  'life.step.sign_off': { en: 'You sign off the handover', hi: 'आप हैंडओवर पर साइन-ऑफ़ करें', mr: 'तुम्ही हँडओव्हरवर साइन-ऑफ करा' },
  'life.step.warranty': { en: 'In warranty', hi: 'वारंटी में', mr: 'वॉरंटीमध्ये' },
  'life.step.closed': { en: 'Project closed', hi: 'प्रोजेक्ट बंद', mr: 'प्रोजेक्ट बंद' },
  'life.step.stage': { en: 'Work on site', hi: 'साइट पर काम', mr: 'साइटवर काम' },
  'life.block.pay': { en: 'Pay the {label} {amount}', hi: '{label} का भुगतान करें {amount}', mr: '{label} भरा {amount}' },
  'life.block.payFinal': { en: 'Pay the final payment {amount}', hi: 'अंतिम भुगतान करें {amount}', mr: 'अंतिम रक्कम भरा {amount}' },
  'life.block.confirm_payment': { en: 'Confirm the payment your studio recorded', hi: 'स्टूडियो का दर्ज किया भुगतान पक्का करें', mr: 'स्टुडिओने नोंदवलेले पेमेंट निश्चित करा' },
  'life.block.answer_drawing': { en: 'Answer the {label}', hi: '{label} पर जवाब दें', mr: '{label} वर उत्तर द्या' },
  'life.block.your_step': { en: 'Your step: {label}', hi: 'आपका काम: {label}', mr: 'तुमचे काम: {label}' },
  'life.block.decide': { en: 'Choose: {label}', hi: 'चुनें: {label}', mr: 'निवडा: {label}' },
  'life.block.confirm_snag': { en: 'Confirm the snag is fixed', hi: 'पक्का करें कि कमी ठीक हो गई', mr: 'त्रुटी दुरुस्त झाली याची खात्री करा' },
  'life.block.confirm_snags': { en: 'Confirm {n} snags are fixed', hi: 'पक्का करें कि {n} कमियाँ ठीक हो गईं', mr: '{n} त्रुटी दुरुस्त झाल्याची खात्री करा' },
  'life.block.sign_off': { en: 'Sign off your handover', hi: 'अपने हैंडओवर पर साइन-ऑफ़ करें', mr: 'तुमच्या हँडओव्हरवर साइन-ऑफ करा' },
  /* Change orders and sign-offs (15 Oct 2026; project/change-order-rules.ts, project/signoff-rules.ts). */
  'life.block.approve_extra': { en: 'Approve the extra work: {label}', hi: 'अतिरिक्त काम मंज़ूर करें: {label}', mr: 'अतिरिक्त कामाला मंजुरी द्या: {label}' },
  'life.block.pay_extra': { en: 'Pay {amount} for the extra work', hi: 'अतिरिक्त काम के लिए {amount} का भुगतान करें', mr: 'अतिरिक्त कामासाठी {amount} भरा' },
  'life.block.sign_design_final': { en: 'Sign the design final', hi: 'डिज़ाइन फ़ाइनल पर हस्ताक्षर करें', mr: 'डिझाइन फायनलवर सही करा' },
  'life.block.sign_sales_final': { en: 'Sign the final quotation (BOQ)', hi: 'अंतिम कोटेशन (BOQ) पर हस्ताक्षर करें', mr: 'अंतिम कोटेशनवर (BOQ) सही करा' },
  'life.extra.title': { en: 'Extra work', hi: 'अतिरिक्त काम', mr: 'अतिरिक्त काम' },
  'life.extra.intro': {
    en: 'Work added after your design was signed off. Nothing is made until you approve and pay.',
    hi: 'डिज़ाइन साइन-ऑफ़ के बाद जोड़ा गया काम। आपकी मंज़ूरी और भुगतान के बिना कुछ नहीं बनता।',
    mr: 'डिझाइन साइन-ऑफनंतर जोडलेले काम. तुमची मंजुरी आणि पेमेंट झाल्याशिवाय काहीही बनत नाही.',
  },
  'life.extra.number': { en: 'Extra work {n}', hi: 'अतिरिक्त काम {n}', mr: 'अतिरिक्त काम {n}' },
  'life.extra.why': { en: 'Why', hi: 'क्यों', mr: 'का' },
  'life.extra.discount': { en: 'Discount', hi: 'छूट', mr: 'सवलत' },
  'life.extra.gst': { en: 'GST {pct}', hi: 'जीएसटी {pct}', mr: 'जीएसटी {pct}' },
  'life.extra.total': { en: 'Total', hi: 'कुल', mr: 'एकूण' },
  'life.extra.approve': { en: 'Approve', hi: 'मंज़ूर करें', mr: 'मंजूर करा' },
  'life.extra.decline': { en: 'Decline', hi: 'मना करें', mr: 'नाकारा' },
  'life.extra.declineReason': { en: 'Why are you declining? The studio sees this.', hi: 'आप मना क्यों कर रहे हैं? स्टूडियो इसे देखेगा।', mr: 'तुम्ही का नाकारत आहात? स्टुडिओला हे दिसेल.' },
  'life.extra.sendDecline': { en: 'Send my answer', hi: 'मेरा जवाब भेजें', mr: 'माझे उत्तर पाठवा' },
  'life.extra.state.waiting': { en: 'Waiting for your answer', hi: 'आपके जवाब का इंतज़ार', mr: 'तुमच्या उत्तराची वाट' },
  'life.extra.state.approved': { en: 'Approved · pay {amount} to the studio', hi: 'मंज़ूर · स्टूडियो को {amount} दें', mr: 'मंजूर · स्टुडिओला {amount} द्या' },
  'life.extra.state.declined': { en: 'You declined', hi: 'आपने मना किया', mr: 'तुम्ही नाकारले' },
  'life.extra.state.paid': { en: 'Paid · the studio starts it', hi: 'भुगतान हुआ · स्टूडियो शुरू करेगा', mr: 'पेमेंट झाले · स्टुडिओ सुरू करेल' },
  'life.extra.state.released': { en: 'Paid · sent to the factory', hi: 'भुगतान हुआ · फ़ैक्टरी भेजा गया', mr: 'पेमेंट झाले · फॅक्टरीला पाठवले' },
  'life.extra.howToPay': {
    en: 'You pay the studio directly. When they record it, confirm it under Payments.',
    hi: 'आप स्टूडियो को सीधे भुगतान करते हैं। जब वे इसे दर्ज करें, भुगतान में पक्का करें।',
    mr: 'तुम्ही स्टुडिओला थेट पैसे देता. त्यांनी नोंद केल्यावर पेमेंटमध्ये निश्चित करा.',
  },
  'life.extra.done': { en: 'Thank you. The studio has your answer.', hi: 'धन्यवाद। स्टूडियो को आपका जवाब मिल गया।', mr: 'धन्यवाद. स्टुडिओला तुमचे उत्तर मिळाले.' },
  'life.extra.failed': { en: 'That did not go through. Try again.', hi: 'यह नहीं हो सका। फिर कोशिश करें।', mr: 'हे झाले नाही. पुन्हा प्रयत्न करा.' },
  'life.extra.photo': { en: 'See the drawing', hi: 'ड्रॉइंग देखें', mr: 'ड्रॉइंग पहा' },
  'life.sign.title': { en: 'To sign', hi: 'हस्ताक्षर के लिए', mr: 'सहीसाठी' },
  'life.sign.kind.SALES_FINAL': { en: 'Final quotation (BOQ) {number}', hi: 'अंतिम कोटेशन (BOQ) {number}', mr: 'अंतिम कोटेशन (BOQ) {number}' },
  'life.sign.kind.DESIGN_FINAL': { en: 'Design final {number}', hi: 'डिज़ाइन फ़ाइनल {number}', mr: 'डिझाइन फायनल {number}' },
  'life.sign.read': { en: 'Read and sign', hi: 'पढ़ें और हस्ताक्षर करें', mr: 'वाचा आणि सही करा' },
  'life.sign.open': { en: 'Open the signed copy', hi: 'हस्ताक्षरित कॉपी खोलें', mr: 'सही केलेली प्रत उघडा' },
  'life.sign.signed': { en: 'Signed by {name} on {date}', hi: '{name} ने {date} को हस्ताक्षर किए', mr: '{name} यांनी {date} रोजी सही केली' },
  'life.sign.superseded': {
    en: 'A newer version was sent; the studio will ask you to sign that one.',
    hi: 'नया संस्करण भेजा गया है; स्टूडियो आपसे उस पर हस्ताक्षर करने को कहेगा।',
    mr: 'नवी आवृत्ती पाठवली आहे; स्टुडिओ तुम्हाला त्यावर सही करायला सांगेल.',
  },
  'life.sign.agree': {
    en: 'I have read this quotation in full, including its terms, and I agree to it.',
    hi: 'मैंने यह कोटेशन, उसकी शर्तों सहित, पूरा पढ़ लिया है और मैं इससे सहमत हूँ।',
    mr: 'मी हे कोटेशन, त्याच्या अटींसह, पूर्ण वाचले आहे आणि मला ते मान्य आहे.',
  },
  'life.sign.name': { en: 'Type your full name as your signature', hi: 'हस्ताक्षर के रूप में अपना पूरा नाम लिखें', mr: 'सही म्हणून तुमचे पूर्ण नाव लिहा' },
  'life.sign.submit': { en: 'Sign', hi: 'हस्ताक्षर करें', mr: 'सही करा' },
  'life.sign.done': { en: 'Signed. A signed copy is in your Home locker.', hi: 'हस्ताक्षर हो गए। हस्ताक्षरित कॉपी आपके होम लॉकर में है।', mr: 'सही झाली. सही केलेली प्रत तुमच्या होम लॉकरमध्ये आहे.' },
  'life.sign.ownerOnly': { en: 'Only the owner of the project can sign.', hi: 'केवल प्रोजेक्ट के मालिक हस्ताक्षर कर सकते हैं।', mr: 'फक्त प्रोजेक्टचे मालक सही करू शकतात.' },
  'life.doing.design': { en: '{studio} is working on your design.', hi: '{studio} आपके डिज़ाइन पर काम कर रहा है।', mr: '{studio} तुमच्या डिझाइनवर काम करत आहे.' },
  'life.doing.site': { en: '{studio} is working on site.', hi: '{studio} साइट पर काम कर रहा है।', mr: '{studio} साइटवर काम करत आहे.' },
  'life.doing.closure': { en: '{studio} is working out the final account.', hi: '{studio} अंतिम हिसाब बना रहा है।', mr: '{studio} अंतिम हिशोब तयार करत आहे.' },
  'life.doing.snags': { en: '{studio} is fixing the open snags.', hi: '{studio} बची कमियाँ ठीक कर रहा है।', mr: '{studio} उरलेल्या त्रुटी दुरुस्त करत आहे.' },
  'life.doing.warranty': { en: 'Raise a snag if anything goes wrong.', hi: 'कुछ भी गड़बड़ हो तो कमी दर्ज करें।', mr: 'काही बिघडले तर त्रुटी नोंदवा.' },
  'life.doing.closed': { en: 'Your project is complete.', hi: 'आपका प्रोजेक्ट पूरा हो गया।', mr: 'तुमचा प्रोजेक्ट पूर्ण झाला.' },
  'life.warrantyUntil': { en: 'In warranty until {date}', hi: '{date} तक वारंटी में', mr: '{date} पर्यंत वॉरंटीमध्ये' },
  'life.warrantyEnded': { en: 'Warranty ended on {date}', hi: 'वारंटी {date} को खत्म हुई', mr: 'वॉरंटी {date} ला संपली' },
  'life.signoff.title': { en: 'Sign off your handover', hi: 'अपने हैंडओवर पर साइन-ऑफ़ करें', mr: 'तुमच्या हँडओव्हरवर साइन-ऑफ करा' },
  'life.signoff.body': {
    en: 'There are no open snags. Signing off says your home is handed over as agreed; your warranty starts today.',
    hi: 'कोई कमी बाकी नहीं है। साइन-ऑफ़ का मतलब है कि आपका घर तय के अनुसार सौंप दिया गया; आपकी वारंटी आज से शुरू होती है।',
    mr: 'कोणतीही त्रुटी उरलेली नाही. साइन-ऑफ म्हणजे तुमचे घर ठरल्याप्रमाणे सोपवले गेले; तुमची वॉरंटी आजपासून सुरू होते.',
  },
  'life.signoff.button': { en: 'Sign off the handover', hi: 'हैंडओवर पर साइन-ऑफ़ करें', mr: 'हँडओव्हरवर साइन-ऑफ करा' },
  'life.signoff.done': { en: 'Signed off. Your warranty runs until {date}.', hi: 'साइन-ऑफ़ हो गया। आपकी वारंटी {date} तक है।', mr: 'साइन-ऑफ झाले. तुमची वॉरंटी {date} पर्यंत आहे.' },
  'life.signoff.failed': { en: 'Could not sign off. Try again.', hi: 'साइन-ऑफ़ नहीं हो सका। फिर कोशिश करें।', mr: 'साइन-ऑफ झाले नाही. पुन्हा प्रयत्न करा.' },
  'life.warrantySnag': { en: 'Warranty', hi: 'वारंटी', mr: 'वॉरंटी' },
  'life.snagWindow': { en: 'You can raise snags here until {date}.', hi: 'आप {date} तक यहाँ कमी दर्ज कर सकते हैं।', mr: 'तुम्ही {date} पर्यंत येथे त्रुटी नोंदवू शकता.' },
  'life.snagWindowClosed': {
    en: 'Your snag window closed on {date}. Sign off the handover; during the warranty you can raise a warranty snag.',
    hi: 'कमी दर्ज करने का समय {date} को खत्म हुआ। हैंडओवर पर साइन-ऑफ़ करें; वारंटी में आप वारंटी कमी दर्ज कर सकते हैं।',
    mr: 'त्रुटी नोंदवण्याची मुदत {date} ला संपली. हँडओव्हरवर साइन-ऑफ करा; वॉरंटीमध्ये तुम्ही वॉरंटी त्रुटी नोंदवू शकता.',
  },
} satisfies Record<string, Entry>;

export type LifecycleKey = keyof typeof lifecycleWords;

export function lw(lang: Lang, key: LifecycleKey, vars: Record<string, string | number> = {}): string {
  const raw = lifecycleWords[key][lang] ?? lifecycleWords[key].en;
  return raw.replace(/\{(\w+)\}/g, (_m, k: string) => (vars[k] === undefined ? '' : String(vars[k]))).replace(/\s+$/, '');
}

export interface LifecycleLines {
  phase: string;
  current: string;
  next: string | null;
  /** The customer's one thing to do; null = nothing needed. */
  blocker: string | null;
  /** "Nothing needed from you" companion: what the studio is doing. */
  doing: string;
  warranty: string | null;
  /** The snag window (owner, 15 Oct 2026): until when snags may be raised, or that it has closed. */
  snagWindow: string | null;
}

/** The three lines, said in one language. `money` and `date` format paise and a YYYY-MM-DD day. */
export function lifecycleLines(
  l: CustomerLifecycle,
  lang: Lang,
  ctx: { studio: string; money: (paise: number) => string; date: (day: string) => string; today: string },
): LifecycleLines {
  const step = (s: CustomerLifecycleStep): string => {
    if ((s.kind === 'design' || s.kind === 'stage') && s.label) return s.label;
    if (s.kind === 'design') return lw(lang, 'life.phase.design');
    return lw(lang, `life.step.${s.kind}` as LifecycleKey);
  };
  let blocker: string | null = null;
  const b = l.blocker;
  if (b) {
    const amount = b.amountPaise !== null ? ctx.money(b.amountPaise) : '';
    if (b.kind === 'pay') blocker = ['snags', 'warranty'].includes(l.phase) ? lw(lang, 'life.block.payFinal', { amount }) : lw(lang, 'life.block.pay', { label: b.label ?? '', amount });
    else if (b.kind === 'confirm_snag') blocker = (b.count ?? 1) > 1 ? lw(lang, 'life.block.confirm_snags', { n: b.count ?? 1 }) : lw(lang, 'life.block.confirm_snag');
    else blocker = lw(lang, `life.block.${b.kind}` as LifecycleKey, { label: b.label ?? '', amount });
  }
  const warranty = l.warrantyEndsOn
    ? lw(lang, l.warrantyEndsOn >= ctx.today ? 'life.warrantyUntil' : 'life.warrantyEnded', { date: ctx.date(l.warrantyEndsOn) })
    : null;
  return {
    phase: lw(lang, `life.phase.${l.phase}` as LifecycleKey),
    current: step(l.current),
    next: l.next ? step(l.next) : null,
    blocker,
    doing: lw(lang, `life.doing.${l.studioDoing}` as LifecycleKey, { studio: ctx.studio }),
    warranty,
    snagWindow: l.snagWindowEndsOn
      ? lw(lang, l.snagWindowEndsOn >= ctx.today ? 'life.snagWindow' : 'life.snagWindowClosed', { date: ctx.date(l.snagWindowEndsOn) })
      : null,
  };
}

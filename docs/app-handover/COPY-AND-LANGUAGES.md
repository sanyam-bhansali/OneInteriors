# Copy and languages

The app runs in **English, हिंदी and मराठी**.
- The language is picked on Welcome and can be changed in Me.
- GEIO answers in the app's language.
- The website already has an i18n layer (`src/modules/i18n/site`, `components/app/i18n.tsx`). Reuse its keys and the `oa.lang` cookie convention, so the website and app agree.

**Status:** only the strings below exist in Hindi and Marathi so far. They are a **first draft**, and **Sanyam reviews them** before launch. Every other screen is English-only in the designs and needs translating with the same review.

## Welcome (Start)

| Key | English | हिंदी | मराठी |
|---|---|---|---|
| switch label | EN | हिं | मरा |
| kicker | Pune, 14 verified studios | पुणे, 14 सत्यापित स्टूडियो | पुणे, 14 पडताळलेले स्टुडिओ |
| h1 | Find the right interior designer for your home. | अपने घर के लिए सही इंटीरियर डिज़ाइनर चुनें। | तुमच्या घरासाठी योग्य इंटिरियर डिझायनर शोधा. |
| sub | Seven questions, three studios matched to your flat, and a quote you can read line by line. | सात सवाल, आपके फ्लैट के लिए तीन स्टूडियो, और लाइन-दर-लाइन समझ आने वाला कोटेशन। | सात प्रश्न, तुमच्या फ्लॅटसाठी तीन स्टुडिओ, आणि ओळ-न-ओळ समजणारे कोटेशन. |
| cta | Find your designer | अपना डिज़ाइनर खोजें | तुमचा डिझायनर शोधा |
| have account | I already have an account | मेरा अकाउंट पहले से है | माझे खाते आधीच आहे |

Headline size is 40px in English and 34px in Hindi and Marathi.

## Me → Language

| English | हिंदी | मराठी |
|---|---|---|
| The whole app, and GEIO, in English. | पूरा ऐप और GEIO हिंदी में। | संपूर्ण ॲप आणि GEIO मराठीत. |

## GEIO

- Language pills: English · हिंदी · मराठी
- Message box placeholder: "Ask in English, हिंदी or मराठी"
- Voice panel: "Listening…" · "Speak in English, Hindi or Marathi"

## Lines that must not drift (they carry promises)

- "Three studios, scored on your brief. Never on who paid."
- "Your expert is on our payroll. Never a studio's." / "She earns the same whichever studio you pick."
- "First quote, from each studio's own rate card. Final price comes after they measure your flat. It usually moves by less than 5%."
- "GST, labour and installation included. No hidden charges."
- "Priced from each studio's own rate card. One Interiors adds nothing on top." (This changes if the paid plan launches; see DECISIONS.md.)
- "You pay the studio directly. Every payment and receipt is kept in your Home locker."
- "GEIO can make mistakes. Prices and dates are confirmed by your studio."
- "Coins can't be used on your studio's bill or cashed out."
- GEIO's intro: "I'm GEIO, your interior design expert. Ask me anything about your home."

# One Interiors: store listing (draft, 1 Nov 2026)

The words and answers for Google Play and the App Store. Everything here is a draft for the owner to approve; nothing has been submitted.

## Names

- **App name:** One Interiors
- **Short description (Play, 80 characters):** Follow your home's interiors: design, site photos, payments and your designer.
- **Subtitle (App Store, 30 characters):** Your home's interiors, live
- **Package / bundle id:** `in.oneinteriors.app` (already in app.json; cannot change after the first upload)
- **Category:** House & Home (Play) · Lifestyle (App Store)

## Full description

Your home's interiors, in one place, from the day you sign with your studio to the day you get your keys.

- **Your one thing today.** The app puts first what your studio is waiting on: a drawing to approve, a finish to choose, a payment to confirm. Nothing waiting? It says what the studio is doing.
- **Every design step.** See each step of your design, what is done and what is next, and approve 2D layouts, 3D renders and working drawings with a tap, or ask for changes in your own words.
- **Chat with your home team.** Your designer, your site head and your family in one conversation, with photos and voice notes. Your phone number stays private.
- **The site, every working day.** Photos from site, a week at a glance, and a timelapse of your home taking shape.
- **Choices with a deadline.** Pick finishes on your real cabinet size, see what each one costs, let your family vote, or ask for other options.
- **Payments you can trust.** Every stage, what is paid and what is next. Confirm each payment your studio records, or say you did not pay it.
- **Snags fixed by a date.** Photograph anything that is not right; your studio sets a date to fix it and you confirm it is fixed.
- **Your home locker.** Agreement, quotation, drawings, receipts and warranties, for as long as you live there.

In English, हिंदी and मराठी.

## Privacy and data safety

- **Privacy policy URL:** https://oneinteriors.in/privacy (exists; check it mentions the app, chat and voice notes before submitting).
- **Account deletion:** in the app, Me → Delete my account (built; the store requires it). Web link for Play's form: the same page on app.oneinteriors.in.
- **Data collected (Play data-safety form):**
  - Name, phone number: account and your studio's records. Not shared with anyone but your studio.
  - Photos and voice notes you send (chat, snags): stored privately, shown only to your studio and family on the project.
  - Messages: stored with your project.
  - Device push token: to send notifications.
  - No location, contacts, advertising ID or payment details. No selling of data. Data is encrypted in transit.
- **Permissions and why (already in app.json):** camera (photograph a snag, send a photo), photos (send a photo), microphone (voice notes), notifications (updates and messages), Face ID / fingerprint (lock the app).

## Screenshots needed

Phone screenshots, 1080 × 1920 or larger, from a real Hauspire project with the client's permission or the test project:

1. Home, "your one thing today"
2. Project: the design steps
3. Chats: a conversation with the designer, with a photo and a voice note
4. On site: today's photos
5. A decision with options and prices
6. Payments

## Before the first store upload (owner)

1. **Google Play Console** account ($25 once) and **Apple Developer** account ($99 a year), in the company's name.
2. **Firebase project** for Android notifications: create it, download `google-services.json`, and upload its FCM V1 service-account key to Expo (`npx eas-cli credentials` → Android → Push notifications). Without it Android phones get no notifications.
3. Build the store versions: `npx eas-cli build -p android --profile production` (an `.aab` for Play) and `npx eas-cli build -p ios --profile production`.
4. Submit: `npx eas-cli submit -p android` and `npx eas-cli submit -p ios`. Start with Play's internal testing track and Apple's TestFlight, for Hauspire's team.

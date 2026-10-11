# Play Store and App Store checklist

The app is the Expo app in `mobile/` (SDK 57, expo-router). Builds run on **EAS** (Expo's cloud), so no Mac is needed to *build* iOS. The MacBook is used for the iPhone Simulator and App Store screenshots.

## Accounts (Sanyam)
- [ ] **Apple Developer Program**, $99 a year. A company account needs a **D-U-N-S number**, which is free but takes days to weeks.
- [ ] **Google Play Console**, $25 once. A new *personal* account must run a closed test with 12+ testers for 14 days before production. An organisation account avoids that.
- [ ] **Expo account** (free) for EAS builds and submit.
- [ ] Final store name ("One Interiors") and app ID `in.oneinteriors.app` (already in `mobile/app.json`).

## Backend before release
- [ ] Production database and the Vercel deployment are live. A **separate test database** exists for preview builds.
- [ ] OTP sender chosen and working (SMS or WhatsApp provider).
- [ ] GEIO AI provider chosen; it runs server-side with keys in Vercel env only.
- [ ] Push notifications: Expo push tokens are stored (`PushDevice`), the Apple push key is uploaded to EAS, and FCM is set up for Android.
- [ ] Example data is off in production builds.
- [ ] **Never commit secrets.** `.env.local` stays git-ignored, and no keys go into `mobile/`.

## Things both stores require
- [ ] **Privacy policy URL** (the website has `/privacy`; check it covers the app, photos and phone numbers).
- [ ] **In-app account deletion** (Me → Privacy → Delete my account), plus a web link for deleting.
- [ ] **Support email or URL**.
- [ ] Permission texts are already in `app.json`: camera, photos, Face ID and notifications. Only ask for each one when it's needed.
- [ ] **Data safety (Google) / privacy labels (Apple):** phone number, name, photos, approximate location (locality), usage data.
- [ ] Content rating questionnaire; category Lifestyle or House & Home.
- [ ] **Reviewer login:** a test phone number with a fixed OTP, plus a demo project, written in the review notes.

## Store listing assets
- [ ] App icon 1024×1024 (no transparency for iOS) and the Android adaptive icon (already in `mobile/assets`, check them).
- [ ] Screenshots:
  - iPhone 6.9" (1320×2868), taken from the Simulator on the Mac
  - Android phone, 2–8 images
  - iPad screenshots too if `supportsTablet` is ever switched on (currently `false`)
- [ ] Short description (80 characters, Play), full description, keywords (App Store), promo text.
- [ ] Feature graphic 1024×500 (Play).

## Testing
- [ ] **Android phone:** Expo dev build, then an internal testing track.
- [ ] **MacBook:** iPhone Simulator for all flows, layouts and screenshots.
- [ ] **iPad:** a TestFlight build. Apple reviews iPhone apps on iPad too, so check that the layout holds.
- [ ] **One real iPhone for a day** (borrowed, added as a TestFlight tester): camera, push notifications and the Face ID lock can't be fully tested in the Simulator.
- [ ] Hindi and Marathi on both platforms (Sanyam reviews the text).
- [ ] Reduce-motion and large-text settings on both.

## Release steps (Claude Code can run them once the accounts exist)
1. Run `eas build --platform android --profile production` and `eas build --platform ios --profile production` (`eas.json` exists).
2. Run `eas submit -p android` to the internal track, then promote to production after testing.
3. Run `eas submit -p ios` to TestFlight, test, then submit for review.
4. After launch, ship small fixes as OTA updates with `expo-updates` (already a dependency). Anything that changes native permissions needs a new store build.

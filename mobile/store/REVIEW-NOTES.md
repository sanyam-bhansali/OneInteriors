# Reviewer access and release steps

## Reviewer login (Sanyam sets this up; it needs the live studio app)

Apple and Google reviewers must get past sign-in. The app has no sign-up, so they need a demo customer with a project.

1. In studio.oneinteriors.in (Hauspire), start a project for a client named **"App Review (demo)"** with a mobile number you control that is not a real customer's. Use clearly fake data: a demo flat, a small quotation.
2. Give it some content so the screens are not empty: tick a design step, post one site update with photos, raise one decision.
3. On the project page, press **Make a one-time password**, then sign in once in the app as that number and choose a permanent password (the one-time one works only once).
4. Put the number and the permanent password in:
   - Play Console → App content → App access → "All or some functionality is restricted" → add the login.
   - App Store Connect → the version → App Review Information → Sign-in required.
5. Leave the project running until both apps are approved; delete it afterwards (only the owner can).

Review notes to paste (both stores):

> One Interiors is for homeowners whose interiors studio manages their project on our platform; the studio invites them, so there is no sign-up. Use the demo account above: it is a sample project. Payments are made directly to the studio outside the app; the app only shows them. Account deletion: Me → Delete my account.

## Release steps (once the accounts exist)

1. **Google Play Console** — create the app "One Interiors" (package `in.oneinteriors.app`), fill App content (privacy policy, app access, ads: none, content rating, target audience 18+, data safety from DATA-SAFETY.md), and the store listing from LISTING.md.
2. **Apple** — in App Store Connect create the app with bundle ID `in.oneinteriors.app`, the same listing text, and the privacy labels from DATA-SAFETY.md.
3. **Builds** (Claude runs these):
   - `npx eas-cli build --profile production --platform android` → an .aab
   - `npx eas-cli build --profile production --platform ios` → asks you to sign in to your Apple account once to make the certificates.
4. **Submit:** Play's first upload is manual in the Console (internal testing track); after that `npx eas-cli submit -p android` works with a Play service-account key. iOS: `npx eas-cli submit -p ios` sends to TestFlight.
5. Test the store builds (internal track, TestFlight), then promote / submit for review.

## Still open before release

- Firebase (FCM) key for Android notifications, uploaded to Expo.
- Apple push key, made when the Apple account exists.
- Hindi and Marathi wording review.
- Privacy policy app section (PRIVACY-APP-SECTION.md) approved and published.
- `app.json` version 1.0.0; the production profile auto-increments build numbers.

# One Interiors: the customer app

Expo (React Native) app for homeowners. The plan, the slices and what is built
are in [docs/MOBILE-APP-PLAN.md](../docs/MOBILE-APP-PLAN.md).

## Run it

```
cd mobile
npm install
npx expo start
```

Scan the QR code with **Expo Go** on an Android phone or iPhone on the same
Wi-Fi as the computer. Press `w` to open it in a browser instead (screens only:
the browser cannot reach the API across ports).

The app talks to the website's API at `/api/app/v1`. In development it uses
the Next dev server on the same computer, port 3100 (the worktree's
`customer-fixtures` preview). For any other server, set:

```
EXPO_PUBLIC_API_URL=https://your-preview.vercel.app
```

The API answers only where `CUSTOMER_LIVE=1` **and** a database is
configured. Locally there is no database, so sign-in reports "temporarily
unavailable". Testing sign-in end to end needs a preview deployment with its
own test database, never the production one.

## What is in it (docs/CUSTOMER-PLATFORM-PLAN.md, step 3)

- **Native, after sign-in:** Home, Project, On site, Snags (camera), Locker,
  a decision screen, the notification list and Settings (Face ID or
  fingerprint lock, sign out). Built to the owner's v1 design: Geist type,
  the warm grey ground, terracotta pills, rise-in motion, haptics.
- **Inside the app from the website's `/app`:** the choosing journey, GEIO
  and the 3D home (`src/app/web.tsx`), opened in a web view limited to `/app`.
- **Push:** registered after sign-in (`src/lib/push.ts`); tapping one opens
  its screen. The server side is `src/modules/notify` on the website.
- **Offline:** the last copy of the project is kept on the phone.

## Building for phones (EAS, no Mac needed)

One-time, with the owner's Expo account (the CLI is `eas-cli`, run from `mobile/`):

```
npm install -g eas-cli
eas login
eas init              # writes the EAS project id into app.json; push needs it
```

Then:

```
eas build --profile preview --platform android   # an APK to install on any Android phone
eas build --profile production --platform all     # store builds, once the store accounts exist
```

Android push also needs Firebase (FCM v1) credentials uploaded with
`eas credentials`; iOS push is set up by EAS with the Apple account.

The `preview` profile points at the branch preview, which Vercel protects
with a login the app cannot pass. A store build needs a server the app can
reach without that login: production at launch, or an unprotected staging
address with the test database before it.

## Checks

```
npm run typecheck
npx eslint src
```

## Rules

- Routes live in `src/app/`. Everything else lives outside it.
- `@/â€¦` imports reach the **website's** `src/`, for pure modules only (brief
  types, matching, quotation, money). Never import a file that imports
  `server-only`, Prisma or `next/*`.
- The session token lives in the device keychain (`src/lib/token.ts`), never
  in AsyncStorage.
- Native folders (`ios/`, `android/`) are generated; configure in `app.json`.

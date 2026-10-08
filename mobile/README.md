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

## Checks

```
npm run typecheck
npx eslint src
```

## Rules

- Routes live in `src/app/`. Everything else lives outside it.
- `@/…` imports reach the **website's** `src/`, for pure modules only (brief
  types, matching, quotation, money). Never import a file that imports
  `server-only`, Prisma or `next/*`.
- The session token lives in the device keychain (`src/lib/token.ts`), never
  in AsyncStorage.
- Native folders (`ios/`, `android/`) are generated; configure in `app.json`.

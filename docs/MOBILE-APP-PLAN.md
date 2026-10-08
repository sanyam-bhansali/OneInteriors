# The customer phone app: the plan

Started 7 October 2026. Owner's decision the same day: **a real Play Store and
App Store app**, covering **both halves** of the customer side, choosing and
the project. That supersedes the "PWA first" recommendation in
`CUSTOMER-APP-PLAN.md`, whose analysis still holds and is worth reading for the
trade-offs.

---

## Shape

```
mobile/                     Expo (React Native) app, expo-router, TypeScript
  app/                      screens (file-based routes)
  src/api.ts                the only place that talks to the backend
  src/session.ts            bearer token in the device keychain (expo-secure-store)
src/app/api/app/v1/**       the app's JSON API, inside the existing Next app
src/modules/app-api/**      request plumbing for it: auth, errors, JSON reading
```

**One backend.** The app does not get its own server or database. Every rule
(who matches, what a quote costs, who may see what) stays in `src/modules`,
and the API is a thin layer over it. A fix ships to the website and the app
together.

**Pure modules are shared, not copied.** Brief types, the matcher, the quote
engine and money (`src/modules/{brief,matching,quotation,studio}/*`, the pure
files listed in the module rule in CONTRIBUTING §9.5) are imported by the app
straight from `../src` through a Metro watch folder. Nothing server-only is
ever imported. A check in the app's typecheck makes that a build error rather
than a crash on a phone.

## Auth

The website keeps its httpOnly cookie. The app uses the **same `Session` row**,
with the token handed back in the response body instead of a cookie and sent as
`Authorization: Bearer <token>`.

- `getCurrentUser()` accepts either. The token is the same 256-bit random value
  and is stored the same way (only its SHA-256 in the database), so a bearer
  token is no weaker than the cookie, and revocation, expiry and the fresh role
  read all apply unchanged.
- Customers sign in with **phone + WhatsApp OTP**, the same `requestOtp` /
  `verifyOtp` as the website. No password, no email.
- Google and Apple sign-in come next. They need native client IDs (Android SHA-1,
  iOS bundle ID) and an id-token exchange endpoint. Apple requires Apple sign-in
  in any iOS app that offers Google.
- The token lives in the device keychain (`expo-secure-store`), never in
  AsyncStorage.

The brief is kept on the phone until sign-in, so there is no anonymous server
brief and no `anonKey` in the app. Signing in happens before matches, at the
same point the website asks for the name and number.

## Gate

`/api` is always routed (lib/host.ts `ALWAYS`), so every `/api/app/v1` handler
checks `customerLive()` itself and answers 404 while the marketplace is closed,
exactly like the website's customer pages. A test pins this.

## Build order

| # | Slice | Backend | App |
|---|---|---|---|
| 1 | **Foundation** | bearer sessions, `auth/otp/request`, `auth/otp/verify`, `auth/sign-out`, `me` | Expo scaffold, brand theme, phone sign-in |
| 2 | **The brief** | `brief` GET / PUT | the nine questions, kept on the phone, synced once signed in |
| 3 | **Matches and quotes** | `matches` (via `rankOnServer`), `quote/:studio` | match list with reasons, the quote with its lines |
| 4 | **Compare and ask** | `compare`, `ask` | side by side, materials row, AI summary |
| 5 | **The expert call** | `expert/slots`, `expert/book`, `call/:token` | book, move, cancel |
| 6 | **Your home** | `home` (consultations, tracker, benefits, rooms) | Your home tab |
| 7 | **The project** | new: drawings to approve, payment stages, snags (schema + studio side) | project tab, camera for snags, push notifications |
| 8 | **Social sign-in** | `auth/google`, `auth/apple` (id-token exchange) | buttons |
| 9 | **Store release** | — | EAS builds, icons, splash, store listings, privacy labels |

**Progress, 7 Oct:** slice 1 is built. The backend has bearer sessions, the
OTP, sign-out, `me` and `brief` routes, all behind the gate, with tests in
`tests/app-api.test.ts`. The app has the Expo SDK 57 scaffold, the brand
theme and fonts, welcome, WhatsApp sign-in, the keychain token and a
signed-in home. It has not been signed in end to end yet, because that needs a
preview deployment with a test database. The brief route (slice 2's backend)
is in; its screens are next.

Slice 7 is the reason the app exists and is the only one that needs new
data: today the tracker (`HomeProject`, `HomeProjectUpdate`) covers stages,
notes and site photos. Drawings to approve and the snag list do not exist
anywhere, and the studio side has to be able to post them. It gets its own
short plan before it is built.

## What the owner has to provide

- **Apple Developer account** (US$99 a year) and **Google Play Console**
  (US$25 once), in the company's name, before slice 9.
- An **Expo account** for EAS builds (free tier is enough to start). iOS builds
  run on Expo's cloud, so no Mac is needed.
- Google and Apple **OAuth client IDs** for slice 8.
- App name on the stores and the bundle ID. Proposed: `in.oneinteriors.app`.

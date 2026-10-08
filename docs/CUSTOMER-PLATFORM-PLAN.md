# Customer platform: one account, a phone app and a laptop site

Owner's direction, 9 Oct 2026: customers get a native phone app (Play Store
and App Store) for notifications and daily updates, and a web version with its
own desktop layout for laptops. One sign-in works on both, and both show the
same project.

Supersedes the slice order in `MOBILE-APP-PLAN.md`; the store-app decision of
7 Oct (Expo, native) stands.

## The shape

```
                 ┌──────────────────────────────┐
 studio / ops ──▶│  Next.js on Vercel + Postgres │◀── phone app (Expo, native)
 post updates,   │  one account, one API         │      push, camera, Face ID
 decisions,      │  /api/app/v1                  │
 snags           │  notification service         │◀── laptop site (oneinteriors.in)
                 └──────────────────────────────┘      desktop layout, same data
```

- **One backend.** Every screen on both clients reads `/api/app/v1` (the phone)
  or the same server modules (the website). They cannot disagree.
- **One account.** Phone number with a code, Google or Apple. Sessions already
  work as a cookie on the web and a bearer token in the app (`getCurrentUser`).
- **Updates come from the studio side.** The studio or our site team posts the
  daily update, photo first, from `/studio` and ops. The customer only reads,
  chooses and raises snags.

## What exists already

| Piece | Where | State |
|---|---|---|
| Project tracker: stages, target dates, done marks | `HomeProject`, `modules/portal/tracker*.ts` | Built; ops starts it when a customer signs |
| Site updates with photos (private bucket, signed links) | `HomeProjectUpdate`, `storage/site-photos.ts` | Built; posted by ops or the studio |
| Payment phases per studio | `modules/studio/payment-phases.ts` | Built |
| Customer sessions on web and app | `Session`, `getCurrentUser` (cookie or bearer) | Built |
| App API | `/api/app/v1` (auth, me, brief) | Started |
| Notification log | `Notification` table | Exists, barely used |
| The design | `/app` (web, v1 screens) | Built on example data |

## What is missing, and the order it gets built

### Step 1 — Backend (1–2 weeks) ← starting now

1. **Decisions with a deadline.** `HomeDecision`: title, why it matters, due
   date, options (name, note, price against the quote, swatch), the choice and
   when it was made. Posted by the studio or ops; chosen by the customer.
2. **Snags.** `HomeSnag`: what, which room, photos, raised by whom, fix-by date,
   status (open, fixed), fixed-on and its photo. Raised by the customer or at
   the handover walk-through; closed by the studio.
3. **Push devices.** `PushDevice`: the user, the Expo push token, platform,
   last seen. Registered by the app after sign-in; removed on sign-out.
4. **Notification service.** `notify(userId, event)` writes a `Notification` and
   sends a push to every device; WhatsApp or email when there is no device.
   Events: site update posted, decision due in 2 days, decision made (to the
   studio), snag raised (to the studio), snag fixed, payment phase due.
5. **The project API.** `GET /api/app/v1/project` (stages, latest updates with
   signed photo links, open decisions, snags, payments, documents),
   `POST …/decisions/:id` (choose), `POST …/snags` (raise, with a photo),
   `POST …/devices` (register), `GET …/notifications` and mark-read.
6. **Example data off.** The `/app` after-signing screens read the real project
   when the signed-in customer has one, and the example only in the test build.

### Step 2 — Studio side (about 1 week)

Posting a daily update from a phone (photos first), raising a decision with
options and a deadline, closing snags with a photo, uploading documents
(agreement, drawings, receipts, warranties). Inside the existing `/studio`
CRM so studios learn one tool.

### Step 3 — Phone app (2–3 weeks)

The Expo app in `mobile/`, built to the v1 design.

- **Native:** Home, Project, On site, Decision, Snags, Locker, 3D, notifications,
  camera, Face ID or fingerprint unlock, haptics, the last update kept offline.
- **Inside the app from `/app`:** the choosing journey (quiz, matches, quotes,
  compare, expert call), used once per customer. Moved to native later, one
  screen at a time, if it earns it.
- Push through Expo's push service; deep links (`oneinteriors://`, and
  `oneinteriors.in` links) open the right screen.
- The server address is read at startup, so moving from the test server to
  production needs no new store build.

### Step 4 — Laptop site (1–2 weeks, alongside step 3)

The same pages in a desktop layout: a side menu (Home, Project, On site,
Decisions, Snags, Documents, 3D), a photo grid of updates, the timeline beside
the payments, quotes side by side, documents and PDFs to download. Same
components where they fit; a desktop layout, not a stretched phone screen.

### Step 5 — Store submission (about 1 week)

Icons, splash, store screenshots and text, the privacy forms (photos, push,
phone number), a test account for the reviewers, then Apple and Google review.
EAS builds the iPhone version in the cloud; no Mac is needed.

## Who does what

| Owner | Item |
|---|---|
| Sanyam | Apple Developer account ($99/yr), Google Play Console ($25), a free Expo account |
| Sanyam | Who posts daily updates: the studio, our site team, or both |
| Sanyam | Google and Apple sign-in client IDs for the app (when step 3 needs them) |
| Sanyam | The `app-test` database connection strings in the worktree `.env.local` |
| Claude | Steps 1–5, tested on the test database before anything touches production |

## Rules that carry over

- Never run `migrate dev` or `reset` against production; migrations ship as
  SQL files and are deployed with `db:deploy` after review.
- Photos stay in the private bucket and are only ever served as short-lived
  signed links.
- Per-sq-ft studio rates are never shown to customers.
- Nothing claims to hold customer money until escrow exists (`FUTURE-SCOPE.md`).

# Studio project workspace — feature brief

**Written:** 11 October 2026 · **Owner:** Sanyam
**Source:** the "Studio project workspace — spec" doc and the studio row of the
"One Interiors App — v1 screens" canvas

This adds the studio side of the post-signing project to One Interiors. You
already know the product, codebase and conventions; this file covers only the
new feature. It lives in `docs/studio-workspace/` with the screen designs in `designs/` (see `designs/README.md`). If it conflicts with
the code or with `HANDOVER.md`, stop and say so.

New env vars this feature needs (Sanyam adds them): speech provider key,
message provider key, cron secret.

---

## 1. What this adds

The studio side of every post-signing customer feature: project tracker, today
on site, decisions, snags, payments, home locker. Plus the team, login and
permission layer under it, and the customer-side views that read it.

**The principle: the studio records each fact once, while doing its own work,
and the customer app reads that same record.** There is no separate "update
the customer" step anywhere. A step that exists only for the customer gets
skipped the first busy week.

Three tests every screen must pass:

- **One source.** If the customer screen could be wrong while the studio
  screen is right, there are two copies of the truth. Fix the design.
- **Done in the doing.** The action that records the fact is one the studio
  takes anyway: ticking off work, photographing a fix, logging a receipt.
- **Phone-first for site work.** A site supervisor uses it one-handed, on a
  weak connection, in Hindi or Marathi, with no required typing.

---

## 2. Decisions already made

- **Inside the existing app.** `/studio/**` in the same codebase, database and
  modules. No new repo.
- **Two store apps from that codebase** (phase 6): **One Interiors** for
  homeowners and **One Interiors Studio** for studios. Each is a thin
  Capacitor shell opening its own part of the same app. Proposed bundle IDs:
  `in.oneinteriors.app` and `in.oneinteriors.studio`. On the web: customers at
  the main domain, studios at `studio.` subdomain (or `/studio` until the
  subdomain is set up).
- **Studio members sign in with phone + one-time code.** No passwords.
  Email sign-in is blocked by the Resend domain anyway.
- **Site mode** is a separate phone-first route for site supervisors
  (`/studio/site`). A supervisor lands there and never sees the office menu.
- **Append-only:** site updates, snag events, payment entries, date changes
  and the project event log are never edited or deleted. Corrections are new
  rows shown beside the original.
- **The customer closes:** a snag closes only on the customer's confirmation
  (or a 7-day timeout). A payment counts only after the customer confirms it.
- **Photos come from the in-app camera** with time and location. Gallery
  photos are allowed but labelled "from gallery" to the customer.
- **Voice, not typing:** every photo has its own mic. The supervisor says what
  was done in any language; the customer reads one plain sentence under that
  photo, in their own language. **The customer never hears the recording.**
  The recording and transcript stay with the studio and One Interiors so a
  sentence can be checked against what was said.
- **Stages: the studio owns names, we own meaning.** Same pattern as
  `StudioStage` and `pipeline-rules.ts`. Every query reads the stage `kind`,
  never its name.
- **Snapshot at signing:** checklist, materials and payment amounts are copied
  from the signed quote. Editing the product master never changes a running
  project.
- **Self-managed vs Assured:** the studio does the same work either way.
  Assured only adds a check by our team before a stage shows "done". Build the
  hook; the Assured check itself is phase 6 or later.

---

## 3. Roles and permissions

| Action | Owner | Project manager | Site supervisor | Accounts |
|---|---|---|---|---|
| Invite or remove team, set roles | ✓ | | | |
| Create project from signed quote | ✓ | ✓ | | |
| Edit plan dates and stage names | ✓ | ✓ | | |
| Post today's update, mark nobody on site | ✓ | ✓ | ✓ | |
| Tick checklist items | ✓ | ✓ | ✓ | |
| Create a decision for the customer | ✓ | ✓ | | |
| Accept a snag, set fix-by date, assign | ✓ | ✓ | | |
| Mark a snag fixed (after photo) | ✓ | ✓ | ✓ | |
| Mark a payment received, attach receipt | ✓ | | | ✓ |
| Upload drawings and documents | ✓ | ✓ | | |
| See vendor rates and margins | ✓ | | | |

- Project managers and supervisors see **only projects assigned to them**.
- Accounts sees payments across all projects, nothing else.
- Enforce in the module layer on every read and write, not only in the UI.
  Write tests for each cell of this table that matters (at minimum: a
  supervisor cannot read an unassigned project; a PM cannot read vendor rates).

---

## 4. Data model

Extends the existing `StudioProject`. Names are proposals: reuse what already
exists, and change existing columns expand → migrate → contract. Every new
table gets the usual RLS lines and an index on each foreign key.

| Table | Key fields | Notes |
|---|---|---|
| `StudioMember` | studioId, phone, name, role (`OWNER`,`PM`,`SUPERVISOR`,`ACCOUNTS`), status (`INVITED`,`ACTIVE`,`SUSPENDED`), language, lastSeenAt | Unique (studioId, phone). A seat = signed in at least once and not suspended |
| `ProjectMember` | projectId, memberId | Which PM / supervisor sees which project |
| `ProjectStage` | projectId, kind (`DESIGN`,`CIVIL`,`CARPENTRY`,`FINISH`,`HANDOVER`), name, sortOrder, plannedStart, plannedEnd, actualEnd | `kind` fixed, `name` renameable |
| `ChecklistItem` | stageId, room, label, quoteLineId, sortOrder, doneAt, doneById, doneSource (`TICK`,`VOICE`) | Generated from quote lines. `doneAt` null = open |
| `SiteLog` | projectId, date, kind (`UPDATE`,`NOBODY`,`CORRECTION`), reason, postedById, postedAt, correctsId | Partial unique index: one `UPDATE`/`NOBODY` per (projectId, date) |
| `SiteLogPhoto` | siteLogId, storagePath, takenAt, lat, lng, fromGallery, voicePath, transcript, transcriptLang, customerText, customerLang | Private storage bucket; signed URLs only |
| `SiteLogCrew` | siteLogId, crewName, crewRole, arrivedAt | Only first name + role cross to the customer |
| `ProjectDateChange` | projectId, stageId, field, fromDate, toDate, reason (`SUPPLIER`,`CUSTOMER_CHANGE`,`SITE_CONDITION`,`STUDIO`,`OTHER`), note, byId, at | Append-only. Reason decides whose delay it is |
| `ProjectDecision` | projectId, title, dueAt, lateImpact, quoteLineId, status (`OPEN`,`PICKED`,`EXPIRED`), pickedOptionId | Picking writes a quote-line change; the old line stays |
| `DecisionOption` | decisionId, label, detail, photoPath, deltaPaise, studioCostDeltaPaise | `studioCostDeltaPaise` never leaves the studio |
| `DecisionVote` | decisionId, optionId, voterId | Family votes; customer's pick decides |
| `Snag` | projectId, room, title, raisedBy (`CUSTOMER`,`STUDIO`), fixBy, assigneeId | Status is derived from events, not stored |
| `SnagEvent` | snagId, kind (`RAISED`,`ACCEPTED`,`DISPUTED`,`FIXED`,`CONFIRMED`,`REOPENED`,`AUTO_CLOSED`), photoPath, voicePath, transcript, customerText, note, byId, at | Append-only |
| `ProjectPayment` | projectId, stageKind, amountPaise, receivedOn, mode (`UPI`,`BANK`,`CHEQUE`,`CASH`), receiptPath, recordedById, customerConfirmedAt, disputedAt | Paid and balance computed |
| `ProjectDocument` | projectId, kind (`AGREEMENT`,`QUOTE`,`DRAWING`,`RECEIPT`,`WARRANTY`,`OTHER`), title, storagePath, version, supersedesId, sharedAt | A shared document can only be superseded |
| `ProjectEvent` | projectId, at, actorType, actorId, type, refId, payload (jsonb) | Append-only log; feeds the customer feed, notifications, reminders, studio score |

Rules:

- `ProjectEvent`, `SnagEvent`, `ProjectDateChange` and `SiteLog` get **no
  update or delete path** in code. Add a test that greps the module for
  `update`/`delete` calls on them.
- Every write that matters also writes one `ProjectEvent` in the same
  transaction.
- Pure rules go in pure files with exhaustive tests:
  - `project-rules.ts`: stage completion from items, delay attribution by
    reason, overall delay, "can mark stage done" (needs at least one photo in
    that stage), final payment gate (no open snags).
  - `snag-status.ts`: status from an ordered event list, including 7-day
    auto-close.
  - `reminder-rules.ts`: which reminder is due for a project at a given IST
    time, given working days.
  - `quote-to-plan.ts`: signed quote lines → stages, checklist items,
    payment schedule, materials list.

---

## 5. What crosses to the customer

| Customer sees | Never crosses |
|---|---|
| Site photos, crew first name + role, arrival time | Crew phone numbers, wages, attendance history |
| Checklist items done, stage status, planned and actual dates | Internal task notes, vendor work orders |
| Delay reason in plain wording | Free-text internal notes on the delay |
| Decision options, photos, price difference | Studio cost per option, margins |
| Quote lines as signed, recorded changes | Vendor rates, product master cost fields |
| Snag status, fix-by date, before/after photos, the written fix sentence | Who on the crew caused it, the voice recording |
| Payment marked received, receipt | Studio's other accounts |
| Documents the studio shared | Drafts, internal drawings |
| `customerText` for each photo | `voicePath`, `transcript` |

Implement as one server-side projection (`customer-project.ts` or similar)
that selects only the left column. Test that a projection result contains
none of the right-column fields.

---

## 6. Phases

Plan each phase against the code first and wait for Sanyam's go-ahead.
Each phase ends with a test a real studio could fail. Phase 2 is what the v1
goal depends on; nothing after it starts until it passes.

### Phase 1 — Team, sign-in, projects

**Build**
- `StudioMember`, `ProjectMember`, migration with RLS and indexes.
- Phone + OTP sign-in for studio members, reusing the existing customer OTP
  challenge and session machinery (attempt limits, rate limits). Add a
  per-IP limit while you are there.
- Code delivery behind a `MessageSender` adapter: WhatsApp when the template
  is approved, SMS fallback, console/fake in development. Ask which provider
  before wiring a real one.
- Settings → Team: list members, invite by name + phone + role + projects,
  resend, suspend. Seat counter (5 free).
- Role guards in the module layer per section 3.
- Before this ships, make sure the existing dev shortcuts (OTP shown on
  screen, ops without login) can only switch on in local development, never
  in a deployed build, now that studios sign in too.
- After sign-in: owner/PM → office dashboard; supervisor → `/studio/site`.
  Supervisor sessions last 90 days. Owner can sign a member out of all
  devices.
- `quote-to-plan.ts` and "New project from a signed quote": creates
  `ProjectStage` rows (5 kinds, default names), `ChecklistItem`s per room
  from quote lines, the 40/40/20 payment schedule (`splitAcross`), the
  materials list, and files the agreement + final quote as documents.
- Office: Projects list (columns: home + customer, stage, today on site,
  overall status, open snags, waiting on customer, next payment, plan) and a
  "Needs attention today" strip. Project workspace with the Plan tab
  (read-only for now).

**Done when**
- An owner invites a supervisor by phone; the supervisor signs in and sees
  only their site.
- A signed quote produces a full plan with no typing.
- Tests cover `quote-to-plan.ts` (stages, items, payments summing exactly to
  the contract) and the permission table.

### Phase 2 — Daily update and the customer feed

**Build**
- **Site mode** (`/studio/site`), phone layout, Hindi/Marathi/English:
  - *My sites today*: one card per assigned site with status (not posted /
    posted at time / nobody on site), a big **Post today's update** button,
    **Nobody on site**, and the snag count.
  - *Post today's update*, in this order:
    1. **Photos with a mic under each.** Camera opens straight away. A faint
       guide asks for the first photo from the same corner each day (for the
       timelapse). Under every photo: a large **Speak about this** mic. Tap,
       speak in any language, stop. Show what was heard (original language)
       and the sentence the customer will read, with **Redo**. A separate
       "Say something else" mic for things not in a photo.
    2. **Who is on site?** Tap faces from the studio's saved crew list.
    3. **What got done today?** The stage's checklist as large tick boxes.
       Items the voice notes clearly mention arrive **suggested as ticked**,
       labelled "from your voice note". The supervisor corrects with a tap.
       Never tick silently without showing it.
    4. **Preview:** "Priya will read" — the customer sentences, in the
       customer's language.
    5. **Post update.** Confirmation says what changed in the customer app.
  - *Nobody on site*: one tap + a reason (waiting for material, waiting for
    customer decision, crew on another job, holiday, customer asked us not to
    come, other). Customer-decision and customer-asked do not count against
    the studio.
- **Speech** behind a `modules/speech` adapter (see section 8: provider
  not chosen):
  - `transcribe(audio, languageHint) → { text, lang }`
  - `toCustomerSentence(transcript, targetLang, context) → string`
    (context = room, stage, checklist labels; one plain sentence, no
    promises about dates or prices)
  - `suggestTicks(transcript, checklistItems) → itemIds` (suggestions only)
  - A fake implementation returning canned text, used in dev and tests.
- **Capture on the web:** use the camera input / `getUserMedia` and
  `MediaRecorder`. The web cannot fully prove a photo came from the camera;
  record what it can (`takenAt` from EXIF when present, `fromGallery` when
  the photo came from a file picker) and say so in the code comment. Full
  enforcement arrives with the Capacitor build in phase 6.
- **Offline:** save the post on the phone (IndexedDB) and send when the
  connection returns. Show "Waiting to send" → "Sent". Compress photos on
  the phone to a 1600 px long edge. Keep `takenAt` from capture time, so a
  late upload is not a late update.
- **Storage:** a private Supabase Storage bucket for photos and audio; serve
  through short-lived signed URLs. Tell Sanyam the bucket name and policy to
  create; don't create it with a key you don't have.
- **Reminders** via a scheduled job (Vercel Cron), times in IST:
  - 18:00 on a working day with no post → the assigned supervisor
    (WhatsApp/push via the adapter).
  - 21:00 still nothing → flag for PM and owner on the dashboard; the
    customer sees "No update from the studio today".
  - Second missed day in a row → owner reminder; the studio's update score
    drops.
- **Customer views (web, in the existing customer account area — inspect
  the routes first):**
  - *Site feed*: one entry per day, newest first. Photos, each with its
    sentence underneath; who was on site and from when; "from gallery"
    labels; nobody-on-site days with the reason; corrections beside the
    original.
  - *Home card*: "Today on site" with the latest entry.
- **Office:** Site log tab in the project workspace.

**Done when**
- A real supervisor at a real site posts in **under 60 seconds** on a weak
  connection, five working days running, speaking rather than typing.
- The customer sees each post within a minute of upload.
- A post made offline arrives later with its original time.
- Tests cover `reminder-rules.ts` and the customer projection (no voice or
  transcript fields leak).

### Phase 3 — Tracker and delays

**Build**
- Stage completion from ticks (`project-rules.ts`). A stage can show done to
  the customer only if at least one photo was posted during that stage.
- **Move a date:** PM changes a date and must pick a reason; writes
  `ProjectDateChange`. The customer sees old date, new date, reason in plain
  words.
- Stage status ("Carpentry · on track") and overall status ("Overall · 4 days
  late") are computed, never typed. Overall = planned handover vs forecast
  handover. Customer-caused delay is shown but not counted against the
  studio.
- Customer *Project* view: stages with planned vs actual, the current stage's
  room checklist, next payment.

**Done when** a moved date shows the customer the old date, the new date and
the reason, and delay attribution passes its unit tests.

### Phase 4 — Snags

**Build**
- Customer raises: photo + room + one line.
- Studio inbox in the project workspace: accept (fix-by date + assignee) or
  dispute with a reason.
- Site mode *Fix a snag*: shows the customer's note and photo, the PM's
  internal note ("only your team"), then **Take the after photo** from the
  same spot, a **Say what you fixed** mic under it, and **Mark fixed**
  (disabled until the after photo exists).
- Customer sees before/after side by side and taps **Confirm** or **Not
  fixed**. No response in 7 days → auto-close, customer told.
- Final payment stage cannot be marked due while any snag is open.
- Handover walk-through can add snags in bulk.

**Done when** a snag cannot close on the studio's tap alone, and the last
payment cannot be due with a snag open.

### Phase 5 — Decisions, payments, locker

**Build**
- **New decision** (office): title, decide-by date, "if she decides late",
  linked quote line, 2–3 options each with photo, description, price change
  (shown to customer, GST-inclusive) and studio cost change (only your team).
  A live preview of the customer's screen beside the form.
- Customer picks (family can vote; the customer's pick decides). On pick:
  the quote line gets a recorded change (old line kept), the price difference
  lands on the final payment stage, the locker material entry updates, the
  studio is notified. Nobody retypes anything. Late, unanswered decisions are
  tagged as customer delay.
- **Payments:** accounts/owner marks a stage received (amount, date, mode,
  receipt). Customer confirms or flags "I didn't pay this" (goes to our
  team). Overpayment is refused with the difference shown (existing
  `canPay()` pattern).
- **Locker:** agreement, final quote, receipts and decision outcomes file
  automatically; studio uploads drawings (versioned) and adds product codes
  to materials when ordered.

**Done when** a customer's pick changes the quote, the final payment amount
and the locker entry with nobody retyping, and paid / balance always equal
the payment rows.

### Phase 6 — Native apps, then later features

**Build**
- Two Capacitor shells from this codebase: **One Interiors** and **One
  Interiors Studio**. The studio app opens straight into site mode for
  supervisors. Native camera capture (enforces camera-only), native mic,
  push notifications, background upload of the offline queue.
- Store listing prep for both (Sanyam publishes under his developer
  account for now; the company account later).

**Later, on data phases 2–5 already collect:** timelapse (from the
same-corner photos), 3D room states (from checklist items per room), Assured
stage checks by our team, the studio score shown to customers once a studio
has enough finished projects.

---

## 7. Studio screens, as designed

Visual language: the existing `.studio-app` palette (sage ground `#dfe0d2`, rail `#eceddf`, paper `#fbfbf6`,
terracotta accent; use the darker `#a8502f` for text and buttons so white text
passes contrast). Geist + Geist Mono for numbers and dates. No dark mode on
the studio surface. Full-width, dense office layouts.

- **Studio sign in** (phone): language switch (EN / हिं / मरा), mobile number,
  6-digit code boxes, "Sent on WhatsApp", "Your studio owner adds team members
  from Settings, Team."
- **My sites today** (site mode): greeting, studio + role, one card per site,
  the bottom bar Today · Snags · Me.
- **Post today's update** (site mode): as in phase 2.
- **Fix a snag** (site mode): as in phase 4.
- **Projects** (office): rail nav with the existing grouping (Dashboard /
  Your work / From us / Settings), "Needs attention today" cards (no update
  yet, snag overdue, payment to record, waiting on the customer — labelled
  as not your delay), live projects table.
- **Project workspace** (office): header chips (customer, flat, tier,
  contract, plan, "customer app connected"), tabs Plan · Site log · Snags ·
  Payments, a dark side panel **"What Priya sees right now"**, a Home locker
  card, and an "Only your team" notes box.
- **New decision** (office): form + customer preview, as in phase 5.
- **Team** (office): seat counter, people table (role, which sites, last
  active, language), "Add someone" panel with role cards explaining what each
  role can do and site chips.

Every studio field the customer will see carries a small **"Customer sees
this"** marker, or "Priya will read" using the customer's first name. Internal-only fields sit in a grey box
labelled **"Only your team"**.

---

## 8. Open decisions — ask before the phase that needs them

1. **Speech provider** (phase 2) for transcription in Marathi, Hindi and
   English, and the model that writes the customer sentence. Build on the
   fake adapter until chosen.
2. **Message provider** (phase 1) for OTP and reminders: WhatsApp template
   approval is pending; which SMS provider in the meantime?
3. **Supervisor posting via WhatsApp** (could replace or supplement site
   mode). Not in scope until decided.
4. **Working days:** six-day or five-day week, and whose holidays. Default to
   Monday–Saturday, configurable per studio, until decided.
5. **Approval of customer sentences:** is the supervisor's look enough, or
   must the PM approve on a studio's first projects?
6. **Snag auto-close period:** 7 days proposed.
7. **Assured checks** in v1 or later.

## 9. Out of scope

Escrow or holding funds, AR "try it in my room", Home Coins and the other
engagement features, timelapse and 3D rendering (phase 6+), changes to
matching or the quote builder beyond what phase 5 needs.

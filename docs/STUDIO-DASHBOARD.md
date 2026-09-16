# The studio dashboard — requirements

> ## Revision, 14 September 2026 — sections 3 and 3b are superseded
>
> The surface described below was built in full and then rejected on sight:
> *"too bad the complexity, it is not understandable, we want it simple and
> aesthetic with features that are actually helpful for them."*
>
> That verdict is correct and the cause is legible in this document. It was
> written by working outward from **what the marketplace can measure** — six
> funnel stages, six scoring factors, a take-rate calculation — rather than
> inward from **what a designer wants to know**. Everything in it is true. Almost
> none of it is a thing a studio owner would open an app to find out.
>
> The shipped surface is three pages:
>
> | Route | The one question it answers |
> | --- | --- |
> | `/studio` | Is work coming in, and does anything need me? |
> | `/studio/calendar` | Who am I seeing, and when? |
> | `/studio/listing` | How do I look, and what do I change? |
>
> What changed concretely:
>
> - **The funnel is gone**, with `/studio/analytics` and its diagnosis engine.
>   `dashboard-funnel.ts` survives, tested, because the ops side may yet want it —
>   but no studio-facing page renders it.
> - **Six factor bars became one sentence.** `adviceFrom()` in `/studio/page.tsx`
>   picks the single weakest measured factor and says the one thing that moves
>   it. Six things to act on is none.
> - **Rates, work and profile copy left the nav** and now sit behind
>   `/studio/listing`, a contents page rather than a fourth form.
> - **The home page leads with one number**: briefs this month, set large, with a
>   plain sentence under it — "Up from 3 last month", never "+33%".
>
> Sections 0, 1, 2 and 4 onward still hold: they are about where the data comes
> from and what does not exist yet, and none of that changed.

A studio pays ₹25,000 to ₹1,00,000 a month. Today, once they are approved and
live, their home page is still the onboarding checklist they finished weeks ago.
`studio.status` is loaded into the page context and never read. A studio earning
us money sees five ticks and nothing else, forever.

That is the largest gap in the product, and it is a retention problem before it
is a design problem: a studio that cannot see what it is buying does not renew.

---

## 0. Read this before estimating anything

**The dashboard is not a view over existing data. Most of the data does not
exist.** Six things a studio dashboard obviously needs have no writer anywhere
in the codebase:

| What | Status today |
| --- | --- |
| `Match` rows — score, breakdown, reasoning | Schema exists in full. **Nothing ever writes one.** Every match is computed in `rankStudios()` at render time and discarded. |
| Shown / viewed / shortlisted | `Shortlist` table is dead — the real shortlist is `sessionStorage` + a URL. `match.view` and `studio.view` are in the event vocabulary and **never emitted**. `AnalyticsEvent` has **no `studioId` column**. |
| Won / lost | Nothing. `Quotation.status` has `ACCEPTED`/`DECLINED` and no code sets them. No `Project` row is ever created. |
| Delivery record | No `Review` model. The six derived columns on `Studio` (`completedProjects`, `avgVarianceDays`, `upheldDisputes`, …) are documented as "recomputed by a job" — **that job does not exist.** They are `0`/`null` in any real database. |
| Billing | No `Invoice`, no `Payment`. **No `Subscription` row is ever created** by any code path. Razorpay is three empty env vars. |
| Studio-visible pause state | `Studio.pausedReason` is documented as "shown to the studio". **No studio-facing page renders it.** A studio can be invisible and never be told. |
| The introduction itself | **No model.** Nothing records that we handed customer A to studio B on date C — the single event the 5% is charged for. |
| Meetings and site visits | **No model.** `Consultation.scheduledFor` is the *expert's* call with the customer. `VerificationCheck` site visits are ops visiting the *studio*. Neither is a studio–customer meeting. |

The meeting gap is the sharpest of these, because it is a promise already made.
Customer-facing copy says *"then we set up the meeting or site visit with that
studio directly"* — in `modules/brief/journey.ts`, `app/expert/page.tsx` and
`app/expert/ExpertForm.tsx`. **We say it four times and model it nowhere.**

`/ops/allocation` already carries the sentence that justifies this whole
project — *"a studio that cannot see it is paying for a black box"* — above a
column that reads the empty `matches` table and silently renders `0`.

**So the first deliverable is not a page. It is the persistence layer.** Anyone
estimating this as "build a dashboard" will be wrong by an order of magnitude.

---

## 1. The five questions the dashboard exists to answer

In the order a studio owner actually asks them.

1. **Am I visible right now?** And if not, why, and when does that lift?
2. **How many customers saw me?** This is the thing the subscription buys. It is
   the headline number and everything else is supporting detail.
3. **Why did I rank where I did, and what would move it?** Including the briefs
   where we ranked them low — a dashboard that only shows wins teaches nothing.
4. **What happened to the people who saw me?** Quotes generated, expert calls
   requested naming us, and eventually projects signed.
5. **Is this worth what I pay?** Their effective take rate against the
   alternative they already know: what a booked project costs them through their
   own ads.

Any panel that does not serve one of those five does not go on the first
version.

---

## 2. Phase 0 — make the numbers exist

This is the real work. None of it is user-visible on its own.

### 0.1 Persist matches — *the gate for everything else*

Nothing downstream is possible without this.

- Add `storeMatches(briefId, results)` to `src/modules/matching/` as a
  `server-only` sibling of the pure `score.ts`. `score.ts` itself must stay pure
  and must not learn about Prisma.
- Write one `Match` row per studio per brief: `score`, `factorsScored`,
  `factorsTotal`, `breakdown` (the full `FactorScores`, **nulls preserved**),
  `reasoning`, `engineVersion`. The `@@unique([briefId, studioId])` makes this an
  upsert.
- **Write on the server, once, when the brief is completed** — not from
  `MatchClient.tsx`, which ranks client-side inside a `useMemo` and would write
  on every re-render. The natural seam is the same place `quoteBrief()` is
  called server-side.
- **Never rewrite an existing row with a newer engine version.** `engineVersion`
  exists precisely so an old score is never reinterpreted under new weights. A
  re-match after a weight change writes a new row for a new brief, and leaves
  history alone.
- Nulls in `breakdown` are load-bearing. `null` means *not measurable*, and
  coercing it to `0` would tell a studio it scored badly on something we never
  measured — which, given most factors are null on a new roster, would be the
  dashboard's dominant message on day one.

**Backfill is impossible.** Every match computed before this ships is gone. Say
so on the dashboard rather than showing a misleadingly short history.

### 0.2 Record what happened after they were shown

Three distinct events, currently all missing. `AnalyticsEvent` has no `studioId`
and its `props` guard rejects free text but permits a slug — so the cheapest
correct answer is a `studioSlug` prop, not a schema change.

- **Shown** — implied by the `Match` row. No extra event needed.
- **Opened** — emit `studio.view` with `{ studioSlug }` from the studio profile
  page. The event name already exists and is never fired.
- **Shortlisted** — emit `match.view`… no. Shortlisting lives in `sessionStorage`
  by deliberate design (*"a shortlist is a working set, not a record"*), and that
  reasoning still holds. **Do not resurrect the `Shortlist` table.** The
  comparison page already knows which studios were compared: emit one event
  there with the slugs, which is a record of a decision rather than of a
  draft.

### 0.3 Close the loop — won and lost

The honest position: **we cannot show a studio "you won 3 of 8" until something
records an outcome**, and the only human who reliably knows the outcome is the
expert on the call.

- `recordOutcome(id, recommendedStudioId, matchWasCorrect, notes)` already exists
  in `modules/consultation/request.ts` and **no UI calls it.** Build that UI on
  `/ops/consultations` first — it is one form, and it is the cheapest source of
  outcome truth in the product.
- Separately, allow ops to mark a `Quotation` `ACCEPTED`/`DECLINED`, which is
  what eventually creates a `Project` row. Until `Project` rows exist,
  `autoPauseSweep`'s at-capacity branch counts zero forever and the whole
  capacity feature is inert.
- **Do not show a studio the expert's `recommendedStudioId` or
  `matchWasCorrect`.** See §4.

### 0.5 The introduction, and the meetings that follow

The calendar cannot be built without this, and it is worth building even if the
calendar were cancelled.

**`Introduction`** — the handoff. One row per brief per studio, created by the
expert when the customer chooses.

```
id, briefId, studioId, consultationId
introducedAt  DateTime
introducedById String        // the expert. This is a human act, never automatic.
contactReleasedAt DateTime?  // when the studio may first see name and phone
withdrawnAt DateTime?        // customer changed their mind; contact access ends
```

Three reasons this matters beyond the calendar:

- **It is the moment contact details change hands.** Today that transition is
  described in copy and enforced nowhere, because there is nothing to enforce it
  against. With this row, "has this studio earned the customer's phone number
  yet?" becomes a query rather than a convention.
- **It starts the commission clock.** The 5% is charged on a project that came
  from an introduction we made. Nothing currently records that we made one.
- **It is the denominator the roster will eventually be judged on.** Introductions
  per studio, and what share of them become signed projects, is the honest
  measure of whether matching works — and it is the number the expert's
  `matchWasCorrect` flag is a poor proxy for.

**`Appointment`** — a meeting or site visit, hanging off an introduction.

```
id, introductionId (→ briefId, studioId derivable)
kind    AppointmentKind   // FIRST_MEETING | SITE_VISIT | FOLLOW_UP
status  AppointmentStatus // PROPOSED | CONFIRMED | COMPLETED | NO_SHOW | CANCELLED
startsAt DateTime         // stored UTC, rendered IST. One city, but store it properly.
durationMins Int @default(60)
location String?          // the flat's address, or "studio office"
proposedById String       // who suggested it
confirmedAt DateTime?
noShowBy  NoShowParty?    // CUSTOMER | STUDIO — null unless status is NO_SHOW
notes String? @db.Text    // ops-visible; see §4 on what the studio may read
@@index([introductionId]) @@index([startsAt, status])
```

**Who schedules.** Ops, for version one. The copy promises *we* set it up, a
two-sided scheduling flow is a fortnight of work, and with ten studios the
expert can do it on the same call. The studio may **propose** times, which lands
in the ops queue. Do not build customer-facing self-scheduling yet.

**`noShowBy` is not decoration.** Whether the studio failed to turn up is exactly
the kind of fact the delivery record is supposed to carry, and it is available
months before any project completes. It is also the first thing a studio will
dispute, so it must be set by a human with the reason recorded — never inferred
from an appointment passing its end time.

### 0.4 Make the pause state visible to the studio it applies to

Smallest item here and arguably the most urgent, because it is currently a
correctness bug rather than a missing feature. The schema says `pausedReason` is
shown to the studio. Nothing shows it. Fix that on the existing `/studio` page
before any of the above, as a standalone change.

---

## 3. Phase 1 — three pages

The studio layout currently has **no navigation at all** — no links to anywhere.
This will be the first nav that surface has ever had, so it is worth getting the
shape right rather than growing it accidentally:

| Route | What it is for | Opened |
| --- | --- | --- |
| `/studio` | Home. Status, this month, what needs you today, next few appointments. | Daily, for ten seconds |
| `/studio/analytics` | The evidence for the subscription. Visibility over time, ranking and why, the funnel. | Weekly, for five minutes |
| `/studio/calendar` | Meetings and site visits. | Daily, and before leaving the office |
| `/studio/profile` | Existing. Profile copy. | Rarely |
| `/studio/onboarding` | Existing. Appears in nav **only while incomplete**. | Once |

The division that matters: **home answers "is anything wrong?", analytics
answers "is this worth paying for?"** Those are different questions asked at
different frequencies, and collapsing them into one page makes the daily check
slow and the monthly review shallow.

### 3a. `/studio` — home

Four blocks, in this order. Nothing else.

#### Panel 1 — Status, at the top, always

Answers question 1, and it is the only panel that is never absent.

- Live / Paused / In review / Onboarding, from `Studio.status` and `pausedAt`.
- When paused: the reason verbatim, the cause (`MANUAL`, `AT_CAPACITY`,
  `PAYMENT_DUE`), and what lifts it. An `AT_CAPACITY` pause lifts itself next
  month; a `MANUAL` one never does, and the copy must not imply otherwise.
- Verification tier and what the next tier needs — reuse `assessTier` and
  `TierProgress` from the ops side, scoped to their own studio.

#### Panel 2 — This month, in one line each

The headline numbers only. Detail lives on `/studio/analytics`.

- Briefs appeared in, this month, from `Match` rows — largest type on the page.
- Introductions made, and appointments still to come.
- Against `TIER_TERMS[tier].guaranteedBriefs` where a subscription exists.
- **Before there is history, this panel says so.** "Not enough data yet" —
  never `0`, which reads as failure rather than as newness. This is the same
  rule the customer-facing side already follows.

#### Panel 3 — What needs you today

The only action list. Empty is a legitimate and good state, and should read as
one rather than as an error.

- Appointments to confirm, and any proposed times waiting on the customer.
- Rate categories still unpriced — these silently exclude them from quotes.
- A verification check expiring within thirty days.

#### Panel 4 — Next few appointments

Three rows, linking to `/studio/calendar`. Date, kind, locality. Contact details
only where §4's release rule allows.

### 3b. `/studio/analytics`

The page that justifies the subscription. It is read monthly, so it can be dense
— but every number on it must be one they could act on or renew on.

#### The studio funnel — the centrepiece

Six stages, each from a real source, for a chosen period:

| Stage | Source |
| --- | --- |
| Shown in results | `Match` rows |
| Profile opened | `studio.view` analytics event (§0.2) |
| Taken to comparison | comparison event (§0.2) |
| Named in an expert call | `Consultation.studioIds has studioId` |
| Introduced | `Introduction` rows (§0.5) |
| Signed | `Project` rows |

This is the single most valuable thing on the studio side, because it converts
"am I getting value" into a question with a shape. A studio shown 40 times and
introduced twice has a *profile* problem; one introduced eight times and signed
none has a *sales* problem. Those need opposite conversations, and today neither
we nor they can tell which is happening.

Render a stage as "not enough data yet" rather than 0% when the denominator is
thin — `funnelSummary` already sets this precedent by returning `null` rates
rather than zero.

#### Visibility over time

Briefs shown per week or month. Nothing clever — a studio wants to know whether
the number is going up, and a line does that.

Annotate it with pauses drawn from the audit trail. A studio that sees a dip and
can immediately see it coincided with an `AT_CAPACITY` pause will not open a
support conversation about it.

#### Where you ranked, and why

Answers question 3, and it is the section most likely to be got wrong. Read §4
and §5 before building it.

- Recent briefs they appeared in: anonymised (locality, property type, budget
  band, scope — never a name, never contact details), their own score, and their
  own `breakdown` rendered with `FACTOR_LABELS`.
- Factors that were `null` render as **"not measured yet"** with the reason —
  delivery reliability needs completed projects, and most studios will have none
  for months.
- Include the briefs where they ranked poorly. A page that hides those is a
  vanity metric; the losses carry all the actionable information.
- Each weak factor carries **one specific, verifiable action**: add a real
  project with client consent, declare the localities you actually work in, price
  the remaining rate categories.

#### What it costs you

`src/modules/studio/subscription.ts` is pure, tested, and currently dead code —
it exists to be rendered here.

- `effectiveTakeRate(tier, projectsClosed, averageProjectPaise)`. It returns
  `null` at zero projects rather than `Infinity`; render that as "not yet
  meaningful", not as a dash.
- `volumeWhereFeeStopsBiting(tier)` — the honest framing of the fixed fee, and
  the number a studio should see *before* the ramp makes them resent it.
  (Essential 36, Premium 42, Luxury 50 projects a month.)
- The year-one model's own finding belongs here rather than hidden: the take rate
  is **heaviest mid-ramp**, up to 7.1% against 5% in the pilot. A studio that can
  see we already know this is less likely to churn over it than one who works it
  out alone and concludes we were hoping they would not notice.

#### Your own controls

- **Declare capacity.** `capacityPerMonth` is self-declared by definition, yet
  `setCapacity` is `requireRole('OPS')` today. It should be theirs to set, with
  ops retaining an override.
- Request a pause. Not self-service — it affects live customers mid-funnel — but
  a request that reaches the ops queue.
- Their own audit trail, filtered, from `studioAuditTrail(studioId, 20)`.

### 3c. `/studio/calendar`

Everything here depends on §0.5 existing first.

#### What it shows

- **Month grid and an agenda list**, with agenda as the default on narrow
  screens. A studio owner checks this on a phone between sites; a month grid at
  360px is decoration.
- Each appointment: date and time (IST), kind, locality, status, and — subject
  to the release rule below — the customer's name and phone.
- **Proposed** appointments are visually distinct from **confirmed** ones. An
  unconfirmed time that looks confirmed is how somebody drives to Wakad for
  nothing.
- Past appointments keep their outcome, including `NO_SHOW`, because that is a
  record rather than a tidy-up.

#### The contact release rule — the thing that makes this page safe

**A studio sees a customer's name and phone number only where an `Introduction`
row exists and `contactReleasedAt` is set and `withdrawnAt` is null.** Before
that the appointment renders with locality, budget band and scope only.

This is not a UI nicety. "No studio receives your details until you tell an
expert which introduction you want" is on the landing page, and the calendar is
the first surface where breaking it would be invisible to everyone except the
customer. Encode it as one function in the module — `canSeeContact(introduction)`
— called in exactly one place, so there is a single thing to test and a single
thing to review.

#### What the studio can do here

- Propose times for an appointment that has none.
- Confirm or decline a proposed time.
- Mark an appointment completed, with a note.
- **Cannot** mark the customer a no-show themselves — that goes to ops, because
  it is a fact that ends up in a delivery record and both sides will have a view.

#### Deliberately not in version one

- **No calendar sync.** Google/Outlook/iCal export is the obvious next thing and
  it is not month one. An `.ics` download per appointment is a cheap eighty
  percent of it if it is wanted early.
- **No customer-facing self-scheduling.** The copy promises we arrange it.
- **No reminders.** They need the WhatsApp template that is already waiting on
  Meta approval; revisit once that clears.

---

## 4. What must never appear on this surface

These are not preferences. Each one, shipped, costs the roster.

- **Any other studio's identity, score, rank, rates or verification state.**
  Aggregate benchmarking is already prohibited in `rate-card.ts` for a stated
  reason — with two studios live, "the median of two" is telling each of them the
  other's price. That reasoning extends to every metric here, not just rates.
- **"You lost to X."** Telling studio A that the expert recommended studio B is
  the end of the roster.
- **`Consultation.recommendedStudioId` and `matchWasCorrect`.** The expert's
  verdict is training data for the matching engine, not feedback to the studio.
- **Any customer identity before an introduction exists.** No `contactName`,
  `contactPhone`, `contactEmail`, no `askedAbout` free text, no floor plan, no
  prep-pack notes. A studio sees a customer's details after the introduction, and
  the introduction happens after the expert call — that is the entire mechanic
  and none of these pages may become a way around it. After an introduction, the
  release rule in §3c governs, and nothing else does.
- **`Appointment.notes` written by ops.** Those are internal. If the studio
  needs to know something, it is said to them, not left in a field they can
  read over our shoulder.
- **`VerificationCheck.notes` and `evidenceUrl`**, even for their own studio.
  `source` and `checkedAt` are the publishable parts; the notes are ours.
- **Anything implying position is purchasable.** No "upgrade to rank higher", no
  "studios on Premium appear more often" — the second is arguably true of
  *volume* and reads as true of *position*, which is exactly the confusion the
  product exists to refuse.

---

## 5. The gaming question, and why it mostly answers itself

Showing a studio their per-factor breakdown tells them how the matching engine
works. The obvious worry is that they will tag every portfolio project with every
style to raise `styleOverlap`.

**That strategy is self-punishing, and it is worth understanding why before
anyone builds a defence against it.** Q5 dislikes are a hard filter:
`MAX_DISLIKED_SHARE = 0.4` removes a studio outright when more than 40% of its
portfolio carries a style the customer rejected. A studio claiming every style
therefore fails that filter far more often than one claiming three. Breadth costs
them visibility; it does not buy it.

The remaining factors are resistant for structural reasons:

- `budgetFit` prefers **delivered** project values over claimed ones once there
  are three of them.
- `deliveryReliability` comes from `avgVarianceDays` and `upheldDisputes`, which
  are ours to compute, not theirs to declare.
- `scopeExperience` counts comparable projects, and portfolio projects require
  client consent or an honest render flag at entry.

So: **show the factors and the scores. Do not show the weights.** Knowing that
style overlap matters is useful and legitimate — it makes studios describe
themselves accurately. Knowing it is worth exactly 25 points invites arithmetic
rather than honesty, and buys the studio nothing we want them to have.

---

## 6. Contradictions to resolve before building

Each of these will surface as a bug the moment two surfaces show the same number.

1. **`Project.commissionBps` defaults to `400`** (4.00%) while
   `COMMISSION_BPS = 500` in `subscription.ts` and every business document says
   5%. The dashboard will show a take rate computed one way against invoices
   computed the other.
2. **`Subscription.guaranteedProjects` (schema) vs `TierTerms.guaranteedBriefs`
   (code).** The code comment is explicit that we promise briefs, not projects,
   because projects are the customer's decision. The column name promises the
   thing we must not promise. Rename the column.
3. **No `Subscription` row is ever created.** Every tier feature — the guarantee,
   `PAST_DUE` auto-pause, take rate — reads a row nothing writes.
4. **The onboarding page says "Four steps"** while `ONBOARDING_STEPS` has five.
5. **The registration step cannot be completed without a GSTIN**, though its own
   missing-message offers "a GSTIN, or a note that you do not have one". There is
   no field for the note.

---

## 7. Explicitly out of scope for version one

- **Billing and payment collection.** No invoice model, no Razorpay. Until
  subscriptions start in month four this is not on the critical path; a
  statement of what is owed is enough, and it can be a read of
  `AllocationPeriod` once that table is actually written.
- **Multiple logins per studio.** `StudioMember.userId` is `@unique`, so one
  user belongs to at most one studio and there is no invite flow. Real studios
  will want a second login; it needs a migration and it is not month one.
- **Cross-studio benchmarking** in any form. See §4.
- **A mobile app view.** The dashboard should work at 360px like everything else,
  but the Capacitor wrap is not part of this.

---

## 8. Suggested order

1. **0.4 — show a paused studio why it is paused.** Standalone, small, and fixes
   a live correctness gap rather than adding a feature.
2. **0.1 — persist `Match` rows.** The gate. Nothing else is possible, and every
   day it is not shipped is a day of history permanently lost.
3. **0.5 — `Introduction` and `Appointment`.** Independent of 0.1, and the
   higher priority of the two if a real customer reaches the expert call before
   the dashboard is built — because the introduction is happening either way, and
   right now it happens in someone's WhatsApp and nowhere else.
4. **`/studio` home, panels 1 and 2.** Status and this month. Those two alone
   turn the page from a checklist into a dashboard.
5. **`/studio/calendar`.** Falls out of 0.5 almost for free, and it is the page a
   studio will open every day — which makes it the one that builds the habit of
   opening any of this.
6. **0.3 — the outcome-recording UI on `/ops/consultations`.** One form, and the
   only source of won/lost truth that will exist for months.
7. **`/studio/analytics`,** once there is enough history for it to say anything.
   The funnel first; ranking detail after.

Two things to hold onto while sequencing. **The analytics page is what justifies
the subscription, but the calendar is what gets the studio to log in** — a page
opened daily is worth more than a better page opened monthly, and neither works
if nobody visits. And **0.1 cannot backfill**: the analytics page can be built
whenever, but the data it draws on only starts existing the day persistence
ships.

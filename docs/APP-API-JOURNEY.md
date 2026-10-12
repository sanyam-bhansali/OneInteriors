# App API — the first visit and the plans (step 4)

The phone app's contract for the first-visit journey (design screens #2–#20)
and the two customer plans. Everything lives under `/api/app/v1`, uses the
existing helpers in `src/modules/app-api/http.ts` (`gate`, `signedIn`,
`json`, `fail`, `readJson`), and answers with `{ ok: true, ... }` or
`{ ok: false, error }`. Money is always integer paise. Shapes below are the
contract; the server may add fields, never rename or remove them.

The website's `/app` journey and the phone must give the same answers from
the same code: routes call the same modules the website's pages and server
actions call (`modules/app/journey.ts`, `estimate-range.ts`, `portal/choose.ts`,
the expert booking module, …) — never a second copy of the maths.

## Plans (owner decision, 11 Oct 2026)

- **Basic** (free, the default): Home, Project, Site, Snags, decisions,
  payment-stage tracking, Locker, Notifications. No GEIO, no expert
  consultations. One Interiors does not guarantee the studio keeps the tracker
  and site feed up to date; the customer and the studio agree to follow it.
- **Assured** (paid, fee decided later): One Interiors makes sure the site
  feed and tracker are updated every day and calls the studio when a day is
  missed; GEIO; 5 expert consultations across the project; everything in Basic.
  Escrow may come later.
- The plan is chosen at the Sign step. Until the fee is set, choosing Assured
  **registers interest**: the project starts on Basic with
  `assuredRequestedAt` set, ops is told, and the app says "Your fee is confirmed
  by our team before anything is charged." Ops switches the plan to Assured.
- The free expert call before signing (choosing a studio) is for everyone and
  does not count toward the 5.

## Public (no sign-in; rate-limited per IP)

The brief travels in the body as the website's `Brief` shape
(`src/modules/brief/types.ts`), partial while the quiz is unfinished.

Built (11 Oct): every route below exists. The shaping lives in
`modules/app/journey-view.ts` (pure, tested in `tests/app-journey.test.ts`),
which calls `journey.ts` and `estimate-range.ts`; the website's matches,
profile, quote and compare screens import the same helpers. The roster and
rates come from `appData()` (moved to `modules/app/app-data.ts`). Public
routes answer 400 for a body without a readable brief and 429 past 600
requests an hour from one address (keyed on a hash of it). "As built" notes
below record where the server differs from or adds to the draft.

`POST /journey/estimate` — `{ brief }` →
`{ ok, range: { lowPaise, midPaise, highPaise, studios } | null }` — the live estimate on
the quiz screens (`estimate-range.ts`; null below `MIN_STUDIOS_FOR_ESTIMATE`).

`POST /journey/matches` — `{ brief }` →
```
{ ok, studioCount,                       // listed studios, capped by claims.ts
  tiers: { essential: Match[], premium: Match[], luxury: Match[] },
  tier: 'essential' | 'premium' | 'luxury',   // the brief's own tier
  style: { primary: { tag, label, pct }, secondary: { tag, label, pct } | null } }  // Style DNA
Match = { slug, name, area: string|null, since: number|null, team: number|null,
          score: number,                 // 0–100
          reasons: string[],             // "Why they suit you"
          photo: string|null,
          rating: { stars: number, count: number } | null,   // verified reviews only
          homes: number, checks: { passed: number, total: number },
          lateness: string | null,       // journey.ts lateness(), e.g. "Usually 4 days late"
          quote: Quote }
Quote = { totalPaise, beforeGstPaise, gstPaise, validTill: ISO,
          lines: { room: string, item: string, spec: string|null, amountPaise: number }[] }
```
As built: the bands are empty until `brief.completedAt` is set (as on the
website). `style` is null when no style was picked. `since` is this year
minus the studio's years practising (no founding year is stored). `rating`
is always null until verified reviews exist. Added: `ratesReal` (false while
studios are priced on pre-launch archive rates — say so, as the website
does); on each Match `band` and `localities` (for the client-side filters);
on Quote `lowPaise`/`highPaise` (the band until measuring) and `size` on
each line.

`POST /journey/studios` — `{ brief }` → `{ ok, studios: (Match without quote)[] }`,
best match first (All studios, #16; filters are client-side). As built:
`score` is null until the brief is finished (the website shows none then).

`GET /studios/:slug` →
```
{ ok, studio: { slug, name, area, since, team, photo, about: string|null,
  portfolio: { photo: string, caption: string|null }[],
  checks: { label: string, passed: boolean }[],
  delivery: { completed: number, avgLateDays: number|null, line: string|null },
  reviews: { name: string, stars: number, text: string, at: ISO }[] } }
```
As built: 404 for a studio that is not listed (paused, unverified, unknown).
Added: `verified`, `isRender` on each portfolio photo, `source`/`checkedAt`
on passed checks. `reviews` is empty until customers who went through One
Interiors review after handover.

`POST /journey/compare` — `{ brief, slugs: string[] }` →
`{ ok, plainWords: string[], columns: { slug, name, totalPaise, board: string|null,
counter: string|null, weeks: number|null, lateness: string|null, checks: string }[] }`
(`plainWords()` from journey.ts). As built: empty `slugs` compares the
brief's own matches; at most five; unlisted slugs are dropped, never priced.
Added: `shutter` on each column, and `ratesReal`.

## Signed in (bearer token)

`POST /auth/otp/verify` — now also takes `consent: { share: boolean, offers: boolean }`
on the first visit. `share` must be true when `brief` is sent; the server records
`Consent` rows exactly as the website's `recordQuizConsentAction` /
`submitContactAction` do (DPDP). Returning-customer sign-in sends no consent.
As built: with a `brief`, the name (body `name`, else `brief.contactName`),
the number and `share` go through the website's `checkContact` before the
code is spent (400 otherwise). Once the code is right: `DATA_PROCESSING`
granted and `MARKETING_WHATSAPP` = `offers`, source `quiz_contact_step`
(`contactConsent()`, shared with `submitContactAction`), recorded for the
verified account; then the brief, name and number are saved onto it
(`saveContact`). A brief sent here needs no separate `PUT /brief`.

`PUT /brief` — exists. `POST /journey/submit` — `{ slugs }` → `{ ok }`: what the
website's `submitContactAction` does after verification (record the journey,
introduce / shortlist), so ops and the expert see the same three quotes.
As built: keeps the stored brief's matches and first quotes (`recordJourney`,
what the website's journey route does) and the chosen listed studios as the
brief's `Shortlist` rows, in order, at most five. Nobody is introduced: the
expert makes every introduction. Returns `{ ok, shortlisted }`; 409 when the
account has no saved, finished brief.

`GET /expert/slots` → `{ ok, expert: { name, photo|null, line }, days: { date: ISO-day,
slots: { startsAt: ISO, label: string }[] }[] }` (the website's `openSlots`).
As built: `date` is the IST day and `label` the IST time ("11:30 am");
`photo` is null for now.
`POST /expert/book` — `{ startsAt }` → `{ ok, booking: { startsAt, label } }` or 409
when the slot is gone. As built: through `modules/consultation/book.ts`, which
the website's expert screen now calls too. Optional `slugs` name the studios
the call is about; otherwise the shortlist from `journey/submit`, otherwise
the brief's own matches. Also 409 with no brief or number on the account.

`GET /choose` → the website's `chooseView()` for this customer:
`{ ok, view: { studios: { introId, slug, name, visit: { at, kind, state }|null,
finalQuoteId: string|null }[], expertNote: string|null } | null }`.
As built (`modules/portal/choose-api.ts`): `visit` is the next proposed or
confirmed visit, else the last completed one; it also carries `id` (what
`/choose/visits/:id` takes) and `location`, and `kind`/`state` are lower case
(`site_visit`, `proposed`). Added: `visits` (all of them), `finalQuote`
(`{ id, totalPaise, issuedOn, accepted }`), `call` and `signedWith`.
`expertNote` is always null: there is no customer-facing expert note yet.
`POST /choose/visits/:id` — `{ answer: 'confirm' | 'cancel' }` → `{ ok }`; 409
when the visit is not theirs or is already settled.
`GET /choose/quote/:id` → `{ ok, quote: finalQuoteView }`. **Changed from the
draft:** no changed lines with before/after and no unchanged count. The final
quote's lines are the studio's own products from its builder and the first
quote's are our catalogue codes, so nothing pairs them line by line (the
website does not show it either). `quote` is `FinalQuoteView` as the website
reads it: rooms with their lines, `lineCount`, the bill (`workPaise`,
`feePaise`, `discountPaise`, `onSpotPaise`, `beforeTaxPaise`, `gstPaise`,
`totalPaise`), what signing locks (`stages`, `handoverDays`, `terms`) and
`firstBeforeGstPaise` to compare. 404 unless issued on their own introduction.
`POST /choose/sign/:id/code` → `{ ok, devCode? }`.
`POST /choose/sign/:id` — `{ code, plan: 'basic' | 'assured' }` →
`{ ok, projectId, plan: 'basic', assuredRequested: boolean }`. As built:
through `modules/portal/sign.ts`, shared with the website's Sign screen, which
now offers the same choice in the same words (`PLAN_COPY`, `ASSURED_FEE_NOTE`).
Optional `agreed` defaults to true (the app shows the agreement before the
code is sent); `false` is refused. 400 for a wrong code or a missing plan,
404 for a quote that is not theirs.

`POST /plan` — `{ plan: 'assured' }` → `{ ok, assuredRequested: true }` (upgrade
later from Me or the locked GEIO card; registers interest, tells ops).
As built: also returns `plan`. Asking twice tells ops once. Already on
Assured: `{ ok, plan: 'assured', assuredRequested: false }`. 409 before
signing; 403 for a family member (only the owner chooses).

`GET /me` — adds `plan: { plan: 'basic' | 'assured', assuredRequested: boolean,
expertCalls: { used: number, total: 5 } | null } | null` (null before signing).
`GET /project` — each project adds `plan: 'basic' | 'assured'`.

`POST /geio` — answers 403 `{ ok: false, reason: 'plan' }` for a customer whose
project is on Basic. Before signing (no project) GEIO stays available, as now.
The website's GEIO action follows the same rule. As built: the gate is in the
shared `geio-ask.ts`, read off the projects GEIO's facts come from; any
project of theirs on Assured opens it. The website shows `GEIO_LOCKED`
(`portal/plans.ts`) instead of an example answer.

## Data and ops (as built)

`home_projects.plan` (`CustomerPlan`: BASIC | ASSURED, default BASIC) and
`home_projects.assuredRequestedAt`, migration `20261011130000_customer_plan`
(not yet applied anywhere). Expert calls used are counted from consultations
on the brief created after `signedAt`, so no counter is stored. Ops hears
through the `assured-requested` notice (linking to `/ops/introductions`) and
switches the plan there, on the project's tracker ("Switch to Assured (fee
agreed)" / "Move back to Basic"; `setProjectPlan`, OPS only, audited as
`plan.set`).

## The step tracker (owner, 11 Oct 2026; as built)

docs/studio-workspace/STEP-TRACKER.md. The plan is Hauspire's execution steps,
each worth a share of the project. `GET /project` adds, without changing any
existing field:

- `progressPct: number | null` on each project — whole percent of the home
  done, rounded down (100 only when every step in scope is ticked); null for a
  project with no plan. The same figure is `tracker.progressPct`.
- On each `tracker.stages[]`: `progressPct: number` (the stage's own whole
  percent; a stage with no step in scope reads 100 once done, else 0) and
  `steps: { label, group, pct, done, doneOn, plannedOn }[]` — the stage's
  in-scope steps in plan order. `group` is the sheet's section ("Execution
  stage 2A"); `pct` is the step's share of the whole project as a percentage
  (may carry decimals, e.g. 0.5); `doneOn` / `plannedOn` are IST days
  (`YYYY-MM-DD`) or null. Steps the studio marked not in scope are never sent.
  A step's stored weight, its photo, and who ticked it never cross.
- `tracker.stages[].checklist` and `tracker.current.rooms` keep their shape
  and now count in-scope steps (rooms are the steps' groups). (Since 12 Oct
  2026, starred steps only: see Customer milestones below.)
- In `siteLogs[]` (and their `corrections[]`), each photo adds
  `doneStep: string | null` — the step that photo ticked. The apps show
  "Done: {step}" (translated) with the photo's `takenAt`. The entry's `done`
  list still names every step ticked in that post. (Since 12 Oct 2026 both
  name starred steps only: see Customer milestones below.)

Older apps ignore the new fields and keep working.

## Customer milestones (owner, 12 Oct 2026; as built)

docs/studio-os/CUSTOMER-MILESTONES.md. The customer sees each stage (name,
status, % done, planned end) and under it only the 2–3 steps the studio
**starred**. Every other step is the studio's own. `GET /project` keeps every
field and its shape; what changes is which steps the arrays carry
(the choice: `steps` now carries only milestones; no new `milestones` field):

- `tracker.stages[].steps` — only the stage's starred in-scope steps, same
  shape `{ label, group, pct, done, doneOn, plannedOn }`. May be `[]` (the
  studio starred nothing in that stage): show the stage and its % only.
- `tracker.stages[].checklist` — `{ done, total }` of those milestones (was:
  of every in-scope step).
- `tracker.current.rooms` — the current stage's milestones, by group.
- `progressPct` (project and `tracker.progressPct`) and
  `tracker.stages[].progressPct` are unchanged: they still count **every**
  in-scope step, starred or not.
- `design.steps` — only the starred design steps. `design.pct` is unchanged
  (every in-scope design step). `design.next` is the next milestone not done;
  its `waitingFor` is the payment that opens the design's next step (starred
  or not), when unrecorded. New: `design.waitingFor: string | null` (the same
  payment, also when no milestone is left) and `design.yourStep: string | null`
  (the design's next step when it is the client's own, starred or not).
  Show the design card when `design.pct !== null`, not when `steps` is
  non-empty.
- `siteLogs[].photos[].doneStep` names the step only when it is starred, else
  null (the photo and its sentence still show). `siteLogs[].done` lists only
  starred steps ticked in that post.

Older apps keep working: they show fewer steps.

# Studio workspace — Phases 2–5 foundation

**Written:** 11 Oct 2026 · **For:** the four agents building Phase 2 (site log
and feed), Phase 3 (tracker and delays), Phase 4 (snags) and Phase 5
(decisions, payments, locker) in parallel, on top of this.
**Brief:** `STUDIO-WORKSPACE-BUILD.md` §4–§6. **Before this:** `PHASE-1-FOUNDATION.md`.

**The schema is done. No phase edits `prisma/schema.prisma` or adds a
migration.** If a phase finds it truly needs a column, it stops and says so.

Owner's decisions this follows: everything stays on the customer's project
(`HomeProject` and its `Home*` tables, never `StudioProject`); Basic/Assured is
`HomeProject.plan`; WhatsApp is fine for studio staff, never for customers;
working week Monday–Saturday until decided, configurable per studio; snag
auto-close after 7 days; the supervisor's preview is enough to post customer
sentences (no PM approval step); speech provider not chosen (fake adapter).

---

## 1. The migration

`prisma/migrations/20261011150000_studio_workspace_phases_2_5` — expand-only,
not applied anywhere (Sanyam runs `db:deploy`). Verified by applying all 73
migrations to a throwaway in-memory Postgres (PGlite) with seeded rows before
it, checking every backfill, the partial unique index, the CHECKs, cascades
and RLS (`scratchpad/testdb/migcheck3.mjs` in the session that wrote it).

Generated with `prisma migrate diff` from the previous schema, then the raw
SQL Prisma cannot express was added by hand: the partial unique index, three
CHECK constraints, the backfills and RLS. Every new table has
`ENABLE`/`FORCE ROW LEVEL SECURITY` + `REVOKE ALL … FROM anon, authenticated`
and an index on each foreign key.

### New enums

| Enum | Values |
|---|---|
| `SiteLogKind` | `UPDATE`, `NOBODY`, `CORRECTION` |
| `NobodyReason` | `WAITING_MATERIAL`, `WAITING_CUSTOMER_DECISION`, `CREW_ELSEWHERE`, `HOLIDAY`, `CUSTOMER_ASKED`, `OTHER` |
| `DateChangeField` | `PLANNED_START`, `PLANNED_END`, `HANDOVER` |
| `DelayReason` | `SUPPLIER`, `CUSTOMER_CHANGE`, `SITE_CONDITION`, `STUDIO`, `OTHER` |
| `SnagEventKind` | `RAISED`, `ACCEPTED`, `DISPUTED`, `FIXED`, `CONFIRMED`, `REOPENED`, `AUTO_CLOSED` |
| `ProjectActorType` | `CUSTOMER`, `STUDIO`, `OPS`, `SYSTEM` (not `EventActor`, which is the CRM's) |

`PaymentMode` (`BANK`, `UPI`, `CASH`, `CHEQUE`) is reused.

### New tables

| Model (table) | Fields | Notes |
|---|---|---|
| `HomeSiteLog` (`home_site_logs`) | `projectId`, `date` (`@db.Date`, IST day), `kind`, `reason?`, `note?` (internal), `voicePath?`, `transcript?`, `transcriptLang?`, `customerText?`, `customerLang?`, `stageId?` → stage, `postedById`, `postedAt` (phone's time), `createdAt` (arrival), `clientRef?` unique, `correctsId?` → self | **Partial unique index** `home_site_logs_one_per_day_key`: one `UPDATE`/`NOBODY` per (projectId, date); `CORRECTION`s unlimited. CHECK: `NOBODY` needs a reason, `UPDATE` has none. The voice/customer columns are the "Say something else" mic. Append-only |
| `HomeSiteLogPhoto` (`home_site_log_photos`) | `siteLogId`, `storagePath`, `takenAt`, `lat?`, `lng?`, `fromGallery`, `voicePath?`, `transcript?`, `transcriptLang?`, `customerText?`, `customerLang?`, `sortOrder` | sortOrder 0 = the same-corner photo. Never deleted; speech fields may be filled in later |
| `HomeSiteLogCrew` (`home_site_log_crew`) | `siteLogId`, `crewMemberId?` → `StudioCrewMember` (SetNull), `crewName`, `crewRole`, `arrivedAt?` | Name and role copied at posting. Never deleted |
| `StudioCrewMember` (`studio_crew_members`) | `studioId`, `name`, `role`, `phone?`, `active` | `phone` never crosses. Switch off, don't delete |
| `StudioHoliday` (`studio_holidays`) | `studioId`, `day` (`@db.Date`), `name?` | unique (studioId, day) |
| `HomeProjectDateChange` (`home_project_date_changes`) | `projectId`, `stageId?`, `field`, `fromDate`, `toDate`, `reason`, `decisionId?` → `HomeDecision` (a late decision), `note?` (internal), `byId`, `at` | Append-only. The stage column holds the current date; these are the history |
| `HomeSnagEvent` (`home_snag_events`) | `snagId`, `kind`, `photoPaths[]`, `voicePath?`, `transcript?`, `transcriptLang?`, `customerText?`, `customerLang?`, `note?` (customer-visible), `internalNote?`, `fixBy?`, `assigneeId?`, `actorType`, `byId?`, `at` | Append-only. `photoPaths` is an array (the brief said one path; snags already carry up to four) |
| `HomeDecisionOption` (`home_decision_options`) | `decisionId`, `sortOrder`, `label`, `detail?`, `photoPath?`, `swatch?`, `deltaPaise` (BigInt, GST incl., may be negative), `studioCostDeltaPaise?` (BigInt) | A table, not JSON, so `studioCostDeltaPaise` can simply never be selected |
| `HomeProjectPayment` (`home_project_payments`) | `projectId`, `stageIndex`, `amountPaise` (BigInt), `receivedOn` (`@db.Date`), `mode?`, `receiptDocumentId?` → `HomeDocument`, `note?` (internal), `recordedById`, `recordedAt`, `correctsId?` → self, `customerConfirmedAt?`, `customerConfirmedById?`, `disputedAt?`, `disputedById?`, `disputeNote?` | CHECK amount ≥ 0, stageIndex ≥ 0. Never deleted; only the customer's confirm/dispute columns are set after insert, once |
| `HomeQuoteChange` (`home_quote_changes`) | `projectId`, `decisionId?`, `optionId?`, `quoteLineId?`, `label`, `deltaPaise` (BigInt), `stageIndex?`, `byId?`, `at` | Append-only. A re-pick is a new row reversing the old |
| `HomeProjectEvent` (`home_project_events`) | `projectId`, `at`, `actorType`, `actorId?`, `type`, `refId?`, `payload` (jsonb, default `{}`), `dedupeKey?` unique | Append-only. Indexed (projectId, at) and (type, at) |

Every child cascades with its `HomeProject` (erasure of the whole record);
optional links to a stage, decision, option, document or crew member are
`SET NULL`.

### New columns on existing tables

| Column | Notes |
|---|---|
| `Studio.workingDays Int[]` default `{1,2,3,4,5,6}` | ISO weekdays. CHECK: values within 1–7. On `Studio`, not `StudioBranding` (which not every studio has) |
| `HomeChecklistItem.doneSiteLogId?` → `HomeSiteLog` | Which day's post ticked it |
| `HomeMaterial.orderedAt?` | `productCode` already existed |
| `HomeDecision.pickedOptionId?` → `HomeDecisionOption`, `quoteLineId?` | |
| `DecisionVote.optionId?` → `HomeDecisionOption` | |
| `HomeSnag.assigneeId?` → `StudioMember` | |

### Deliberately not added

- **Decision `status`, `dueAt`, `lateImpact`:** `dueOn` is already the
  instant (23:59:59 IST of the due day) — it is the brief's `dueAt`; `why` is
  already "what waiting costs" — the brief's `lateImpact`; status is derived
  (`decisions.ts decisionState`: picked / overdue = expired / due-soon / open).
- **Snag `raisedBy`:** `HomeSnag.raisedByStudio` is it (true = STUDIO).
- **Reminder or score columns:** computed from `HomeSiteLog` and
  `HomeProjectEvent`; a sent reminder is an event with a `dedupeKey`.
- **Baseline plan dates:** the original date is the earliest
  `HomeProjectDateChange.fromDate` for that stage and field, or the column if
  it never moved.
- **DB triggers enforcing append-only:** FK `SET NULL` actions are UPDATEs
  too, so a trigger would fight the schema. The rule is enforced in code by
  `tests/append-only.test.ts`.

The partial index is raw SQL, like `consultations_expert_slot_live_key`:
`prisma migrate dev` would try to drop it. Migrations here are diffed
offline and applied with `migrate deploy`; keep it that way.

---

## 2. How old data maps

| Old | New | What the migration did | Who switches the readers |
|---|---|---|---|
| `HomeProjectUpdate` (free-text notes, several a day) | `HomeSiteLog` | **Nothing — not migrated.** They do not fit one post per day with a reason and crew. The customer projection keeps showing `updates` beside the new site log; ops' notes can keep landing there | Phase 2: the feed shows both, newest first. `postStudioUpdate` / `/studio/updates` stop being the studio's path once site mode works |
| `HomeSnag.status` / `fixedAt` / `fixedNote` / `fixedPhotoPaths` / `fixBy` | `HomeSnagEvent` | RAISED for every snag (actor STUDIO if `raisedByStudio`, CUSTOMER if the brief's owner raised it, else OPS); ACCEPTED (with `fixBy`) where a fix-by was set, placed 1 ms after RAISED since when is unknown; FIXED (`photoPaths` = fixed photos, `customerText` = `fixedNote`) where `status = 'FIXED'`; AUTO_CLOSED at fix + 7 days where that is already past. Ids `hse_<md5>` | Phase 4. **`status` stays and is written alongside**: `'FIXED'` for FIXED / CONFIRMED / AUTO_CLOSED, `'OPEN'` otherwise — never any other value, the app maps anything else to OPEN |
| `HomeDecision.options` JSON, `chosenIndex`; `DecisionVote.optionIndex` | `HomeDecisionOption`, `pickedOptionId`, `DecisionVote.optionId` | Options copied mirroring `parseOptions` exactly (first six, named items only, at least two or none), so `sortOrder` = the index `chosenIndex` points at. `studioCostDeltaPaise` null. Ids `hdo_<md5>` | Phase 5. Keep writing the JSON (without any studio cost) and `chosenIndex` / `optionIndex` until the customer app reads `choices` |
| "Changes so far" (derived from picked decisions) | `HomeQuoteChange` | One row per picked option: label `"<title>: <option>"`, its delta, `stageIndex` = last signed payment stage, at = `chosenAt` | Phase 5 |
| `HomeProject.paidPhases` marks `[{ index, dueOn?, paidOn?, remindedAt? }]` | `HomeProjectPayment` | One row per stage marked paid with a readable signed amount: amount = the signed stage's `amountPaise`, `receivedOn` = `paidOn`, `mode` null, `recordedById = 'backfill:paidPhases'`, **`customerConfirmedAt` null** — the customer was never asked. Ids `hpp_<md5>` | Phase 5 decides how a backfilled row counts (suggest: the customer confirms with one tap; until the projection switches, nothing changes). **Due dates and reminder stamps stay in `paidPhases`** — a payment row is money received, not a schedule. Keep writing `paidOn` there until every reader (`moneyView`, payments desk, workspace, cron) moves |
| `HomeDocument` | — | Unchanged. A receipt is a `RECEIPT` document; a payment points at it | Phase 5 |

The event log starts empty: history before the migration lives in the
source tables.

---

## 3. Shared modules

All pure (no `server-only`), all tested. Import them directly; there is no
`index.ts` convention in this repo.

### `src/modules/project/events.ts` — the event log

```ts
PROJECT_EVENT_TYPES            // the one union, grouped by phase (below)
type ProjectEventType
type ProjectActor = { type: 'CUSTOMER' | 'STUDIO' | 'OPS'; id: string } | { type: 'SYSTEM' }
recordEvent(tx, { projectId, type, actor, refId?, payload?, at?, dedupeKey? }): Promise<string>
recordEventOnce(tx, { …, dedupeKey }): Promise<boolean>   // ON CONFLICT DO NOTHING; true = written
dedupeKey(...parts): string    // 'reminder|p1|2026-10-12|18:00'
eventRow(input)                // the checked row (pure), what both writers insert
SNAG_EVENT_TYPE                // SnagEventKind → 'snag.*'
FORBIDDEN_PAYLOAD_KEYS, MAX_PAYLOAD_BYTES (4 KB)
```

- Call it with the **transaction client** inside the same `$transaction` as
  the write it records (`prisma` itself also fits the type).
- `payload` is internal bookkeeping (ids, counts, days, paise as numbers). It
  refuses BigInt, Date, NaN, and the keys `transcript`, `voicePath`,
  `phone`, `crewPhone`, `studioCostDeltaPaise`, `internalNote`, `teamNotes`,
  `disputeNote`, `note`, `lat`, `lng` at any depth. The customer feed reads the
  row `refId` names through the projection, never the payload.
- `at` defaults to the database's now; pass the phone's time for an offline
  post if the feed should order by it.

Event types (`type`, `refId` names):

| Phase | Types |
|---|---|
| 1 | `plan.created` (project) |
| 2 | `site.posted`, `site.nobody`, `site.corrected` (site log); `checklist.ticked`, `checklist.unticked` (item); `reminder.sent`, `reminder.flagged` (project; use `recordEventOnce` with a dedupe key per project, day and kind) |
| 3 | `stage.done`, `stage.reopened` (stage); `date.moved` (date change) |
| 4 | `snag.raised` … `snag.auto_closed` (snag) — one per `HomeSnagEvent`, via `SNAG_EVENT_TYPE` |
| 5 | `decision.posted`, `decision.voted`, `decision.picked`, `decision.expired` (decision); `quote.changed` (quote change); `payment.due_set`, `payment.recorded`, `payment.corrected`, `payment.confirmed`, `payment.disputed` (payment); `document.filed`, `document.shared`, `document.superseded` (document); `material.ordered` (material) |

A phase that needs another type adds it to `PROJECT_EVENT_TYPES` in its own
group — the one shared-file edit allowed; keep it to added lines.

### `src/modules/project/working-days.ts` — IST days and the studio calendar

```ts
istDay(instant): 'YYYY-MM-DD'          // the IST day
dayToDb(day): Date / dayFromDb(date)   // @db.Date columns (midnight UTC)
istTime(day, 'HH:MM'): Date            // 18:00 IST on that day, as an instant
istMinutesOfDay(instant): number
isDay(v), addDays(day, n), daysBetween(a, b), isoWeekday(day)
calendarOf({ workingDays, holidays }): StudioCalendar   // from Studio.workingDays + StudioHoliday rows; repairs junk
DEFAULT_WORKING_DAYS ([1..6]), DEFAULT_CALENDAR
isWorkingDay(day, cal), nextWorkingDay(day, cal, { inclusive? }), previousWorkingDay(…)
workingDaysBetween(from, to, cal)      // signed; (from, to]
addWorkingDays(day, n, cal)
```

Days are strings everywhere in rules; convert to `Date` only at the database.
`HomeSiteLog.date = dayToDb(istDay(postedAt))`.

### `src/modules/project/append-only.ts` + `tests/append-only.test.ts`

- `APPEND_ONLY_MODELS`: `homeProjectEvent`, `homeSnagEvent`,
  `homeProjectDateChange`, `homeSiteLog`, `homeQuoteChange` — no `update`,
  `updateMany`, `updateManyAndReturn`, `delete`, `deleteMany`, `upsert`, nor
  raw `UPDATE`/`DELETE FROM` on their tables.
- `NEVER_DELETED_MODELS`: `homeSiteLogPhoto`, `homeSiteLogCrew`,
  `homeProjectPayment` — no `delete`, `deleteMany`, `upsert`, raw `DELETE`.
  Updates are allowed only for filling in (speech fields; the customer's
  confirm/dispute — write those with `updateMany({ where: { id, customerConfirmedAt: null, disputedAt: null } })`
  so it happens once). Never change a payment's amount, stage, day or mode.
- The test scans every file under `src/`. It is a grep: don't defeat it with
  dynamic model names.

### `src/modules/studio/roles.ts` — two new actions

`crew.manage` and `calendar.edit`: owner and PM, studio-wide (no assignment).
Everything else maps onto the brief's existing rows:

| Phase action | Check |
|---|---|
| Post today's update, nobody on site, a correction | `update.post` |
| Tick checklist items (incl. voice-suggested) | `checklist.tick` |
| Move a plan date (with reason) | `plan.edit` |
| Accept, dispute, set fix-by, assign a snag; bulk add at handover | `snag.accept` |
| After photo + mark fixed | `snag.fix` |
| New decision (incl. studio cost per option) | `decision.create` |
| Mark a payment received, attach receipt, correct an entry | `payment.record` |
| Set a payment's due date | `payment.record` or `plan.edit` |
| Upload / version drawings, add product codes, mark ordered | `document.upload` |
| Customer confirms / disputes a payment, picks, votes, confirms a fix | customer-side: owner of the brief (family may vote only) — not a studio action |

Gate every studio read/write with `memberOnProject(projectId, action)`
(`studio/access.ts`); crew and calendar with `mayDo(member, 'crew.manage')`.
`tests/studio-roles.test.ts` and `team-rules.ts` labels are updated.

### The customer projection

`customer-project-view.ts` is unchanged in what it selects; its header now
lists, per new table, which columns may cross and which never do.
`tests/customer-projection.test.ts` now feeds a row that also carries site
logs (note, voice, transcript, lat/lng, client ref, crew phone), date changes
(note), payments (note, dispute note, recorder ids), events (payload, dedupe
key, actor id), quote changes, decision `choices` with `studioCostDeltaPaise`,
and snag `events` with `internalNote`, voice, transcript and assignee — and
asserts none of it comes out by key or value, and that the select never names
`studioCostDeltaPaise`, `transcript`, `transcriptLang`, `voicePath`,
`internalNote`, `phone`, `disputeNote`, `lat`, `lng`, `payload`, `dedupeKey`,
`actorId`, `assigneeId`, `assignee`, `recordedById`, `customerConfirmedById`,
`disputedById`, `clientRef` or `crewMember`.

When a phase adds a field to the projection, it extends the select with
explicit `select:` blocks (never `include`, never `true` on a relation) and
the mapper field by field, and adds an assertion for what the customer
should now see. Existing fields keep their shape: the phone app (`mobile/`)
reads this payload. Add new keys; don't change or remove old ones.

---

## 4. Working in parallel — shared files

Four agents edit at once. These files are shared; edit them additively, in a
block of your own, and expect to rebase:

| File | Rule |
|---|---|
| `src/modules/portal/customer-project-view.ts` | One new top-level key per phase in `CUSTOMER_PROJECT_SELECT` and `CustomerProject`; put the mapping in your own pure file (e.g. `portal/site-feed-view.ts`) and call it from `toCustomerProject` in one line |
| `src/modules/portal/customer-project.ts` | Signed links: add your own field to `CustomerProjectLinks` |
| `tests/customer-projection.test.ts` | Add your assertions in your own `describe` |
| `src/modules/portal/project-store.ts` | Phase 4 owns the snag functions, Phase 5 the decision and payment ones. Prefer moving them to a new file (`portal/snag-store.ts`, `portal/payment-store.ts`) and re-exporting, over editing in place |
| `src/modules/project/events.ts` | Only add lines to `PROJECT_EVENT_TYPES` |
| `src/modules/notify/*` | Add notification kinds; don't rename existing ones. Customers get push/email, never WhatsApp |
| `prisma/schema.prisma`, migrations, `roles.ts` | **Don't.** Raise it instead |

Don't touch `mobile/`.

---

## 5. Per-phase notes

### Phase 2 — site log and feed

- Post = one `$transaction`: `HomeSiteLog` (kind `UPDATE`, `date =
  dayToDb(istDay(postedAt))`, `stageId` = the current stage, `clientRef` from
  the phone) + photos + crew + checklist ticks (`doneAt`, `doneById`,
  `doneSource: 'VOICE'` when it came from a suggestion the supervisor kept,
  `doneSiteLogId`) + `recordEvent('site.posted')` (+ `checklist.ticked` per
  item, or one event with item ids in the payload).
- Offline retry: a second request with the same `clientRef` hits the unique
  index — catch `P2002` on `clientRef` and return the existing post as success.
  A second *different* post the same day hits the partial index (also
  `P2002`): answer "already posted today — add a correction".
- Nobody on site: kind `NOBODY` + `reason` (+ optional internal `note`).
  `WAITING_CUSTOMER_DECISION` and `CUSTOMER_ASKED` do not count against the
  studio. `HOLIDAY` on a working day is the studio's own call; a
  `StudioHoliday` day needs no post at all.
- Correction: kind `CORRECTION`, `correctsId`; the feed shows it beside the
  original. Never edit the original.
- Speech: `modules/speech` adapter with the fake; transcripts and recordings
  go in `transcript`/`voicePath`, the customer's sentence in `customerText`
  (+ `customerLang` = the customer's `User.locale`). Supervisor's preview is
  enough (owner).
- Reminders (`reminder-rules.ts`, pure): working day from
  `calendarOf(studio)`; 18:00 IST → supervisor (WhatsApp OK for staff); 21:00
  → flag; second missed working day → owner. Dedupe with
  `recordEventOnce(… dedupeKey('reminder', projectId, day, kind))`. Score and
  "missed days" are computed from `HomeSiteLog` against working days — no
  stored score.
- Customer feed: `siteLogs` newest first (≈30 days), with legacy `updates`
  merged by date until they age out. "From gallery" from `fromGallery`.
- Crew list UI: `StudioCrewMember` gated by `crew.manage`; working days and
  holidays by `calendar.edit`.

### Phase 3 — tracker and delays

- Moving a date = one transaction: update the stage column (`plannedStart` /
  `plannedEnd`; the HANDOVER stage's `plannedEnd` for `HANDOVER`) +
  `HomeProjectDateChange` (from, to, reason, optional internal `note`,
  `decisionId` when it is a late decision) + `recordEvent('date.moved')`.
- `project-rules.ts` (pure): stage completion from items; "can show done"
  needs ≥ 1 `HomeSiteLogPhoto` on a `HomeSiteLog` with that `stageId` (zero
  until Phase 2 ships — fine); delay attribution by `DelayReason`
  (`CUSTOMER_CHANGE` and `decisionId`-linked rows are customer delay);
  overall delay = planned handover (baseline: earliest `fromDate`) vs
  forecast, in working days via `workingDaysBetween`.
- `HomeProjectStage.actualEnd` is still written by `setStudioStageDone`
  (tracker-store.ts); keep `doneStages` in step while the app reads it.
- Customer: old date, new date, reason in plain words — never `note`.

### Phase 4 — snags

- Every snag action = one transaction: a `HomeSnagEvent` + the legacy
  columns kept in step (`status` OPEN/FIXED, `fixBy`, `assigneeId`, and on
  FIXED `fixedAt`/`fixedNote`/`fixedPhotoPaths` so the current app still
  shows the fix) + `recordEvent(SNAG_EVENT_TYPE[kind])`.
- `snag-status.ts` (pure): status from events ordered by `at` (backfilled
  ACCEPTED/FIXED are spaced 1–2 ms apart so `at` alone orders them; break any
  tie by kind order RAISED < ACCEPTED < DISPUTED < FIXED < CONFIRMED/REOPENED
  < AUTO_CLOSED). FIXED + 7 days with no customer answer = closed; the cron
  writes the `AUTO_CLOSED` event (actor SYSTEM) and tells the customer.
  Backfill already closed fixes older than 7 days, so the first run does not
  notify for old snags.
- Mark fixed needs an after photo (the event's `photoPaths`). Only the
  customer's CONFIRMED (or AUTO_CLOSED) closes.
- `internalNote` on ACCEPTED is the PM's "only your team" note; `note` is the
  customer-visible reason (dispute reason, "not fixed" reason).
- Final-payment gate ("no open snags"): put the pure check in
  `snag-status.ts` (`hasOpenSnags(eventsBySnag)`) so Phase 5 calls it; don't
  wait on Phase 3's `project-rules.ts`.

### Phase 5 — decisions, payments, locker

- New decision: `HomeDecision` (`why` = "if she decides late", `dueOn`,
  `quoteLineId`) + `HomeDecisionOption` rows (`deltaPaise` GST-inclusive,
  `studioCostDeltaPaise`) **and** the legacy `options` JSON (name, note,
  extraPaise = max(0, delta), swatch — never the studio cost) + event.
  `parseOptions` clamps `extraPaise` ≥ 0: a negative delta is only correct in
  the table, so the projection should move to `choices` before negative
  options are offered.
- Pick: `pickedOptionId` + `chosenIndex` + `HomeQuoteChange` (re-pick =
  reversing row + new row) + material spec update by `quoteLineId` +
  `decision.picked` / `quote.changed` events, one transaction. Late,
  unanswered decisions → `decision.expired` (cron) and are customer delay
  (Phase 3 reads `decisionId` on date changes).
- Payments: paid = sum of the latest row per correction chain with
  `customerConfirmedAt` set and no `disputedAt`; balance = signed stages +
  quote changes − paid. Overpayment refused with the difference shown
  (`studio-practice/ledger.ts canPay` pattern). Keep writing
  `paidPhases[].paidOn` for compatibility. Backfilled rows
  (`recordedById = 'backfill:paidPhases'`) are unconfirmed — decide and say
  how they count.
- Receipt: file a `RECEIPT` `HomeDocument` (shared) and set
  `receiptDocumentId`. Drawings: `HomeDocument` versions (Phase 1). Materials:
  `productCode` + `orderedAt`, `material.ordered` event.
- "I didn't pay this" goes to our team (ops), with `disputeNote`; it is not
  shown to the studio by the projection.

# Leads, v2 — making the board worth opening

Written 22 Sep 2026, after reading the AxLeads codebase side by side with ours.

---

## 1. The diagnosis, in one sentence

**AxLeads is useful because leads arrive on their own. Our board is a decent
board with nothing landing on it.**

Everything else follows from that. A studio opens `/studio/clients`, sees one
seeded sample row called *Sample — Anita Kulkarni*, and closes the tab. Nothing
we add to the board fixes that, because the board is not the broken part.

### What can create a `StudioClient` today

`grep -rn "studioClient\.(create|createMany|upsert)"` across the whole
repository returns **three** hits, all in `src/modules/studio-practice/clients.ts`:

| Line | Function | What it is |
| --- | --- | --- |
| 239 | `seedDemoLead` | the one sample row |
| 313 | `addClient` | somebody typed it |
| 686 | `importClients` | somebody uploaded a spreadsheet |

There is no API (`src/app/api` does not exist — the app is entirely server
actions), no webhook, no public form, and no bridge from the marketplace.

### The hook that was specified and never built

`docs/STUDIO-CRM.md` says it plainly:

> Clients that came through us are created automatically at the introduction,
> pre-filled from the brief. That is the hook.

It is not wired. `StudioClient.briefId` and `introductionId` exist, the unique
constraint `@@unique([studioId, introductionId])` exists, and **nothing writes
either column.** The only code that reads them is a display badge:

```ts
fromMarketplace: row.briefId !== null || row.introductionId !== null
```

`ClientSource.ONE_INTERIORS` is unreachable in practice — `addClient` rewrites
it to `OTHER`, and `Board.tsx` filters it out of the source dropdown. The
enum value that names our entire differentiator can never be set.

That is the single largest gap in the product and the cheapest to close.

---

## 2. What AxLeads proves, and what it only appears to prove

AxLeads is the reference, not the target. Read `docs/old_spec/PRODUCT.md` in
that repo for what is *deployed*; its neighbours describe what was *designed*,
much of which was never built. Several headline features are dead code.

### Genuinely built, proven in production, worth lifting

- **Capture that cannot lose a lead.** Verify signature → ack in under 5s →
  work in `after()`. Idempotency is **claim-then-confirm**: `alreadyProcessed()`
  writes a claim, `markProcessed()` confirms, `failWebhookEvent()` *releases*
  it so the provider's retry can re-enter. Skipping the release meant the
  retry — the thing that would have saved the lead — got deduped away. That
  was a real bug with a real commit.
- **The three-state `assignedTo`.** `undefined` = use the default, `null` = the
  pool deliberately, an id = that person. Tested with `!== undefined`, never
  truthiness. We already have the *shape* (`assignedToId` null = pool) but not
  the three-state input convention.
- **Claiming as a conditional update.** The `updateMany` whose `where` carries
  `assignedTo: null` *is* the lock; zero rows affected means somebody else won.
  No advisory locks, no transactions-with-retry.
- **KPI tiles computed in SQL**, not from the loaded page. The tiles describe
  the workspace; the list describes a slice. Ours would have to, too — we
  `take: 400` on the board.
- **Call logging that produces work.** An outcome plus reactions
  (`wants_quote`, `wants_portfolio`, `site_visit`) each create a follow-up task
  with a 24-hour deadline, deduped against open tasks.
- **Grouping without a table.** A `groupable` flag on the field definition,
  values in JSONB under one GIN index. A `lead_group` table was explicitly
  rejected: *"A society is a label, not an entity"*, and every stat about one
  is derived by filtering so it cannot go stale. We already have half of this
  (`StudioField.groupBy` + the board's "Group by" select).
- **Value hygiene, in three defences**: normalise (trim, collapse whitespace,
  **leave case alone** — title-casing turns `DLF` into `Dlf`, a worse lie);
  silently reconcile canonically identical values; for near-matches **ask,
  offering both with counts** — `Keep "Kalpataru Sunrise" (37 already · 2 here)`.
  Because nothing there knows which spelling is correct and the UI must never
  imply it does.

### Built but dead — do not assume these work

- **HOT scoring and alerting.** `applyScore` hardcodes `const isHot = false`.
  The score is computed, stored and displayed; the badge, the `HOT_LEAD`
  notification and the whole band pathway never fire.
- **Slack.** `LiveNotifier.slack()` throws `live_notifier_not_wired`. The
  `hot.slackWebhookUrl` setting is a dead option in the UI.
- **Cold-lead reactivation.** Never ran in any environment. Thirteen schedules
  are overdue and still PENDING, the oldest from May, because firing them needs
  a BullMQ worker that was never provisioned.
- **The generic `/in/` webhook.** Complete, correct, zero tenants use it.
- **Google Enhanced Conversions.** The env vars are not set on Vercel, so it
  cannot work in production regardless of the code.
- **`REFERRAL` as a source.** Enum only. No code path creates it.

The lesson worth carrying into our own work: **three of AxLeads' most
impressive-sounding features are switched off, and nothing on any screen says
so.** We should not ship the same shape.

---

## 3. The decision

**Port the ideas; keep the codebases separate.**

Not a shared package, not AxLeads-as-the-engine. Reasons:

- AxLeads' lead core is tangled with its multi-tenant RLS, its plan gating and
  its operator console. Extracting it is a rewrite wearing a refactor's clothes.
- One Interiors is one deployable thing with one database. Provisioning every
  studio an AxLeads tenant means two products, two bills, two schemas and an
  SSO bridge, to deliver a board we already have.
- The patterns are what is valuable, and patterns port for free.

The cost, stated honestly: **two lead systems to maintain.** A fix to the
capture discipline in one does not reach the other. We accept that because the
alternative is worse today, and revisit if a third product ever needs leads.

---

## 4. Where leads will come from

All five, in build order by cost-to-value:

1. **One Interiors introductions** — the differentiator. No other CRM a Pune
   studio can buy will ever put a matched, qualified, brief-carrying customer on
   their board. Cheapest to build: no third party, no credentials, the columns
   already exist.
2. **A hosted form** at a One Interiors URL the studio can put in an Instagram
   bio or on their own site. No third-party credentials, no webhook signature
   verification. Real inbound for the price of one public route.
3. **CSV / spreadsheet** — already built. Needs `.xlsx` support and honest
   source attribution.
4. **Manual entry** — already built. Needs duplicate detection on add.
5. **Their own Meta / Instagram lead ads** — the highest value and by far the
   most work: per-studio connections, encrypted tokens, webhook signature
   verification, a `webhook_event` claim table, a `failed_job` trail, Graph API
   fetching, and field mapping from whatever the advertiser named their
   questions. Its own phase, deliberately last.

---

## 5. Phase A — make leads arrive

### A1. The introduction bridge

When a customer is introduced to a studio, that customer appears on the
studio's board, pre-filled from the brief: locality, property type, carpet
area, budget band, scope, move-in date. `source = ONE_INTERIORS`,
`briefId` and `introductionId` set, landing in the studio's intake stage.

**Idempotent** on the existing `@@unique([studioId, introductionId])`. A
re-introduction after a withdrawal must not create a second card.

#### The contact-release problem, which decides the design

`StudioClient.name` is **required** and is the board card's label. But an
introduction can exist with contact *not* released —`contactState()` exists
precisely so a studio can be told a brief is coming and nothing about who. The
landing page promise is:

> no studio receives them until you tell an expert which introduction you want

So the bridge **must not** create a named card at introduction time.

Three options were considered:

| Option | Verdict |
| --- | --- |
| Create with a placeholder name, fill in on release | Rejected. A row whose name is a lie, on the one surface where a leaked name is invisible to everyone except the customer. |
| Create only when contact is released | **Chosen.** |
| Never bridge; keep introductions on their own screen | Rejected — that is today, and today is the problem. |

So the client row is created at **the moment of release**, which is either
inside `createIntroduction` when `releaseContact` is true (the normal case: the
expert has just been on the phone and the customer said yes) or inside
`releaseContactDetails` when it is not. One private function called from both.

A studio with an unreleased introduction still sees it on the introductions
surface — "a brief is coming" — and nothing lands on the board. Which is
correct: they are not yet allowed to act.

#### Withdrawal must scrub

`withdrawIntroduction` already cancels appointments, because leaving a
confirmed meeting standing against a withdrawn introduction is how a studio
turns up at a door they are no longer welcome at. The same argument applies
harder to the board card: it carries a name and a phone number.

**Binning it is not enough** — the bin is restorable and still displays the
name. Withdrawal must null `name`, `phone` and `email` on the bridged client
and mark it visibly withdrawn, in the same transaction as the withdrawal.

Open question flagged for the build: what happens to a client the studio has
already worked — logged calls against, attached a quote to. We cannot delete a
row `StudioQuote` points at (`onDelete: Restrict`, and `binClients` already
refuses a client with quotes or projects). Likely answer: redact contact, keep
the row, stamp it withdrawn, and let the studio see that the relationship ended
rather than silently losing their own work.

#### Unblocking `ONE_INTERIORS`

`addClient` rewrites `ONE_INTERIORS` to `OTHER` and the board hides it from the
dropdown. Both are correct *for manual entry* — a studio must not be able to
claim a lead came from us. Keep both, and have the bridge write the source
directly rather than going through `addClient`.

### A2. The hosted capture form

A public route, no auth, per studio. Lifted wholesale from AxLeads' shape
because that shape is load-bearing:

- server-side validation, not just client-side: required fields, E.164 phone,
  per-field length caps
- a honeypot field that **silently accepts and creates nothing** — a bot told
  it failed simply tries again
- two rate limits: per IP and per form
- UTM capture, capped
- creation is **inline** (the documented exception to ack-fast — there is no
  provider to ack to), alerts deferred

New model `StudioForm`: slug, which fields to ask, active flag. The studio
gets a link and an embed snippet in settings.

**The rate limiter is the honest risk.** `src/modules/studio/lookup-limit.ts`
is in-memory and per-instance, and says so in its own docblock: on Vercel it
resets on a cold start and is enforced separately in each lambda. That is
adequate for a courtesy website-lookup button behind an application form. It is
**not** adequate for an unauthenticated endpoint that writes rows. This needs a
database-backed counter before the form goes public, and the build task says so.

### A3. Import improvements

Small, specific, taken from AxLeads' own known-gaps list:

- `.xlsx` parsing in the browser before upload, because Excel turns a phone
  number into `9.18E+11` and a CSV export preserves the damage. `.xls` refused.
- Imported rows currently all land as `OTHER` with the note *"Imported from a
  spreadsheet"*, which loses the real source forever. Let the mapping carry a
  source column, or stamp one file-wide.
- Duplicate detection on **manual add**, not only on import. Today `addClient`
  has none.

### A4. Meta Lead Ads

Deliberately last, and scoped as its own phase. Prerequisites that do not exist
here yet: a `webhook_event` claim table, a `failed_job` trail with the
understanding that it holds raw provider PII and must never get a
studio-facing route, encrypted per-studio token columns, and an API route
directory (we have none — the app is entirely server actions).

---

## 6. Phase B — make the board worth working

Ordered so each step unlocks the next.

### B1. An activity timeline

A `StudioClientEvent` table. Actor (`HUMAN` / `SYSTEM`), kind, payload,
timestamp. This is the foundation: call logging, stage history and the
assignment trail are all reads of it.

Today a lead's entire history is one overwritable `notes` text column plus
`lastContactedAt`, a single timestamp that is not a log. Lead edits are not
even written to `AuditLog`.

### B2. Call logging that produces work

`logContact` currently only stamps `lastContactedAt`. Port AxLeads' shape: an
outcome, optional reactions, and reactions that create follow-up tasks with
deadlines — `wants_quote → "Send quotation"`, 24 hours, deduped against open
tasks.

### B3. KPI tiles, computed in SQL

Total · untouched · callbacks due · tasks overdue · needs action · won. Counted
in the database, not from the `take: 400` slice the board already loads, so the
numbers describe the studio rather than the page.

Note the existing trap: `tests/demo-lead.test.ts` fails any `studioClient.count`
that omits the `LIVE` filter, because the sample row is real. Every new counter
inherits that rule.

### B4. Saved filter views

AxLeads persists filters per-user to `sessionStorage` and keeps them out of the
URL deliberately — *"a working view, not a shareable address"* — plus named
presets with a default star. Worth copying whole.

### B5. Dedupe and merge

Phone-exact matching on add and import (we have import-only today, skip-never-
merge). A merge that reparents events and soft-deletes the loser with a
`possibleDuplicateOf` pointer.

---

## 7. What we deliberately do not port

- **Lead scoring.** AxLeads' is a 13-rule table tuned for real-estate intent
  signals, and its HOT pathway is switched off anyway. A studio with forty
  leads does not need a score; a studio with four thousand does, and no studio
  here has four thousand. Revisit when one does.
- **Cold-lead reactivation ladders.** Never ran anywhere, needs a worker we
  also do not have.
- **Slack.** A stub that throws, in both products now.
- **Anything needing Redis or a queue.** Next's `after()` is what AxLeads
  actually runs on too; the queue layer there is parked, not live.
- **Lead resale or paid placement.** Ruled out by policy, not backlog —
  `docs/FUTURE-SCOPE.md`: *"No lead resale, ever. The moment placement can be
  bought, the ranking is a…"*.

---

## 8. Open questions

1. **A worked-then-withdrawn client** — redact and keep, or something else?
   Leaning redact-and-keep (§5, A1).
2. **Does the hosted form need a captcha**, or are the honeypot plus two rate
   limits enough? AxLeads runs without one. We should not add one before we
   have evidence, and we should not ship the endpoint without the shared-store
   limiter either way.
3. **Where the bridged client's assignment lands.** AxLeads resolves a tenant
   default assignee and falls back to the pool. We have no `defaultAssignee`
   column on `Studio`. Simplest first answer: the pool, which is already what
   imports do deliberately.
4. **`/studio/clients/pool` is revalidated and does not exist.**
   `clients/actions.ts:108` calls `revalidatePath('/studio/clients/pool')`; the
   pool was built as a board filter instead. Dead call, harmless, should go.

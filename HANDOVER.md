# One Interiors — handover

**Written 17 September 2026. Read this first, then `CONTRIBUTING.md`, then `README.md`.**

This file exists to bring a new assistant up to speed on a codebase and a
product decision-history that is now larger than any one conversation. It is
deliberately opinionated: it records *why* things are the way they are, because
almost every mistake made on this project so far came from not knowing the why
and doing the locally-sensible thing.

`README.md` is partly stale. It still says auth, the ops console, the quotation
builder and the studio dashboard are "not built yet". All four are built. Trust
this file and the code over the README.

---

## 1. What the business is

**One Interiors** is a curated interior-design marketplace for **Pune, India**.
A homeowner takes a nine-question quiz, gets a reasoned match against a small
roster of verified studios, and is introduced to two or three of them.

Three surfaces, one Next.js app:

| Surface | Route prefix | Who |
|---|---|---|
| Customer | `/`, `/quiz`, `/match`, `/studios`, `/prepare`, `/expert` | Homeowners |
| Ops | `/ops/**` | Us — allocation, verification, introductions |
| Studio | `/studio/**` | The design studios on the roster |

The brand promise is **verification, not volume**. `/apply` says out loud that
there are "eight studios on this site, not eight hundred". Every claim the
product makes about a studio is backed by a `VerificationCheck` row with a
source and a date. There is no hardcoded badge anywhere.

### The rule that is the whole brand

**Unmeasured is not zero.** Anywhere the product makes a claim about a studio —
match score, delivery variance, dispute count — a missing value renders as "not
enough data yet", never as a favourable default. The matching engine returns
`null` for unmeasurable factors and normalises over measured weight only, so a
cold-start studio shows "matched on 4 of 6 factors" rather than a fabricated
94%. Enforced in `score.ts`, covered by tests. Do not soften this.

**v1 does not hold client funds.** We author the milestone plan, verify each
stage against site photographs, and publish the variance. The customer pays the
studio directly. Escrow is a later phase and **no copy anywhere may imply
otherwise**. See `docs/FUTURE-SCOPE.md`.

---

## 2. The strategic shift — read this carefully

The marketplace alone has a retention problem. A studio that stops getting
leads from us has no reason to open our website again, and a two-sided
marketplace where one side churns silently is a marketing business, not a
software business.

So One Interiors is building **the software a studio runs its practice on** —
used daily, for work that has nothing to do with us. Leads we send and leads
they found themselves live in the same list. The bet is that a studio that
quotes, schedules and pays its carpenter inside our software does not churn
when a month goes by without an introduction.

### The instruction that governs all of this

> *"we want a proper consolidated software where they can manage everything at
> one place"*

**One login. One app. `/studio/**` inside the One Interiors codebase.** This
was decided explicitly and then violated once: the CRM was split into a
separate repo with a `CONSOLIDATION.md` arguing for it. The user's response was
*"this is nothing like what we discussed"*, and they were right. It was a
reasonable engineering call and the wrong product call. **Do not propose
splitting the studio software out again.**

### The nav encodes the argument

`src/app/studio/layout.tsx` groups the rail into three:

- **Dashboard**
- **Your work** — Quotations, Product master, Clients, Projects, Vendors
- **From us** — Calendar, Your listing
- **Settings**

"Your work" is software a studio uses whether or not we ever send them a lead.
It is theirs, it holds their clients and their prices, and it keeps working the
day they leave the roster. "From us" is the marketplace. Putting them in one
flat list would say they are the same kind of thing, and the entire retention
case is that they are not. **Keep the grouping.**

### The commercial model

- **5 seats free, then per-seat pricing.** `seat_price_inr` still defaults to 0
  — pricing is not set.
- Marketplace commission on introduced work is separate.
- Pilot shape, as recalibrated: **6-month pilot, minimum 150 studios onboarded
  in the first 3 months, at least 3 projects delivered to each by month 6** →
  450 projects → ~1,500 expert calls → ~12,500–18,750 quiz starts.

**Unresolved tension, flag it rather than quietly picking a side:** 150 studios
contradicts `/apply`'s "eight studios on this site, not eight hundred". The
likely resolution is that the *software* has 150 studios and the *roster* has
eight — but that has not been decided, and the copy has not been reconciled.

### The reference product — AxLeads

The user runs **AxLeads** (`axleads.axgen.co`), a lead-management SaaS for their
own studio (Hauspire Luxury Design Studio, ~21,500 leads). It is the bar to
clear for customisation. What it has that One Interiors does not yet:

| AxLeads feature | State in `/studio` |
|---|---|
| Configurable pipeline stages — reorder, rename, colour, delete, one locked INTAKE | **Built** (17 Sep) |
| Custom fields — key, type, options, "Group by" toggle | **Built** (17 Sep) |
| Team + seats (7/10), invite by email, per-person lead counts, suspend/remove | Not built |
| Unassigned **Pool**, bulk assign, group-by, **Import CSV** | Not built |
| **Bin** — soft delete, 30-day retention, explicit erase date, restore | Not built |
| Analytics — qualified rate, conversion rate, contacted rate, time to first contact | Partial (`/studio` dashboard only) |
| Notifications page, Billing page with invoice PDFs | Not built |
| Connected sources (Meta IG/FB) | Not built |
| EN / हिं toggle, light–dark toggle, global search, workspace switcher | Not built |
| "Needs attention — no contact in 7+ days" banner | Not built |

Build order was chosen by the user: **customisation spine first**, then daily-use
gaps (import / pool / assignment / bin / search), then team-seats-billing.

### Design direction

There are now **two palettes in this repo, deliberately**, and neither is
global.

**`.oi-landing` — "Tactile Assurance", the locked marketing palette.** Raw Silk
`#EAE6DF` ground, Alabaster `#FCFCFA` cards, Deep Espresso `#2C2624` ink,
Terracotta `#C0613C`, Muted Sage `#839073`, Hairline `#DBD5CB`. Typography is
Instrument Serif for headlines, Instrument Sans for body and UI, IBM Plex Mono
for **evidence only** — labels, eyebrows, money, quantities, specs, scores,
never body copy. Squared corners everywhere except glass surfaces and what sits
inside them. The full spec lives in the design-system folder's `CLAUDE.md`, and
Palette A (beige/charcoal/deep terracotta/olive) is **rejected**.

Two rules from it that are easy to break by accident:

- **Terracotta is for high-intent actions and attention flags only.** A
  terracotta rule or hover state costs the primary button its meaning.
- **Never describe getting a quote as *requesting* one.** The first quote is
  priced from the studio's own filed rate card in about three seconds; no
  studio is asked and nobody is phoned. "Request a quote" is what every
  lead-gen competitor says and it means *we will pass on your number*. Every
  CTA says **get**.

**`.studio-app` — the studio software palette.** Sage `#dfe0d2` ground, rail
`#eceddf`, terracotta `#c0613c` accent, taken from the Interioring reference on
the instruction *"i need the color theme of them only"* — keep our sidebar
layout, take only their palette.

The customer journey (`/quiz`, `/match`, `/quotes`, `/compare`, `/expert`) and
the ops console are still on the **older paper/petrol tokens** in `@theme`.
That is a known inconsistency, not an oversight: bringing them onto Tactile
Assurance is a redesign of eight screens and should be its own piece of work,
not a side-effect of a landing-page change.

Tokens live in `src/app/globals.css` under a `.studio-app` scope so nothing on
the customer side moves:

```
--s-ground #dfe0d2   --s-rail #eceddf   --s-surface #fbfbf6
--s-accent #c0613c (terracotta)   --s-tag #e7dcc6
```

**There is deliberately no dark mode on this surface, and there was a bug
here.** A `prefers-color-scheme: dark` block repainted everything in charcoal
and olive, so on any machine set to dark — most of them — nobody ever saw the
palette. It was removed along with `color-scheme: light`, which is the second
half: without it the browser paints its *own* widgets dark (date pickers,
select popups, scrollbars, autofill) on a light page. If dark mode is ever
wanted, it is a separate design, not a translation.

Layout instruction, also explicit: *"why is everypage so centered and clustered
use the whole space"* — full-width, dense, no narrow centred columns on the
studio and ops surfaces.

---

## 3. Stack and where things live

- **Next.js 15.5.25**, App Router, React 19, TypeScript, Tailwind v4
- **Prisma 6.19.3** + **Supabase Postgres** (`ap-south-1`)
- **Vercel** (`bom1`)
- Runtime connects via the **Supavisor pooler on :6543** (`DATABASE_URL`);
  migrations use the **direct connection on :5432** (`DIRECT_URL`). Both are
  required and the distinction is not optional — migrations through the pooler
  hang.

```
src/
  app/            routes; may import from modules/
  modules/        domain layer; may NEVER import from app/
  lib/            money.ts, prisma.ts, env.ts
prisma/
  schema.prisma   43 models
  migrations/     hand-written SQL, applied with `migrate deploy`
tests/            31 files, Vitest
docs/             ARCHITECTURE, DATABASE, STUDIO-CRM, QUOTATION-BUILDER, …
```

Scripts: `npm run dev | build | lint | typecheck | test | db:deploy | db:seed`.

---

## 4. Conventions that are not negotiable

### Money is integer paise

Never rupees, never a float. `₹8,50,000` is `85000000`. All arithmetic goes
through `src/lib/money.ts` — `applyBps` for rates, `splitAcross` for exact
splits that must sum back to the total. `fromDb`/`toDb` convert at the Prisma
boundary because Postgres holds `BigInt` and a `BigInt` cannot cross the RSC
boundary into a client component.

Currency renders in the Indian numbering system — lakh and crore grouping, via
`formatINR()` / `formatINRCompact()`. Never hand-roll `toLocaleString` for this.

### Quantities are thousandths

`qtyMilli` — an integer, so it crosses the RSC boundary as a number, unlike a
Prisma `Decimal`. `QTY_SCALE = 1000`, `MM_PER_SQFT = 92_903.04`.

### Never store a total

Bills, paid, balance, quoted value — all computed on every read from the lines.
A stored total is a total that goes stale the first time somebody edits a line.

### Snapshot anything that prints

Quote lines and work-order lines copy the rate at creation. Editing the product
master must never change a quotation already sent to a client — that is how a
studio ends up in an argument it cannot win about what it quoted. Same for
`StudioProject.contractPaise`, frozen when the project is created.

### Every migration that adds a table carries RLS

Supabase's PostgREST exposes every table in `public` to the `anon` and
`authenticated` roles by default, and Prisma-created tables get no policies. So
**every** migration adding a table ends with:

```sql
ALTER TABLE "x" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "x" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "x" FROM anon, authenticated;
```

Prisma connects as `postgres`, which holds `rolbypassrls`, so this does not
affect the app. Without it the table is world-readable **and writable** over
HTTP.

### Studio scoping — the single most important query rule

> **Every query is scoped by the studio id from the session, and nothing in
> `studio-practice/` or `studio-quote/` takes a studio id as an argument.**

`myStudioId()` in `src/modules/studio-quote/store.ts` is the only way in. These
tables hold one studio's entire price list, cost base and clients' phone
numbers, sitting in the same tables as every other studio's. A missing `where`
clause here leaks one business's operating detail to a direct competitor.

`studio_vendor_rates` is the worst of them: it is what each trade charges a
studio. Put that beside `studio_products` — what they charge a client — and a
reader has their margin on every line of work they do.

### `requireRole` throws — so it is wrong in render paths

Correct for server actions. **Wrong for pages and layouts**, because Next
renders a layout and its page in parallel, so the throw beats the layout's
redirect and you get a 500 where a redirect belongs. In render paths use
`getCurrentUser` + `hasRole`. This has been fixed twice.

### Pure logic does not live in a `server-only` file — CONTRIBUTING §9.5

A module starting with `import 'server-only'` **cannot be imported by Vitest at
all** — the test fails on the import line before a single assertion runs. So
anything worth testing that does not touch the database or session goes in a
sibling file with no `server-only`, and the server module re-exports it.

```
studio-practice/clients.ts         'server-only' — Prisma, auth, writes
studio-practice/vocabulary.ts      pure — labels, enums, colours
studio-practice/pipeline-rules.ts  pure — the rules, exhaustively tested
studio-practice/field-values.ts    pure — validation, grouping
```

**This is also the #1 build-breaking bug in this repo. See §7.**

---

## 5. Data model map — the studio software

Four groups of tables, all keyed on `studioId`.

**Branding and quotations** (`studio-quote/`)

- `StudioBranding` — legalName, address, GSTIN, phone, email, `logoPath`,
  welcome note, terms. This is what makes the quotation builder *white-label*
  rather than ours with their name typed in.
- `StudioProduct` — the product master. 38 starter rows, **every one with
  `ratePaise: 0`**, because `/studio/rates` promises: *"We do not set your
  prices. Nothing here is pre-filled, there is no suggested figure, and we will
  never nudge you toward one."* Ship structure, never a number.
- `StudioQuote` / `StudioQuoteLine` — every product field on a line is a
  snapshot. Fee, discount, booking advance are copied onto the quote at
  creation.

**Pipeline and fields** (added 17 Sep — see §6)

- `StudioStage` — name, `kind`, colour, sortOrder, isIntake
- `StudioField` — key, label, type, options, groupBy

**Practice** (`studio-practice/`)

- `StudioClient` — named people with phone numbers, for projects that in most
  cases have nothing to do with us. **We hold these as a processor.**
  `source` is a `ClientSource` enum; `ONE_INTERIORS` is set **only** by the
  introduction path and can never be picked by hand — otherwise a studio could
  mislabel a walk-in as one of ours and corrupt the one report that says
  whether the roster is worth paying for. `fields` is a `jsonb` column.
- `StudioProject` — contract value frozen at creation, five stages.
- `StudioVendor`, `StudioVendorRate`, `StudioWorkOrder`,
  `StudioWorkOrderLine`, `StudioVendorPayment` — the trades ledger.
  `canPay()` refuses an overpayment **and reports by how much** rather than
  clamping: accepting it and showing a negative balance means the mistake is
  found at reconciliation rather than at the keyboard, and by then somebody has
  been paid twice.

**Marketplace** — `Brief`, `Match`, `Consultation`, `Introduction`,
`Appointment`, `PrepRoom`, `VerificationCheck`, `AllocationPeriod`.

Appointment kinds are `FIRST_MEETING | SITE_VISIT | FOLLOW_UP`. Import
`KIND_LABELS` from `studio/introduction` — do not invent kinds. (This was done
once; a blind `as` cast hid it from the compiler.)

---

## 6. The most recent work — studio-defined pipeline and fields

Shipped 17 September. Migration
`20260917020000_studio_pipeline_and_fields`.

### The problem

Client stages were an enum of six values **we** chose. A studio whose real
process is

> New → Calling 1 → Calling 2 → Effective lead → Floor plan pending →
> Quotation pending → Quotation shared

had nowhere to write any of it down, and the software quietly asked them to
work our way. Software that asks that gets used only for as long as it is the
only thing on offer.

### The design — and this is the part to understand

The studio owns **names, order, colours, and how many**. We own **meaning**,
via `StageKind`:

| Kind | Means | What depends on it |
|---|---|---|
| `OPEN` | Still in play | The board; "waiting on you" |
| `WON` | Signed | **A project can only be started from a WON column** |
| `DONE` | Handed over | Comes off the board |
| `LOST` | Gone | Requires a reason |

**Every query in the codebase reads the kind, never the name.** That is what
lets a studio rename "Booked" to "Advance received" on a Tuesday without
breaking Projects, the dashboard or the ledger. If you add a query that filters
on a stage, filter on `stage: { kind: { in: [...] } }`.

Three rules are enforced, each because breaking it *strands data* rather than
merely looking wrong:

1. **Exactly one intake stage** — where a new client lands, undeletable.
2. **At least one stage of each kind.** Delete the last `WON` column and no
   project can ever be started again: no error, nothing thrown, just a New
   Project button on a different screen offering an empty list forever. The
   check is `wouldStrand()` in `pipeline-rules.ts`, pure and tested.
3. **A stage holding clients cannot be deleted.** The FK is `RESTRICT` so
   Postgres would refuse anyway; the app refuses first, with a sentence saying
   how many and what to do.

### Custom fields

Definitions in `studio_fields`, values in `StudioClient.fields` (`jsonb`) keyed
by a machine-stable `key`.

**`label` is renameable; `key` is derived once at creation and frozen.** If
renaming "Society" to "Project / Society" moved the key, every value already
captured would still be in the row and invisible on the screen. A pleasant
side-effect: a field deleted by mistake at 11pm can be recreated with the same
name next morning and the values are still there.

Form inputs are named `custom.<key>`. The prefix is what stops a studio that
defines a field called "name" from silently overwriting the client's name.

`GROUPABLE_TYPES` excludes `NUMBER` — grouping by a number produces one bucket
per client, which is a list with headings rather than a grouping.

### No defaults for fields, on purpose

A field we invented is a question we decided a studio should ask its clients.
The right set depends on how they sell: a studio working one tower at a time
needs Society and will group the whole list by it; a studio living on architect
referrals needs the architect's name and will never once type a society.

### Files

```
modules/studio-practice/stages.ts          server — seeding, the three rules
modules/studio-practice/pipeline-rules.ts  pure — wouldStrand, nextSortOrder
modules/studio-practice/fields.ts          server
modules/studio-practice/field-values.ts    pure — cleanValues, groupBy
modules/studio-practice/vocabulary.ts      pure — labels, kinds, 8 colour tokens
app/studio/settings/{layout,Tabs}.tsx      tabbed settings
app/studio/settings/pipeline/**            the pipeline editor
app/studio/settings/fields/**              the field editor
tests/studio-pipeline.test.ts              the rules
```

`myStages()` seeds the six defaults on first read — the same lazy pattern as
`myProducts()` seeding the starter catalogue, so a studio approved last month
is not left with an empty pipeline.

---

## 7. Traps that have already cost time

Read this section before writing code. Every item is a real bug that shipped.

**1. The `server-only` boundary — has broken the build twice.**

```ts
import type { ClientRow } from './clients';   // erased at compile time, fine
import { STAGE_LABELS } from './clients';     // a real runtime import, fatal
```

A label map is a **value**, not a type, so importing it from a `server-only`
module pulls Prisma into the browser bundle and the route stops building. `tsc`
cannot catch it — the types line up perfectly. Only `next dev` reports it, at
the moment somebody opens the page. `tests/server-only-boundary.test.ts` now
walks `src/` and fails on any client component importing a value from a
`server-only` module. **Do not weaken that test.**

**2. `prisma.config.ts` switches off path inference.**
Adding a `prisma.config.ts` turns off the CLI's `.env` loading *and* its
migrations-path inference. The fallback is `./migrations` at the repo root, not
`prisma/migrations`. `migrate deploy` pointed at a missing directory **does not
error** — it finds nothing and prints a sentence that reads like success. The
first sign is Postgres telling the running app a table does not exist.
`migrations.path` is now set explicitly. If a migration seems not to have
applied, run `npx prisma migrate status` and read the list, not the last line.

**3. Prisma CLI reads `.env`; Next reads `.env.local`.**
This project keeps connection strings in `.env.local` because that is the
gitignored file. `prisma/load-env.ts`, imported by `prisma.config.ts`, is the
only thing loading them for the CLI. Symptom was
`Environment variable not found: DIRECT_URL`.

**4. `prisma generate` is platform-specific.**
Running it from a Linux shell rewrites the generated client to point at the
Linux query engine and Windows then fails to start. If a Linux-side tool runs
it, the user must re-run `npx prisma generate` on Windows. `EPERM … rename
query_engine-windows.dll.node` means the dev server is still running and
holding the DLL — stop it first.

**5. Silent catches hide broken database reads.**
`myClients()` and friends catch and return `[]`. Right behaviour for a
dashboard — a badge that cannot be computed should not take the screen down —
but it means a missing table looks exactly like "no clients yet". `saveFailed()`
in `clients.ts` now returns the real reason in development and the bland
sentence in production.

**6. A form that never closes reads as a form that never saved.**
The add-client panel was absolutely positioned inside the page header (clipped
on narrow windows), never closed on success, and was the only entry point on an
empty list. All three read to the user as "I cannot add a client". It is a
fixed sheet with a backdrop now, closes when the row is written, and the empty
state has its own button.

**7. Display-rounded numbers in tests.**
A test asserted `34_390` sqft-milli; the real value is `34_391`. The README's
"34.39" was display-rounded. Compute the expected value, do not copy it from a
rendered string.

**8. Two-studio roster made `/expert` unusable** — a greyed button with no
explanation, because the minimum-studios rule assumed a full roster. Fixed with
`quotableStudioCount()` and `min = max(1, min(MIN_STUDIOS, available))`. General
lesson: every "minimum N" rule needs a real-world-small-N path.

**9. Prisma ambiguous relation.** `prisma format` auto-adds a back-relation; if
you then add your own, you have two and the schema is invalid. Check what
`format` wrote before adding relations by hand.

---

## 8. Current state

**Database (production, 17 Sep):** 8 studios, 2 studio members (both on
`st-akara` — Akara Design Studio), 37 products, 0 quotes, 0 clients, 0 branding
rows. It is pre-launch. Treat it as production anyway.

**Built and working:** the full customer journey (`/quiz` → `/match` →
`/prepare` → `/expert`), the ops console (allocation, applications,
consultations, introductions, verification, funnel), studio onboarding, the
white-label quotation builder with print, product master, clients board,
projects, vendors ledger, calendar, listing, and Settings → Pipeline / Fields.

**Not built:** everything in the AxLeads table in §2 marked "Not built". Also
**there is no `/privacy` route** despite `POLICY_VERSION = '2026-09-01'` in
`consent/policy.ts` — consent records reference a policy version that has no
page. That is a real compliance gap.

**Launch blockers, none of them code:**

1. **Resend sending domain** — currently 403s and delivers only to one address.
   Email sign-in does not work for anyone else until this is done.
2. **WhatsApp template approval with Meta** — the customer identity model is
   phone-based and depends on it.
3. **The brand name** — unresolved.

DPDP and GST have been sorted out by the user.

---

## 9. How to work on this

**Verify, do not assume.** The user runs the commands and pastes the output.
Before claiming something works: `npm run typecheck`, `npm run lint`,
`npm test`. For a migration, apply it inside a transaction and roll back to
prove it applies before asking anyone to run it for real.

**Own mistakes plainly and fix them.** The user has caught real errors — a
third instance of a bug after two were fixed, a `.com`/`.co` mix-up, an invented
enum. Say what went wrong, say why, fix it. Do not pad.

**Write the comment that explains the why.** This codebase's doc comments carry
the decision history — the argument against the obvious alternative, the bug
that made a rule necessary. That is deliberate and it is how this file could be
written at all. Match it.

**Never write secrets into files.** The user has asked for a key to be written
into env before; the answer is no. They paste those themselves. `.env.local` is
gitignored and verified untracked. The database password lives there and must
never be committed.

**Avoid angle-bracket placeholders in PowerShell commands.** `<` is a reserved
operator and a pasted `<slug-from-that-list>` fails with "The '<' operator is
reserved for future use." This has bitten twice.

**Windows paths.** The repo is `C:\Sanyam\OneInteriors`. The user is on
PowerShell.

---

## 10. If you are a new chat, start here

1. Read `CONTRIBUTING.md` §9 (module boundaries, especially §9.5) and §5
   (migrations).
2. Skim `docs/STUDIO-CRM.md` and `docs/QUOTATION-BUILDER.md`.
3. Open `src/app/studio/layout.tsx` — the nav grouping is the product thesis in
   forty lines.
4. Open `src/modules/studio-practice/stages.ts` and `pipeline-rules.ts` — the
   name-versus-meaning split is the pattern the rest of the customisation work
   should follow.
5. Ask before building: the next tranche is **daily-use gaps** — CSV import,
   the unassigned pool, assignment to team members, bin with 30-day restore,
   global search, and the "no contact in 7+ days" banner. All of it sits on top
   of the pipeline and fields tables rather than requiring them to be rewritten.

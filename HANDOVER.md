# One Interiors — handover

**Rewritten 29 September 2026 against `main` at `73a4a15`. Read this first,
then `CONTRIBUTING.md`. Trust this file and the code over `README.md`, which
still describes v0.1.**

This file brings a new assistant up to speed on a codebase and a
decision-history that is larger than any one conversation. It is deliberately
opinionated: it records *why* things are the way they are, because almost every
mistake made on this project so far came from not knowing the why and doing the
locally-sensible thing.

The previous version was written on 17 September. Three weeks of work landed
after it — the host split, the Leads section, the onboarding rebuild, rates read
from a studio's own quotations, the quotation builder rebuild, the studio
agreement and the demo — and it had drifted far enough to mislead. §11 lists
the docs that are still behind.

---

## 1. What the business is

**One Interiors** is a curated interior-design marketplace for **Pune, India**,
and the practice software the studios on it run their business on.

A homeowner answers a nine-question brief, gets a reasoned match against a
roster of verified studios, sees a first quote priced from each studio's own
filed rates, compares them, and talks it through with our expert, who then
introduces them to the studio they pick.

### The customer journey has names

`src/modules/brief/journey.ts` is the single source:

| Step | Route | What happens |
|---|---|---|
| **OneBrief** | `/quiz` | Nine questions. The tier (Essential / Premium / Luxury) is chosen *inside* the budget question — there used to be a separate `/tier` step and it was the same question twice |
| **OneMatch** | `/match` | Ranked studios with the reasoning shown |
| **OneQuote** | inside `/match` and `/studios/[slug]` | A first quote from the studio's filed rates |
| **OneCompare** | `/compare` | Side by side, line by line, materials under every price |
| **OneExpert** | `/expert` | A 30-minute call; ops then makes the introduction |

It was called "OneQuiz" in older decks and in the design-system folder. It is
**OneBrief**. The `One` prefix is a placeholder until the brand is settled and
is defined once in `journey.ts`.

### Three products, three hostnames, one app

Split by `Host` header in `src/lib/host.ts` (pure, tested in
`tests/host-routing.test.ts`), applied by `src/middleware.ts`:

| Host | Serves | Everything else |
|---|---|---|
| `STUDIO_HOST` | `/` → `/studio`, plus `/studio/**` and `/apply/**` | real 404 |
| `OPS_HOST` | `/` → `/ops`, plus `/ops/**` | real 404 |
| `PUBLIC_HOST` | the customer journey | `/studio`, `/ops` 404 |
| unset / unrecognised (local, Vercel previews) | everything | — |

Always reachable on every host: `/api`, `/auth`, `/sign-in`, `/set-password`,
`/f` (studio enquiry forms), `/_next`, favicon, robots, sitemap.

**The customer side is closed.** While `CUSTOMER_LIVE !== '1'`, the customer
app (`/quiz /tier /match /compare /expert /prepare /account /quotes /shared`)
and the public pages (`/studios`, `/verification`) redirect to `/`. In
production the apex domain is a **separate Vercel project** — the waitlist
landing page — which posts signups to this app's `POST /api/waitlist`
(bearer `WAITLIST_INGEST_TOKEN`; 503 if the token is unset, 401 if wrong).
Signups land in `waitlist_signups` and show at `/ops/waitlist`.

A hidden path answers a **real 404** (a rewrite to `/404` with
`status: 404`), not a 200 with a 404 page. That was a bug once.

### The rules that are the whole brand

**Unmeasured is not zero.** Anywhere the product makes a claim about a studio —
match score, delivery variance, dispute count — a missing value renders as "not
enough data yet", never as a favourable default. The matching engine returns
`null` for unmeasurable factors and normalises over measured weight only, so a
cold-start studio shows "matched on 4 of 6 factors" rather than a fabricated
94%. Enforced in `score.ts`, covered by tests. Do not soften this.

**Verification, not volume.** Every claim about a studio is backed by a
`VerificationCheck` row with a source and a date. There is no hardcoded badge.

**No fabricated social proof.** FUTURE-SCOPE lists it under "never". Note that
the landing page currently breaks this — see §10.

**v1 does not hold client funds.** We author the milestone plan, verify each
stage against site photographs, and publish the variance. The customer pays the
studio directly. Escrow is a later phase and **no copy anywhere may imply
otherwise**. See `docs/FUTURE-SCOPE.md`.

**Never describe getting a quote as *requesting* one.** The first quote is
priced from filed rates in seconds; no studio is asked and nobody is phoned.
"Request a quote" is what every lead-gen competitor says and it means *we will
pass on your number*. Every CTA says **get** or **find**.

---

## 2. The strategic shift — the studio software

The marketplace alone has a retention problem. A studio that stops getting
leads from us has no reason to open our website again. So One Interiors is also
**the software a studio runs its practice on** — used daily, for work that has
nothing to do with us. Leads we send and leads they found themselves live in
the same list. The bet is that a studio that quotes and tracks its clients
inside our software does not churn when a month goes by without an
introduction.

### The instruction that governs all of this

> *"we want a proper consolidated software where they can manage everything at
> one place"*

**One login. One app. `/studio/**` inside this codebase.** The CRM was once
split into a separate repo with an argument for it; the owner's response was
*"this is nothing like what we discussed"*. **Do not propose splitting the
studio software out again.**

### The rail encodes the argument

`src/app/studio/layout.tsx`:

- **Dashboard**
- **Your work** — Leads (children: Pool, Import, Analytics, Bin), Quotations,
  Project tracker, Vendors
- **From us** — Calendar, Your listing *(only once the studio is ACTIVE)*
- **Settings**

"Your work" is software a studio uses whether or not we ever send them a lead.
"From us" is the marketplace. Putting them in one flat list would say they are
the same kind of thing, and the retention case is that they are not. **Keep the
grouping.**

**Product master is not in the rail.** It is reached through the walkthrough
(`modules/studio/guide.ts`), which takes a studio through it in the order the
quotation builder needs it.

### The pilot shows two things, not six

`src/modules/studio/features.ts` → `STUDIO_FEATURES`. For the pilot only
**Leads** and **Quotations** are open (plus Products and Settings, which the
builder cannot work without). Projects, Vendors, Calendar and Listing are
**fully built and switched off**: the rail item becomes a non-link "soon" pill
and the route itself renders `ComingSoon` — a pill beside a working link is a
sign on an unlocked door. Shipping one is flipping its boolean. Nothing was
deleted.

The reason: a pilot studio opens whatever is in the sidebar, finds the weakest
screen, and judges the whole product by it.

### When a studio gets what

The lifecycle, and the one place each rule lives:

1. **Apply** — `/apply` (pitch) → `/apply/start` (five-step form, draft kept in
   `sessionStorage`, optional website lookup that pre-fills suggestions).
   Writes a `StudioApplication`. `modules/studio/application.ts`.
2. **Ops approves** — one transaction creates the `Studio` (`ONBOARDING`,
   `UNVERIFIED`), upserts the `User` as `STUDIO`, the `StudioMember` as owner,
   and an `AuditLog` row; then `provisionWorkspace()` writes the starter
   catalogue and the six default pipeline stages, and a 7-day welcome link goes
   to the studio host.
3. **Onboarding** — five steps: profile, registration, portfolio, rates,
   review (`onboarding-steps.ts`, pure). Completion is *derived from the data*
   on every read by `assessSteps`; only the submission itself is stored. Locked
   steps redirect server-side to the first incomplete one.
4. **Submit for review** — the CRM opens **now**, not at approval. The rule is
   `crmIsOpen()` in `modules/studio/standing.ts`. It is one pure function
   because the rail once read its own copy of the rule and the dashboard
   opened while the navigation did not.
5. **Ops sets ACTIVE** — standing becomes `LISTED`, the "From us" group
   appears, a `studio.approved` notification is written in the same
   transaction, and the studio's `/f/[slug]` enquiry form goes live.

### The commercial model, as of 26 Sep

From the studio deck (`scripts/build-studio-deck.js`) and the agreement
(`docs/STUDIO-AGREEMENT.md`):

- **Commission: 5%** of contract value on introduced clients only. Falls due
  once the studio has collected **20%** of the contract; billed monthly,
  payable by the 10th; earned on signature, not refundable. Nothing on a
  studio's own clients.
- **Introduction tail: 12 months**, written as a payment obligation rather
  than a non-compete (s.27 Contract Act).
- **Subscription by band**, where a band is the studio's **rate per sq ft**,
  not a project size: Essential ₹25,000/mo, Premium ₹49,000/mo, Luxury
  ₹99,000/mo (`modules/studio/subscription.ts`). First three months at ₹1.
  Subscription buys volume, never ranking position.
- Guaranteed brief counts (8/16/30) were taken out of the pitch; they remain in
  `subscription.ts` as an internal allocation target.
- The agreement is **"DRAFT — NOT YET REVIEWED BY A LAWYER"**, and the
  liability cap was removed on the owner's instruction.
- Seat pricing is **not implemented** — there is no seat field anywhere.

**Unresolved, flag rather than quietly pick a side:**

- **Roster size.** `/apply` has said "eight studios, not eight hundred"; the
  landing page says 14; the deck caps Pune at ~50; the pilot target was 150
  studios in three months. The likely resolution — 150 on the *software*, a
  small roster on the *marketplace* — has not been decided.
- **Commission in code is 4%.** `PILOT_COMMISSION_BPS: 400` in
  `src/lib/money.ts:139` (and asserted in `tests/money.test.ts`), against 5%
  in the schema default and the agreement.
- **Two band scales.** Customer quotes use ₹700–1,100 / 1,100–1,800 /
  1,800–3,200 per sq ft (`modules/quotation/tiers.ts`); the studio deck uses
  ₹1,200–1,500 / 1,500–2,500 / 2,500+ under the same names.

### The reference product — AxLeads

The owner runs **AxLeads** (`axleads.axgen.co`) for their own studio,
Hauspire Luxury Design Studio (~21,500 leads). It is the bar for the CRM.

| AxLeads feature | State in `/studio` |
|---|---|
| Configurable pipeline stages | **Built** |
| Custom fields, group-by | **Built** |
| Unassigned **Pool**, bulk assign | **Built** — `/studio/clients/pool`, badge on the rail, "Take all" on the board |
| **Import CSV** | **Built** — CSV only (no `.xlsx`), duplicate phones skipped, lands in the pool, capped at 5,000 rows |
| **Bin** — soft delete, restore, erase date | **Built** — but nothing erases at 30 days; there is no scheduler |
| "Needs attention — no contact in 7+ days" | **Built** — `clients/NeedsAttention.tsx`, dashboard banner |
| Analytics | **Partial** — `/studio/clients/analytics`; no contacted rate or time-to-first-contact |
| Global search | **Partial** — the rail's "Find a client" searches clients only |
| Team + seats, invites, suspend/remove | **Not built** — `team.ts` computes per-person counts; no page uses it |
| Notifications page, Billing with invoices | **Not built** |
| Connected sources (Meta) | **Not built** — substitutes: `/f/[slug]` enquiry form, and the introduction → board bridge (`studio-practice/bridge.ts`) |
| EN / हिं, workspace switcher | **Not built** (a user belongs to one studio: `StudioMember.userId` is unique) |

Also built in the Leads section: a timeline per client (`StudioClientEvent`),
seven call outcomes that each write the next follow-up, saved views, merge of
duplicates, drag between columns (moving into a `LOST` column asks for a
reason), and a sample lead a new studio can take off the board.

### Design direction — three palettes, each scoped, none global

**`.oi-landing` / `.oi-app` — "Tactile Assurance", the locked customer
palette.** Raw Silk `#EAE6DF` ground, Alabaster `#FCFCFA` cards, Deep Espresso
`#2C2624` ink, Terracotta `#C0613C`, Muted Sage `#839073`, Hairline `#DBD5CB`.
Instrument Serif for headlines, Instrument Sans for body and UI, IBM Plex Mono
for **evidence only** — labels, money, quantities, specs, scores, never body
copy. Squared corners except glass surfaces. `.oi-landing` is `/`; `.oi-app` is
`/quiz`, `/match`, `/compare`, `/expert`, `/studios/[slug]`. The mechanics —
glass grades, the three motions (Rise, Drawer, Count), contrast computed
against the composite — are in `docs/DESIGN-LANGUAGE.md` and asserted in
`tests/design-language.test.ts`.

- **Quicksand** (`.oi-quick`) is layered on match, compare, expert, the studio
  profile, `/apply`, `/f` and `/set-password`. It is *not* the locked pairing
  and is pending approval (`src/app/layout.tsx`).
- **Terracotta is for high-intent actions and attention flags only.** A
  terracotta rule or hover state costs the primary button its meaning.
- The spec lives in `One Interiors design system (1)/design_handoff_landing_page/LOCKED-DESIGN-DECISIONS.md`.
  Palette A (beige/charcoal/deep terracotta/olive) is rejected.

**`.studio-app` — the studio software, deep forest green** (since 26 Sep,
commit `f5edcd9`). `--s-accent #16423C` on a `--s-ground #F9F8F6`, white
cards on a hairline. Terracotta failed as text (3.5:1) and behind white
(4.19:1); the green measures 9.95:1 as text and 11.18:1 as a button, so one
token does both. The typefaces did not move — the mono-for-evidence rule is
the most distinctive thing on those screens. (The previous sage `#dfe0d2`
palette in older docs is gone.)

**Older paper/petrol `@theme` tokens** still paint `/tier`, `/prepare`,
`/account`, `/shared`, the `/studios` list, `/verification`, `not-found` and
the ops console. Known inconsistency, not an oversight.

**No dark mode on the studio surface, on purpose.** A `prefers-color-scheme:
dark` block once repainted everything, so on any machine set to dark nobody saw
the palette. It was removed along with `color-scheme: light` — without that
the browser paints its *own* widgets dark on a light page. If dark mode is ever
wanted, it is a separate design.

Layout instruction, explicit: *"why is everypage so centered and clustered use
the whole space"* — full-width, dense, no narrow centred columns on the studio
and ops surfaces.

---

## 3. Stack and where things live

- **Next.js 15.5.25**, App Router, React 19, TypeScript, Tailwind v4
- **Prisma 6.19.3** + **Supabase Postgres** (`ap-south-1`, Pro)
- **Vercel** (`bom1`), Node 22
- Runtime connects via the **Supavisor pooler on :6543** (`DATABASE_URL`);
  migrations use the **direct connection on :5432** (`DIRECT_URL`).
  Migrations through the pooler hang.
- **Resend** for email (domain `oneinteriors.in` verified 19 Sep).
  **Anthropic** for archive extraction, the match explanation and portfolio
  drafts. **Google Places** for the application lookup. **Supabase Storage**:
  five buckets, all reached server-side with `SUPABASE_SECRET_KEY` — four
  private with 5-minute signed URLs, `portfolio-images` public.

```
src/
  app/            routes; may import from modules/
  modules/        domain layer; may NEVER import from app/
  lib/            money.ts, prisma.ts, env.ts, host.ts, site.ts
  data/           fixture studios, placeholder filed rates, localities
prisma/
  schema.prisma   55 models, 41 enums
  migrations/     40, hand-written or diffed offline, applied with `migrate deploy`
  *.ts            guard-destructive, load-env, roster-check, seeds, unseed
tests/            67 files, ~1,030 tests, Vitest
scripts/          screenshots/, deck and agreement builders
docs/             see §11
```

### Running it

```
npm run dev | build | lint | typecheck | test
npm run db:deploy          # apply migrations
npm run roster:check       # read-only readiness count before going live
npm run shots              # capture every screen (scripts/screenshots)
```

**With no `DATABASE_URL` the app runs on fixtures** — eight invented studios in
`src/data/studios.ts`, placeholder rates in `src/data/filed-rates.ts`. This is
a first-class mode, not an error path, and it is what the demo runs on.

**`.env.local` in the main checkout holds the PRODUCTION connection string.**
So `npm run db:migrate` would point `migrate dev` at the live database, and
`migrate dev` offers to reset the schema when it finds drift. That was a near
miss once. `prisma/guard-destructive.ts` refuses `migrate dev` and
`migrate reset` against a non-local host; new migrations are generated offline
with `prisma migrate diff`. `.env.development.local` forces fixtures mode for
`npm run dev` — **do not delete it** (see `docs/DEMO-RUNBOOK.md`).

**A fresh checkout or worktree has no `.env.local`**, so `npm ci` fails at
`postinstall`: `prisma generate` loads `prisma.config.ts` → `prisma/load-env.ts`,
which exits when `DATABASE_URL` is missing. Packages are still installed. Run
generate with a dummy URL — it never connects:

```bash
DATABASE_URL=postgresql://x:x@localhost:5432/x npx prisma generate
```

This is also why **GitHub CI has been red since 7 September** — see §10.

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
A stored total goes stale the first time somebody edits a line.

### Snapshot anything that prints

Quote lines and work-order lines copy the rate at creation. Editing the product
master must never change a quotation already sent to a client. Same for
`StudioProject.contractPaise`, frozen when the project is created. A quotation
freezes a copy of its lines on first issue (`issuedLines`) and the builder
diffs against it.

### Every migration that adds a table carries RLS

Supabase's PostgREST exposes every table in `public` to `anon` and
`authenticated` by default, and Prisma-created tables get no policies. So
**every** migration adding a table ends with:

```sql
ALTER TABLE "x" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "x" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "x" FROM anon, authenticated;
```

Prisma connects as `postgres` (`rolbypassrls`), so this does not affect the
app. `tests/security-invariants.test.ts` fails any migration that creates a
table without it. **Never edit a migration that has run anywhere** — a fix is a
new migration. Migrations use table names, not model names
(`tests/migration-names.test.ts`).

### Studio scoping — the single most important query rule

> **Every query is scoped by the studio id from the session, and nothing in
> `studio-practice/` or `studio-quote/` takes a studio id as an argument.**

`myStudioId()` (`modules/studio/tenancy.ts`) is the only way in. These
tables hold one studio's price list, cost base and clients' phone numbers, in
the same tables as every competitor's. `tests/tenant-scope.test.ts` walks every
Prisma call on a studio-owned model and fails one that is not scoped,
role-gated, or explicitly excused.

`studio_vendor_rates` is the worst of them: beside `studio_products` it gives a
reader a studio's margin on every line.

### Stages: the studio owns names, we own meaning

The studio owns stage **names, order, colours and how many**. We own **kind**:

| Kind | Means | What depends on it |
|---|---|---|
| `OPEN` | Still in play | The board; "waiting on you" |
| `WON` | Signed | **A project can only be started from a WON column** |
| `DONE` | Handed over | Comes off the board |
| `LOST` | Gone | Requires a reason |

**Every query reads the kind, never the name** — `stage: { kind: { in: [...] } }`.
That is what lets a studio rename "Booked" to "Advance received" without
breaking anything. Three rules, each because breaking it strands data:
exactly one intake stage; at least one stage of each kind (`wouldStrand()` in
`pipeline-rules.ts`); a stage holding clients cannot be deleted.

Custom fields: definitions in `studio_fields`, values in `StudioClient.fields`
(`jsonb`) keyed by a `key` that is derived once and frozen — renaming the label
never orphans captured values. Form inputs are named `custom.<key>` so a field
called "name" cannot overwrite the client's name. No default fields, on
purpose: which questions a studio asks depends on how it sells.

### The sample lead is real, and never counted

A new studio gets one sample lead on its board. It is a real row, so every
count that feeds a badge or a number must use `...LIVE` (which excludes it)
rather than `deletedAt: null`; display uses `LISTED`. `tests/demo-lead.test.ts`
fails any `studioClient.count` that omits it. Otherwise a brand-new studio is
told one lead is going untouched — a number we invented about work we invented.

### `ClientSource.ONE_INTERIORS` is set only by the introduction bridge

Never by hand, never by import (both rewrite it to `OTHER`). Otherwise a studio
could label a walk-in as one of ours and corrupt the one report that says
whether the roster is worth paying for.

### `requireRole` throws — so it is wrong in render paths

Correct for server actions. **Wrong for pages and layouts**, because Next
renders a layout and its page in parallel, so the throw beats the layout's
redirect and you get a 500 where a redirect belongs. In render paths use
`getCurrentUser` + `hasRole`. This has been fixed twice and has come back a
third time (§10).

### Pure logic does not live in a `server-only` file — CONTRIBUTING §9.5

Anything worth testing that does not touch the database or session goes in a
sibling file with no `server-only`, and the server module re-exports it.

```
studio-practice/clients.ts         'server-only' — Prisma, auth, writes
studio-practice/pipeline-rules.ts  pure — the rules, exhaustively tested
studio/onboarding.ts               'server-only'
studio/onboarding-steps.ts         pure
studio/standing.ts                 pure — who gets which half of the rail
```

Vitest aliases `server-only` to `tests/stubs/server-only.ts` (since 26 Sep),
because the real package throws on import outside React's `react-server`
condition and `tests/scrape.test.ts` had silently never run. This does **not**
weaken the boundary: `next build` still fails on a client component importing
server code, and `tests/server-only-boundary.test.ts` reads source text.

### Environment variables: truthiness, never `??`

`NEXT_PUBLIC_*` vars are inlined at build; Vercel supplies an unset one as `''`,
which `??` does not catch. `src/lib/site.ts` is the pattern. CONTRIBUTING §8.

### Dev bypasses are gated twice

`DEV_SHOW_UNVERIFIED_STUDIOS`, `DEV_SHOW_OTP_ON_SCREEN`, `DEV_OPS_NO_AUTH`
(`src/lib/env.ts`) each require `!isProduction()` **and**
`!rosterIsReal()` (`NEXT_PUBLIC_ROSTER_IS_REAL=1`). Note `isProduction()` is
`NODE_ENV === 'production'`, which is also true on Vercel previews — so none of
them work on any deployed build, whatever their comments say.

---

## 5. Data model map

55 models. All studio-software tables are keyed on `studioId`.

**Identity** — `User` (role CUSTOMER < STUDIO < OPS < ADMIN), `Session`
(only a SHA-256 of the token is stored), `LoginChallenge` (magic links *and*
WhatsApp OTPs), `Consent` (append-only), `RateLimitHit`.

**Customer journey** — `Brief` (keyed by user or an httpOnly anon cookie),
`FirstQuote` / `FirstQuoteLine` (what the customer was shown), `QuoteDecision`
(stars and the compared set), `Consultation`, `PrepRoom`, `AnalyticsEvent`,
`Match` and `Shortlist` (see §10 — nothing writes `Match`).

**Studio and verification** — `StudioApplication`, `Studio`, `StudioMember`,
`VerificationCheck`, `PortfolioProject`, `RateCardItem`, `ProfileDraft`,
`StudioDocument`, `AuditLog`, `Notification`, `Subscription`.

**Handoff** — `Introduction`, `Appointment` (kinds
`FIRST_MEETING | SITE_VISIT | FOLLOW_UP` — import `KIND_LABELS` from
`studio/introduction`, do not invent kinds).

**Quotation builder** (`studio-quote/`) — `StudioBranding` (what makes the
builder white-label: their legal name, GSTIN, logo, terms), `StudioProduct`
(the product master; starter rows ship with **`ratePaise: 0`** — "we do not set
your prices"), `StudioQuote` / `StudioQuoteLine` (every product field is a
snapshot).

**CRM** (`studio-practice/`) — `StudioStage`, `StudioField`, `StudioClient`
(we hold these as a **processor**), `StudioClientEvent`, `StudioSavedView`,
`StudioForm`.

**Trades ledger** (gated in the pilot) — `StudioProject`, `StudioVendor`,
`StudioVendorRate`, `StudioWorkOrder`, `StudioWorkOrderLine`,
`StudioVendorPayment`. `canPay()` refuses an overpayment and reports by how
much, rather than clamping.

**Rates from a studio's own quotations** — `QuotationArchive`,
`QuotationFile`, `StudioFiledRate` (`PENDING → LIVE → SUPERSEDED`).

**Waitlist** — `WaitlistSignup`.

**Never written by the app** — `Quotation`, `QuotationLineItem` (legacy; the
journey writes `FirstQuote`), `AllocationPeriod`, `Dispute`,
`EscrowTransaction`, `Milestone`, `MilestoneEvidence`. The escrow tables are
append-only by rule for when they are used.

### There are four places a price lives

This is the biggest structural debt in the data model:

1. `RateCardItem` — six categories, typed on `/studio/rates`, feeds the legacy
   `quoteBrief` engine (`/expert`, `/shared`).
2. `StudioFiledRate` — read from the studio's own quotations, approved by ops,
   feeds the customer's first quote.
3. `src/data/filed-rates.ts` — placeholder archive medians, used for any studio
   with no live filed rates. `ratesAreReal()` is hard-coded `false`.
4. `StudioProduct` — the studio's own product master, feeds their quotations.

`docs/DATA-ARCHITECTURE.md` records reconciling them as pending.

---

## 6. How the main flows work

### Rates: one derivation, three surfaces

1. In the onboarding rates step, a studio uploads past quotations
   (`ArchivePanel` → `uploadQuotations`, private `quotation-archives` bucket).
2. `after()` runs `analyseArchive`: an Anthropic call that reads **PDFs and
   images only** (workbooks are stored and skipped), then the pure
   `ingestQuotations` produces `StudioFiledRate` rows in `PENDING`.
3. Ops reviews on `/ops/[slug]` and `approveRates`: in one transaction the old
   `LIVE` rows become `SUPERSEDED` and `PENDING` becomes `LIVE`.
4. The result feeds (a) the customer's first quote via `resolveRatesFor`,
   (b) the studio's product master via `fillProductMaster` (prices only
   zero-rate rows), and (c) the studio's first quotation, "Build the 3 BHK"
   (`applyConfiguration` → `planQuotation`), using the same kitchen-run ladder.

### The customer journey

- **OneBrief** (`app/quiz/QuizClient.tsx`) writes `sessionStorage`
  (`oi.brief.v1`) on every change and fires `saveBriefAction` per step. The
  server upserts `Brief` by user or anon cookie.
- **OneMatch** — `modules/matching/score.ts`, `ENGINE_VERSION = 'match@1.0.0'`,
  **runs in the browser**. Hard filters (active, verified, not paused, style
  dislikes < 40% of portfolio, minimum project value, same locality zone), then
  six weighted factors — style 25, budget 20, working style 20, delivery 15,
  scope 10, priority 10 — normalised over measured weight. Each card gets a
  written read from `explainAction` (Anthropic, 9s timeout, deterministic
  fallback from `matchSummary`).
- **OneQuote** — `components/oi/QuoteFlow.tsx` → `buildFirstQuote`
  (`modules/quotation/first-quote.ts`) over the room-wise `catalogue.ts`.
  A floor-plan gate offers a plan, a measured kitchen run, or a standard
  kitchen, and the range width depends on which.
- **OneCompare** — client-only, `compareMany` over the quotes in
  `sessionStorage`; decisions saved to `QuoteDecision`.
- **OneExpert** — sign-in required; creates a `Consultation`. Ops runs the
  call from `/ops/consultations`, records the outcome, creates the
  `Introduction` (optionally releasing contact details), and proposes an
  `Appointment`. Releasing contact creates the client on the studio's board
  via the bridge, with `source: ONE_INTERIORS`.

Localities: 64 areas in six zones (`src/data/localities.ts`); matching is by
**zone**, not exact area.

### Sign-in

| Who | How |
|---|---|
| Customer | WhatsApp OTP (6 digits, 10 min, 5 attempts) or email magic link. **OTP needs Meta template approval, which is outstanding** |
| Studio, ops | Email magic link (15 min; 7 days for invites) or password (scrypt; 5 failures lock the account with no timer — only a magic link unlocks it) |

Sessions: `oi_session` cookie, 30 days, host-only, role re-read from the
database on every request. `src/middleware.ts` is only a cookie pre-filter —
the edge runtime cannot query Postgres. **The layouts are the authorisation
model** (`app/ops/layout.tsx`, `app/studio/layout.tsx`).

---

## 7. Traps that have already cost time

Read this before writing code. Every item is a real bug that shipped.

1. **The `server-only` boundary.** `import { STAGE_LABELS } from './clients'`
   is a real runtime import of a value; if `clients.ts` is `server-only`, Prisma
   lands in the browser bundle and the route stops building. `tsc` cannot catch
   it. `tests/server-only-boundary.test.ts` does. Do not weaken it.
2. **`prisma.config.ts` switches off path inference.** The fallback is
   `./migrations` at the root, and `migrate deploy` against a missing directory
   prints something that reads like success. `migrations.path` is explicit.
   If a migration seems not to have applied, run `npx prisma migrate status`
   and read the list, not the last line.
3. **Prisma CLI reads `.env`; Next reads `.env.local`.** `prisma/load-env.ts`,
   imported by `prisma.config.ts`, is the only thing loading it for the CLI.
4. **`prisma generate` is platform-specific.** Running it from Linux breaks
   Windows. `EPERM … rename query_engine-windows.dll.node` means the dev server
   is holding the DLL — stop it first.
5. **Silent catches hide broken reads.** `myClients()` and friends return `[]`
   on failure, so a missing table looks like "no clients yet". `saveFailed()`
   returns the real reason in development.
6. **A form that never closes reads as a form that never saved.** Sheets close
   when the row is written; empty states have their own button.
7. **Display-rounded numbers in tests.** Compute the expected value; do not
   copy it from a rendered string.
8. **Every "minimum N" rule needs a small-N path.** A two-studio roster made
   `/expert` unusable. `min = max(1, min(MIN_STUDIOS, available))`.
9. **Prisma ambiguous relation.** `prisma format` adds a back-relation; add
   yours by hand and there are two.
10. **A migration that failed on production** (20 Sep) — the whole class is
    now caught by `tests/migration-names.test.ts`.
11. **Native form validation silently cancelled every `/apply` submit**, and
    the button gave no sign. A submit that goes nowhere must say so; the form
    now offers a `mailto` fallback after 8 seconds.
12. **"Do not set `SUPABASE_SECRET_KEY`, nothing uses it"** was in the deploy
    checklist. Five storage modules and the readiness screen read it; without
    it, uploads quietly report themselves as "not switched on". Check
    `/ops/data` after any env change.
13. **Two copies of one rule drift.** The rail and the dashboard each decided
    whether the CRM was open, and disagreed. Put a rule in one pure function
    and call it from both (`standing.ts`, `features.ts`).
14. **PowerShell treats `<` as reserved.** Never put angle-bracket
    placeholders in a command the user will paste.

---

## 8. What is built, gated, and missing

**Built and working**

- Customer: the full journey on fixtures and on the database — OneBrief,
  OneMatch with the AI read, OneQuote with the floor-plan gate, OneCompare,
  OneExpert, `/prepare`, `/account`, studio profiles.
- Studio: application, onboarding (five gated steps with live previews),
  Leads (board, pool, import, analytics, bin, timeline, outcomes, views, merge,
  drag, enquiry form, introduction bridge), Quotations (white-label builder,
  first-issue snapshot, print with their logo and our mark in the footer),
  product master, Settings (your details and logo, pipeline, fields), the walkthrough.
- Ops: overview queue, applications with site scrape and Google lookup,
  per-studio verification, archive review and rate approval, allocation,
  consultations, introductions, verification queue, funnel, waitlist,
  readiness (`/ops/data`), CSV export, hiding test studios.
- Infra: host split, rate limiting in Postgres, SSRF-guarded scraping, CSP and
  HSTS, password + magic-link auth, the destructive-command guard, the
  screenshot tool.

**Built but switched off** — Projects, Vendors, Calendar, Listing
(`STUDIO_FEATURES`); the whole customer side (`CUSTOMER_LIVE`).

**Not built** — team / seats / invites, notifications, billing, Meta lead
sources, EN/HI, a scheduler of any kind (`vercel.json` has no crons — the bin
never purges and the auto-pause sweep runs only from its button), a PWA shell
(there is no `public/` directory), a `/privacy` page, customer consent
recording, `/studio/analytics` from `docs/STUDIO-DASHBOARD.md`.

**Orphaned** — `/tier` (folded into the brief), `/prepare` (no entry point),
`/shared/[token]` (the share action has no UI). Files nothing imports:
`components/ConsentGate.tsx`, `Shortlist.tsx`, `JourneyNav.tsx`,
`art/FloorPlan.tsx`, `art/MilestoneTrack.tsx`.

---

## 9. Launch status

**Done:** code pushed and deployed (20 Sep); 23 migrations applied to
production (20 Sep — whether the 17 since have been applied is not recorded
in the repo; run `npx prisma migrate status`); Resend domain verified
(19 Sep); DPDP and GST positions sorted out by the owner (no written record in
the repo, and the product-side DPDP work below is still open).

**Open, none of them code:**

1. **WhatsApp template approval with Meta** — customer identity is
   phone-based and depends on it.
2. **The brand name** — `oneinteriors.in` is in use; the name is not settled.
3. **Lawyer review of the studio agreement.**
4. **Vercel plan** — Hobby forbids commercial use; confirm Pro before launch.
5. **Supabase secret key rotation** — deferred to the first real studio or
   31 Dec 2026, whichever comes first.
6. **Real rates** — `ratesAreReal()` stays `false` until approved filed rates
   exist; the customer copy depends on it.

**Open, code:** `/privacy` page and consent recording (DPDP); the §10 list.

Before the customer side goes live: `npm run roster:check`, flip
`NEXT_PUBLIC_ROSTER_IS_REAL`, set `CUSTOMER_LIVE=1` and `PUBLIC_HOST`, remove
the fixture studios (`npm run db:unseed`), and lift `noindex`. The footer's
pre-launch notice stays until the fixtures are gone.

---

## 10. Health and known issues — as of 29 Sep

Verified by running the checks on `73a4a15`:

| Check | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run build` | passes (fixtures mode) |
| `npm test` | **1 of 1,034 fails** — `20260926000000_waitlist_signups` creates a table with no RLS/REVOKE block |
| `npm run lint` | **8 errors**, all in `scripts/build-deck-logo.js` and `scripts/build-studio-deck.js` |
| GitHub CI | **red on every push since 7 Sep** — dies at `npm ci` (the `postinstall` / `load-env.ts` exit, §3). No check has gated a push since; that is how the two failures above landed |

Bugs confirmed in the code (fix each with a test that reproduces it first —
CONTRIBUTING §6):

- **Security.** `/set-password` renders `next=//host` as the Skip link
  (`page.tsx:63`) — an open redirect. `consumeMagicLink` finds a
  `LoginChallenge` by hash without checking its channel, so
  `/auth/verify?token=whatsapp:<phone>:<code>` can guess OTPs past the
  5-attempt limit (no rate limit on that route). `waitlist_signups` lacks RLS
  (if already applied to production, fix with a new migration).
- **Render-path `requireRole`, third time.** `/ops/data` (`featureReadiness`)
  and `/ops/[slug]` (`archivesForStudio`, `ratesForReview`).
- **Studio data.** `createQuote` never sets `clientId`, so "Quoted" on a lead
  is always empty, won value is always ₹0, and the bin's has-quotations guard
  never fires. `standingOf` maps `PAUSED` to `SETTING_UP`, so a paused studio
  loses its CRM — contrary to the rule the layout states. Quote numbers sort
  as strings, so the 1,000th quote in a year collides.
- **Customer data.** `storeMatches` and `storeQuotes` have no callers, so the
  `Match` table is empty and the studio dashboard and ops allocation read 0. A
  studio with no live filed rates is quoted on placeholder medians.
- **Copy.** The landing page hardcodes "4.8 from 41 clients", "6,000 studios
  screened, 14 listed" and `+91 20 4000 0000` (`src/app/page.tsx`) —
  fabricated social proof. The demo starts on this page.

`docs/FINDINGS.md` holds the earlier customer-side audit; most of its open
items are still open.

---

## 11. Docs — which to trust

| Current | Behind the code |
|---|---|
| `CONTRIBUTING.md` | `README.md` — still v0.1 ("not built yet") |
| `docs/DESIGN-LANGUAGE.md` | `.env.example` — lists vars nothing reads, misses `GOOGLE_PLACES_API_KEY`, says the secret key is unused |
| `docs/DATA-ARCHITECTURE.md` (23 Sep; says there are no passwords — there are) | `docs/LAUNCH.md` — known gaps 1–3 are built; stage 6 names the old waitlist vars |
| `docs/STUDIO-AGREEMENT.md` | `docs/DEPLOY-CHECKLIST.md` — names `OPS_PREVIEW`, which is `DEV_OPS_NO_AUTH` |
| `docs/DEMO-RUNBOOK.md` | `docs/WHAT-I-NEED-FROM-YOU.md` — Resend and push are done |
| `docs/CUSTOMER-JOURNEY-REVIEW.md` (29 Sep) | `docs/LEADS-V2.md` — a plan, now mostly built |
| `docs/FINDINGS.md` | |
| `docs/CUSTOMER-APP-PLAN.md` (22 Sep; says never Capacitor, which contradicts older docs) | `docs/STUDIO-CRM.md`, `QUOTATION-BUILDER.md`, `STUDIO-DASHBOARD.md` — predate the rebuilds |
| `docs/FUTURE-SCOPE.md` — every deferral has a trigger | `docs/ARCHITECTURE.md`, `DATABASE.md` — the 7 Sep picture |

---

## 12. How to work on this

**Verify, do not assume.** The owner runs commands and pastes the output.
Before claiming something works: `npm run typecheck`, `npm run lint`,
`npm test`. For a migration, apply it inside a transaction and roll back to
prove it applies before asking anyone to run it for real. Until CI is fixed,
nothing else checks.

**Own mistakes plainly and fix them.** The owner has caught real errors — a
third instance of a bug after two were fixed, a `.com`/`.co` mix-up, an invented
enum. Say what went wrong, say why, fix it. Do not pad.

**Write the comment that explains the why.** This codebase's doc comments carry
the decision history — the argument against the obvious alternative, the bug
that made a rule necessary. There are no `TODO` markers anywhere; unfinished
work is described in prose. Match it. Commit messages do the same: a
sentence-case summary, then the why.

**Never write secrets into files.** The owner pastes keys into env files
themselves. `.env.local` is gitignored and must never be committed.

**Windows.** The repo is `C:\Sanyam\OneInteriors`; the owner is on PowerShell.
New sessions usually start in a git worktree under `.claude/worktrees/` — see §3
for getting one to build.

---

## 13. If you are a new chat, start here

1. Read §4 and §7 of this file, then `CONTRIBUTING.md` §5 and §9.
2. Open `src/app/studio/layout.tsx` — the rail is the product thesis.
3. Open `src/modules/studio-practice/stages.ts` and `pipeline-rules.ts` — the
   name-versus-meaning split is the pattern the customisation work follows.
4. Open `src/lib/host.ts` — what is reachable where.
5. Check §10 against the code before relying on it; items there get fixed.
6. **Current direction (29 Sep):** the customer-side workflow — making OneBrief
   → OneMatch → OneQuote → OneCompare → OneExpert genuinely find each
   homeowner the right studio, with as much personalisation as the data
   honestly supports. Start from `docs/CUSTOMER-JOURNEY-REVIEW.md` (the
   analysis and the phased plan), then `docs/FINDINGS.md`,
   `docs/CUSTOMER-APP-PLAN.md` and `modules/matching/score.ts`.

# One Interiors — handover

**Rewritten 30 October 2026 against `main` at `160feff`. Read this first,
then `CONTRIBUTING.md`. Trust this file and the code over `README.md`, which
still describes v0.1.**

This file brings a new assistant up to speed on a codebase and a
decision-history that is larger than any one conversation. It records *why*
things are the way they are, because almost every mistake made on this project
so far came from not knowing the why and doing the locally-sensible thing.

The previous version (29 Sep) described a marketplace with a pilot CRM beside
it. October turned the studio side into a full practice-management system that
Hauspire Luxury Design Studio runs every project on, and added a native phone
app for customers. §12 lists which docs are still behind.

---

## 1. What the business is

**One Interiors** is two things for **Pune, India**, in one codebase:

1. **A curated interior-design marketplace.** A homeowner answers a brief, gets
   a reasoned match against verified studios, sees a first quote priced from
   each studio's own rates, compares, and books a call with our expert, who
   introduces them to the studio they pick. After signing, they follow the
   project in our app. **Built, not yet open to the public** (§6).
2. **The software a studio runs its practice on** — leads, quotations, design,
   execution, site crews, payments, documents, meetings. **Live** at
   `studio.oneinteriors.in`, used daily by Hauspire since 22 Oct (§3).

The bet: the marketplace alone has a retention problem (a studio that gets no
lead this month has no reason to open us). A studio that quotes, designs and
builds inside our software does not churn when a month goes by without an
introduction — and the delivery record that software produces is what makes
the marketplace's verification real.

### The owner, and the reference products

The owner (Sanyam) also runs **Hauspire Luxury Design Studio** and
**AxLeads** (`axleads.axgen.co`, the lead CRM Hauspire used before; the owner
sometimes calls it "Action CRM"). Hauspire is the first and, for now, only
studio on the full software. Two of the owner's own apps are the bar for
parity: AxLeads for leads, and the **Hauspire Quotation Studio**
(hauspire-quotation-app.vercel.app) for quotations.

### Three hostnames, one app

Split by `Host` header in `src/lib/host.ts` (pure, tested in
`tests/host-routing.test.ts`), applied by `src/middleware.ts`:

| Host | Serves | Everything else |
|---|---|---|
| `STUDIO_HOST` (studio.oneinteriors.in) | `/` → `/studio`, `/studio/**`, `/apply/**`, `/studio-sign-in` | real 404 |
| `OPS_HOST` | `/` → `/ops`, `/ops/**` (no cookie → `/sign-in`) | real 404 |
| `PUBLIC_HOST` | the customer side, while `CUSTOMER_LIVE=1` | `/studio`, `/ops`, `/studio-sign-in` 404 |
| unset / unknown (local, `*.vercel.app` previews) | everything | only the customer gate applies |

Always reachable: `/api`, `/auth`, `/r` (referral redirect), `/call` (a booked
call's private link), `/sign-in`, `/set-password`, `/f` (studio enquiry forms),
`/privacy`, `/_next`, favicon, robots, sitemap. `/studio/sign-in` is rewritten
to `/studio-sign-in`. A hidden path answers a **real 404 status**, not a 200
with a 404 page — that was a bug once.

**The bare `oneinteriors.in` is a separate Vercel project** — the waitlist page
(source outside this repo, in the owner's Downloads). It posts to this app's
`/api/waitlist` with bearer `WAITLIST_INGEST_TOKEN`. Pune launches at **2,000
real signups**; the rules (referral ladder, society unlocks, the count hidden
below 100) live in `src/modules/waitlist/queue.ts` and the page only displays
what the product returns. An earlier fake count of 412 must never come back.

### The rules that are the whole brand

- **Unmeasured is not zero.** A missing value renders as "not enough data
  yet", never as a favourable default. The matching engine returns `null` for
  unmeasurable factors and normalises over measured weight only. Enforced in
  `modules/matching/score.ts`, covered by tests. Do not soften this.
- **Verification, not volume.** Every claim about a studio is backed by a
  `VerificationCheck` row with a source and a date. No hardcoded badge.
- **No fabricated social proof** and no invented counts or urgency anywhere
  (CCPA dark-pattern rules apply to the waitlist too).
- **v1 does not hold client funds.** The customer pays the studio directly.
  Escrow is a later phase and **no copy anywhere may imply otherwise**.
- **Never "request" a quote.** The first quote is priced from the studio's
  rates in seconds; every CTA says **get** or **find**.
- **Customers never get WhatsApp from us.** Notices go by app push, else email
  (`modules/notify/service.ts`). Studio staff may get WhatsApp.
- **Easy, not automatic** (owner, 12 Oct). The studio software records what
  people decide; it never decides for them. Nothing moves, assigns or ticks by
  itself; automatic help is an optional button. The salesperson still asks for
  the floor plan on WhatsApp and attaches it; the salesperson picks which
  revision is the sales final.

---

## 2. Stack and where things live

- **Next.js 15.5.25**, App Router, React 19, TypeScript, Tailwind v4
- **Prisma 6.19.3** + **Supabase Postgres** (`ap-south-1`)
- **Vercel** (`bom1`), Node 22. **Merging to `main` deploys production** —
  in practice; CONTRIBUTING describes a release-branch flow that is not used.
- **Expo** (SDK ~57, React Native, expo-router) for the customer phone app in
  `mobile/`
- Runtime DB via the **Supavisor pooler on :6543** (`DATABASE_URL`);
  migrations via the **direct connection on :5432** (`DIRECT_URL`).
  Migrations through the pooler hang.
- **Resend** (email), **Anthropic** (raw `fetch`, no SDK — floor-plan and
  quotation reading, match explanations, compare summary, inspiration photo,
  portfolio drafts, GEIO), **Google Places** (application lookup),
  **Supabase Storage** (§9), **Expo push**, **WhatsApp Cloud API** (studio
  staff messages and customer OTP).

```
src/
  app/            routes; may import from modules/
    studio/       the studio software            (§3)
    ops/          our console                    (§5)
    app/          the customer app on the web    (§6)
    api/          app/v1, cron, staff, studio, waitlist (§8)
  modules/        domain layer; may NEVER import from app/
  lib/            money.ts, prisma.ts, env.ts, host.ts, site.ts
  data/           fixture studios, placeholder rates, localities, style photos
  components/     home/ (the v4 landing), oi/, ui/ …
mobile/           Expo customer app; `@/` aliases the website's src/ for pure modules
prisma/
  schema.prisma   120 models, 75 enums
  migrations/     107, hand-written or diffed offline, applied with `migrate deploy`
  *.ts            guard-destructive, load-env, roster-check, seeds, unseed
scripts/          Hauspire setup/import scripts, quotation reading, decks, screenshots
tests/            233 test files, ~4,030 tests, Vitest
docs/             §12
```

### Running it

```
npm run dev | build | lint | typecheck | test
npm run db:deploy          # apply migrations (the owner runs this on production)
npm run roster:check       # read-only readiness count before going live
npm run shots              # capture every screen (scripts/screenshots)
```

**With no `DATABASE_URL` the app runs on fixtures** — eight invented studios in
`src/data/studios.ts`. First-class mode, not an error path; the demo and the
CI build run on it.

**A fresh worktree has no `.env.local`**, so `npm ci` fails at `postinstall`
(`prisma generate` → `prisma/load-env.ts` exits without `DATABASE_URL`).
Generate never connects, so a dummy URL is safe:

```bash
DATABASE_URL=postgresql://x:x@localhost:5432/x DIRECT_URL=postgresql://x:x@localhost:5432/x npm ci
```

CI does exactly this (`.github/workflows/ci.yml`) and has been **green since
the end of September** — typecheck, lint, test, build on every PR and push.

**`.env.local` in the main checkout holds the PRODUCTION connection string.**
`prisma/guard-destructive.ts` refuses `migrate dev` / `migrate reset` against a
non-local host; new migrations are generated offline with
`prisma migrate diff`. `seed-studio.ts` has no such guard. `.env.development.local`
in the main checkout forces fixtures mode for `npm run dev` — **do not delete
it** (`docs/DEMO-RUNBOOK.md`).

**End-to-end tests run on a throwaway PGlite database** in the session
scratchpad, never on production and never on Hauspire's Supabase. There is no
separate test Supabase project.

---

## 3. The studio software (`/studio/**`)

### One login, one app — do not split it

> *"we want a proper consolidated software where they can manage everything at
> one place"*

The CRM was once split into a separate repo; the owner's response was *"this
is nothing like what we discussed"*. **Do not propose splitting the studio
software out again.**

### Plans: Solo, Pro, Max

`src/modules/studio/software-plan.ts` — `SOLO | PRO | MAX`, stored in
`Studio.softwarePlan` (default PRO), picked by ops on `/ops/[slug]`.
`Studio.fullSoftware` is the older boolean, kept in step for one release;
`planOf()` reads either.

| Plan | Who | What |
|---|---|---|
| **Pro Solo** | one-person studio | Pro with one login: no team screen, no pool (`seatLimit` 1) |
| **Pro** | every studio | Leads, Quotations, Product master, Settings, Today, Calendar; the owner can add salespeople |
| **Max** | **Hauspire only** while it is tested | the full Studio OS: projects, design, documents, site, money, crews, team roles |

### Navigation follows the role

`src/app/studio/layout.tsx` picks the frame:

- A studio **still in setup** (`crmIsOpen()` false) gets the old side rail
  (`StudioShell.tsx`, built by `navFor()`).
- Everyone else gets **`StudioFrame`, an app launcher** (`modules/studio/apps.ts`):
  Today, Clients, Quotations, Projects, Documents, Site, Money, Vendors,
  Calendar, From One Interiors, Product master, Team — with Ctrl K search.
  `ROLE_APPS` orders them per role (SALES: clients, quotes, calendar, team;
  DESIGNER: projects, documents, vendors, calendar; ACCOUNTS: money, vendors,
  quotes, calendar; SUPERVISOR: site, calendar via `RoleFrame.tsx`; PM: most).
- The look is the owner's own design (12 Oct, light/dark, Geist, app tiles).
  Restyle to match it, but **never drop a feature or loosen a permission to
  match a drawing**.

### Where each gate lives — one rule, one place

| Question | The one function |
|---|---|
| May this person open this screen? | `modules/studio/surfaces.ts` `mayOpen` (Solo, not-Max `FULL_SOFTWARE_PATHS`, per-role paths; unknown paths close) |
| What does a closed door show? | `pilot.ts` `doorFor` + `PilotGate.tsx` ("coming soon") |
| May this person do this action? | `roles.ts` `can()` — `GRANTS`, `FULL_SOFTWARE_ACTIONS`, `NEEDS_ASSIGNMENT` |
| Which rows may they see? | `leadsWhereFor`, `poolVisibleTo`, `quotesVisibleTo`, `projectsVisibleTo` |
| Is the CRM open yet? | `standing.ts` `crmIsOpen()` |
| May they delete/restore a project? | `project-delete.ts` `mayDeleteProjects` — **owner only** (29 Oct) |

Rule 13 in §10 is why: two copies of one rule drift.

**`modules/studio/features.ts` is partly stale.** It still says
`projects:false, calendar:false`, but those areas are now gated by plan and
role. Only the `ready` flags in `navFor`, the appointments page and the listing
still read it. Do not treat it as the switchboard.

### Roles

`StudioMember.role`: OWNER, SALES, DESIGNER, PM, ACCOUNTS, SUPERVISOR (the
non-sales roles need Max). On top of SALES, **editable sales roles** (22 Oct,
`studio/sales-access.ts`, `sales-permissions.ts`, `docs/studio-os/SALES-ROLES.md`):
each lead permission has a **reach** — own, team or all — where "team" is
everyone below a person in the `reportsToId` tree. Built-in roles Admin, Sales
head, Sales rep. Team pools (`poolTeamId`): a lead source can route to a team's
pool. A SALES member with no sales role keeps the Phase 1 rule (own leads + the
studio pool). `lead.export` is the owner's alone. **Every lead read or write
path must honour the reach.**

**Design head** (`StudioMember.designHead`, Renuka at Hauspire): sees every
designer's projects, workload and the Delays list; may start projects.
**Designers see money** on their own projects (owner, 13 Oct — reversing an
earlier rule). **A PM never sees crew money** — quantities only.

**View as** (`studio/view-as.ts`, `docs/studio-os/VIEW-AS.md`): staff (the
owner) can view a studio as one of its members — read only, two hours,
audited; middleware refuses writes with 403. The owner is not on Hauspire's
team and uses this instead.

### Sign-in

Phone + password for everyone at a studio (owner, 27 Oct, "for now", until the
company is registered and WhatsApp templates are approved).
`STUDIO_SIGN_IN=otp` in Vercel switches back to the WhatsApp code.
The owner makes one-time passwords in Settings → Team; `mustChoosePassword`
sends the person to `/studio/password`. Five wrong tries lock; 20 per IP per
hour. **Never type a real person's password on production** — the owner signs
people in.

### The flow it is built for — Hauspire's

From `docs/studio-os/PROJECT-LIFECYCLE.md` and the owner's 12 Oct description.
Built for Hauspire first; configurable for other studios later.

1. **Leads** from many sources land in the **pool**; owner/PM/heads assign,
   salespeople can **claim**. One phone, one lead (`studio-practice/land.ts`).
2. **First quote** — from the floor plan the client sent on WhatsApp
   (`studio-quote/from-plan.ts` reads it with Claude), or built by hand.
   **Quotation requests** go *in turns* to the people with `quotes.build`
   (Quotations → To build; `quote-request-*.ts`, `QUOTE-REQUESTS.md`).
3. **Office meeting**, revisions, then the salesperson marks the **sales
   final** (`StudioQuote.salesFinalRevisionId`, compulsory handover notes,
   category Essential/Premium/Luxe).
4. **Booking**: sales final accepted + ₹25,000 token → `studio-sales/booking.ts`
   → `project/own-project.ts` → `portal/plan-write.ts createSignedProject`. The
   lead moves to the first WON column; the client gets the app. A refund is a
   correction row and the project is cancelled, never deleted.
5. **Design** — Hauspire's step template (`studio-design/template.ts`, 26 steps
   incl. pre-execution, held in `Studio.designTemplate`), from the 24 Oct design
   meeting. A 2BHK is the base; other sizes scale (`sizeFactor`). "Design done
   in N days" scales the gaps. Steps waiting on a payment are **never counted
   late** and re-date from the day the payment is recorded (`payment-redate.ts`).
   A late step asks **whose delay** (client/us) and why (`delays.ts`,
   `HomeStepDelay`, append-only); the client sees only days waiting on them, and
   sees the steps but not the dates.
6. **Design final** — `design-flow.ts makeDesignFinal` copies the signed
   quotation; it is always compared line by line with the sales final
   (`compare-lines.ts`, `final-doc.ts`).
7. **Pre-execution** → **execution** — the PM owns the project from here. Step
   tracker (`project/step-template.ts`, `docs/studio-workspace/STEP-TRACKER.md`):
   weights sum to 100%, **a tick needs a photo and a sentence**. Designer and
   supervisor both tick. Site mode at `/studio/site`.
8. **Crews** = the site trades (carpenter, electrician, POP, painter…), **not**
   material procurement, and **not** Hauspire's factory (owner: don't integrate
   it). Paid by **running bills** — any amount up to the balance
   (`studio-crews/*`, `HomeWorkOrder`, `HomeCrewPayment`). Orders reach a crew
   by the studio sharing a link on its own WhatsApp; we send nothing.
9. **Change orders** mid-project (`project/change-orders.ts`) — client approves
   in the app, then pays. Each project was leaving ₹1.5–2 L unbilled.
10. **Closure** (extra work + final payment, `project/closure.ts`) → **snags**
    → client signs off the handover in the app → **warranty** (default 12
    months, per studio).

Phases (`ProjectPhase`): DESIGN → PRE_EXECUTION → EXECUTION → CLOSURE → SNAGS
→ WARRANTY → CLOSED. They move **only** through `project/lifecycle-rules.ts
movePhase` / `lifecycle.ts applyPhaseEvent`.

Hauspire's payment stages, each paid at the start of its stage: booking
₹25,000 → design advance 5% → design closure 10% (working drawings stay locked
until paid) → material procurement 40% → material dispatch 40% → handover 5%.

### What the client of a studio sees

Through the customer app (`/app/*` on the web, `mobile/` on phones) and
`modules/portal/*` (`customer-project-view.ts`, `lifecycle-view.ts`):
current step, next step and the blocker they must clear; decisions with 2–6
options (`project/decision-rules.ts`); **sign-offs** of three kinds —
SALES_FINAL, AGREEMENT, DESIGN_FINAL (`project/signoff-rules.ts`). The
agreement stays hidden until the studio asks them to sign; they tick "I agree"
and type their name, or sign on paper at the office (filed as "Signed
agreement (paper)"). **Documents** (`studio-design/documents.ts`): one list of
types; names and versions are generated, never typed
(`TYPE_Studio_Client_date_vX.Y`; approval makes the next whole number).

**One customer projection, no internal field crosses it**
(`tests/customer-projection*`). Delay notes, crew money and margins never reach
the client.

### Also built

- **Leads at scale** (`studio-sales/*`, `LEADS-SCALE-BUILT.md`): list with
  pagination, filters with counts, saved views, bulk assign/split, KPI cards,
  board, stale review, analytics, bin (purged after 30 days by cron), timeline,
  call outcomes, merge, custom fields, configurable stages.
- **Lead intake** (`studio-intake/*`, `LEAD-INTAKE.md`): website forms
  (`/api/studio/intake/[id]`, key in `x-oi-key`), Google Ads lead forms, Meta
  lead ads (HMAC with `META_APP_SECRET`), with conversion feedback to Meta.
- **AxLeads import** (`scripts/import-axleads.ts`, `studio-import-axleads/*`):
  idempotent by `externalId`, sends nothing. Hauspire's 26,441 leads came in on
  22–23 Oct.
- **Bring in running projects** (`studio-bring-in/*`, `/studio/projects/bring-in`,
  `BRING-IN-PROJECTS.md`): Hauspire's live projects, old quotes read from the
  Hauspire quotation app (`HAUSPIRE_QUOTES_*` env). "Done before joining" ticks
  exist only here.
- **Calendar and office meetings** (`studio-office/*`, `OFFICE-MEETINGS.md`):
  everyone has a calendar and their own tasks; anyone can set up a meeting with
  anyone, the other accepts or suggests a time (no "decline", on purpose);
  regular weekly busy times and a clash warning (29 Oct).
- **Today / My work**: today, next 3 days, missed, "waiting on payment"; a daily
  digest email by cron.
- **Delete and restore a project**: owner only, type the client's name to
  confirm; leaves every list and the client's app and revokes the app link.

### Quotations and prices

The builder (`studio-quote/*`) was rebuilt on 10–11 Oct to match the Hauspire
Quotation Studio, generalised per studio: fee, modular discount
(`StudioBranding.discountBps`; Hauspire 15%), booking advance, payment stages,
GST, terms, brands, cover/about pages, room sets per BHK. Fee 7% + GST 18% for
all studios. `hauspire-calc.ts` keeps Hauspire's maths as the yardstick for
`pricing.ts` (`QUOTE-PARITY.md`). Lines shut once a live project runs on a
quotation (`write-rules.ts`). Any line can carry a note printed in the PDF; the
final PDF keeps Work Code and Description.

**One price list is the target**: the studio's product master
(`StudioProduct`) prices both its own quotations and the customer's first
quote. **Quotation reading runs in the owner's Claude Code**, not the API
(uploads only store files; `scripts/quotations/{fetch,submit,approve}` →
product-master rows PENDING → ops approves → studio confirms). The API reading
got stuck and burned credits. The older `StudioFiledRate` and `RateCardItem`
price lists are still in the schema, waiting to be retired into it.

**Studio approval rule** (owner, 30 Sep; threshold lowered 12 Oct): no studio
goes ACTIVE until **25** of its own quotations have been analysed into live
rates and its product master filled from them (`MIN_QUOTATIONS_FOR_RATES` in
`modules/quotation/catalogue.ts`; `studio-quote/rates-gate.ts` holds the
builder until then). Typed rates alone never qualify.

### The commercial model (studio side)

From `docs/STUDIO-AGREEMENT.md` and `modules/studio/subscription.ts`:
commission **5%** on introduced clients only, due once the studio has
collected 20%; 12-month introduction tail as a payment obligation; subscription
by band. The agreement is **"DRAFT — NOT YET REVIEWED BY A LAWYER"**. Pricing
for Solo/Pro/Max seats is not in code.

**Unresolved, flag rather than pick a side:** `PILOT_COMMISSION_BPS: 400`
(4%) in `src/lib/money.ts:139` against `COMMISSION_BPS = 500` in
`subscription.ts` and the agreement.

---

## 4. Conventions that are not negotiable

### Money is integer paise

Never rupees, never a float. `₹8,50,000` is `85000000`. All arithmetic through
`src/lib/money.ts` — `applyBps` for rates, `splitAcross` for exact splits.
`fromDb`/`toDb` at the Prisma boundary (`BigInt` cannot cross into a client
component). Indian grouping via `formatINR()` / `formatINRCompact()`; never
hand-roll `toLocaleString`.

### Quantities are thousandths

`qtyMilli`, an integer. `QTY_SCALE = 1000`, `MM_PER_SQFT = 92_903.04`.

### Never store a total

Bills, paid, balance, quoted value, document versions — computed on every read.

### Snapshot anything that prints

Quote and work-order lines copy the rate at creation. Editing the product
master never changes a quotation already sent. A quotation freezes its lines on
first issue (`issuedLines`).

### Append-only, corrections are new rows

`project/append-only.ts`: site logs, payments, delays, closure, change-order
events, crew payments — plus `AuditLog`, `Consent` and the (unused) escrow
tables.

### Every migration that adds a table carries RLS

Supabase's PostgREST exposes every `public` table to `anon` and
`authenticated`; Prisma tables get no policies. Every migration adding a table
ends with:

```sql
ALTER TABLE "x" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "x" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "x" FROM anon, authenticated;
```

`tests/security-invariants.test.ts` fails a migration without it. **Never edit
a migration that has run anywhere** — a fix is a new migration. Migrations use
table names, not model names (`tests/migration-names.test.ts`). One migration
per PR; expand only — add, backfill, and drop in a later release.

### Studio scoping — the most important query rule

> **Every query is scoped by the studio id from the session; nothing in a
> studio module takes a studio id as an argument.**

`myStudioId()` (`modules/studio/tenancy.ts`) is the only way in.
`tests/tenant-scope.test.ts` walks every Prisma call on a studio-owned model
and fails one that is not scoped, role-gated or explicitly excused. The same
tables hold every studio's prices, costs and clients' phone numbers.

### Stages: the studio owns names, we own meaning

The studio owns stage names, order, colours and count; we own the **kind** —
`OPEN`, `WON` (a project starts only from here), `DONE`, `LOST` (needs a
reason). **Every query reads the kind, never the name.** Exactly one intake
stage; at least one of each kind (`wouldStrand()` in `pipeline-rules.ts`); a
stage holding clients cannot be deleted. Custom-field keys are frozen once
derived.

### Other rules that cost a bug to learn

- **The sample lead is real and never counted** — counts use `...LIVE`
  (`tests/demo-lead.test.ts`).
- **`ClientSource.ONE_INTERIORS` is set only by the introduction bridge**,
  never by hand or import.
- **`requireRole` throws, so it is wrong in render paths** (pages, layouts —
  Next renders them in parallel and the throw beats the redirect). Use
  `getCurrentUser` + `hasRole` there. It has come back three times; §11 lists
  where it still is.
- **Pure logic does not live in a `server-only` file** (CONTRIBUTING §9.5):
  rules in a pure sibling (`*-rules.ts`), the server module re-exports. Vitest
  aliases `server-only` to a stub; `tests/server-only-boundary.test.ts` guards
  the real boundary.
- **Env vars: truthiness, never `??`** — Vercel supplies an unset
  `NEXT_PUBLIC_*` as `''` (CONTRIBUTING §8).
- **Dev bypasses are gated twice** (`DEV_SHOW_UNVERIFIED_STUDIOS`,
  `DEV_SHOW_OTP_ON_SCREEN`, `DEV_OPS_NO_AUTH`): `!isProduction()` and
  `!rosterIsReal()`. `isProduction()` is also true on Vercel previews.

---

## 5. Ops console (`/ops/**`)

Overview queue, applications (site scrape, Google lookup), per-studio page
`/ops/[slug]` (verification, status, **software plan**, archive review, product
proposals), allocation, consultations, introductions, verification queue,
experts, follow-ups (24-hour call list), funnel, waitlist, the weekly challenge,
readiness (`/ops/data` — check it after any env change), CSV export, hiding
test studios. `app/ops/layout.tsx` redirects anyone who is not OPS.

---

## 6. The customer side — built, not open

While `CUSTOMER_LIVE !== '1'`, `/app /quiz /match /compare /expert /prepare
/account /quotes /shared` redirect to `/` and the phone API answers 404.
`/studios` and `/verification` are gated with them on the public host.

### The choosing journey

`src/modules/brief/journey.ts`: **OneBrief → OneMatch → OneQuote → OneCompare
→ OneExpert** (the band is chosen inside the budget question; there is no
separate tier step). The `One` prefix is a placeholder until the brand is
settled.

- **Matching** — `ENGINE_VERSION = 'match@2.2.0'`; weights style 30,
  priorities 30, similar work 15, working style 10, household 10, timeline 5;
  one server ranker; matches stored with their engine version. Changing weights
  never rescores a match a customer already saw.
- **Bands** per sq ft, before GST (`modules/quotation/tiers.ts`): Essential
  ₹1,200–1,800, Premium ₹1,800–2,500, Luxury ₹2,500+. "One band up" is on.
  Per-sq-ft studio rates are never shown to customers.
- **First quote** from the floor plan (Claude reads it; `modules/floorplan/*`,
  sizes reused across a society), scope-aware (full home, kitchen & wardrobes,
  single room, renovation).
- **Compare** with an AI summary whose figures are checked against the quotes.
- **Expert** — Ar. Swarupa Tondare, booked directly; the pre-sign call is free.
- **Benefits** show only once their terms are written in
  `modules/portal/benefits.ts`.

### After signing — Basic and Assured

`modules/portal/plans.ts` (owner, 11 Oct): **Basic** is free and the default;
**Assured** is paid (fee not set) — we personally make sure the tracker and
site feed are updated daily, plus GEIO and 5 expert calls. Choosing Assured
only registers interest (`assuredRequestedAt`); ops switches the plan. Copy that
promises daily checks belongs to Assured only.

- **GEIO** (`modules/app/geio*.ts`) — the customer's AI guide, English, Hindi,
  Marathi; rupee figures checked against the facts; out-of-scope questions go
  to the expert; monthly cap `GEIO_MONTHLY_BUDGET_INR` (default ₹1,500); falls
  back to written answers without a key. Open before signing; after, Assured
  only.
- **Home Coins** (`modules/engagement/coin-rules.ts`) — earn only until partner
  brands are signed; never spent on the studio bill, never cashed out.
- **Family** on a project can vote on decisions; only the owner chooses and
  approves payments.
- **3D**: `/app/3d` is example data; `/account` draws the customer's own flat.
  The owner is building a separate 3D design tool (`DESIGN_TOOL_URL`).

### The phone app (`mobile/`)

Native screens: tabs Home, Project, Site, GEIO, Me; decisions, locker, snags
(camera), notifications, plan, delete account, and a native version of the
choosing journey. `web.tsx` is a web view limited to the website's `/app`.
Talks to `/api/app/v1` with a bearer session (the same `Session` row as the
cookie; `modules/auth/bearer.ts`), token in secure storage, Face ID /
fingerprint lock, push via Expo, last project kept offline.
`EXPO_PUBLIC_SAMPLE=1` answers every call from sample data. Bundle id
`in.oneinteriors.app`.

**Not tested end to end.** It has never signed in against a real database
(that needs a preview deploy with a test database — never production), and
`mobile/` has no tests. The owner handles the Apple and Google store accounts.

---

## 7. Sign-in, all roles

| Who | How |
|---|---|
| Customer | WhatsApp OTP (6 digits, 10 min, 5 attempts, per-phone and per-IP limits); optional Google/Apple/Facebook buttons, shown only when their keys are set. On `/app/verify` the phone code is off unless `NEXT_PUBLIC_APP_PHONE_CODE=1` |
| Studio staff | phone + password (§3); `STUDIO_SIGN_IN=otp` for the WhatsApp code |
| Ops | email magic link (15 min, single use) or password |

Sessions: `oi_session` cookie, host-only, httpOnly, 30 days (site supervisors
90); only a hash of the token is stored; role re-read on every request. The
middleware is only a cookie pre-filter — **the layouts are the authorisation
model** (`app/ops/layout.tsx`, `app/studio/layout.tsx`).

---

## 8. API routes and crons

- **`/api/app/v1`** — the phone/customer API: auth, me, brief, journey,
  choose, expert, plan, project, decisions, design answers, extras, payments
  (confirm/dispute), sign-offs, snags, GEIO, coins, devices, notifications.
  `modules/app-api/http.ts`: 404 unless `CUSTOMER_LIVE`, 503 with no database,
  `no-store`. `tests/app-api.test.ts` checks every route calls the gate first.
- **`/api/studio`** — document upload, lead intake (website, Google, Meta),
  leads export/upload, the site app's queued daily update, site photos and
  voice.
- **`/api/staff/view-as`** — enter/stop View as.
- **`/api/waitlist`** — join, extras, stats, status (bearer token).
- **`/api/cron/*`** — `Authorization: Bearer $CRON_SECRET` (401 if unset).
  `vercel.json` schedules: decision reminders, snag auto-close (7 days), site
  daily-update reminders (twice), bin purge (30 days), the Today digest email.

---

## 9. Data, storage and environment

### Data model map (120 models)

- **Identity** — `User`, `Session`, `LoginChallenge`, `Consent` (append-only),
  `RateLimitHit`.
- **Customer journey** — `Brief`, `FirstQuote(Line)`, `QuoteDecision`, `Match`,
  `Consultation`, waitlist.
- **Studio and verification** — `StudioApplication`, `Studio`, `StudioMember`,
  `VerificationCheck`, `PortfolioProject`, `StudioDocument`, `AuditLog`,
  `Notification`, `Subscription`.
- **Leads** — `StudioStage`, `StudioField`, `StudioClient`,
  `StudioClientEvent`, `StudioSavedView`, `StudioForm`, sales roles, intake
  connections.
- **Quotations** — `StudioBranding`, `StudioProduct`, `StudioQuote(Line)`,
  `StudioQuoteRequest`; legacy `StudioFiledRate`, `RateCardItem`,
  `QuotationArchive`.
- **The project** — `HomeProject` and its `Home*` family: stages, checklist,
  payments, site logs, decisions, snags, documents, step delays, change orders,
  closure, sign-offs, work orders and crew payments. `StudioVendor` for crews.
- **Office** — `StudioMeeting`, `StudioMeetingGuest`, `StudioBusyBlock`, tasks.
- **Never written** — `Quotation`, `QuotationLineItem`, `Dispute`,
  `EscrowTransaction`, `Milestone`, `MilestoneEvidence`.

### Storage buckets (Supabase, server-side with `SUPABASE_SECRET_KEY`)

`floor-plans` 15 MB · `quotation-archives` 25 MB/file · `business-proof` 10 MB ·
`portfolio-images` 8 MB (public) · `site-photos` 8 MB · `project-docs` 50 MB by
signed upload · `lead-files` 15 MB · `crew-kyc` 4 MB · `studio-logos` 2 MB. All
private with short signed links except portfolio images. A bucket's own size
limit is set in Supabase by the owner — raise it there when the code allows
more.

### Environment

Read by code and **missing from `.env.example`**: `CRON_SECRET`,
`SAMPLE_DATA_ONLY`, `STUDIO_SIGN_IN`, `NEXT_PUBLIC_APP_PHONE_CODE`,
`GEIO_MODEL`, `GEIO_MONTHLY_BUDGET_INR`, `SPEECH_PROVIDER`,
`EXPO_ACCESS_TOKEN`, `META_APP_SECRET`, `META_VERIFY_TOKEN`,
`STUDIO_META_CAPI`, `STUDIO_META_PAGE_TOKENS`, `GOOGLE_PLACES_API_KEY`,
`DESIGN_TOOL_URL`, `WAITLIST_SITE_URL`, `WHATSAPP_TEMPLATE_LOCALE`,
`WHATSAPP_WAITLIST_TEMPLATE`, `WHATSAPP_STUDIO_*_TEMPLATE`,
`HAUSPIRE_QUOTES_*`.

Listed in `.env.example` but **read by nothing**: `SESSION_SECRET`,
`REDIS_URL`, `S3_*`, `RAZORPAY_*`, `ESCROW_*`, `KYC_*`,
`NEXT_PUBLIC_POSTHOG_*`, `SUPABASE_JWKS_URL`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.

Anthropic: `ANTHROPIC_MODEL` (default `claude-sonnet-5`, `src/lib/env.ts:79`)
for everything except GEIO, which uses `GEIO_MODEL` (default
`claude-haiku-4-5-20251001`). Everything degrades without `ANTHROPIC_API_KEY`.

---

## 10. Traps that have already cost time

Every item is a real bug that shipped, or a near miss.

1. **The `server-only` boundary.** Importing a value from a `server-only` file
   pulls Prisma into the browser bundle; `tsc` cannot catch it,
   `tests/server-only-boundary.test.ts` does.
2. **`prisma.config.ts` switches off path inference.** `migrations.path` is
   explicit. If a migration seems not to have applied, run
   `npx prisma migrate status` and read the list, not the last line.
3. **Prisma CLI reads `.env`; Next reads `.env.local`.** `prisma/load-env.ts`
   bridges them.
4. **`prisma generate` is platform-specific**, and `EPERM … query_engine-windows.dll.node`
   means the dev server holds the DLL — stop it first.
5. **Silent catches hide broken reads** — a missing table looks like "no
   clients yet". `saveFailed()` shows the real reason in development.
6. **A form that never closes reads as a form that never saved.**
7. **Display-rounded numbers in tests.** Compute the expected value.
8. **Every "minimum N" rule needs a small-N path.**
9. **Prisma ambiguous relation** when you add a back-relation by hand after
   `prisma format`.
10. **Migration names vs table names** — `tests/migration-names.test.ts`.
11. **A submit that goes nowhere must say so** (native validation silently
    cancelled every `/apply` submit once).
12. **"Nothing uses `SUPABASE_SECRET_KEY`"** was in a checklist. Uploads then
    reported themselves "not switched on". It also signs the View-as hint.
13. **Two copies of one rule drift.** Put a rule in one pure function and call
    it from every surface (§3 table).
14. **PowerShell treats `<` as reserved.** Never put angle-bracket
    placeholders in a command the owner will paste.
15. **Windows line endings break two tests locally.** Git checks files out
    with CRLF here (`core.autocrlf=true`, no `.gitattributes`), and
    `tests/app-api.test.ts` and `tests/studio-sales-permissions.test.ts` match
    source text against `\n`. They pass on CI (Linux) and fail on the owner's
    machine. A local red run of exactly those two is this, not a regression.
16. **Prod commands are the owner's.** Migrations, Hauspire scripts and merges
    against production are run by the owner from a "prod" terminal tab, with
    `DATABASE_URL` loaded from the main checkout's `.env.local` (a worktree's
    copy lacks it). **Production migrations go in before the merge to `main`**,
    because the merge deploys.

---

## 11. Health and known issues — as of 30 Oct

Verified in a fresh worktree on `160feff`:

| Check | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm test` | 4,017 pass, 10 skipped, **2 fail on Windows only** (trap 15); CI green |
| GitHub CI | green on every PR and push since late September |

### Still open from the 29 Sep audit (fix each with a test that reproduces it first — CONTRIBUTING §6)

- **Security — `consumeMagicLink` ignores the challenge's channel.**
  `modules/auth/magic-link.ts:198` finds a `LoginChallenge` by hash only, and
  WhatsApp challenges hash `whatsapp:<phone>:<code>` (`otp.ts:134`). So
  `/auth/verify?token=whatsapp:<phone>:<code>` can guess OTPs with no attempt
  limit and no rate limit. The most serious open item.
- **Security — open redirect.** `src/app/set-password/page.tsx:63` accepts
  `next=//host` because it only checks `startsWith('/')`.
- **`requireRole` in render paths** (500 instead of a redirect, behind the ops
  layout): `/ops/data` (`featureReadiness`), `/ops/[slug]`
  (`archivesForStudio`, `ratesForReview`, `softwarePlanOf`, `pendingDraftRun`),
  `/ops/challenge` (calls it directly), `/ops/applications`
  (`listApplications`), `/ops/follow-ups` (`followUpList`).
- **`standingOf` maps `PAUSED` to `SETTING_UP`** (`modules/studio/standing.ts`),
  so a studio that pauses leads loses its CRM.
- **Commission 4% vs 5%** (§3).
- **`storeQuotes`** (`modules/quotation/generate.ts:105`) has no callers.
  (`storeMatches` is now called.)

Fixed since 29 Sep: waitlist RLS (follow-up migration), `createQuote` sets the
client, quote numbering, the bin purge cron, `ratesAreReal()` follows the
roster (its doc comment still says `false`), the landing page's invented
figures (the page was rewritten), the CI install.

### Known gaps, not bugs

- **Speech-to-text** has no provider; voice notes are kept as audio.
- **SMS** for studio staff is a stub (needs DLT registration).
- **No Pro/Max seat pricing or billing** in code.
- **Electrical bill module** — not in scope.
- `/tier` is still in the host gate list but has no route.
- At Hauspire: Ankita (VTP Cygnus) had no designer and was on the old steps as
  of 27 Oct; the "Whose" picker on meetings cannot select a designer.

---

## 12. Docs — which to trust

**Current:** `CONTRIBUTING.md`; `docs/studio-os/*` (one file per built piece —
`PROJECT-LIFECYCLE.md`, `PHASE-1/2/3-BUILT.md`, `SALES-ROLES.md`,
`LEAD-INTAKE.md`, `QUOTE-PARITY.md`, `QUOTE-REQUESTS.md`, `VIEW-AS.md`,
`BRING-IN-PROJECTS.md`, `AXLEADS-IMPORT.md`); `docs/studio-workspace/STEP-TRACKER.md`;
`docs/CUSTOMER-PLATFORM-PLAN.md`; `docs/MOBILE-APP-PLAN.md`;
`docs/app-handover/*` (the customer app design and decisions);
`docs/DESIGN-LANGUAGE.md`; `docs/STUDIO-AGREEMENT.md`; `docs/FUTURE-SCOPE.md`.

**Behind the code:**

| Doc | What is wrong |
|---|---|
| `README.md` | still v0.1 ("not built yet") |
| `docs/studio-os/DESIGN-PROCESS-PLAN.md` | header says "Nothing below is built yet"; most of it was built 25–29 Oct (PRs #22–#29) |
| `docs/studio-os/OFFICE-MEETINGS.md` | says "No clash check"; weekly busy times and the clash warning landed 29 Oct |
| `docs/studio-workspace/STUDIO-WORKSPACE-BUILD.md` | says "No passwords"; studio password sign-in landed 27 Oct |
| `mobile/README.md` | calls the web view the journey; there is now a native journey and GEIO tab |
| `.env.example` | §9 |
| `docs/ARCHITECTURE.md`, `DATABASE.md`, `DATA-ARCHITECTURE.md` | the September picture; four price lists, no Studio OS |
| `docs/STUDIO-CRM.md`, `QUOTATION-BUILDER.md`, `STUDIO-DASHBOARD.md`, `LEADS-V2.md` | predate the rebuilds |
| `docs/LAUNCH.md`, `DEPLOY-CHECKLIST.md`, `WHAT-I-NEED-FROM-YOU.md` | old variable names and done items |
| `src/modules/studio/features.ts` | comments describe it as the switchboard; plans and roles are (§3) |

---

## 13. How to work on this

**Verify, do not assume.** The owner runs commands and pastes the output.
Before claiming something works: `npm run typecheck`, `npm run lint`,
`npm test`; CI checks the same on every PR. For a migration, apply it inside a
transaction and roll back to prove it applies (PGlite is fine) before asking the
owner to run it on production.

**Work from the owner's meetings.** Most October work came from the owner's
walkthroughs with Hauspire's team (15, 24 and 27 Oct), pasted as transcripts.
Turn one into a numbered plan, get decisions on the open points, then ship it
item by item, one PR each (e.g. "Design walkthrough 27 Oct, item 15"). Defaults
in bold are used unless the owner says otherwise.

**Own mistakes plainly and fix them.** The owner has caught real errors — a
third instance of a bug after two were fixed, a `.com`/`.co` mix-up, an
invented enum. Say what went wrong, say why, fix it.

**Write the comment that explains the why.** Doc comments carry the decision
history, often with the owner and date ("owner, 29 Oct 2026"). There are no
`TODO` markers; unfinished work is described in prose. Commit messages: a
sentence-case summary, then the why.

**Never write secrets into files.** The owner pastes keys into env files and
Vercel themselves. `.env.local` is gitignored and must never be committed.
Never sign in as a real person.

**Windows.** The repo is `C:\Sanyam\OneInteriors`; the owner is on PowerShell.
Sessions start in a git worktree under `.claude/worktrees/` (§2 for getting one
to build).

---

## 14. If you are a new chat, start here

1. Read §1, §4 and §10 of this file, then `CONTRIBUTING.md` §5 and §9.
2. Open `src/modules/studio/surfaces.ts` and `roles.ts` — who sees what is the
   heart of the studio software.
3. Open `docs/studio-os/PROJECT-LIFECYCLE.md` and
   `src/modules/project/lifecycle-rules.ts` — how a project moves.
4. Open `src/lib/host.ts` — what is reachable where.
5. Check §11 against the code before relying on it; items there get fixed.
6. **Current direction (30 Oct):** Hauspire runs every project on the Max plan
   since 27 Oct; the work is the owner's list from the Hauspire design and
   sales teams, shipped item by item. The customer side waits on the waitlist
   reaching 2,000 and on the phone app being tested end to end.

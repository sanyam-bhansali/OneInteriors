# Data architecture

Where every piece of data lives, who can reach it, and what has to change
before there are fifty studios on it.

`DATABASE.md` is the setup guide — connection strings, migrations, the two
URLs. This is the map. Written 23 Sep 2026 against `main`; the audit behind it
covered every `prisma.*` call in `src/` and every migration.

---

## 1. The shape, in one paragraph

**One Postgres database, one Supabase project, one Vercel app, one Prisma
client.** Every studio is a row, not a deployment. Isolation is a `studioId`
column on 26 tables and a `where` clause on every query that touches them.
Files go to five buckets in the same Supabase project, namespaced by a
`studio_<id>/` path prefix and served through five-minute signed URLs — except
portfolio images, which are deliberately public. Nothing is per-tenant except
the rows themselves.

That is the right shape and it should not change at 50 studios, or at 500. What
has to change is named in §7.

---

## 2. The three stores, and what is not one

| Store | Holds | Reached by |
|---|---|---|
| **Postgres** (Supabase, `ap-south-1`) | Everything structured: 54 models. Studios, applications, onboarding, the CRM, quotations, the marketplace journey. | Prisma, server-side only |
| **Supabase Storage** | Five buckets of binary: logos, portfolio images, business proof, uploaded quotation archives, floor plans. | Hand-rolled `fetch` from `server-only` modules in `src/modules/storage/` |
| **The session** | Auth only — a cookie verified against the database on every request. | `modules/auth/session.ts` |

**Not stores, and must never become ones:**

- `sessionStorage` on the customer journey (`modules/quotation/project-store.ts`)
  is a convenience copy of a quote the customer has already been shown. It is
  re-derivable and is never read back as truth.
- The browser's copy of quotation lines in the builder. It is the *editing*
  state; `saveQuoteLines` re-computes every amount server-side from the same
  pure function, because a total that arrived from a browser is a total
  somebody could have sent us.

---

## 3. What is written, and when

### 3.1 Application — public, no account

`/apply` → `submitApplication` (`modules/studio/application.ts:65`)

Writes **one table**: `StudioApplication`. No `Studio`, no `User`, no session.
Flood-controlled at three per email per day. An acknowledgement email goes out
outside the transaction — a mail provider having a bad minute must not lose an
application.

### 3.2 Approval of the application — ops

`approveApplication` (`application.ts:232`), one transaction:

| Table | What |
|---|---|
| `Studio` | created, `status: ONBOARDING`, `tier: UNVERIFIED`, unique slug |
| `User` | upserted by email, role `STUDIO` (an existing OPS/ADMIN is never demoted) |
| `StudioMember` | upserted, `isOwner: true` — **this row is the tenancy link** |
| `StudioApplication` | `APPROVED` + reviewer + reason |
| `AuditLog` | `application.approve` |

Then, outside the transaction: all sessions revoked, and a seven-day magic
link sent. **That link is the studio's first login.** There is no password
anywhere in the studio flow.

### 3.3 Onboarding — five steps

Route `app/studio/onboarding/[step]`, services in `modules/studio/onboarding.ts`.
Every write resolves the studio through `currentStudio()`, never through a
parameter.

| Step | Writes | Bucket |
|---|---|---|
| Your studio | `Studio`: about, localities, website, instagram, yearsActive, teamSize, min/maxProjectPaise | — |
| Registration | `Studio`: addressLine, pincode, gstin, gstinNotApplicable, gstinNote · `StudioDocument` | `business-proof` |
| Your work | `PortfolioProject` (+ images) · `Studio.portfolioShortfallNote` | `portfolio-images` |
| Your rates | `RateCardItem` · `Studio.offering`, `priceLevel` · `QuotationArchive` + `QuotationFile`, then `StudioFiledRate` rows as `PENDING` | `quotation-archives` |
| Send for review | `Studio.onboardingSteps = { submittedForReview, submittedAt }` · `AuditLog` | — |

**Completion is derived, never stored.** `assessSteps()`
(`modules/studio/onboarding-steps.ts:78`) is pure and reads the data. A stored
"step 2 done" flag goes stale the moment a field is cleared, and then the
checklist lies about what we are waiting for. The only thing in
`onboardingSteps` is the submission, which is an event rather than a condition.

### 3.4 Going live — ops

- `setStudioStatus` → `Studio.status`, recomputed `Studio.tier`, and on
  ONBOARDING→ACTIVE a `Notification` per member (`studio.approved`).
- `approveRates` → filed rates `PENDING → LIVE`, archive `FILED`, **and then**
  `fillProductMaster` seeds `StudioProduct` from the same figures. That second
  write is deliberately outside the transaction: half a set of live rates
  would price one home from two readings, but a failure filling a working
  catalogue must not roll back ops's decision.

### 3.5 The software

`crmIsOpen()` (`modules/studio/standing.ts`) decides what opens. Submitted =
the practice software; approved = briefs as well. One pure function, read by
the dashboard and the navigation — they disagreed once, and the fix was to
give them one rule rather than two copies.

---

## 4. Tenancy — how isolation actually works

### 4.1 The mechanism

One user belongs to one studio. `StudioMember.userId` is unique, and three
helpers resolve it:

- `currentStudio()` — `modules/studio/onboarding.ts:121`
- `myStudioId()` — `modules/studio-quote/store.ts:36`
- `myStudioId()` — `modules/studio/dashboard.ts:44` ← **a second, weaker copy**

Every studio-scoped query is `where: { studioId }`, and every write that takes
an id from a form re-checks ownership before using it — `ownedQuote()`,
`findFirst({ id, studioId })`, or an `updateMany` scoped by both. A full scan
of all 26 studio-owned models found **no cross-tenant leak today.**

### 4.2 The honest part

**Row-level security is not a second line of defence for tenant isolation, and
it is important that nobody believes otherwise.**

- 30 tables have `ENABLE` + `FORCE ROW LEVEL SECURITY`.
- `CREATE POLICY` appears **zero** times in the entire migration history.
- Every table also `REVOKE`s all privileges from `anon` and `authenticated`.

What that buys is real and worth keeping: the Supabase publishable key is
inert. A leaked one reads nothing, because the PostgREST roles have no grants
and no policies to satisfy.

What it does **not** buy is protection between studios. Prisma connects over
`DATABASE_URL` as the database owner, which the REVOKEs do not touch and for
which RLS is not enforced. So one repository function that forgets `studioId`
is a full cross-tenant read, with nothing underneath to catch it.

`tests/security-invariants.test.ts` enforces the pairing on every new table,
which is why the lockdown has not eroded — but it is a regex over migration
SQL. It proves the statements were written; it does not prove a policy exists,
because none do.

**At 50–100 studios this is the central risk.** §7 says what to do about it.

---

## 5. Storage — and the answer to the Supabase question

### 5.1 The question

> Do we need a Supabase project per client, or one project with every client on
> it?

**One project. Always one.** Not "for now" — this is not a decision to revisit
at 50 studios or at 500.

A project per studio would mean, per studio: a database to migrate, a set of
keys to rotate, a connection pool, a dashboard, a backup schedule and a bill.
Fifty studios is fifty schema migrations to run in lockstep, and the first time
one of them fails halfway you have fifty codebases. It also makes the things
this product exists to do impossible: the comparison screen reads every
studio's rates in one query, and ops reviews the roster in one list. Neither
can cross a database boundary without an export pipeline that becomes the
hardest thing in the system.

The industry line is simple: **isolate by row, not by deployment, until a
customer's contract forces otherwise.** Nothing about interior studios in Pune
forces otherwise. If an enterprise client ever demands their own instance, that
is a separate deployment of the same code — a commercial decision, not an
architectural one.

What must be right instead is the **path convention and the read guard**, and
they already are:

### 5.2 The five buckets

| Bucket | Path | Public | Read | Max | Guard |
|---|---|---|---|---|---|
| `studio-logos` | `studio_<id>/<uuid>.<ext>` | no | signed, 5 min | 2 MB | ⚠ none — see below |
| `portfolio-images` | `studio_<id>/<uuid>.<ext>` | **yes** | permanent public URL, immutable cache | 8 MB, 20/project | none, by design |
| `business-proof` | `studio_<id>/<uuid>.<ext>` | no | signed, 5 min | 10 MB | `requireRole('OPS')` |
| `quotation-archives` | `studio_<id>/<uuid>.<ext>` | no | signed, 5 min | 25 MB, 40/batch | `requireRole('OPS')` |
| `floor-plans` | `u_<userId>/…` or `a_<anonKey>/…` | no | signed, 5 min | 15 MB | owner-or-OPS |

Properties worth keeping:

- **Object names are server-generated UUIDs, never a user's filename.** There
  is no path-traversal surface anywhere.
- `x-upsert: false` on every upload, so a write can never silently replace
  somebody else's object.
- Every call is `server-only`, using `SUPABASE_SECRET_KEY`. **No storage call
  is made from the browser.** The one client-side import from
  `modules/storage` is `logo-limits.ts`, which is pure constants and exists
  precisely so the size limit in the copy and the size limit in the check
  cannot drift.
- Deletes are best-effort. An orphaned object costs kilobytes; a failed delete
  that took the row with it would cost the document.

**The one soft spot:** `signedLogoUrl(path)` (`studio-logo.ts:108`) signs any
path handed to it. Today every caller passes `StudioBranding.logoPath` read off
the already-authorised studio's own row, so no browser-supplied id reaches it —
and the function says so in a comment. But that invariant is convention, not
code. One future caller passing a request parameter turns it into a
cross-studio read. Low impact (a logo is on their van), but it is the only
bucket where the boundary is a comment.

### 5.3 Storage at 100 studios

Twenty quotations at up to 25 MB, twenty portfolio images at up to 8 MB, a
logo, some proof: call it a generous **600 MB per studio**, so ~60 GB at 100.
Supabase Pro includes 100 GB. Archives are the bulk and are read once, by ops,
during verification — they are cold storage after that and are the obvious
candidate for a lifecycle rule later. This is not a constraint worth designing
around now.

---

## 6. Where the same fact lives twice

Duplication is not automatically wrong — a snapshot on a sent document is
correct and a join would be a bug. What matters is whether each copy is
*intended*. These are the ones in the system, with a verdict on each.

| # | The duplication | Verdict |
|---|---|---|
| 1 | `StudioApplication` copies 11 fields into `Studio` at approval and is never re-synced; `/ops/applications` still renders the stale row | **Fix the display.** The copy is right; showing the frozen version as if current is not |
| 2 | `StudioBranding` snapshots `legalName`, `addressLine`, `gstin` etc. from `Studio` at first read | **Correct.** The name on a document is a fact about the day it was sent. But a GSTIN corrected in onboarding will not reach an existing branding row — needs a re-sync on registration save |
| 3 | **Three rate stores**: `RateCardItem` (typed on the rates step, drives the marketplace estimate), `StudioFiledRate` (derived from their archive, drives the first quote), `StudioProduct.ratePaise` (the CRM catalogue) | **The real problem.** Nothing reconciles them. A studio can be quoted at three different prices depending on which page a customer lands on. See §7 |
| 4 | **Three quote models**: `Quotation` (marketplace, legacy), `StudioQuote` (CRM), `FirstQuote` (customer journey) | Two are justified — a first quote and a studio's own quotation are different documents. `Quotation`/`QuotationLineItem` is written and never read by `app/studio/*` and looks retired |
| 5 | `Studio.slug` copied into `StudioForm.slug` | Latent bug if a slug ever changes. One line to fix |
| 6 | `onboardingSteps` JSON re-cast inline in four files | `readSteps()` exists at `onboarding.ts:199` and only calls itself. Use it |
| 7 | `PAUSED` exists as both `StudioStatus.PAUSED` and `Studio.pausedAt/pauseCause` | Two representations of one fact that can disagree |

**Dead weight** (zero readers, safe to drop with a migration): `Studio.cin`,
`udyamNumber`, `performanceComputedAt`, `designFeePaise`, `panLast4` (one
writer, no reader), `StudioApplication.phone` (written, never read — the phone
a client rings lives on `StudioBranding`), and the whole performance block
(`completedProjects`, `avgVarianceDays`, `upheldDisputes`,
`specComplianceRate`, `communicationRating`, `autonomyProfile`) which the tier
logic reads and **nothing ever writes**.

That last one matters beyond tidiness: a tier is being computed from columns
that are permanently at their defaults.

---

## 7. The plan for 50–100 studios

Ranked by what actually bites, not by effort.

### P0 — before the roster grows

**1. A second line of defence under tenancy.**
Today one forgotten `where` is a cross-tenant leak. Two options, and they
compose:

- *Cheap and immediate:* a test that walks every `prisma.<model>.<op>` call on
  the 26 studio-owned models and fails the build if the `where` has no
  `studioId` (or is not preceded by an ownership check). The audit that found
  the current state clean was manual; make it a test and it stays clean.
- *Proper:* give Prisma a non-owner role and write RLS policies keyed on a
  session variable (`SET LOCAL app.studio_id`), with a `withStudio()` wrapper
  opening the transaction. This is the AxLeads pattern (`withTenant()`), it is
  known to work, and it is the only version where a forgotten `where` fails
  closed.

**2. Index `StudioQuote.clientId`.**
The leads board loads up to 400 clients and includes their quotes, so Postgres
runs `WHERE clientId IN (400 ids)` against an **unindexed column** on every
board render. One `@@index([clientId])`, one migration. This is the single
cheapest performance fix in the system.

**3. Stop seeding on read.**
`myProducts()`, `myStages()` and `seedDemoLead()` each check-and-maybe-write on
every page load. They are idempotent and cheap today, but they turn every read
into a write-capable transaction through the pooler, and `/studio/quotations`
calls two of them concurrently. Move provisioning to approval time — the same
place `fillProductMaster` already runs — with a one-off backfill for existing
studios.

### P1 — before it hurts

**4. Reconcile the three rate stores.**
Decide which one is the source of truth. The honest answer is
`StudioFiledRate` (derived from their own documents, reviewed by ops), with
`StudioProduct` as the studio's editable working copy and `RateCardItem`
retired or explicitly relabelled as the indicative marketplace bucket. Whatever
is decided, one document should be able to answer "what does this studio charge
for a wardrobe?" without asking which screen you are on.

**5. Bound the unbounded reads.**
76 `findMany` calls have no `take`. The ones on studio-scoped hot paths:
`archivesForStudio`, `liveRatesFor`, `myFiledRates`, and several in
`studio-practice/clients.ts`. A `take` on each is minutes of work and removes a
whole class of future incident.

**6. Fix the archive extractor's memory profile.**
`extract-agent.ts:167` downloads every file of an archive **sequentially, into
base64, in one serverless invocation**. Worst case with the current caps is
roughly a gigabyte in memory. Process in batches, or stream, or move it to a
queue.

**7. Aggregate the board's quoted value.**
`clients.ts:93` sums every line of every quote of every one of 400 clients in
JavaScript. Cost grows with quote history, not with client count — so it gets
worse precisely as a studio succeeds. Use a grouped aggregate.

### P2 — hygiene, worth a quiet afternoon

8. Collapse the duplicate `myStudioId()` in `dashboard.ts` into the one in
   `studio-quote/store.ts` (it is missing the STUDIO role check).
9. Give `signedLogoUrl` an explicit studio check so the boundary is code.
10. Drop the dead columns; decide whether the performance block should be
    written or removed, because a tier computed from permanent defaults is
    worse than no tier.
11. Re-sync `StudioBranding` identity when the registration changes.
12. Use `readSteps()` in the four places that re-cast the JSON.
13. Set `connection_limit=1` explicitly on `DATABASE_URL` in production (the
    docs say to; verify Vercel actually has it).

### What does NOT need to change

- One Supabase project, one database, one app. Confirmed above.
- Shared buckets with `studio_<id>/` prefixes and signed reads.
- Integer paise everywhere, with one rounding rule in `money.ts`.
- Derived onboarding completion.
- Pure modules beside `server-only` ones (CONTRIBUTING §9.5) — it is what makes
  the pricing testable without a database, and it has caught real arithmetic
  bugs.

---

## 8. Is it clear?

Mostly, yes. The structure holds: one tenancy link, one derivation of
onboarding state, one pricing module used by both sides of the marketplace, and
an audit that found no leak.

The two places it is **not** clear, and both are worth fixing before the roster
grows rather than after:

1. **What a studio charges** has three answers in three tables with nothing
   reconciling them.
2. **What protects one studio from another** is application code alone, while
   the presence of `ENABLE ROW LEVEL SECURITY` on thirty tables suggests
   otherwise to anybody reading the migrations.

Everything else on the list is maintenance.

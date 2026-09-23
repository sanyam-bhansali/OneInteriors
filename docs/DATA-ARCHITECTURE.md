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

One user belongs to one studio. `StudioMember.userId` is unique, and two
helpers resolve it:

- `myStudioId()` — `modules/studio/tenancy.ts`, the primitive. Re-exported
  from `studio-quote/store.ts`, which is where it used to live.
- `currentStudio()` — `modules/studio/onboarding.ts`, the same resolution plus
  the whole onboarding context.

There was a third: a copy in `dashboard.ts` with the STUDIO role check missing
and no callers. A second, weaker copy of the function that decides whose data
you are looking at is not a duplication worth tolerating — whichever one a
reader finds first becomes the one they call. It is gone.

Every studio-scoped query is `where: { studioId }`, and every write that takes
an id from a form re-checks ownership before using it — `ownedQuote()`,
`findFirst({ id, studioId })`, or an `updateMany` scoped by both. A full scan
of all studio-owned models found **no cross-tenant leak**, and
`tests/tenant-scope.test.ts` now runs that scan on every build.

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

**What now stands in for the missing floor** is
`tests/tenant-scope.test.ts`: every Prisma call on a studio-owned table must be
scoped, role-guarded, or excused in writing. It is a static scan rather than a
proof — it cannot know that a variable called `studioId` holds the session's
studio — but it makes the *absence* of scoping impossible to introduce quietly,
and it was proven against real injected regressions rather than assumed to
work.

That is a good second line. It is not a floor: policies keyed on a session
variable, with Prisma connecting as a non-owner role, is the only version where
a forgotten `where` fails closed. See §7.4.

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

**The soft spot, now closed:** `signedLogoUrl(path)` used to sign any path
handed to it, on the argument that every caller passes `StudioBranding.logoPath`
read off the already-authorised studio's own row. That was true, and it was a
comment rather than a check — one future caller passing a request parameter
would have turned it into a cross-studio read. It now refuses any path outside
`studio_<yourStudioId>/`, with ops passing through. Every bucket's boundary is
code.

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

Ranked by what actually bites, not by effort. **Everything in P0, P1 and P2 was
done on 23 Sep 2026** — each item below says what it turned into, so this reads
as a record rather than a wishlist. What remains open is §7.4.

### P0 — before the roster grows ✅

**1. A second line of defence under tenancy.** → `tests/tenant-scope.test.ts`

Every `prisma.<model>.<op>` call on a studio-owned table is scanned, and the
build fails unless it is scoped by `studioId` (or by the session's `userId`),
guarded by an OPS/ADMIN role check, or listed in `ALLOWED` with a reason. The
model list is **derived from `schema.prisma`**, so a new studio-owned table is
covered the day it is added rather than the day somebody remembers.

It was tested by regression, not by assumption: a deliberately unscoped query
was added to two different modules and the test caught both. The first version
did not — it excused any file containing `hasRole(`, which is inside
`myStudioId()` itself, so most of the codebase walked through. The guard now
matches on the ROLE, not the function.

There is also a test that fails if `CREATE POLICY` ever appears, because that
would mean this file's premise had changed and the header needs rewriting.

*Still the right next step, unblocked by the above:* a non-owner Prisma role
with RLS policies keyed on `SET LOCAL app.studio_id`. That is the only version
where a forgotten `where` fails closed rather than being caught by a scan. See
§7.4.

**2. Index `StudioQuote.clientId`.** → `20260923060000_quote_client_index`

Done. `CONCURRENTLY` is deliberately not used — Prisma runs migrations in a
transaction and cannot — which is noted in the migration for whenever the table
is large enough to care.

**3. Stop seeding on read.** → `modules/studio/provision.ts`

`provisionWorkspace()` writes the starter catalogue and the pipeline once, when
the application is approved, beside the `Studio`, `User` and `StudioMember`
rows. It never throws: a studio who signs in to an empty catalogue is a smaller
problem than an approval that failed because a starter row would not insert.

The lazy paths in `myProducts()` and `myStages()` are **kept and relabelled as
a migration path** — they are the only thing standing between a studio created
before this existed and an empty product master. Delete them once no studio
predates provisioning.

### P1 — before it hurts

**4. Reconcile the three rate stores.** — **STILL OPEN**, see §7.4.
Decide which one is the source of truth. The honest answer is
`StudioFiledRate` (derived from their own documents, reviewed by ops), with
`StudioProduct` as the studio's editable working copy and `RateCardItem`
retired or explicitly relabelled as the indicative marketplace bucket. Whatever
is decided, one document should be able to answer "what does this studio charge
for a wardrobe?" without asking which screen you are on.

**5. Bound the unbounded reads.** ✅

`archivesForStudio` (100 — and it carries every file row of every archive, so
unbounded it grows quadratically), `liveRatesFor` (200, on the pricing path),
`myFiledRates` (100), `ratesForReview` (100), and the extractor's file read
(120). Each `take` carries a comment saying what the number means, so nobody
later reads it as a page size.

**6. Fix the archive extractor's memory profile.** ✅

It already batched by COUNT — four files — which says nothing about size: four
25 MB PDFs is ~133 MB of base64 in one invocation. It now batches by **bytes**
as well (18 MB of encoded data per request), releases each batch before
fetching the next, and still sends an oversized single file on its own rather
than skipping it.

**7. Aggregate the board's quoted value.** ✅

`quotedPerClient()` does it in two queries — one to map quotes to clients, one
`groupBy` with a `_sum` — over the index added in item 2. Scoped by `studioId`
as well as by the id list, because an id list assembled from a previous query
is still a list of ids.

### P2 — hygiene ✅

8. **One tenancy helper.** → `modules/studio/tenancy.ts`. The weaker copy in
   `dashboard.ts` is gone (it had no callers and no STUDIO role check);
   `studio-quote/store.ts` re-exports the canonical one, so no import had to
   move.
9. **`signedLogoUrl` checks the prefix.** A path that is not
   `studio_<yourStudioId>/…` is refused, whoever handed it over. Ops pass
   through. `myFiledRates` got the same treatment — it took a `studioId`
   parameter with no authorisation of its own, in a file that also exports
   OPS-guarded functions.
10. **Dead columns dropped** → `20260923070000_drop_dead_studio_columns`:
    `cin`, `udyamNumber`, `designFeePaise`, `performanceComputedAt`. Verified
    zero readers and zero writers first. `panLast4` was KEPT — it has a writer
    and is a record of what was verified. The performance block was kept too,
    and the reason is item 4 of §7.4.
11. **Branding re-syncs from the registration.** `saveRegistration` pushes the
    identity through to `StudioBranding` — and only from there, because that is
    the screen ops verifies against the registries. Quotations already issued
    are untouched: they carry their own snapshot.
12. **One reader for the JSON.** → `modules/studio/submitted.ts`. Four inline
    casts of an untyped Json column replaced by one defensive function. A cast
    is not a check.
13. `connection_limit=1` on `DATABASE_URL` — **still to verify in Vercel**, see
    §7.4.

### 7.4 What is still open

1. **RLS policies with a non-owner Prisma role.** The scan test is a good
   second line; policies would be a floor. Until then, item 1's test is the
   whole of the enforcement.
2. **The three rate stores.** Unchanged and still the largest conceptual
   duplication in the system. The decision to make: `StudioFiledRate` is the
   source of truth (derived from their own documents, reviewed by ops),
   `StudioProduct` is their editable working copy, and `RateCardItem` is
   either retired or relabelled as the indicative marketplace bucket.
3. **`Quotation` / `QuotationLineItem`** look retired — written by the
   marketplace path, read nowhere in `app/studio/*`. Confirm and remove.
4. **Nothing writes the performance block.** `completedProjects`,
   `avgVarianceDays`, `upheldDisputes`, `specComplianceRate`,
   `communicationRating`, `autonomyProfile` have no writer anywhere, and both
   the matching score and the verification tier read them as fact. No studio is
   flattered — a zero is a zero — but two ranked outputs are ranking on a
   constant. Either the recompute job gets written or the inputs come out of
   the score. Recorded in the schema beside the columns so it cannot be
   forgotten again.
5. **`Studio.slug` copied into `StudioForm.slug`** — latent divergence if a
   slug ever changes.
6. **`PAUSED` exists twice**, as a status and as `pausedAt`/`pauseCause`.
7. **`/ops/applications` renders the frozen application** as though it were
   current.

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

One of the two places it was not clear has been closed, and one has not:

1. **What protects one studio from another** is still application code — but it
   is no longer only a habit. `tests/tenant-scope.test.ts` fails the build on
   any unscoped query, was proven against real regressions, and states in its
   own header that row-level security is not doing this job. Policies remain
   the proper floor.
2. **What a studio charges** still has three answers in three tables with
   nothing reconciling them. This is now the largest open question in the
   system and it is a product decision, not a refactor.

Everything else is maintenance, and §7.4 lists it.

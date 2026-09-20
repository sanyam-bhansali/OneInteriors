# Going live — the runbook

Taking One Interiors from "works on your machine" to "a studio in Pune is
using it", with the customer marketplace hidden behind a waitlist.

Work top to bottom. **Every step has a check, and you do not move on until the
check passes.** That is the whole method — most launch bugs are not hard, they
are a step that half-worked and nobody looked.

Tick the boxes as you go. If you stop halfway, you can come back and see where
you were.

---

## What you are building

| Hostname | Vercel project | What it serves |
| --- | --- | --- |
| `oneinteriors.in`, `www.` | **waitlist** | The cinematic waitlist page |
| `studio.oneinteriors.in` | **main app** | Studio practice software + `/apply` |
| `ops.oneinteriors.in` | **main app** | Your console |

The customer marketplace (`/quiz`, `/match`, `/compare`, `/expert`) is in the
main app and **has no hostname pointed at it**. That is the gate — not a flag,
an absence. Nothing answers for it.

---

## Stage 0 — Before you touch anything

- [ ] **0.1** Have these open in tabs: Vercel dashboard, Supabase dashboard,
      Resend dashboard, your domain registrar's DNS page.
- [ ] **0.2** Know where `oneinteriors.in` DNS is managed. That is your
      *registrar* unless you moved it — GoDaddy, Namecheap, Cloudflare,
      whoever. Everything in Stage 4 happens there.
- [ ] **0.3** Take note: you will be editing DNS. A wrong record takes the
      domain down until it propagates back. Nothing here is unrecoverable, but
      changes can take up to an hour to settle, so do this when you have a
      clear couple of hours rather than in the ten minutes before a call.

---

## Stage 1 — Prove the code builds

Do this **before** touching any infrastructure. If the build is broken you want
to know now, not after the DNS is half-cut-over.

- [ ] **1.1** In the repo:
  ```
  npm install
  npm run typecheck
  npm run lint
  npm run test
  npm run build
  ```
- [ ] **1.2 CHECK:** all five finish with no errors. `npm run build` is the
      one that matters most — framer-motion is a newish dependency and the
      rebuilt pages have never been prerendered on your machine.

> **If the build fails:** read the first error, not the last. Next prints the
> failing route. Nothing below this line will work until it passes, and a
> broken build on Vercel does not replace the running deployment — it just
> fails, so you would be live on old code without realising.

> **Done on 20 Sep.** Compiled in 4.7s, 23/23 static pages, middleware
> 34.5 kB.
>
> One thing to carry to Stage 9: `/studios/[slug]` built as **● SSG** with 8
> paths prerendered, although the page sets `dynamic = 'force-dynamic'`.
> `generateStaticParams` still runs at build time. `force-dynamic` should win
> at request time, but that is a should — when your first studio goes ACTIVE,
> confirm their profile appears **without a redeploy**. If it does not, the
> fix is to drop `generateStaticParams` from that page.

---

## Stage 2 — Push the code

There are **6 commits** waiting.

- [ ] **2.1** `git status` — should say nothing to commit.
- [ ] **2.2** `git push origin main`
- [ ] **2.3 CHECK:** Vercel shows a new deployment building. Wait for **Ready**.
- [ ] **2.4 CHECK:** open the deployment's `*.vercel.app` URL. Add `/studio` to
      it. You should get the studio sign-in, not a 404.

> **Why `/studio` works on a preview URL but the customer app does not:** an
> unrecognised hostname is treated as one-origin, so both products are
> reachable, but `CUSTOMER_LIVE` still gates the marketplace. That is
> deliberate — see `src/lib/host.ts`.

> **Done on 20 Sep.** `5dcd7ac..dfc7133` pushed to `origin/main`. 2.3 and 2.4
> still need your eyes on the Vercel dashboard.

---

## Stage 3 — Database

Supabase is already on Pro in the `Kairos` org. Nothing to move, nothing to
transfer.

- [ ] **3.1** Confirm what the database thinks is applied:
  ```
  npx prisma migrate status
  ```
- [ ] **3.2 CHECK:** it will list pending migrations. `20260920100000_studio_client_demo`
      should be among them.
- [ ] **3.3** Apply them:
  ```
  npm run db:deploy
  ```
- [ ] **3.4 CHECK:** `npx prisma migrate status` now says the schema is up to
      date.

> ### ⚠️ Never run these against production
>
> ```
> npx prisma db push          # reconciles the DB to the schema
> npm run db:migrate          # = prisma migrate dev
> npm run db:reset            # = prisma migrate reset
> ```
>
> `db:migrate` and `db:reset` now refuse on their own — a guard checks the
> hostname in the connection string and only allows localhost. `npx prisma db
> push` typed directly bypasses that, because there is no npm script in front
> of it to guard.
>
> `migrate deploy` is safe: it only applies migration files and never drops
> anything. The three above reconcile the database *to the schema*, so
> anything not in `schema.prisma` is removed.

- [ ] **3.5** Supabase → Database → Backups. Confirm a backup exists from
      *after* the migration. If not, take one.

> **Done on 20 Sep.** 23 migrations applied, `Database schema is up to date!`
> The first attempt at `20260920100000_studio_client_demo` failed on a table
> name and was resolved as rolled-back; the corrected one applied at 12:57.
> Two rows for that migration in `_prisma_migrations` is the correct end
> state — Prisma keeps the failed attempt as history.
>
> `prisma migrate dev` will still warn that this migration "was modified after
> it was applied", forever. It checksums every row including the rolled-back
> one, which holds the old SQL's checksum. `migrate deploy` and `migrate
> status` ignore rolled-back rows. Harmless; ignore it.

### If a migration fails partway (error P3018)

A failed migration is recorded as started-and-failed, and **every later
migration is blocked until it is cleared**. Nothing applied, so nothing needs
undoing — Postgres rolls back a failed statement — but Prisma will not move on
until you say so.

- [ ] **3.6** Read the `Database error` line. It names the real problem.
      `42P01 relation "X" does not exist` almost always means the SQL used a
      Prisma **model** name where the **table** name was required. This schema
      maps every model to snake_case: `StudioClient` is `studio_clients`.
- [ ] **3.7** Fix the migration file. Do **not** edit the database by hand.
- [ ] **3.8** Clear the failed record:
  ```
  npx prisma migrate resolve --rolled-back 20260920100000_studio_client_demo
  ```
  Use `--rolled-back`, never `--applied`. `--applied` tells Prisma the work was
  done, so the corrected SQL is skipped forever and the column never appears —
  a far worse state than the failure, because everything looks fine until a
  page 500s on a missing column.
- [ ] **3.9** Run `npm run db:deploy` again, and confirm with
      `npx prisma migrate status`.
- [ ] **3.10** `npm run test` before you retry. `tests/migration-names.test.ts`
      checks every migration's identifiers against the schema's `@@map`s and
      names the exact substitution needed.

---

## Stage 4 — The Supabase secret key

**Decided on 20 Sep: not rotating now.** What went through a chat was a
truncated fragment — the `sb_secret_` prefix and a few characters — and a
truncated key does not authenticate. (The fragment itself is no longer
written down anywhere in this repo; there is no reason to keep even part of
it.) The full key lives in two places, both of them fine:
`.env.local` (gitignored, confirmed untracked) and Vercel's environment
store.

This is a judgement, not an oversight, and the judgement rests on one
assumption. Check it, then move on:

- [ ] **4.1 CHECK:** the full key has never been pasted anywhere with
      retention — a chat, a ticket, a shared doc, a screenshot, a Slack
      message, a terminal whose scrollback syncs. If it has, rotate; §4.4
      below is how.
- [ ] **4.2 CHECK:** `git log --all -S "sb_secret" -- . ` returns nothing.
      A key that reached a commit is public even if the branch never shipped,
      and removing it later means rewriting history.
- [ ] **4.3** Put a date on it. Rotate on **first studio onboarded, or
      31 Dec 2026, whichever comes first.** A deferred rotation with no date
      is a rotation that never happens.

> **Why the date matters more than the fragment.** Right now the database
> holds fixtures and your own test rows. The moment studio #1 is live it
> holds a real practice's client list — names, addresses, what they are
> spending. The secret key bypasses Row Level Security entirely, so from
> that day the blast radius stops being yours and starts being theirs.

### 4.4 When you do rotate — nothing breaks

**`SUPABASE_SECRET_KEY` is not used by this application.** There is no
reference to it in `src/`, and `@supabase/supabase-js` is not a dependency.
The app reaches Postgres through **Prisma and the connection string**; it
never speaks to Supabase's REST API. So:

- [ ] Supabase → Project Settings → API Keys → roll the `service_role` /
      secret key.

That is the whole procedure. No Vercel env change, no `.env.local` change,
no redeploy, nothing to smoke-test — because nothing reads it.

> **Not using it does not make a leak safe.** The key authenticates against
> Supabase's own API regardless of what our code does with it; an attacker
> holding one does not need our app. Our non-use only means rotation is
> free, which is an argument *for* doing it, not against.
>
> Do not delete `SUPABASE_SECRET_KEY` from `.env.example` on the strength of
> this. It is documented there precisely so the next person knows what it is
> and why it must not be handed to the browser.

---

## Stage 5 — Resend

You have `oneinteriors.in` connected. Confirm it is actually finished — a
domain that is "added" but not verified sends nothing, silently.

- [ ] **5.1** Resend → Domains → `oneinteriors.in`.
- [ ] **5.2 CHECK:** **DKIM** and **SPF** both show **Verified**, not Pending.
      If either is pending, the DNS records Resend gave you are not live yet.
- [ ] **5.3** Note the exact from-address you will use. It must be **on that
      domain** — `hello@oneinteriors.in` works, a Gmail address does not.
- [ ] **5.4** Send yourself a test from the Resend dashboard and confirm it
      arrives, and is not in spam.

> **Done on 19 Sep.** `oneinteriors.in` verified, DKIM and SPF both green,
> sending region Tokyo (which is where Resend processes, not where mail is
> delivered — it costs about 100ms from the Mumbai deployment and is not
> worth changing).

> **If it lands in spam:** add a DMARC record at your DNS provider —
> `_dmarc` TXT `v=DMARC1; p=none; rua=mailto:you@oneinteriors.in`. Start at
> `p=none` so nothing is rejected while you watch.

---

## Stage 6 — Deploy the waitlist as its own project

- [ ] **6.1** Push the waitlist folder to its own Git repository.
- [ ] **6.2** Vercel → **Add New → Project** → import that repo.
- [ ] **6.3** Framework preset: **Other**. The `vercel.json` already sets
      `outputDirectory: public`, so leave the build settings alone.
- [ ] **6.4** Environment variables — set **one** of:
      - `WAITLIST_WEBHOOK_URL` — any endpoint accepting a JSON POST, or
      - `WEB3FORMS_KEY` — submissions arrive by email.
- [ ] **6.5** Deploy.
- [ ] **6.6 CHECK:** open the `*.vercel.app` URL. The room lights as you move
      the cursor, and **"For interior studios →"** sits top-right.
- [ ] **6.7 CHECK:** submit the form with your own address. Confirm it actually
      arrives wherever you pointed it. **With neither variable set the form
      accepts submissions and stores nothing** — it looks like it worked.

---

## Stage 7 — Domains

This is the part where order matters.

### 7a. The apex → waitlist

- [ ] **7.1** Waitlist project → Settings → Domains → **Add** `oneinteriors.in`.
- [ ] **7.2** Vercel prompts to add `www.oneinteriors.in` too. Say yes.
- [ ] **7.3** Vercel shows you the record to create. For an apex it is an
      **A record**, value `76.76.21.21` — **but use the value Vercel shows
      you**, not the one written here, in case it differs for your account.
- [ ] **7.4** At your DNS provider, create:

  | Type | Name | Value |
  | --- | --- | --- |
  | A | `@` | *(the value Vercel shows)* |
  | CNAME | `www` | *(the value Vercel shows)* |

- [ ] **7.5** Delete any existing A/AAAA/CNAME for `@` or `www` pointing
      somewhere else. Conflicting records are the single most common cause of
      "invalid configuration".

### 7b. The subdomains → main app

- [ ] **7.6** Main app project → Settings → Domains → **Add**
      `studio.oneinteriors.in`.
- [ ] **7.7** Add `ops.oneinteriors.in`.
- [ ] **7.8** Vercel shows a **CNAME** for each. **This is project-specific** —
      something like `d1d4fc829fe7bc7c.vercel-dns-017.com`. Copy the exact
      value from your own screen.

  | Type | Name | Value |
  | --- | --- | --- |
  | CNAME | `studio` | *(the value Vercel shows)* |
  | CNAME | `ops` | *(the value Vercel shows)* |

- [ ] **7.9 CHECK:** back in Vercel, both domains eventually show **Valid
      Configuration** with a certificate issued. This can take a few minutes.
      Refresh rather than re-adding.

> **Do not assign the apex to both projects.** Vercel will refuse the second
> one, which is a good error to get, but it wastes an hour if you are not
> expecting it.

> **If a domain says "in use by another Vercel account":** add the TXT record
> Vercel shows to verify you control it. One TXT at a time.

---

## Stage 8 — Environment variables

Main app → Settings → Environment Variables. **Production scope only** for the
host variables.

- [ ] **8.1** Set:

  ```
  STUDIO_HOST=studio.oneinteriors.in
  OPS_HOST=ops.oneinteriors.in
  PUBLIC_HOST=oneinteriors.in
  NEXT_PUBLIC_SITE_URL=https://studio.oneinteriors.in
  RESEND_API_KEY=<your key>
  EMAIL_FROM=One Interiors <hello@oneinteriors.in>
  ```

- [ ] **8.2** Leave `CUSTOMER_LIVE` **unset**. That is what keeps the
      marketplace closed.
- [ ] **8.3** Delete any `DEV_SHOW_UNVERIFIED_STUDIOS`, `DEV_SHOW_OTP_ON_SCREEN`,
      `DEV_OPS_NO_AUTH` from Vercel. The code refuses them in production
      anyway, but they should not be there to be refused.
- [ ] **8.4** Confirm `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET` and the
      Supabase variables are all present.
- [ ] **8.5** **Do NOT set the three `*_HOST` variables on Preview.** Previews
      rely on the unrecognised-host fallback to keep `/studio` and `/ops`
      reachable. Set them on Preview and you break your own testing.
- [ ] **8.6** Redeploy. Environment variables are read at build time — an
      existing deployment will not pick them up.

---

## Stage 9 — The smoke test

**Do not skip this.** This is where you find the bugs, and it takes ten
minutes.

### The routing

- [ ] **9.1** `oneinteriors.in` → the waitlist. Not the app.
- [ ] **9.2** `oneinteriors.in/match` → redirects to the waitlist.
- [ ] **9.3** `studio.oneinteriors.in` → the studio sign-in. **Not** the
      customer landing page.
- [ ] **9.4** `studio.oneinteriors.in/ops` → 404.
- [ ] **9.5** `ops.oneinteriors.in` → the ops sign-in.
- [ ] **9.6** `ops.oneinteriors.in/studio` → 404.
- [ ] **9.7** `studio.oneinteriors.in/apply` → the application form.
- [ ] **9.8** The "For interior studios" link on the waitlist lands on 9.7.

### The login loop — the one that matters

- [ ] **9.9** Create your ops account:
  ```
  npm run db:ops -- you@yourdomain.com "Your Name"
  ```
- [ ] **9.10** Go to `ops.oneinteriors.in`, enter that address.
- [ ] **9.11 CHECK:** the email arrives. Open it.
- [ ] **9.12 CHECK:** **the link points at `ops.oneinteriors.in`**, not the
      apex. This is the one that would have been a silent bug — sessions are
      host-only, so a link to the wrong host signs you in somewhere the right
      host cannot see, and you get bounced back to sign-in with no explanation.
- [ ] **9.13** Click it. You land in the ops console, signed in.
- [ ] **9.14** Refresh. **Still signed in.** If you are not, the cookie went to
      the wrong host — stop and tell me.

### The whole studio journey, on yourself

- [ ] **9.15** In a **private window**, go to `studio.oneinteriors.in/apply`.
      Apply as a fake studio with an address you can read.
- [ ] **9.16** Back in ops, `/ops/applications` — your application is there.
- [ ] **9.17** Approve it.
- [ ] **9.18 CHECK:** the welcome email arrives, and **its link points at
      `studio.oneinteriors.in`**.
- [ ] **9.19** Click it. You land in the studio setup checklist.
- [ ] **9.20** Open Leads. **CHECK:** the sample lead is on the board, badged
      "Sample", with a strip above explaining it.
- [ ] **9.21** Drag it to another column. It moves and stays moved.
- [ ] **9.22 CHECK:** the walkthrough still says **0/3**. The sample must not
      tick step one — if it does, the `LIVE` filter is not being applied
      somewhere.
- [ ] **9.23** Press "Remove the sample". It goes, and does not come back on
      refresh.

---

## Stage 10 — Your first real studio

Only once Stage 9 is entirely green.

- [ ] **10.1** Delete your fake studio from the database, or leave it — it is
      `ONBOARDING` and invisible to everyone.
- [ ] **10.2** Send the real studio to `studio.oneinteriors.in/apply`.
- [ ] **10.3** Approve at `ops.oneinteriors.in/applications`.
- [ ] **10.4** **Ring them.** Three emails in the flow are silent (see Known
      gaps): rejection, submitted-for-review, and gone-live. A studio who
      submits for review hears nothing until you call.
- [ ] **10.5** Record their fifteen checks at `ops.oneinteriors.in/verification`.
- [ ] **10.6** Flip them to **ACTIVE**.

### When the roster is real

- [ ] **10.7** Set `NEXT_PUBLIC_ROSTER_IS_REAL=1` in Vercel and redeploy. This
      removes the pre-launch disclosures and permanently disables the dev
      bypasses. Do it the day your first real studio goes ACTIVE — **not
      before**, because until then the invented fixture studios are still being
      served.

---

## If something breaks

| Symptom | Almost certainly |
| --- | --- |
| Domain shows "Invalid Configuration" | A conflicting A/AAAA/CNAME for the same name at your DNS provider. Delete the old one. |
| `studio.` serves the customer landing page | `STUDIO_HOST` not set, or set on the wrong scope, or you did not redeploy after setting it. |
| Signed in, then immediately signed out | The magic link pointed at the wrong host. Check 9.12. |
| Emails never arrive | Resend domain not fully verified, or `EMAIL_FROM` is not on that domain. |
| `/studio/clients` 500s | `db:deploy` was not run — the `isDemo` column is missing. |
| Everything 404s after a deploy | Middleware. Roll back in Vercel (below) and tell me. |
| Sample lead ticks the walkthrough | A `studioClient.count` missing the `LIVE` filter. `npm run test` will name it. |

### Rolling back

Vercel → Deployments → the last good one → **⋯ → Promote to Production**.
Instant, and it does not touch the database.

**Database changes do not roll back with it.** Every migration so far is
additive — new columns with defaults, new tables — so an older deployment runs
fine against the newer schema. That holds until a migration drops or renames
something; when one does, it needs its own plan.

---

## Known gaps — what is deliberately not finished

You are launching with these. None of them stops a studio using the software,
but you should know they are there rather than discover them.

1. **A brand-new practice cannot complete onboarding.** The portfolio step
   requires *three completed projects*, and unlike the GSTIN step there is no
   escape hatch. If your first studios are young, this is a hard stop.
2. **Rates are typed by hand.** Six figures, blank by design. The
   upload-your-archive flow is built as far as the engine (`ingestQuotations`)
   and has no upload screen yet.
3. **Three silent emails** — rejection, submitted-for-review, gone-live.
4. **The architect on `/expert` is a placeholder.** `ARCHITECT_IS_REAL = false`
   and the page names "Ira Deshmukh" with 12 years and 68 briefs read. Not
   customer-visible while the marketplace is closed, but it must not survive
   opening it.
5. **Quotes are priced on archive rates**, not each studio's own card —
   `ratesAreReal()` is `false`. The quote document says so on its face.
6. **DPDP consent is not recorded.** `recordQuizConsentAction` has no caller,
   `mayContact()` is enforced nowhere, and there is no `/privacy` route. This
   is the one I would not leave open long once you hold real studios' real
   client lists. See `docs/FINDINGS.md` §1.3.

Full list, ranked: `docs/FINDINGS.md`.

---

## Quick reference

```bash
# Local checks before any push
npm run typecheck && npm run lint && npm run test && npm run build

# Database
npx prisma migrate status      # what is pending
npm run db:deploy              # apply it — SAFE
npm run db:ops -- you@x.com "Name"   # create/promote an ops account

# NEVER against production
npx prisma db push
npm run db:migrate
```

| Variable | Value | Where |
| --- | --- | --- |
| `STUDIO_HOST` | `studio.oneinteriors.in` | main app, Production |
| `OPS_HOST` | `ops.oneinteriors.in` | main app, Production |
| `PUBLIC_HOST` | `oneinteriors.in` | main app, Production |
| `CUSTOMER_LIVE` | *unset* | set to `1` when the marketplace opens |
| `NEXT_PUBLIC_ROSTER_IS_REAL` | *unset* | set to `1` when studio #1 goes ACTIVE |
| `RESEND_API_KEY` | your key | main app, Production |
| `EMAIL_FROM` | `One Interiors <hello@oneinteriors.in>` | main app, Production |
| `WAITLIST_WEBHOOK_URL` *or* `WEB3FORMS_KEY` | your endpoint | waitlist project |

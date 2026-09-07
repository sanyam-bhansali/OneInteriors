# Database setup — Supabase + Prisma

Project: `tkxuvtctaknmymtuvcuo`

The app runs **without a database** on fixture studios. Adding these variables
switches it to Postgres; removing them switches it back. Nothing else changes.

---

## 1. Get the two connection strings

Supabase dashboard → **Project Settings → Database → Connection string**.

You need **both**, and the distinction is not optional:

| Variable | Which string | Port | Used by |
|---|---|---|---|
| `DATABASE_URL` | **Transaction pooler** (Supavisor) | `6543` | PrismaClient at runtime |
| `DIRECT_URL` | **Direct connection** | `5432` | Prisma CLI for migrations |

```bash
# .env.local  — never commit this file
DATABASE_URL="postgresql://postgres.tkxuvtctaknmymtuvcuo:YOUR_PASSWORD@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres:YOUR_PASSWORD@db.tkxuvtctaknmymtuvcuo.supabase.co:5432/postgres"
```

Copy the exact hostnames from the dashboard rather than typing them — the
pooler region is in the string and varies by project.

**Why both.** Serverless functions open a connection per invocation, so runtime
traffic must go through the pooler or the direct connection limit is exhausted
almost immediately. But **migrations through the pooler hang or fail** — it is
the most common Prisma + Supabase problem. `directUrl` in `schema.prisma` is
what keeps them apart.

`connection_limit=1` on the pooled URL is deliberate for serverless: each
function instance should hold one connection, not a pool of its own.

---

## 2. Create the schema

```bash
npm install          # postinstall runs `prisma generate`
npm run db:migrate   # creates the migration and applies it
```

If `db:migrate` hangs, `DIRECT_URL` is wrong or pointing at port 6543.

---

## 3. Seed (development only)

```bash
npm run db:seed
```

Loads the eight fixture studios. **They are invented and their GSTINs are
deliberately invalid** — a made-up GSTIN with a valid checksum could collide
with a real registered business.

The seed **refuses to run** if the database already holds studios that are not
fixtures, so it cannot scribble over the real pilot cohort. Override with
`SEED_FORCE=1` only if you are certain.

---

## 4. Vercel

Add both variables under **Settings → Environment Variables**, then redeploy —
env changes do not take effect until a new deploy.

Set the function region to **Mumbai (bom1)** under Settings → Functions. Now
that queries hit a database this matters: the default US region adds a
round-trip to every request, and your database, studios and customers are all
in India.

---

## Notes

## Keys, and which of them matter

| Key | Public? | What protects it |
|---|---|---|
| `SUPABASE_URL` | Yes | Nothing — it's just an address |
| `SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`) | **Yes, by design** | **Row Level Security, and nothing else** |
| `SUPABASE_JWKS_URL` | Yes | Public endpoint; it exists to publish signing keys |
| Database password (inside the Prisma URLs) | **No** | `.env.local` and Vercel only |
| `SUPABASE_SECRET_KEY` (`sb_secret_…`) | **No — this is the dangerous one** | Nothing. It **bypasses RLS entirely.** |

### The secret key

`sb_secret_…` (and the legacy `service_role` key) is not a stronger version of
the publishable key — it is a different category. It bypasses Row Level
Security completely: full read and write on every table, all storage, admin
operations. Anyone holding it has your database.

Rules:

- **Server-only.** Never prefix it with `NEXT_PUBLIC_` — that inlines it into
  the browser bundle and publishes it to every visitor.
- **Never commit it, and never send it through chat, Slack or email.** Anything
  transmitted that way should be considered exposed.
- **If exposed, rotate immediately**: Supabase → Project Settings → API Keys →
  roll the secret key. Rotation costs a redeploy. A leaked RLS-bypass key costs
  the database.
- **We do not currently need it.** Prisma authenticates with the database
  password. Leave `SUPABASE_SECRET_KEY` blank until something genuinely
  requires admin access, and prefer a scoped approach when it does.

The publishable key is meant to ship in the browser bundle — that is not a
leak. But it is worth being precise about what makes it safe: **the key is not
the security boundary, RLS is.** With RLS off, that public key is full read and
write on every table in the project, for anyone who opens devtools.

Nothing in the app uses it yet. It arrives with OI-5c, when milestone photos
and verification evidence need somewhere private to live.

**Before anything talks to Supabase with that key**, decide the policies. Two
rules for us specifically:

- Verification evidence and milestone photos go in **private** buckets, reached
  through signed URLs. A studio's site photographs and a client's home are not
  public objects.
- Studio rate cards are commercially sensitive (see `QUOTATION-BUILDER.md`).
  Whatever policy governs them must not let one studio read another's.

---

## Notes

**Row Level Security.** Supabase enables RLS on new tables and, with it on and
no policy, reads and writes **silently return nothing rather than erroring** —
a genuinely confusing failure that looks like a bug in your code.

Prisma connects as the `postgres` role and bypasses RLS, so this does not bite
us today. It will the moment anything uses the publishable key. Decide the
policy deliberately then — do not disable RLS to make a bug go away, because
that is precisely the setting the public key depends on.

**Tier is recomputed on read.** `PrismaStudioRepository` recomputes each
studio's tier from its checks rather than trusting the column, so a stale or
hand-edited value can never reach the UI. The stored column exists only so
`tierDrift()` can detect disagreement. Keep this if you write another
repository.

**Money.** Columns are `BigInt` paise, the domain is integer `number` paise.
`fromDb` / `toDb` in `src/lib/money.ts` convert at the boundary and throw
rather than lose precision. Do not convert anywhere else.

**`deepmerge-ts` override.** Prisma 6.19 depends on a version with a
high-severity advisory (GHSA-ggr8-5vv4-36mx), and `npm audit fix` wants to
*downgrade* Prisma to 6.12 to resolve it. The override to `^8.0.0` fixes it
without the downgrade. `npm audit` reports zero. See `DEPENDENCIES.md`.

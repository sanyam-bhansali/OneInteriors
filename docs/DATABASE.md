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

**Row Level Security.** Supabase enables RLS on new tables and, with it on and
no policy, reads and writes silently return nothing rather than erroring — a
genuinely confusing failure. Prisma connects as the `postgres` role and
bypasses RLS, so this does not bite us today. It will the moment anything talks
to Supabase with the anon key. Decide deliberately then; do not disable RLS to
make a bug go away.

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

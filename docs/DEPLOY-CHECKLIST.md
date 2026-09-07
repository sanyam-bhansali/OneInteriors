# Deploy checklist

Run through this before each production deploy. It is short on purpose — every
line is here because getting it wrong has a real consequence, not because it is
tidy.

---

## Before the first deploy

### Vercel environment variables

Settings → Environment Variables. **Env changes need a redeploy to take effect.**

| Variable | Value | If you get it wrong |
|---|---|---|
| `DATABASE_URL` | Transaction pooler, `:6543`, `?pgbouncer=true&connection_limit=1` | Connection exhaustion under load |
| `DIRECT_URL` | Session pooler, `:5432` | Migrations hang |
| `NEXT_PUBLIC_SITE_URL` | The deployed URL | Wrong canonical URLs in metadata |
| `NEXT_PUBLIC_ROSTER_IS_REAL` | **Leave unset** | Setting it to `1` hides the "these studios are placeholders" notice while the roster is still invented |
| `OPS_PREVIEW` | **Leave unset** | `1` exposes the unauthenticated ops console publicly |

Do **not** set `SUPABASE_SECRET_KEY`. Nothing uses it, and it bypasses RLS.

### Settings

- [ ] **Functions region → Mumbai (`bom1`)**. The database is `ap-south-1`; the default US region adds a round-trip to every query.
- [ ] **Node version → 22.x**, matching `engines`.
- [ ] Repo is **private** — `CONTRIBUTING.md`, `docs/` and the commit history carry pricing, the Hauspire arrangement and the verification methodology.

### Database

- [ ] `npx prisma migrate deploy` has run against production, **including `20260907180000_enable_rls_lockdown`**.
- [ ] Verify the lockdown actually took, with the publishable key:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "$SUPABASE_URL/rest/v1/studios?select=*" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY"
# 401 = correct.  200 = every table is publicly readable. Stop and fix.
```

This is not paranoia: it returned **200 for reads and 204 for writes** before
that migration existed. Prisma creates tables with raw SQL and RLS is off by
default; only tables made through the Supabase UI get it automatically.

---

## Every deploy

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm audit          # must be 0
```

CI runs all of these on every PR (`.github/workflows/ci.yml`). If CI is green,
this is a formality — but run it before a release tag anyway.

- [ ] Migrations reviewed, reversible or rollback written down
- [ ] Money paths: integer paise, `applyBps` for rates, `splitAcross` for splits — no bare `*` or `/`
- [ ] No new customer-facing claim that isn't backed by a row
- [ ] Nothing implies we hold client funds (see `FUTURE-SCOPE.md` §1)

---

## While the roster is still fixtures

- [ ] `robots: noindex` stays in `src/app/layout.tsx`. The studios are invented and the brand name is not settled; an early crawl is hard to undo.
- [ ] `NEXT_PUBLIC_ROSTER_IS_REAL` unset, so the pre-launch notice shows.
- [ ] The eight fixture GSTINs are **deliberately checksum-invalid** so they cannot collide with a real registered business. A test enforces this. Do not "fix" them.

## The day the real cohort goes in

1. Delete the fixture studios (`prisma/seed.ts` refuses to run alongside real ones, but deletion is manual).
2. Set `NEXT_PUBLIC_ROSTER_IS_REAL=1`, redeploy.
3. Remove `robots: noindex`.
4. Re-run the RLS curl check.

---

## Known gaps at this deploy

Stated plainly so nobody discovers them by accident:

- **`/ops` has no authentication.** It is 404'd outside development by `src/middleware.ts` and carries a red banner. That is a lock on a door, not a security model — it comes out in the PR that adds real auth (OI-3).
- **No auth at all yet.** No accounts, no sessions. The quiz is session-scoped in the browser and nothing is persisted server-side.
- **Briefs are not stored.** `sessionStorage` only, so they do not survive a device change. Server-side persistence is OI-4.
- **The delivery figures are fixture data.** Every number on the site is currently invented, which is what the pre-launch notice says.

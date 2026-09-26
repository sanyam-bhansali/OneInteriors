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

`SUPABASE_SECRET_KEY` **is required**, and this line used to say the opposite.

It said "do not set it, nothing uses it, and it bypasses RLS." The second
clause stopped being true the day storage was built: seven modules read it —
every one of the five buckets plus the archive extractor and the ops readiness
screen. Following the old instruction does not produce an error. It produces a
studio surface where business proof, portfolio images, quotation archives and
logos all quietly report themselves as "not switched on", and a studio asking
where the upload button went.

The third clause is still true and is the reason for the care: this key
bypasses row-level security, so it is server-only. It must never be prefixed
`NEXT_PUBLIC_`, and `tests/security-invariants.test.ts` fails the build if it
ever reaches a client component.

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

- [ ] **Migrations applied to production BEFORE the push.** Vercel deploys on
      push, so pushing first opens a window where new code runs against the
      old schema. That is not hypothetical: it is how the rates page 500'd in
      production earlier this month. Run `npm run db:deploy`, confirm it, then
      push.
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

Three entries that used to sit here — "`/ops` has no authentication", "no auth
at all yet", "briefs are not stored" — were all fixed and none of them was
struck out. A gaps list nobody prunes is read as fiction, including the entries
that are still true. What follows is current as of 26 Sep 2026.

- **Tenant isolation is application code, not row-level security.** Thirty
  tables have RLS enabled and forced, and there are zero policies; Prisma
  connects as the owner, for whom RLS is not enforced. Every
  `where: { studioId }` is the only thing between two studios' data.
  `tests/tenant-scope.test.ts` fails the build on an unscoped query, which is
  a good second line and not a floor. See `docs/DATA-ARCHITECTURE.md` §4.2.
- **Nothing writes the studio performance block.** `completedProjects`,
  `avgVarianceDays`, `upheldDisputes`, `specComplianceRate`,
  `communicationRating` and `autonomyProfile` have no writer anywhere, and
  both the matching score and the verification tier read them as fact. No
  studio is flattered — a zero is a zero — but two ranked outputs are
  currently ranking on a constant.
- **A studio's rate has three homes.** `RateCardItem`, `StudioFiledRate` and
  `StudioProduct.ratePaise`, with nothing reconciling them.
- **The delivery figures are fixture data** until the real cohort goes in,
  which is what the pre-launch notice says.

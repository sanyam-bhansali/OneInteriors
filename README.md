# One Interiors

Curated interior-design marketplace for Pune. Responsive web (mobile and desktop),
to be wrapped with Capacitor for Play Store and App Store from the same codebase.

- **How we work:** [`CONTRIBUTING.md`](./CONTRIBUTING.md) — branching, versioning, bug policy
- **Architecture:** [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- **Dependencies:** [`docs/DEPENDENCIES.md`](./docs/DEPENDENCIES.md) — why anything is pinned or overridden

---

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. **v0.1 needs no database and no environment variables** —
it runs entirely on fixture studios in `src/data/studios.ts`, so it deploys to
Vercel with an empty environment.

> If `node_modules` already exists from a partial install, delete it first.

```bash
npm run typecheck   # tsc --noEmit
npm run test        # vitest — money + matching logic
npm run lint
npm run build
npm audit           # should report 0 vulnerabilities
```

Two install-time warnings are expected and explained in
[`docs/DEPENDENCIES.md`](./docs/DEPENDENCIES.md):

- **`eslint@9.39.5` is deprecated** — a support-lifecycle notice, not a
  vulnerability. `eslint-config-next` does not work with ESLint 10 yet; we
  tested it and it fails to load. Move both together at the next Next upgrade.
- **`allow-scripts` prompt** for `sharp`, `esbuild`, `unrs-resolver` — all
  legitimate, they fetch platform-native binaries. Run
  `npm approve-scripts --allow-scripts-pending`. Vercel enables scripts by
  default, so this is a local-machine thing only.

## Deploy to Vercel

The repo is initialised on `main` with the first commit already made. Two steps
are yours because they need your credentials:

```bash
# 1. Create an empty repo on GitHub (no README, no .gitignore), then:
git remote add origin https://github.com/<you>/one-interiors.git
git push -u origin main
```

2. Import it at **vercel.com → Add New → Project**. The Next.js preset is
   detected automatically — leave build command, output directory and install
   command untouched. **No environment variables are needed**; v0.1 runs on
   fixture data.

After the first deploy:

- Set `NEXT_PUBLIC_SITE_URL` to the deployed URL (Project → Settings →
  Environment Variables), then redeploy.
- Set the function region to **Mumbai (bom1)** under Settings → Functions.
  Irrelevant while every page is static, but it matters the moment API routes
  and Postgres land in Sprint 3 — everything and everyone is in India.
- Vercel gives every branch a preview URL. `main` is the staging environment
  per `CONTRIBUTING.md`; production should deploy from a `release/x.y` tag once
  there is anything real to protect.

`robots` is set to `noindex` in `src/app/layout.tsx`. Leave it that way until
the brand name is settled — an early crawl of a placeholder brand is hard to
undo, and the studios shown are still fixtures.

---

## What is built

| Route | State |
|---|---|
| `/` | Landing. Escrow-first promise, proof strip computed from real fixture rows. |
| `/quiz` | The 9-question brief with live profile panel. Session-scoped, no signup. |
| `/match` | Reveal (comprehension before the ask) + ranked studios with reasoning. |
| `/studios` | The full roster. |
| `/studios/[slug]` | Profile: track record, 12-check verification list with sources and dates, tagged portfolio. |
| `/verification` | How verification works and what it does not prove. |

**Not built yet** — escrow, contracts, milestones, quotation builder, studio
dashboard, ops console, auth. See the sprint plan in the build plan document.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript | One codebase for customer, studio and ops surfaces. Server components give real SEO on locality cost pages — a primary organic channel. |
| Styling | Tailwind v4 + CSS custom properties | Tokens live in `globals.css` as the single source of truth, shared with the wrapped app. |
| Database | Postgres + Prisma | Escrow ledgers, milestone chains and verification records are relational, not document-shaped. Schema is in `prisma/schema.prisma`, not yet wired up. |
| Auth | WhatsApp OTP (planned) | Phone is the identity. No passwords, no email requirement. |
| Payments | Escrow partner behind an adapter | The provider must be swappable. |
| Mobile | Capacitor (planned) | Store presence for trust from one codebase. Needs real native capability — camera, push, share — or Apple rejects it under Guideline 4.2. We need all three anyway. |

---

## Conventions that are not negotiable

**Money is integer paise.** Never rupees, never a float. `₹8,50,000` is `85000000`.
All formatting and arithmetic goes through `src/lib/money.ts` — `applyBps` for
rates, `splitAcross` for milestones. A rounding error in an escrow release is an S1.

**Currency renders in the Indian numbering system.** Lakh and crore grouping.
`formatINR()` handles it — never hand-roll `toLocaleString` for this.

**Unmeasured is not zero.** Anywhere the product makes a claim about a studio —
match score, delivery variance, dispute count — a missing value renders as
"not enough data yet", never as a favourable default. The matching engine returns
`null` for unmeasurable factors and normalises over measured weight only, so a
cold-start studio shows "matched on 4 of 6 factors" rather than a fabricated 94%.
This is the entire brand; it is enforced in `score.ts` and covered by tests.

**Verification claims are backed by rows.** A profile says "GST portal · 12 Aug 2026"
because a `VerificationCheck` says so. There is no hardcoded badge in the codebase.

**Escrow and audit tables are append-only.** Corrections are new rows.

---

## Fixture data

`src/data/studios.ts` contains **eight invented studios**. None are real
businesses and no GSTIN in that file is a real registration. They exist so the
matching engine and UI can be built before the first real cohort is onboarded.

The fixtures deliberately include studios with **no delivery record** — that is
the real day-one state, and the UI has to handle it honestly, so it must be
representable in the fixtures. Replace the file wholesale in Sprint 3 with the
6–8 real pilot studios; the `Studio` type in `src/modules/studio/types.ts` is
the contract.

The pre-launch notice in the footer (`src/components/chrome.tsx`) must stay until
those fixtures are gone.

# Working in this repo

The two things this document exists to protect: **you can always ship a version
you can name**, and **you can always find which version introduced a bug**.
Everything below serves one of those.

---

## 1. Branching

Trunk-based, with short-lived branches. `main` is always deployable.

```
main ─────●────────●────────●────────●──────▶  always green, auto-deploys to staging
           \      /          \      /
            feat/            fix/
```

| Branch | Purpose | Lifetime |
|---|---|---|
| `main` | Always deployable. Protected. No direct pushes. | permanent |
| `feat/<module>-<slug>` | One feature. e.g. `feat/matching-cold-start` | < 3 days |
| `fix/<issue>-<slug>` | One bug. e.g. `fix/412-escrow-double-release` | < 1 day |
| `chore/<slug>` | Deps, config, CI | < 1 day |
| `release/x.y` | Cut at a version. Only fixes land here. | until x.y is retired |

**If a branch lives longer than three days, it is too big.** Split it. Long
branches are where merge conflicts and half-tested code come from, and they are
the single most common reason small teams stop being able to ship cleanly.

Never branch off a branch. Always branch from `main`.

---

## 2. Commits

[Conventional Commits](https://www.conventionalcommits.org/). The format is not
decoration — the changelog and the version bump are generated from it.

```
<type>(<module>): <imperative summary>

<body: why, not what>

Refs: #<issue>
```

Types: `feat` `fix` `perf` `refactor` `docs` `test` `chore` `revert`

```bash
feat(matching): score over measured factors only

Cold-start studios have no delivery record. Previously the missing 15%
was redistributed across the other factors, which produced a flattering
94% for a studio we knew nothing about. Now returns factorsScored so the
UI can say "matched on 4 of 6".

Refs: #128
```

`feat` → minor bump. `fix` → patch bump. `BREAKING CHANGE:` in the footer → major.

---

## 3. Versioning

Semver, on the whole application: `MAJOR.MINOR.PATCH`.

- **PATCH** — bug fixes, no behaviour change for a correct user
- **MINOR** — new capability, backwards compatible
- **MAJOR** — a contract changes: API shape, a DB column's meaning, a price

Version bumps are generated, never hand-edited. Tag on `main`:

```bash
npm version <major|minor|patch>   # bumps package.json and tags
git push --follow-tags
```

### Things that carry their own version

Two subsystems are versioned **independently of the app**, because old records
must never be reinterpreted under new rules:

| Subsystem | Constant | Why |
|---|---|---|
| Matching engine | `ENGINE_VERSION` in `src/modules/matching/score.ts` | A `Match` row stores the engine version that produced it. Changing weights must never silently rescore a match a customer already saw. |
| Consent policy | `policyVersion` on `Consent` | DPDP: consent is given against a specific policy text. If the text changes, prior consent does not carry over. |

Bump these deliberately, in their own commit, with the reason in the body.

---

## 4. Releases

```
feat/* ──▶ main ──▶ staging (auto) ──▶ release/x.y ──▶ production (manual)
```

1. Merge to `main` → deploys to staging automatically.
2. When a set of changes is ready, cut `release/x.y` from `main`.
3. Run the release checklist (below). Deploy to production from the tag.
4. Hotfixes branch from the release tag, land on `release/x.y`, then cherry-pick
   back to `main`. **Never fix only on the release branch** — that is how a bug
   comes back two versions later.

### Release checklist

- [ ] CI green on the release commit
- [ ] Migrations reviewed — every one reversible, or the rollback documented
- [ ] Migration run against a **copy of production data**, not just a dev DB
- [ ] Escrow flows tested end-to-end in the provider's sandbox
- [ ] Money paths checked: no float arithmetic anywhere, GST rounding correct
- [ ] `CHANGELOG.md` reads like something a human wrote
- [ ] Rollback plan written down before deploy, not after

---

## 5. Database migrations

The riskiest thing in the repo. Money and the trust record live here.

- One migration per PR. Never edit a migration that has run anywhere.
- **Expand → migrate → contract.** Add the new column, backfill, ship code that
  writes both, *then* drop the old column in a later release. Never rename in one
  step; a rename is a drop plus an add, and it breaks the running deploy.
- Every migration is reviewed by someone who did not write it.
- `EscrowTransaction` and `AuditLog` are **append-only**. Corrections are new
  rows. If you find yourself writing an `UPDATE` against either, stop and ask.

---

## 6. Bugs

### Severity

| Sev | Definition | Response |
|---|---|---|
| **S1** | Money is wrong, escrow stuck, data exposed across accounts | Drop everything. Hotfix branch now. |
| **S2** | A core flow is blocked with no workaround (quiz, match, booking) | Fixed in the current sprint, before new feature work |
| **S3** | Broken with a workaround, or affects one surface | Next sprint |
| **S4** | Cosmetic, copy, minor layout | Backlog |

### The rule that keeps the count down

**A bug fix is not done until a test reproduces it.** Write the failing test
first, then fix it. Without this, the same bug returns — and in a system where
`fix/` branches touch escrow, the same bug returning is a refund.

### Report format

```
What happened:
What should have happened:
Steps: 1. 2. 3.
Environment: prod / staging | version | browser/device
Project reference (if money involved): OI-PN-2026-XXXX
Sev: S1 | S2 | S3 | S4
```

Anything touching escrow, commission, or a published verification claim is
**S1 or S2 by default**. Those three are the product; a bug in them is not cosmetic.

---

## 7. Definition of done

A PR is not done until all of these are true.

- [ ] Types check, lint clean, tests pass
- [ ] New logic has tests — money and matching logic need *unit* tests, not just a click-through
- [ ] Works at 360px wide and at 1440px. Both are shipped surfaces.
- [ ] Keyboard reachable, visible focus, labelled inputs
- [ ] Renders correctly in light and dark
- [ ] No secrets, no PII in logs, no raw IPs — hash them
- [ ] Environment variables read with `||` / a truthiness check, **never `??`** — see below
- [ ] Money as **integer paise** via `src/lib/money.ts`. **No floats in a money path, ever.** Use `applyBps` for rates and `splitAcross` for milestones — never a bare `*` or `/`
- [ ] Currency renders in the Indian system: `₹8,50,000` not `₹850,000`
- [ ] Strings go through the i18n layer — Marathi and Hindi are phase 3 and retrofitting is miserable
- [ ] Anything a customer sees that makes a claim about a studio is backed by a real row, not a placeholder

---

## 8. Environment variables — the `??` trap

This one already cost us a broken production deploy, so it is a rule rather
than a preference.

```ts
// WRONG — fails on Vercel, works locally
new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000')

// RIGHT
import { siteUrl } from '@/lib/site';
```

`NEXT_PUBLIC_*` variables are inlined at **build** time. A variable that is
merely *declared* but empty — which is what Vercel provides for unset public
vars — arrives as `''`, not `undefined`. `??` only catches `null` and
`undefined`, so the fallback never fires, and `new URL('')` throws
`ERR_INVALID_URL` during page-data collection.

It passes locally because there the variable is genuinely undefined. That
asymmetry is exactly what makes it dangerous: local green, deploy red.

**Read env vars with a truthiness check, and never let a bad value throw at
module scope.** `src/lib/site.ts` is the pattern to copy — resolve, trim,
degrade to a safe default, and cover it with tests.

---

## 9. Module boundaries

`src/modules/*` is the domain layer. Each module owns its logic and exposes a
public surface through its `index.ts`.

```
modules/
  brief/         quiz, customer profile
  studio/        profiles, portfolio, rate card
  verification/  tier state machine, registry lookups
  matching/      scoring engine          ← versioned separately
  quotation/     indicative + firm quotes
  project/       milestones, evidence
  escrow/        ledger, provider adapter ← append-only
  billing/       subscription, commission ledger
  allocation/    guarantee tracking, credit rollover
  notification/  whatsapp, push, email
```

**Rules:**

1. A module may import another module only through its `index.ts`. Never reach
   into `../escrow/internal/whatever`.
2. `app/` may import from `modules/`. `modules/` may never import from `app/`.
3. No module imports React. Domain logic stays renderable-agnostic — this is what
   lets the same logic serve web and the Capacitor build without a second codebase.
4. If two modules keep needing each other, they are one module. Merge them rather
   than building a circular import you will fight for a year.

---

## 10. Environments

| Env | Branch | Data | Payments |
|---|---|---|---|
| local | any | seeded | provider sandbox |
| staging | `main` | anonymised copy | provider sandbox |
| production | `release/x.y` tag | real | live |

Production data never leaves production. If you need real data to debug, use the
anonymisation script — it scrubs phone, name, email, and address while keeping
the shape of the record intact.

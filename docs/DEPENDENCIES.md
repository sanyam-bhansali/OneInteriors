# Dependency decisions

Why anything in `package.json` is pinned, overridden, or deliberately absent.
Update this whenever you change one of them — a pin with no recorded reason gets
"cleaned up" by someone six months from now and the problem comes back.

---

## Overrides

```json
"overrides": {
  "postcss": "^8.5.28",
  "sharp": "^0.35.4"
}
```

### `postcss` → `^8.5.28`

Next 15.5.25 pins `postcss@8.4.31` internally. That version carries four
advisories, the significant ones being **GHSA-6g55-p6wh-862q** and
**GHSA-r28c-9q8g-f849**: an attacker-controlled `sourceMappingURL` in a CSS
comment can cause arbitrary `.map` file disclosure.

Tailwind and Vite were already resolving `postcss@8.5.28` in the same tree, so
the override just aligns Next onto the patched version everything else uses.
It is a minor bump inside 8.x — no API change — and the build is verified green
with it.

The alternative npm offers is upgrading to Next 16, which is a semver-major
change we do not need yet. Revisit at the next planned Next upgrade; if Next 16
ships with a patched postcss, drop this override.

### `sharp` → `^0.35.4`

Next depends on `sharp@0.34.5`, which inherits four libvips CVEs
(**GHSA-f88m-g3jw-g9cj**: CVE-2026-33327, -33328, -35590, -35591). `0.35.4` is
patched and API-compatible for Next's image optimisation use.

Relevant to us because milestone site photos and studio portfolios are
user-uploaded images that will pass through image processing. This is not a
theoretical exposure once Sprint 6 lands.

**Result: `npm audit` reports 0 vulnerabilities.**

---

## Pinned back

### `eslint` stays on `9.39.5`

npm prints a deprecation warning on install:

```
npm warn deprecated eslint@9.39.5: This version is no longer supported.
```

This is a **support-lifecycle notice, not a vulnerability** — `npm audit` is
clean. ESLint 9.x is in maintenance and 10.x is current.

We cannot move yet. `eslint-config-next@15.5.25` declares
`eslint: "^7.23.0 || ^8.0.0 || ^9.0.0"`, and forcing v10 fails outright:

```
Error: Cannot read config file: node_modules/eslint-config-next/index.js
Error: Failed to patch ESLint because the calling module was not recognized.
```

`@rushstack/eslint-patch`, which `eslint-config-next` uses, does not recognise
ESLint 10's module layout. Tested and confirmed, not assumed.

**Move to ESLint 10 when `eslint-config-next` declares support for it** — likely
alongside the Next 16 upgrade. Both changes want to happen in the same PR.

---

## Deliberately not installed

### `prisma` / `@prisma/client`

`prisma/schema.prisma` is written and reviewed, but nothing imports it yet — the
app runs entirely on fixtures in `src/data/studios.ts` until Sprint 3.

Installing the CLI early bought us three high-severity advisories
(`deepmerge-ts` stack exhaustion via `@prisma/config`) in exchange for nothing,
plus a slow `postinstall` that downloads query engines on every CI run.

**Add it back in Sprint 3**, when Postgres is provisioned:

```bash
npm install prisma --save-dev
npm install @prisma/client
```

and restore the scripts:

```json
"db:generate": "prisma generate",
"db:migrate":  "prisma migrate dev",
"db:studio":   "prisma studio"
```

---

## Install scripts

npm may prompt about packages with install scripts:

```
npm warn allow-scripts   esbuild@0.28.2 (postinstall: node install.js)
npm warn allow-scripts   sharp@0.34.5 (install: node install/check.js)
npm warn allow-scripts   unrs-resolver@1.12.2 (postinstall: node postinstall.js)
```

All three are legitimate and needed — they fetch or verify the correct native
binary for the platform. `sharp` in particular will not work without it.

```bash
npm approve-scripts --allow-scripts-pending    # review, then allow
```

Vercel runs installs with scripts enabled by default, so this only affects local
machines. Treat any *new* name appearing in that list as something to look at
before approving — a package that suddenly starts running install scripts is
worth thirty seconds of attention.

---

## Checking this yourself

```bash
npm audit                # should report 0 vulnerabilities
npm run audit            # production dependencies only
npm outdated             # what has moved on
```

If `npm audit` ever reports something, resolve it the same way: work out whether
we are actually exposed, prefer an override to a major upgrade, and write down
what you decided here.

# Dependency decisions

Why anything in `package.json` is pinned, overridden, or deliberately absent.
Update this whenever you change one of them — a pin with no recorded reason gets
"cleaned up" by someone six months from now and the problem comes back.

---

## Overrides

```json
"overrides": {
  "postcss": "^8.5.28",
  "sharp": "^0.35.4",
  "deepmerge-ts": "^8.0.0"
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

### `deepmerge-ts` → `^8.0.0`

Prisma 6.19 depends on a version carrying **GHSA-ggr8-5vv4-36mx** (stack
exhaustion on recursive object graphs) via `@prisma/config`.

`npm audit fix` wants to resolve this by **downgrading Prisma to 6.12**, which
is a semver-major move backwards and gives up seven minor versions of fixes.
The override to the patched `deepmerge-ts@8` fixes the advisory while keeping
Prisma current.

Re-check at each Prisma upgrade; drop the override once Prisma ships with an
unaffected version.

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

## Installed in Sprint 3

### `prisma` / `@prisma/client`

Added when Supabase was provisioned. `postinstall` runs `prisma generate` so
the client types exist after a clean clone — the build typechecks against them.

It brought back the `deepmerge-ts` advisory, handled by the override above
rather than by the downgrade npm suggests.

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

## `lucide-react` — added 26 Sep 2026

The studio surface had around twenty hand-drawn inline SVGs, each defined
locally in the file that used it, at `strokeWidth={1.5}`. They were fine and
they were twenty separate drawings of things like a phone and a pin, with no
way to be sure two files drew the same concept the same way.

Lucide is the set the onboarding mockup was built against, so adopting it
matches the intended design exactly rather than approximating it, and its
house geometry — 24×24, stroke 2, round caps and joins — is what makes those
icons read as friendly rather than technical. That roundness is the point:
this surface is a person setting up their business, not a control panel.

**Tree-shaken per icon.** Every icon is its own module, so importing six costs
six; the package's size on npm is not the size in the bundle. That is the only
reason a 1.4MB dependency is acceptable for something we were already drawing
by hand.

**Pinned loosely (`^1.48.0`)** because the icon set only ever grows — new
icons are added, existing paths are stable. A minor bump cannot change a shape
already in use.

Rules for using it here:

- `size: 18, strokeWidth: 2, absoluteStrokeWidth: true` beside body copy;
  `size: 24` for a panel's own icon. `absoluteStrokeWidth` keeps the line the
  same weight when the size changes, which is what stops a 24px icon looking
  heavier than an 18px one beside it.
- Colour comes from `currentColor` via a Tailwind text class, never a `stroke`
  prop, so an icon inherits the state of the thing it sits in.
- An icon labels a **choice** — upload or type by hand — or marks a panel.
  It does not decorate a sequence: four icons across four numbered steps is
  four shapes to decode where only the order matters.

### The sweep, and the one exception

Onboarding is fully converted: seventeen hand-drawn SVGs across thirteen files
are now twelve lucide imports and one shared `icon-sizes.ts`. Six of the
seventeen were the same tick, redrawn six times at three different stroke
weights, which is the argument for a set in one line.

**`ProfileForm` still draws Instagram by hand, and has to.** lucide carries no
brand marks at all — Instagram, Facebook, LinkedIn and the rest were removed
from the set over trademark. There is nothing to import, so the glyph stays
with a comment saying why, and it is the only inline SVG left under
`src/app/studio/onboarding`.

Two collisions worth knowing about if you convert more files:

- `fields.tsx` exports its own `Check`, which is a **checkbox field**, not a
  tick. The icon is imported there as `CheckMark`.
- `PortfolioForm` imports lucide's `Image` as `ImageIcon`, because `Image` is
  also `next/image`.

The hand-drawn SVGs elsewhere in `src/app/studio` — the CRM, the drag handle —
are not a second system to keep; they are the previous one, and should move
across as those files are touched.

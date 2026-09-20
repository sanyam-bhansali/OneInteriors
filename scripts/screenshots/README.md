# Capturing every screen

```
npm i -D playwright
npx playwright install chromium
npm run shots
```

Writes `screenshots/` — four folders by flow, each with `desktop/` and
`mobile/`, plus a README per folder explaining every page.

## Before the first run

**Point at a local database, or at none.** The script refuses to run against a
remote one, and the reason is not pedantry: `.env.local` holds the production
connection string, so `npm run dev` on your machine talks to the live database
by default. Against production these screenshots would carry real studios, real
GSTINs and real customer names — and opening a client board would *write* the
sample lead into production.

**Clearing `DATABASE_URL` in your terminal does not work**, and it is worth
knowing why: Next reads `.env.local` itself at startup, so an unset shell
variable hides the connection from a naive check without changing what the
server connects to. The guard reads the file for this reason.

Two options that actually work:

**Fixtures only** — move the file aside for the run. Most pages render; the
ones that need rows show their empty state, and the generated README says
which those were.

```powershell
Rename-Item .env.local .env.local.off
npm run shots
Rename-Item .env.local.off .env.local
```

**A local Postgres** — fuller screens. Point `DATABASE_URL` and `DIRECT_URL` in
`.env.local` at it, then:

```
npm run db:deploy
npm run db:seed                 # eight fixture studios, portfolios, checks
npx tsx prisma/seed-rate-cards.ts   # so the quote flow has numbers
npx tsx prisma/seed-applications.ts # so /ops/applications is not empty
npm run db:studio-login -- you@example.com northlight-studio --live
```

That last one is the only way a `StudioMember` gets created, which is what the
whole `/studio` section needs.

## If it will not start

`SHOT_VERBOSE=1 npm run shots` passes the dev server's own output through, which
is usually where the real reason is.

The script runs Next's binary with your Node rather than going through npm,
because `spawn('npm.cmd')` fails on Windows with `EINVAL` — since the fix for
CVE-2024-27980 Node refuses to spawn a `.cmd` without a shell.

## What it does with the dev flags

It starts the dev server with `CUSTOMER_LIVE=1`, `DEV_OPS_NO_AUTH=1` and
`DEV_SHOW_UNVERIFIED_STUDIOS=1`, and with the hostname split off so every route
is reachable on one origin. All three flags refuse to work when `NODE_ENV` is
production — see `src/lib/env.ts` — so this cannot be turned on a live
deployment by pointing it somewhere else.

## When a page does not capture

The script will not quietly save a picture of a 404 or a sign-in page and let
you believe it is the product. Anything that bounced or errored is listed at
the end and in `screenshots/README.md`, with what that page needed.

Almost always it is missing data rather than a broken page. The `Needs` line on
each entry in `routes.mjs` says which.

## Adding a page

Add it to `routes.mjs`. Nothing else — the capture and both levels of README
read from that one list, so the pictures and the words cannot drift apart.

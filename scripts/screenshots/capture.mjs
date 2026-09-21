/**
 * Photograph every page in the product.
 *
 *   npm run shots
 *
 * Starts a dev server with the development bypasses on, walks every route in
 * routes.mjs, and writes numbered PNGs into folders by flow, with a README
 * beside them.
 *
 * ## Why this runs against a LOCAL server and not the live site
 *
 * Most of these pages need a session, and production has no way to hand one to
 * a script that should not have your password. Locally, three flags do it
 * honestly: DEV_OPS_NO_AUTH opens the console, DEV_SHOW_UNVERIFIED_STUDIOS
 * shows studios still onboarding, CUSTOMER_LIVE opens the marketplace that the
 * waitlist hides. All three refuse to work in production — see src/lib/env.ts —
 * so this cannot be pointed at the real thing by accident.
 *
 * ## What it refuses to do
 *
 * It will not quietly save a picture of a 404 or a sign-in page and let you
 * believe you have a screenshot of the product. Every route records the status
 * and the URL it actually ended on, anything unexpected is reported at the end,
 * and the README says which pages were captured in an empty state.
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { BY_FLOW, ROUTES } from './routes.mjs';
import { installBrief, NEEDS_BRIEF } from './seed-brief.mjs';

/**
 * Playwright is loaded at run time, not imported at the top.
 *
 * A bare import fails with a module-resolution stack trace that says nothing
 * about what to do. This says what to do. It is also why playwright is not
 * pinned in package.json: it downloads a browser, and that belongs in a
 * deliberate install rather than in everybody's `npm ci`.
 */
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    '\nThis needs Playwright, which is not installed. Two commands:\n\n' +
    '  npm i -D playwright\n' +
    '  npx playwright install chromium\n\n' +
    'The second downloads a browser (~150MB) and is the one people forget.\n',
  );
  process.exit(1);
}

const PORT = Number(process.env.SHOT_PORT ?? 3111);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = join(process.cwd(), 'screenshots');

/** Desktop first; mobile matters because studios use this on site visits. */
const VIEWPORTS = [
  { key: 'desktop', width: 1440, height: 900 },
  { key: 'mobile', width: 390, height: 844 },
];

const MOBILE_ONLY_NOTE =
  'Captured at phone width too — studio owners use this between site visits.';

function log(...a) { console.log(...a); }

/** Wait for the dev server to answer, or give up with something useful. */
async function waitForServer(timeoutMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/sign-in`, { signal: AbortSignal.timeout(4000) });
      if (res.status > 0) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(
    `Dev server did not answer on ${BASE} within ${timeoutMs / 1000}s.\n` +
    'Run `npm run dev` yourself and watch the output — it is usually a database ' +
    'connection or a missing env var, and the server prints the reason.',
  );
}

/**
 * Refuse to do this against a remote database.
 *
 * `.env.local` holds the PRODUCTION connection string, because that is the
 * file Next reads. So `npm run dev` on this machine talks to the live database
 * by default, and this script would then:
 *
 *   · put real studios, real GSTINs and real customer names into PNG files
 *     that are meant to be shared, and
 *   · WRITE to production — the sample lead seeds itself on any empty client
 *     board the moment that page is opened.
 *
 * Neither is recoverable by deleting the screenshots afterwards. Same check as
 * prisma/guard-destructive.ts, and the same reasoning: the hostname in the
 * connection string is the thing that actually decides whose data this is.
 */
function envFileValue(key) {
  /* Read it the way Next will read it, from the file, rather than trusting the
     shell. See the comment on assertLocalDatabase. Same parsing rules as
     prisma/load-env.ts: strip one layer of matching quotes, and only treat
     ' #' as a comment on an unquoted value, because a database password may
     legitimately contain a hash. */
  for (const file of ['.env.local', '.env']) {
    const path = join(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1 || line.slice(0, eq).trim() !== key) continue;
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) return value.slice(1, -1);
      const hash = value.indexOf(' #');
      return hash === -1 ? value : value.slice(0, hash).trim();
    }
  }
  return '';
}

function assertLocalDatabase() {
  /**
   * Ask the FILE, not the shell.
   *
   * The first version of this checked `process.env.DATABASE_URL`, which is
   * exactly the wrong thing and gave a confident all-clear while pointing at
   * production. Next loads `.env.local` itself at startup, so clearing the
   * variable in your terminal changes nothing about what the server connects
   * to — it only hides it from the guard.
   *
   * A check that can be satisfied without changing the behaviour it guards is
   * worse than no check, because it is trusted.
   */
  const shell = process.env.DATABASE_URL ?? '';
  const fromFile = envFileValue('DATABASE_URL');
  const raw = shell || fromFile;
  let host = '';
  try { host = new URL(raw).hostname.toLowerCase(); } catch { /* unparseable */ }

  const local =
    host === 'localhost' || host === '127.0.0.1' || host === '::1' ||
    host === '[::1]' || host.endsWith('.local');

  if (local) return;

  /* A deliberate, named override — same shape as ALLOW_DESTRUCTIVE_AGAINST in
     prisma/guard-destructive.ts, and for the same reason: a guard exists to
     stop accidents, not to forbid a decision somebody makes with their eyes
     open. Naming the exact host is the point. You cannot set it without
     reading which database you are about to photograph.

     What you are agreeing to: the screenshots will contain whatever that
     database holds. Today that is eight invented studios and two real
     applications with contact details taken from those businesses' own
     websites. Check the output before sharing it anywhere. */
  if (process.env.SHOT_ALLOW_REMOTE?.trim() === host) {
    console.warn(
      `\n⚠ Screenshotting a REMOTE database (${host}).\n` +
      '  Allowed because SHOT_ALLOW_REMOTE names this exact host.\n' +
      '  Every page captured will show real rows. Read them before sharing.\n',
    );
    return;
  }

  if (!raw) {
    console.log(
      'No DATABASE_URL anywhere — the app will serve fixture studios.\n' +
      'Good enough for most screens; the ones needing rows show empty states.\n',
    );
    return;
  }

  const where = shell ? 'your shell' : '.env.local';

  console.error(
    `\n✖ Refusing to run: DATABASE_URL points at a REMOTE database.\n\n` +
    `      host:  ${host}\n` +
    `      from:  ${where}\n\n` +
    '  These screenshots are made to be shared, and against production they\n' +
    '  would carry real studios, real GSTINs and real customer names. Opening a\n' +
    '  client board would also WRITE -- the sample lead seeds itself onto any\n' +
    '  empty board the moment that page renders.\n\n' +
    '  Clearing it in your terminal will NOT help: Next reads .env.local\n' +
    '  itself at startup. Three options that do:\n\n' +
    '    1. Fixtures only -- move .env.local aside for the run:\n\n' +
    '         Rename-Item .env.local .env.local.off\n' +
    '         npm run shots\n' +
    '         Rename-Item .env.local.off .env.local\n\n' +
    '       The studio pages are skipped, because they need a session.\n\n' +
    '    2. A local Postgres -- everything captures. See the README.\n\n' +
    `    3. Go ahead against this one, knowingly:\n\n` +
    `         $env:SHOT_ALLOW_REMOTE="${host}"     # PowerShell\n` +
    `         SHOT_ALLOW_REMOTE="${host}" npm run shots   # bash\n\n` +
    '       The screenshots will then contain real rows.\n',
  );
  process.exit(1);
}

async function main() {
  assertLocalDatabase();
  const keepServer = process.env.SHOT_REUSE === '1';
  let server;

  if (!keepServer) {
    log(`Starting dev server on ${PORT} with the development bypasses on…`);

    /**
     * Run Next's own entry point with this Node, rather than going through npm.
     *
     * `spawn('npm.cmd', …)` fails on Windows with EINVAL: since the fix for
     * CVE-2024-27980, Node refuses to spawn a .cmd file unless `shell: true`,
     * and turning the shell on means every path with a space in it -- which on
     * Windows is most of them -- has to be quoted correctly by hand.
     *
     * Calling the bin directly sidesteps both. It is also one less process in
     * the tree, which matters because npm on Windows does not reliably pass a
     * kill down to its child, so the old version could leave a dev server
     * holding the port after this script exited.
     */
    const nextBin = join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
    if (!existsSync(nextBin)) {
      throw new Error(
        `Could not find Next at ${nextBin}.\nRun \`npm install\` first.`,
      );
    }

    server = spawn(
      process.execPath,
      [nextBin, 'dev', '--port', String(PORT)],
      {
        env: {
          ...process.env,
          /* The three that make the screenshots possible. Each refuses to work
             when NODE_ENV is production, so this is not a way to open a live
             deployment. */
          CUSTOMER_LIVE: '1',
          DEV_OPS_NO_AUTH: '1',
          DEV_SHOW_UNVERIFIED_STUDIOS: '1',
          /* Hostname split off, so every route is reachable on one origin.
             With STUDIO_HOST set, /ops would 404 on localhost. */
          STUDIO_HOST: '',
          OPS_HOST: '',
          PUBLIC_HOST: '',
        },
        stdio: process.env.SHOT_VERBOSE === '1' ? 'inherit' : 'ignore',
        shell: false,
      },
    );
    server.on('error', (e) => {
      throw new Error(
        `Could not start the dev server: ${e.message}\n` +
        'Try `npm run dev` on its own — if that fails, this will too, and its ' +
        'output says why. SHOT_VERBOSE=1 shows the server output through this ' +
        'script.',
      );
    });
  }

  try {
    await waitForServer();
    log('Server is up.');
    log(
      process.env.SHOT_COOKIE
        ? 'Using the session you passed — the studio pages should render.\n'
        : 'No SHOT_COOKIE, so /studio/* will redirect to sign-in and be skipped.\n' +
          'See scripts/screenshots/README.md to capture those too.\n',
    );

    await rm(OUT, { recursive: true, force: true });
    const browser = await chromium.launch();
    const problems = [];
    const captured = [];

    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
        locale: 'en-IN',
      });

      /**
       * A session, if you have one.
       *
       * `DEV_OPS_NO_AUTH` opens /ops and nothing else — there is deliberately
       * no equivalent for /studio, and adding one would mean a new auth bypass
       * in the product so that a screenshot script could work, which is the
       * wrong trade.
       *
       * So the session comes from OUTSIDE: sign in locally in your own
       * browser, copy the `oi_session` cookie, and pass it here. Sessions are
       * opaque random tokens whose SHA-256 is what the database stores, so
       * this is your real session and nothing about it is weakened.
       *
       *   SHOT_COOKIE=<value> npm run shots
       */
      if (process.env.SHOT_COOKIE) {
        /* `url`, not `domain` + `path`.
           Playwright accepts either form, and the domain form does not apply
           cleanly to a bare IP host — the cookie was accepted without error
           and then never sent, so all twenty-one studio pages bounced exactly
           as they had with no cookie at all. A silent no-op is the worst
           possible failure here, because it is indistinguishable from the
           session simply not being valid. */
        await context.addCookies([{
          name: 'oi_session',
          value: process.env.SHOT_COOKIE,
          url: BASE,
          httpOnly: true,
          sameSite: 'Lax',
        }]);
      }

      const page = await context.newPage();

      /**
       * Prove the session works before walking forty-eight routes with it.
       *
       * `/set-password` needs only a signed-in user of any staff role, so it
       * separates the two failures that otherwise look identical: a cookie
       * that is not being sent, and a session that is real but belongs to an
       * account without a StudioMember. Both end at /sign-in, and forty-two
       * identical bounce lines tell you nothing about which.
       *
       * Checked once per viewport, before anything is captured.
       */
      if (process.env.SHOT_COOKIE && vp.key === VIEWPORTS[0].key) {
        const probe = await page.goto(`${BASE}/set-password`, {
          waitUntil: 'domcontentloaded', timeout: 30_000,
        });
        const landedOnSignIn = page.url().includes('/sign-in');
        if (landedOnSignIn) {
          log(
            '\n⚠ The session is not being accepted — /set-password bounced to sign-in.\n' +
            '  Either SHOT_COOKIE is stale (they last two hours) or it is for an\n' +
            '  account that no longer exists. Mint a fresh one:\n\n' +
            '      npm run db:session -- you@example.com\n\n' +
            '  Continuing; everything behind a sign-in will be skipped.\n',
          );
        } else {
          log(`  ✓ session accepted (${probe?.status() ?? '?'} on /set-password)\n`);
        }
      }

      /* /match, /quotes and /compare rank in the browser from a brief held in
         sessionStorage. Without one they render the "tell us about your flat
         first" gate — at HTTP 200, which is why this script used to file it as
         a success. Fixture studios are enough; no database is involved. */
      await installBrief(page);

      for (const r of ROUTES) {
        const dir = join(OUT, r.flow, vp.key);
        await mkdir(dir, { recursive: true });
        const file = join(dir, `${String(r.n).padStart(2, '0')}-${r.name}.png`);

        let status = 0;
        let landed = '';
        try {
          const res = await page.goto(`${BASE}${r.path}`, {
            waitUntil: 'networkidle',
            timeout: 30_000,
          });
          status = res?.status() ?? 0;
          landed = page.url().replace(BASE, '');

          /* Let fonts load and scroll-driven work settle. These pages reveal
             things on scroll, so a screenshot taken at once catches them
             mid-animation and looks broken when they are not. */
          await page.evaluate(() => document.fonts?.ready);
          await page.evaluate(async () => {
            window.scrollTo(0, document.body.scrollHeight);
            await new Promise((r) => setTimeout(r, 400));
            window.scrollTo(0, 0);
          });
          await page.waitForTimeout(600);

          /* An empty state at 200 is the failure this script was blind to.
             Check before writing the file, not after. */
          if (NEEDS_BRIEF.has(r.path)) {
            const gated = await page.evaluate(() =>
              /Tell us about your flat first|Start the brief/i.test(document.body.innerText),
            );
            if (gated) {
              problems.push(
                `${r.flow}/${r.name} [${vp.key}] — rendered the empty-brief gate at HTTP ${status}. ` +
                'Needs: the demo brief in sessionStorage (scripts/screenshots/seed-brief.mjs).',
              );
              continue;
            }
          }

          /* CHECK BEFORE CAPTURING. This used to screenshot first and test
             afterwards, which meant every /studio/* route -- all twenty-one of
             them -- wrote a picture of the sign-in page and was then counted
             as captured. The whole point of this script is that it does not
             hand you a sign-in page and let you believe it is the product, and
             it was doing exactly that. Order matters more than the check. */
          const wanted = r.path.split('?')[0];
          const bounced = landed.startsWith('/sign-in') && !wanted.startsWith('/sign-in');

          if (bounced) {
            problems.push(
              `${r.flow}/${r.name} [${vp.key}] — redirected to ${landed}, so NOT saved. ` +
              `Needs: ${r.needs}`,
            );
            log(`  ${'skip'.padEnd(4)} ${vp.key.padEnd(7)} ${r.flow}/${r.name} → ${landed}`);
            continue;
          }

          if (status >= 400) {
            problems.push(
              `${r.flow}/${r.name} [${vp.key}] — HTTP ${status}, so NOT saved. Needs: ${r.needs}`,
            );
            log(`  ${status} ${vp.key.padEnd(7)} ${r.flow}/${r.name} (not saved)`);
            continue;
          }

          await page.screenshot({ path: file, fullPage: true });
          captured.push({ ...r, vp: vp.key, status, landed, file });
        } catch (err) {
          problems.push(`${r.flow}/${r.name} [${vp.key}] — ${String(err).split('\n')[0]}`);
          continue;
        }

        log(`  ${status} ${vp.key.padEnd(7)} ${r.flow}/${r.name}`);
      }

      await context.close();
    }

    await browser.close();
    await writeReadmes(captured, problems);

    log(`\nWrote ${captured.length} screenshots to ./screenshots`);
    if (problems.length) {
      log(`\n${problems.length} route(s) did not capture cleanly:\n`);
      for (const p of problems) log(`  · ${p}`);
      log(
        '\nThis is almost always missing DATA rather than a broken page.\n\n' +
        'The studio surface in particular cannot be captured without a\n' +
        'database: DEV_OPS_NO_AUTH opens /ops only, and there is no equivalent\n' +
        'for /studio, so every /studio/* route redirects to sign-in. Those\n' +
        'pages need a real StudioMember row, which only db:studio-login\n' +
        'creates. With a local Postgres:\n\n' +
        '  npm run db:deploy\n' +
        '  npm run db:seed\n' +
        '  npx tsx prisma/seed-rate-cards.ts\n' +
        '  npx tsx prisma/seed-applications.ts\n' +
        '  npm run db:studio-login -- you@example.com northlight-studio --live\n\n' +
        'Then sign in once in a browser at the same port, and re-run with\n' +
        'SHOT_REUSE=1 so the session cookie survives.\n',
      );
    }
  } finally {
    if (server) server.kill();
  }
}

async function writeReadmes(captured, problems) {
  const ok = (flow, name) => captured.find((c) => c.flow === flow && c.name === name && c.vp === 'desktop');

  const index = [
    '# One Interiors — every screen',
    '',
    'Four folders, in the order a person meets them. Each has `desktop/` and',
    '`mobile/`; the numbers are the order you would walk through, not the order',
    'the files happen to sort in.',
    '',
    '> Generated by `npm run shots`. Re-run it after any UI change rather than',
    '> editing anything here — this file is overwritten.',
    '',
  ];

  for (const f of BY_FLOW) {
    index.push(`## ${f.key} · ${f.title}`, '', f.blurb, '');
    for (const r of f.routes) {
      const got = ok(f.key, r.name);
      const mark = got ? '' : ' _(did not capture — see below)_';
      index.push(`- **${String(r.n).padStart(2, '0')} ${r.title}** — ${r.does}${mark}`);
    }
    index.push('');

    const lines = [
      `# ${f.title}`,
      '',
      f.blurb,
      '',
      MOBILE_ONLY_NOTE,
      '',
      '---',
      '',
    ];
    for (const r of f.routes) {
      const got = ok(f.key, r.name);
      const shot = `${String(r.n).padStart(2, '0')}-${r.name}.png`;
      lines.push(
        `## ${String(r.n).padStart(2, '0')} · ${r.title}`,
        '',
        got ? `![${r.title}](desktop/${shot})` : '_Not captured._',
        '',
        `**What it does.** ${r.does}`,
        '',
        `**Who sees it.** ${r.who}`,
        '',
        `**Before → after.** ${r.before} → ${r.after}`,
        '',
        `**Route.** \`${r.path}\``,
        '',
        `**Needs.** ${r.needs}`,
        '',
        '---',
        '',
      );
    }
    await writeFile(join(OUT, f.key, 'README.md'), lines.join('\n'), 'utf8');
  }

  if (problems.length) {
    index.push(
      '## Not captured',
      '',
      'These need data or a session the script could not produce. That is a',
      'statement about the fixtures, not about the pages.',
      '',
      ...problems.map((p) => `- ${p}`),
      '',
    );
  }

  await writeFile(join(OUT, 'README.md'), index.join('\n'), 'utf8');
}

main().catch((e) => {
  console.error('\n' + String(e));
  process.exit(1);
});

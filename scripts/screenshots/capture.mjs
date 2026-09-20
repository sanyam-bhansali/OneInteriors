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
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { BY_FLOW, ROUTES } from './routes.mjs';

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
function assertLocalDatabase() {
  const raw = process.env.DATABASE_URL ?? '';
  let host = '';
  try { host = new URL(raw).hostname.toLowerCase(); } catch { /* unparseable */ }

  const local =
    host === 'localhost' || host === '127.0.0.1' || host === '::1' ||
    host === '[::1]' || host.endsWith('.local');

  if (local) return;

  if (!raw) {
    console.log(
      'No DATABASE_URL — the app will serve fixture studios.\n' +
      'Good enough for most screens; the ones needing rows will show empty states.\n',
    );
    return;
  }

  console.error(
    `\n✖ Refusing to run: DATABASE_URL points at a REMOTE database (${host}).\n\n` +
    '  These screenshots are meant to be shared, and against production they would\n' +
    '  contain real studios, real GSTINs and real customer names. Opening a client\n' +
    '  board would also WRITE the sample lead into production.\n\n' +
    '  Point it at a local Postgres for this, or unset it entirely to run on\n' +
    '  fixtures:\n\n' +
    '      $env:DATABASE_URL=""      # PowerShell\n' +
    '      DATABASE_URL= npm run shots   # bash\n',
  );
  process.exit(1);
}

async function main() {
  assertLocalDatabase();
  const keepServer = process.env.SHOT_REUSE === '1';
  let server;

  if (!keepServer) {
    log(`Starting dev server on ${PORT} with the development bypasses on…`);
    server = spawn(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['run', 'dev', '--', '--port', String(PORT)],
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
        stdio: 'ignore',
        shell: false,
      },
    );
    server.on('error', (e) => { throw e; });
  }

  try {
    await waitForServer();
    log('Server is up.\n');

    await rm(OUT, { recursive: true, force: true });
    const browser = await chromium.launch();
    const problems = [];
    const captured = [];

    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
        // The studio host variant of /sign-in is chosen by the Host header.
        // Everything else is host-agnostic here because the split is off.
        locale: 'en-IN',
      });
      const page = await context.newPage();

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

          await page.screenshot({ path: file, fullPage: true });
          captured.push({ ...r, vp: vp.key, status, landed, file });
        } catch (err) {
          problems.push(`${r.flow}/${r.name} [${vp.key}] — ${String(err).split('\n')[0]}`);
          continue;
        }

        /* A redirect to sign-in means the bypass did not apply, and a picture
           of a sign-in page filed under "the studio dashboard" is worse than
           no picture at all. */
        const wanted = r.path.split('?')[0];
        const bounced = landed.startsWith('/sign-in') && !wanted.startsWith('/sign-in');
        if (bounced) {
          problems.push(
            `${r.flow}/${r.name} [${vp.key}] — bounced to ${landed}. ` +
            `Needs: ${r.needs}`,
          );
        } else if (status >= 400) {
          problems.push(`${r.flow}/${r.name} [${vp.key}] — HTTP ${status}. Needs: ${r.needs}`);
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
        '\nUsually this is missing data rather than a broken page. Try:\n' +
        '  npm run db:seed\n' +
        '  npm run db:studio-login -- you@example.com northlight-studio --live\n',
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

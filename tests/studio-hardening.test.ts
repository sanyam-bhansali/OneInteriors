import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/* Owner, 24 Nov 2026: "check if the studio max software is working correctly without any errors and if speed is
   optimal and going further protecting the software from crashing". */

function filesUnder(dir: string, re: RegExp): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? filesUnder(p, re) : re.test(p) ? [p] : [];
  });
}

describe('crash protection', () => {
  it('a last error screen for the whole app, and the studio one', () => {
    const g = readFileSync('src/app/global-error.tsx', 'utf8');
    expect(g).toContain('<html lang="en">');
    expect(g).toContain('Everything you saved is safe.');
    expect(readFileSync('src/app/studio/error.tsx', 'utf8')).toContain('That screen stopped working.');
  });

  it('studio actions answer "did not save" instead of throwing to the error screen', () => {
    const guard = readFileSync('src/lib/action-guard.ts', 'utf8');
    expect(guard).toContain('unstable_rethrow(error);');
    const actions = filesUnder('src/app/studio', /actions\.ts$/).filter((f) => /^\s*(\/\*[\s\S]*?\*\/\s*)?['"]use server['"]/.test(readFileSync(f, 'utf8')));
    const guarded = actions.filter((f) => readFileSync(f, 'utf8').includes("from '@/lib/action-guard'"));
    expect(guarded.length).toBeGreaterThan(40);
    for (const f of ['src/app/studio/settings/team/actions.ts', 'src/app/studio/quotations/actions.ts', 'src/app/studio/clients/actions.ts']) {
      expect(guarded.map((x) => x.replace(/\\/g, '/'))).toContain(f);
    }
  });

  it('transactions get time, and the pool waits for a connection', () => {
    expect(readFileSync('src/lib/prisma.ts', 'utf8')).toContain('transactionOptions: { maxWait: 10_000, timeout: 20_000 }');
    expect(readFileSync('src/lib/db-url.ts', 'utf8')).toContain("parsed.searchParams.set('pool_timeout', String(POOL_TIMEOUT_SECONDS));");
  });

  it('a badge or side panel never takes a page down', () => {
    expect(readFileSync('src/app/studio/layout.tsx', 'utf8')).toContain('await toBuildCount(member).catch(() => 0)');
    const home = readFileSync('src/app/studio/home/page.tsx', 'utf8');
    expect(home).toContain('myToday().catch(() => null)');
    expect(home).toContain('meetingsWaiting(member).catch(() => 0)');
    const pay = readFileSync('src/app/studio/payments/page.tsx', 'utf8');
    expect(pay).toContain('bookingsToRecord().catch(() => [])');
    expect(readFileSync('src/app/studio/projects/[id]/page.tsx', 'utf8')).toContain('closureFor(w.id, now).catch(() => null)');
  });

  it('one bad item never stops a nightly job', () => {
    expect(readFileSync('src/app/api/cron/decision-reminders/route.ts', 'utf8')).toContain("console.error('[cron] decision reminder failed'");
    expect(readFileSync('src/app/api/cron/bin-purge/route.ts', 'utf8')).toContain("console.error('[cron] retryConversions failed'");
    expect(readFileSync('src/modules/project/site-reminders.ts', 'utf8')).toContain("console.error('[cron] site reminder failed'");
    expect(readFileSync('src/modules/project/snag-flow.ts', 'utf8')).toContain("console.error('[cron] snag auto-close failed'");
  });

  it('storage, email and WhatsApp calls have a time limit', () => {
    for (const f of ['src/modules/storage/studio-logo.ts', 'src/modules/storage/lead-files.ts', 'src/modules/auth/email.ts', 'src/modules/auth/whatsapp.ts']) {
      const src = readFileSync(f, 'utf8');
      const calls = (src.match(/\bfetch\(/g) ?? []).length;
      const timed = (src.match(/AbortSignal\.timeout\(/g) ?? []).length;
      expect(timed, f).toBeGreaterThanOrEqual(calls);
    }
  });
});

describe('speed', () => {
  it('the project page reads its access once and its panels together', () => {
    expect(readFileSync('src/modules/studio/access.ts', 'utf8')).toContain('const projectFacts = cache(async (studioId: string, memberId: string, needsAssign: boolean, homeProjectId: string)');
    const page = readFileSync('src/app/studio/projects/[id]/page.tsx', 'utf8');
    expect(page).toContain('const [canStar, broughtIn, decisions, life, closure, snagWin, extras, signoffs, electrical, hold, scope, carcass] = await Promise.all([');
  });

  it('My Quotations reads only what the totals need, and the board only the newest note per card', () => {
    expect(readFileSync('src/modules/studio-quote/quotes.ts', 'utf8')).toContain('include: { lines: { select: { code: true, unit: true, ratePaise: true, widthMm: true, heightMm: true, qtyMilli: true, amountPaise: true } } }');
    expect(readFileSync('src/modules/studio-sales/leads-list.ts', 'utf8')).toContain('SELECT DISTINCT ON ("clientId") "clientId", "summary"');
  });

  it('indexes for the quotation lookups and board columns', () => {
    const sql = readFileSync('prisma/migrations/20261124120000_speed_indexes/migration.sql', 'utf8');
    expect(sql).toContain('"studio_quotes_basedOnId_idx"');
    expect(sql).toContain('"studio_clients_studioId_stageId_createdAt_idx"');
  });
});

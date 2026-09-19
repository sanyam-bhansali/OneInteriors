import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The things that must never quietly come back.
 *
 * Every assertion here corresponds to a finding from the September 2026
 * security audit. They are written as tests rather than comments because a
 * comment did not stop any of them the first time — `scrape.ts` carried a
 * block list that missed `127.1`, and `requestConsultation` carried a comment
 * promising an ownership check directly above a query that did not perform one.
 */

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

/**
 * Assertions about behaviour have to look at code, not at prose.
 *
 * Several of these files explain the bug they fixed, quoting the old line —
 * so a naive `not.toContain` fails on the comment describing the very thing
 * it is checking was removed.
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ── The scaffolding flags ───────────────────────────────────────────

describe('dev flags refuse in production', () => {
  it('each of the three checks isProduction FIRST', async () => {
    /**
     * They were gated on `rosterIsReal()` alone, which sounds sufficient and
     * is not: a production deploy sits with the roster undeclared from first
     * push until somebody remembers one variable. In that window
     * DEV_OPS_NO_AUTH=1 opened every studio's GSTIN and every customer's name,
     * phone and email to anyone who guessed /ops.
     *
     * Asserted by reading the source, because the module reads process.env at
     * import time and stubbing it after the fact proves nothing.
     */
    const src = read('src/lib/env.ts');

    for (const fn of ['showUnverifiedStudios', 'showOtpOnScreen', 'opsWithoutAuth']) {
      const body = src.slice(src.indexOf(`export function ${fn}(`));
      const firstGuard = body.slice(0, body.indexOf('return process.env'));
      expect(firstGuard, `${fn} must refuse in production before anything else`).toContain(
        'if (isProduction()) return false;',
      );
    }
  });

  it('names every dev flag it gates, so a new one cannot be added silently', () => {
    const src = read('src/lib/env.ts');
    const flags = [...src.matchAll(/process\.env\.(DEV_[A-Z_]+)/g)].map((m) => m[1]);
    // If this fails, a new DEV_ flag exists and needs the isProduction guard
    // plus a line in the loop above.
    expect(new Set(flags)).toEqual(
      new Set(['DEV_SHOW_UNVERIFIED_STUDIOS', 'DEV_SHOW_OTP_ON_SCREEN', 'DEV_OPS_NO_AUTH']),
    );
  });
});

// ── SSRF ────────────────────────────────────────────────────────────

describe('the scraper cannot be pointed inward', () => {
  it('follows redirects manually', () => {
    /**
     * `redirect: 'follow'` validated the first URL and then followed up to
     * twenty more without looking at any of them, so an applicant supplied an
     * ordinary public address that answered
     * `302 Location: http://169.254.169.254/latest/meta-data/` and the entire
     * block list was skipped. Every hop now goes back through normaliseUrl.
     */
    const code = stripComments(read('src/modules/studio/scrape.ts'));
    expect(code).toContain("redirect: 'manual'");
    expect(code).not.toContain("redirect: 'follow'");
  });

  it('caps the body while reading rather than after', () => {
    // MAX_BYTES was applied after `await response.text()`, so the whole body
    // was in memory before anyone measured it.
    const src = read('src/modules/studio/scrape.ts');
    expect(src).toContain('readCapped');
  });

  it('keeps the abort timer alive across the body read', () => {
    // clearTimeout fired the moment headers arrived, so a server that sent
    // headers fast and dribbled the body held the invocation open forever.
    const src = read('src/modules/studio/scrape.ts');
    expect(src).toContain('} finally {');
  });
});

// ── Ownership ───────────────────────────────────────────────────────

describe('brief-scoped reads check ownership', () => {
  it('requestConsultation resolves the brief by owner, not by id alone', () => {
    const src = read('src/modules/consultation/request.ts');
    const fn = src.slice(src.indexOf('export async function requestConsultation'));
    const upToCreate = fn.slice(0, fn.indexOf('prisma.consultation.create'));
    // findUnique({ where: { id } }) proves existence and nothing else.
    expect(upToCreate).not.toContain('brief.findUnique');
    expect(upToCreate).toContain('findFirst');
    expect(upToCreate).toContain('readAnonKey');
  });
});

// ── RLS ─────────────────────────────────────────────────────────────

describe('every migration that creates a table locks it down', () => {
  /**
   * The record was perfect when audited, and it was perfect by habit. This
   * makes it structural: a future migration that adds a table without RLS
   * fails here rather than in a breach.
   */
  const INITIAL_MIGRATION = '20260907170456_init';

  it('has a lockdown migration that sweeps every table', () => {
    // The exception below is only safe because this exists.
    const lockdown = read('prisma/migrations/20260907180000_enable_rls_lockdown/migration.sql');
    expect(lockdown).toContain('ENABLE ROW LEVEL SECURITY');
    expect(lockdown).toContain('FORCE ROW LEVEL SECURITY');
    expect(lockdown).toContain('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated');
  });

  it('pairs CREATE TABLE with ROW LEVEL SECURITY', () => {
    const dir = join(ROOT, 'prisma/migrations');
    const offenders: string[] = [];

    for (const name of readdirSync(dir)) {
      const file = join(dir, name, 'migration.sql');
      let sql: string;
      try {
        sql = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      if (!/CREATE TABLE/i.test(sql)) continue;

      /* The initial migration is the one documented exception: it creates the
         first twenty-four tables, and a dedicated lockdown migration
         immediately after sweeps every table in the schema with a DO-loop.
         That arrangement is stronger than per-table statements, not weaker —
         it cannot miss one. Every migration since carries its own block. */
      if (name === INITIAL_MIGRATION) continue;

      const hasRls = /ROW LEVEL SECURITY/i.test(sql);
      const hasRevoke = /REVOKE ALL[\s\S]*?(anon|authenticated)/i.test(sql);
      if (!hasRls || !hasRevoke) offenders.push(name);
    }

    expect(offenders, 'these migrations create a table without RLS + REVOKE').toEqual([]);
  });
});

// ── Logs ────────────────────────────────────────────────────────────

describe('no raw contact detail reaches production logs', () => {
  it('masks the address and the number in the provider-missing branches', () => {
    // These fire exactly when the provider is misconfigured in production,
    // which is the moment they would write identifiers into Vercel's logs —
    // a far wider readership than the table the value came from.
    expect(read('src/modules/auth/email.ts')).toContain('maskEmail(to)');
    expect(read('src/modules/auth/whatsapp.ts')).toContain('to.slice(-4)');
  });
});

// ── Headers ─────────────────────────────────────────────────────────

describe('security headers', () => {
  const config = read('next.config.ts');

  it('sets a Content-Security-Policy', () => {
    expect(config).toContain('Content-Security-Policy');
    expect(config).toContain("frame-ancestors 'none'");
    expect(config).toContain("object-src 'none'");
    expect(config).toContain("base-uri 'self'");
    expect(config).toContain("form-action 'self'");
  });

  it('sets HSTS', () => {
    expect(config).toContain('Strict-Transport-Security');
  });

  it('grants no permission the app does not use', () => {
    // camera=(self) and geolocation=(self) were allowed for features that do
    // not exist — useful only to somebody who finds an injection.
    expect(config).toContain('camera=()');
    expect(config).toContain('geolocation=()');
  });
});

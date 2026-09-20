import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { LIVE, LISTED, DEMO_LEAD } from '@/modules/studio-practice/demo-lead';

/**
 * The sample lead is a real row, and that is only safe while every aggregate
 * excludes it.
 *
 * This is the whole risk of the feature in one file. A `studioClient.count`
 * added six months from now that filters on `deletedAt: null` alone will
 * quietly include the sample, and the symptom — a studio's walkthrough ticking
 * a step they did not do, or the morning screen naming somebody who does not
 * exist — is the kind nobody reports, because a number being slightly wrong
 * looks like the product working.
 *
 * So the rule is not written in a comment and hoped for. It is asserted
 * against the tree.
 */

const ROOT = join(__dirname, '..');

/** Every .ts under src, so a new count anywhere is caught. */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sources(p);
    return e.name.endsWith('.ts') || e.name.endsWith('.tsx') ? [p] : [];
  });
}

describe('the sample is listed, never counted', () => {
  it('every studioClient.count carries the LIVE filter', () => {
    const offenders: string[] = [];

    for (const file of sources(join(ROOT, 'src'))) {
      const src = readFileSync(file, 'utf8');
      if (!src.includes('studioClient.count')) continue;

      /* Read each call's argument object. Cheap and good enough: the calls in
         this codebase are all written inline, and a count assembled from a
         variable would be a style change worth noticing anyway. */
      for (const m of src.matchAll(/studioClient\.count\(\s*\{([\s\S]*?)\}\s*\)/g)) {
        const arg = m[1]!;

        /* One count legitimately sees everything: the guard that decides
           whether to seed the sample at all, which asks "has this studio ever
           had a client" and must therefore see binned rows and the sample
           itself. It says so at the call site. Requiring the marker rather
           than exempting the file by name means a second count added to the
           same file is still caught. */
        if (arg.includes('COUNTS-EVERYTHING')) continue;

        if (!arg.includes('LIVE')) {
          offenders.push(`${file.replace(ROOT, '')} — ${arg.trim().slice(0, 70)}…`);
        }
      }
    }

    expect(
      offenders,
      'these count the sample lead; spread ...LIVE from modules/studio-practice/demo-lead',
    ).toEqual([]);
    // Same reason as tests/form-submitter.test.ts: this walks the tree, and
    // the tree is on a mounted filesystem with very uneven speed.
  }, 30_000);

  it('LIVE excludes the sample AND the deleted, because one without the other is a bug', () => {
    expect(LIVE).toEqual({ deletedAt: null, isDemo: false });
  });

  it('LISTED keeps the sample, or the board has nothing to teach with', () => {
    expect(LISTED).toEqual({ deletedAt: null });
    expect(LISTED).not.toHaveProperty('isDemo');
  });

  it('the schema defaults isDemo to false', () => {
    // The safe direction. A row wrongly marked demo drops out of the studio's
    // own figures without deleting anything, which reads as a quiet week.
    const schema = readFileSync(join(ROOT, 'prisma/schema.prisma'), 'utf8');
    expect(schema).toMatch(/isDemo\s+Boolean\s+@default\(false\)/);
  });

  it('the migration adds the column with a default, not as nullable-then-backfill', () => {
    const dir = join(ROOT, 'prisma/migrations/20260920100000_studio_client_demo');
    const sql = readFileSync(join(dir, 'migration.sql'), 'utf8');
    expect(sql).toContain('ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false');
    // The mapped table name, not the model name. See the suite below.
    expect(sql).toContain('ALTER TABLE "studio_clients"');
  });
});

describe('what the sample says', () => {
  it('carries no phone number and no email', () => {
    // A sample with a plausible mobile in it is a sample somebody eventually
    // rings. There is no real person behind this row.
    expect(DEMO_LEAD).not.toHaveProperty('phone');
    expect(DEMO_LEAD).not.toHaveProperty('email');
  });

  it('announces itself in the name, not only in a badge', () => {
    // The badge is a rendering decision and could be lost in a redesign. A
    // studio skimming a board, or exporting it to CSV, still sees what it is.
    expect(DEMO_LEAD.name.toLowerCase()).toContain('sample');
  });

  it('has a next action, because that is what the board is for', () => {
    expect(DEMO_LEAD.nextAction.length).toBeGreaterThan(0);
    expect(DEMO_LEAD.followUpInDays).toBeGreaterThan(0);
  });

  it('says it is removable and uncounted, in the row itself', () => {
    const notes = DEMO_LEAD.notes.toLowerCase();
    expect(notes).toContain('remove');
    expect(notes).toContain('not counted');
  });
});

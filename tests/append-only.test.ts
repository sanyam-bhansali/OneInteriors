import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { APPEND_ONLY_MODELS, APPEND_ONLY_TABLES, findMutations, NEVER_DELETED_MODELS, NEVER_DELETED_TABLES } from '@/modules/project/append-only';

/**
 * Site updates, snag events, date changes, quote changes and the project
 * event log are never edited or deleted; payments and site-log photos and
 * crew are never deleted (docs/studio-workspace/STUDIO-WORKSPACE-BUILD.md §2,
 * §4; PHASES-2-5-FOUNDATION.md). Checked against every file in src/, so a
 * phase that adds an "edit" path fails here, not in a customer dispute.
 */

const ROOT = join(__dirname, '..');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

describe('append-only project tables', () => {
  it('src/ has no update or delete path on them', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(join(ROOT, 'src'))) {
      for (const m of findMutations(readFileSync(file, 'utf8'))) {
        offenders.push(`${relative(ROOT, file)}:${m.line} ${m.target}.${m.method}`);
      }
    }
    expect(offenders, 'corrections are new rows — never edit or delete these').toEqual([]);
  });

  it('names models and tables that exist in the schema', () => {
    const schema = readFileSync(join(ROOT, 'prisma/schema.prisma'), 'utf8');
    for (const model of [...APPEND_ONLY_MODELS, ...NEVER_DELETED_MODELS]) {
      const name = model[0]!.toUpperCase() + model.slice(1);
      expect(schema, name).toMatch(new RegExp(`\\nmodel ${name} \\{`));
    }
    for (const table of [...APPEND_ONLY_TABLES, ...NEVER_DELETED_TABLES]) expect(schema, table).toContain(`@@map("${table}")`);
  });
});

describe('findMutations', () => {
  it('finds every forbidden call shape', () => {
    const src = [
      'await prisma.homeSiteLog.update({ where: { id } });',
      'await tx.homeProjectEvent.deleteMany({});',
      'await tx?.homeSnagEvent.upsert({});',
      'await db.homeProjectDateChange',
      '  .updateMany({});',
      "await tx['homeQuoteChange'].delete({});",
      'await prisma.homeProjectPayment.delete({ where: { id } });',
      'await prisma.homeSiteLogPhoto.deleteMany({});',
      'await prisma.$executeRaw`UPDATE "home_site_logs" SET note = 1`;',
      'await prisma.$executeRawUnsafe(`DELETE FROM home_project_payments`);',
      'await prisma.homeSiteLog.updateManyAndReturn({});',
    ].join('\n');
    expect(findMutations(src).map((m) => `${m.line}:${m.target}.${m.method}`)).toEqual([
      '1:homeSiteLog.update',
      '2:homeProjectEvent.deleteMany',
      '3:homeSnagEvent.upsert',
      '4:homeProjectDateChange.updateMany',
      '6:homeQuoteChange.delete',
      '7:homeProjectPayment.delete',
      '8:homeSiteLogPhoto.deleteMany',
      '9:home_site_logs.UPDATE',
      '10:home_project_payments.DELETE',
      '11:homeSiteLog.updateManyAndReturn',
    ]);
  });

  it('allows reads, inserts, and filling in rows that may be filled in', () => {
    const src = [
      'await tx.homeSiteLog.create({ data });',
      'await tx.homeProjectEvent.createMany({ data, skipDuplicates: true });',
      'await prisma.homeSnagEvent.findMany({ where });',
      'await prisma.homeSiteLogPhoto.update({ where: { id }, data: { transcript } });',
      'await prisma.homeProjectPayment.updateMany({ where: { id, customerConfirmedAt: null }, data: { customerConfirmedAt: now } });',
      'await prisma.homeSnag.update({ where: { id }, data: { status: "FIXED" } });',
      'const n = await prisma.homeQuoteChange.count();',
    ].join('\n');
    expect(findMutations(src)).toEqual([]);
  });

  it('does not mistake a longer model name, or a comment, for a forbidden call', () => {
    const src = [
      '// never prisma.homeSiteLog.update(…) — corrections are new rows',
      '/* tx.homeProjectEvent.delete( is forbidden */',
      'await prisma.homeSiteLogPhoto.update({});',
      "const url = 'https://example.com/x'; await prisma.homeSiteLog.update({});",
    ].join('\n');
    expect(findMutations(src).map((m) => `${m.line}:${m.target}.${m.method}`)).toEqual(['4:homeSiteLog.update']);
  });
});

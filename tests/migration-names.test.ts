import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Migrations must name TABLES, never Prisma models.
 *
 * ## The failure this exists to stop, which reached production
 *
 * Every model in this schema carries an `@@map` to snake_case — `StudioClient`
 * is the table `studio_clients`. A migration written by hand from the model
 * name is valid SQL, passes typecheck, passes lint, passes every unit test,
 * and then fails on the production database with:
 *
 *     42P01  relation "StudioClient" does not exist
 *
 * It cannot fail anywhere earlier, because nothing before `migrate deploy`
 * ever executes the SQL. And it fails *after* being recorded as started, so
 * it blocks every later migration until somebody runs `migrate resolve`.
 *
 * The rule is therefore checked against the schema rather than remembered:
 * any identifier in a migration that matches a Prisma model name, when that
 * model maps to something else, is the mistake.
 */

const ROOT = join(__dirname, '..');
const schema = readFileSync(join(ROOT, 'prisma/schema.prisma'), 'utf8');

/** model name → mapped table name, for every model that maps. */
function mappedModels(): Map<string, string> {
  const out = new Map<string, string>();
  // Each block runs from `model X {` to the closing brace at column zero.
  for (const block of schema.split(/\nmodel /).slice(1)) {
    const name = block.slice(0, block.indexOf(' ')).trim();
    const map = block.match(/@@map\("([^"]+)"\)/);
    if (name && map) out.set(name, map[1]!);
  }
  return out;
}

describe('migrations use table names, not model names', () => {
  const models = mappedModels();

  it('the schema really does map its models, or this suite proves nothing', () => {
    expect(models.size).toBeGreaterThan(30);
    expect(models.get('StudioClient')).toBe('studio_clients');
  });

  it('no migration quotes a model name that maps elsewhere', () => {
    const dir = join(ROOT, 'prisma/migrations');
    const offenders: string[] = [];

    for (const name of readdirSync(dir)) {
      let sql: string;
      try {
        sql = readFileSync(join(dir, name, 'migration.sql'), 'utf8');
      } catch {
        continue;
      }

      // Comments explain the rule by naming the model, which is correct and
      // must not fail. Only executable SQL is checked.
      const code = sql
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('--'))
        .join('\n');

      for (const [model, table] of models) {
        if (code.includes(`"${model}"`)) {
          offenders.push(`${name}: "${model}" should be "${table}"`);
        }
      }
    }

    expect(
      offenders,
      'these migrations name a Prisma model where Postgres expects a table',
    ).toEqual([]);
  });

  it('every table a migration alters actually exists in the schema', () => {
    /**
     * The other half of the same mistake: a table name that is simply wrong
     * rather than a model name. Collected from ALTER TABLE, which is where a
     * hand-written migration usually goes.
     */
    const dir = join(ROOT, 'prisma/migrations');
    const known = new Set(models.values());
    const unknown: string[] = [];

    for (const name of readdirSync(dir)) {
      let sql: string;
      try {
        sql = readFileSync(join(dir, name, 'migration.sql'), 'utf8');
      } catch {
        continue;
      }
      const code = sql
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('--'))
        .join('\n');

      for (const m of code.matchAll(/ALTER TABLE\s+"([^"]+)"/gi)) {
        const table = m[1]!;
        // Tables created before @@map was universal, and Postgres internals.
        if (known.has(table) || table.startsWith('_') || table.startsWith('pg_')) continue;
        unknown.push(`${name}: ALTER TABLE "${table}"`);
      }
    }

    expect(unknown, 'these alter a table the schema does not define').toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The second line of defence under multi-tenancy.
 *
 * ## Why this test exists at all
 *
 * Thirty tables in this database carry `ENABLE ROW LEVEL SECURITY` and
 * `FORCE ROW LEVEL SECURITY`, and there is not one `CREATE POLICY` anywhere in
 * the migration history. That is deliberate and it is worth keeping: with every
 * privilege revoked from `anon` and `authenticated`, a leaked Supabase
 * publishable key reads nothing at all.
 *
 * But **it does not isolate one studio from another.** Prisma connects over
 * `DATABASE_URL` as the database owner, for whom RLS is not enforced and for
 * whom there are no policies to satisfy. So `where: { studioId }` in
 * application code is the ONLY thing between one studio's client list and
 * another's — and the thing protecting fifty businesses' private pricing
 * should not be a habit.
 *
 * This is the habit, written down. It reads every Prisma call in `src/` that
 * touches a studio-owned table and fails the build unless that call is scoped
 * or explicitly excused with a reason.
 *
 * ## What it can and cannot prove
 *
 * It is a static scan, not a proof. It cannot know that a variable called
 * `studioId` holds the session's studio rather than one off a form — that is
 * what code review is for. What it CAN do, and what matters, is make the
 * absence of any scoping impossible to introduce quietly: a new unscoped query
 * fails CI, and the only way past is to scope it or to write down here why it
 * is allowed. An excuse with a name on it is a different thing from an
 * oversight.
 *
 * ## Adding to the allow-list
 *
 * Only for reads that are cross-studio BY DESIGN — the ops console, the
 * customer-facing marketplace, roster-wide aggregates. If you are adding a
 * studio-facing query here, you are working around the wrong thing.
 */

const SRC = 'src';

/** Prisma operations that reach rows. `$transaction` and the like do not. */
const OPERATIONS = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
  'findUnique',
  'findFirst',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

/**
 * Anything that ties a query to one tenant.
 *
 * `briefId` and `userId` are here because they are the CUSTOMER's anchor and
 * the SESSION's anchor respectively — a query scoped by the signed-in user's
 * id is as scoped as one by their studio, since `StudioMember.userId` is
 * unique.
 */
const ANCHORS = [
  'studioId',
  'userId',
  'memberId',
  'briefId',
  'member.id',
  'ownedQuote(',
  'myStudioId(',
  'currentStudio(',
  'myMembership(',
  'myMembershipId(',
];

/**
 * An operator acting across the roster, which is their job.
 *
 * Matched on the ROLE, not on the function. `hasRole(user, 'STUDIO')` appears
 * inside `myStudioId()` — the tenancy helper itself — so excusing any file
 * that merely mentions `hasRole` excused most of the codebase. It did: the
 * first regression this test was pointed at walked straight through.
 */
const OPERATOR_GUARD = /(?:requireRole|hasRole)\([^)]*['"](?:OPS|ADMIN)['"]/;

/**
 * The operator console, guarded once by its layout.
 *
 * `app/ops/page.tsx` says in its own header why it does NOT call
 * `requireRole` inline: that throws, which races the layout's redirect and
 * shows a stack trace to somebody who simply is not signed in. The guard is
 * real, it is just one level up — so the route prefix is what identifies these
 * files, not a token inside them.
 *
 * Mutations under here still call `requireRole` themselves. This only excuses
 * render-path reads.
 */
const OPERATOR_ROUTES = ['src/app/ops/'];

/**
 * Cross-studio by design. Every entry needs a reason a reader can check.
 *
 * Keyed `path:line` is deliberately NOT used — line numbers move and a stale
 * key silently stops excusing anything. Keyed by file and model instead, which
 * is stable and still narrow.
 */
const ALLOWED: { file: string; model: string; why: string }[] = [
  {
    file: 'src/modules/matching/store.ts',
    model: 'match',
    why: 'Roster-wide "when did matching begin" — one timestamp, no studio data, and no studio to scope it to.',
  },
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (path.endsWith('.ts') || path.endsWith('.tsx')) out.push(path);
  }
  return out;
}

/** Every model carrying a `studioId` column, read from the schema itself. */
function studioOwnedModels(): Set<string> {
  const schema = readFileSync('prisma/schema.prisma', 'utf8');
  const models = new Set<string>();

  for (const match of schema.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g)) {
    const [, name, body] = match;
    if (!name || !body) continue;
    if (!/^\s*studioId\s/m.test(body)) continue;
    /* Prisma's client accessor is the model name with a lowercase initial.
       Derived rather than listed, so a new studio-owned table is covered by
       this test the day it is added rather than the day somebody remembers. */
    models.add(name[0]!.toLowerCase() + name.slice(1));
  }

  return models;
}

/**
 * Where each function in a file begins.
 *
 * Computed once per file rather than per call. Re-scanning the whole head of
 * the file for every Prisma call is quadratic, and on this codebase that was
 * the difference between four seconds and a test that times out in CI under
 * load — which is a test that gets deleted rather than fixed.
 */
function functionStarts(source: string): number[] {
  return [
    ...source.matchAll(/\n(?:export )?(?:async )?function |\n(?:export )?const \w+ = async/g),
  ].map((m) => m.index ?? 0);
}

/** The text from the start of the enclosing function to the call. */
function enclosingScope(source: string, starts: number[], index: number): string {
  let from = 0;
  for (const start of starts) {
    if (start >= index) break;
    from = start;
  }
  return source.slice(from, index);
}

/** The balanced argument text of the call starting at `from`. */
function callArguments(source: string, from: number): string {
  let depth = 1;
  let i = from;
  while (i < source.length && depth > 0) {
    const c = source[i]!;
    if (c === '(' || c === '{' || c === '[') depth += 1;
    else if (c === ')' || c === '}' || c === ']') depth -= 1;
    i += 1;
  }
  return source.slice(from, i);
}

interface Unscoped {
  file: string;
  line: number;
  model: string;
  operation: string;
}

function findUnscoped(): Unscoped[] {
  const models = studioOwnedModels();
  const found: Unscoped[] = [];

  for (const file of walk(SRC)) {
    const path = file.split('\\').join('/');
    const source = readFileSync(file, 'utf8');

    /* A file that checks for OPS or ADMIN anywhere is an operator surface.
       Every one of them is under `ops/` or named for it. */
    const operatorFile = OPERATOR_GUARD.test(source);
    const starts = functionStarts(source);

    for (const match of source.matchAll(/(?:prisma|tx)\.(\w+)\.(\w+)\(/g)) {
      const [, model, operation] = match;
      if (!model || !operation) continue;
      if (!models.has(model) || !OPERATIONS.has(operation)) continue;

      const at = (match.index ?? 0) + match[0].length;
      const args = callArguments(source, at);
      const scope = enclosingScope(source, starts, match.index ?? 0);

      /* The ARGUMENTS anchor the query; the enclosing SCOPE is what proves an
         id taken from a form was checked first. Both are consulted, and
         neither accepts a bare role check — `hasRole(user, 'STUDIO')` says
         who is asking, not which studio's rows they may have. */
      const anchored = ANCHORS.some((a) => args.includes(a) || scope.includes(a));
      const operatorRoute = OPERATOR_ROUTES.some((prefix) => path.startsWith(prefix));
      if (anchored || operatorFile || operatorRoute) continue;

      if (ALLOWED.some((a) => a.file === path && a.model === model)) continue;

      found.push({
        file: path,
        line: source.slice(0, match.index).split('\n').length,
        model,
        operation,
      });
    }
  }

  return found;
}

describe('multi-tenancy', () => {
  /* A generous timeout: this reads every file in `src/`, and a flake here
     reads as a tenancy failure, which is the last thing that should cry
     wolf. */
  it('scopes every query that touches a studio-owned table', { timeout: 30_000 }, () => {
    const unscoped = findUnscoped();

    const report = unscoped
      .map((u) => `  ${u.file}:${u.line} — prisma.${u.model}.${u.operation}() has no tenant scope`)
      .join('\n');

    expect(
      unscoped,
      unscoped.length === 0
        ? ''
        : `\n${unscoped.length} unscoped studio-table ${unscoped.length === 1 ? 'query' : 'queries'}:\n${report}\n\n` +
            'Scope it by studioId (or by the session\'s userId), guard it with a role check, ' +
            'or — only if it is cross-studio by design — add it to ALLOWED in this file with a reason.\n',
    ).toEqual([]);
  });

  it('covers every studio-owned model in the schema', () => {
    /* The list is derived, so this is really a check that the derivation still
       works: if the regex stops matching, the test above passes vacuously and
       the whole invariant quietly evaporates. */
    const models = studioOwnedModels();
    expect(models.size).toBeGreaterThan(20);
    for (const expected of ['studioClient', 'studioQuote', 'studioProduct', 'studioBranding']) {
      expect(models.has(expected)).toBe(true);
    }
  });

  it('keeps a reason beside every exception', () => {
    for (const entry of ALLOWED) {
      expect(entry.why.length, `${entry.file} needs a reason`).toBeGreaterThan(30);
    }
  });

  /**
   * The thing this test is standing in for.
   *
   * If policies are ever written, this becomes a belt beside braces rather
   * than the only guard — and the comment at the top of this file has to
   * change. Until then it fails loudly if somebody assumes otherwise.
   */
  it('records that row-level security is not doing this job', { timeout: 20_000 }, () => {
    const migrations = walkSql('prisma/migrations');
    const policies = migrations.filter((sql) => /CREATE POLICY/i.test(sql));

    expect(
      policies.length,
      'A CREATE POLICY has appeared. Row-level security may now be enforcing tenancy — ' +
        'update the header of this test and docs/DATA-ARCHITECTURE.md §4 before removing anything.',
    ).toBe(0);
  });
});

function walkSql(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walkSql(path));
    else if (path.endsWith('.sql')) out.push(readFileSync(path, 'utf8'));
  }
  return out;
}

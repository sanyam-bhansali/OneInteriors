import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * No client component may import a VALUE from a `server-only` module.
 *
 * ## Why this test exists
 *
 * `tsc` cannot catch this. It is not a type error — the types line up perfectly.
 * It is a bundler boundary, and the only thing that reports it is `next dev`,
 * at the moment somebody opens the page:
 *
 *   × You're importing a component that needs "server-only".
 *
 * The trap is that the two imports look identical at a glance:
 *
 *   import type { ClientRow } from './clients';      // erased at compile time, fine
 *   import { STAGE_LABELS } from './clients';        // a real runtime import, fatal
 *
 * A label map, a list of stages, a constant — none of these are types, so
 * importing one drags Prisma and the database client into the browser bundle
 * and the route stops building. It has happened twice in this codebase, both
 * times with a `Record<…, string>` of display labels, and both times everything
 * typechecked and every test passed first.
 *
 * The fix is always the same: move the vocabulary to a sibling module with no
 * `server-only`, re-export it from the server module for server callers, and
 * point the client component at the pure file. See
 * `src/modules/studio-practice/vocabulary.ts` and CONTRIBUTING §9.5.
 */

const SRC = join(process.cwd(), 'src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** `src/modules/foo/bar.ts` → `@/modules/foo/bar`, the alias imports use. */
function toAlias(file: string): string {
  return '@/' + relative(SRC, file).replace(/\\/g, '/').replace(/\.tsx?$/, '');
}

const FILES = walk(SRC);

const SERVER_ONLY = new Set(
  FILES.filter((f) => /^\s*import\s+['"]server-only['"]/m.test(readFileSync(f, 'utf8'))).map(
    toAlias,
  ),
);

const CLIENT_FILES = FILES.filter((f) =>
  /^\s*['"]use client['"]/.test(readFileSync(f, 'utf8')),
);

interface Offence {
  file: string;
  module: string;
  values: string[];
}

function offences(): Offence[] {
  const found: Offence[] = [];

  for (const file of CLIENT_FILES) {
    const source = readFileSync(file, 'utf8');

    // `import { a, b } from 'x'` and `import type { a } from 'x'`. A
    // type-only import is erased, so only the first form can be an offence.
    const pattern = /import\s+(type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'/gs;

    for (const match of source.matchAll(pattern)) {
      const [, isTypeOnly, names, module] = match;
      if (isTypeOnly || !SERVER_ONLY.has(module!)) continue;

      // Inline `type X` specifiers inside a value import are also erased.
      const values = names!
        .split(',')
        .map((n) => n.trim())
        .filter((n) => n.length > 0 && !n.startsWith('type '));

      if (values.length > 0) {
        found.push({ file: relative(process.cwd(), file).split(sep).join('/'), module: module!, values });
      }
    }
  }

  return found;
}

describe('the server-only boundary', () => {
  it('finds the modules and the client components to check', () => {
    // A guard on the guard. If the walk or the alias mapping ever breaks, this
    // test would pass by finding nothing to look at, which is the worst way for
    // a safety net to fail.
    expect(SERVER_ONLY.size).toBeGreaterThan(10);
    expect(CLIENT_FILES.length).toBeGreaterThan(10);
  });

  it('is not crossed by any client component', () => {
    const found = offences();

    const report = found
      .map((o) => `  ${o.file}\n    imports { ${o.values.join(', ')} } from '${o.module}'`)
      .join('\n');

    expect(
      found,
      found.length === 0
        ? ''
        : `A client component is importing a value from a server-only module.\n` +
            `This typechecks and then fails at build time.\n\n${report}\n\n` +
            `Move the value to a sibling module without 'server-only' and import it from there.`,
    ).toEqual([]);
  });
});

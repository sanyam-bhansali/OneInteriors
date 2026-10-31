import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A deleted project is "gone from every studio list" (owner, 27 Oct 2026;
 * studio/project-delete.ts). On 31 Oct five lists still showed them — a
 * designer's "Your projects today" had Ankita four times, after she was
 * remade three times. So: every project list built from
 * `projectsVisibleTo(...)` also says `cancelledAt` in the same query.
 *
 * Read from the source, like tests/tenant-scope.test.ts: a `findMany` on
 * homeProject (or one whose `project` relation is filtered) that mentions
 * projectsVisibleTo must mention cancelledAt before the query closes.
 */

const ROOT = join(__dirname, '..', 'src');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** The text of the call starting at `start` (an opening parenthesis), up to its matching close. */
function callAt(src: string, start: number): string {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')' && --depth === 0) return src.slice(start, i + 1);
  }
  return src.slice(start);
}

describe('deleted projects', () => {
  it('stay out of every project list built from projectsVisibleTo', () => {
    const missing: string[] = [];
    for (const file of files(ROOT)) {
      const src = readFileSync(file, 'utf8');
      if (!src.includes('projectsVisibleTo(')) continue;
      for (const m of src.matchAll(/\.(homeProject|homeWorkOrder)\.(findMany|count)\(/g)) {
        const call = callAt(src, m.index! + m[0].length - 1);
        if (call.includes('projectsVisibleTo(') && !call.includes('cancelledAt')) {
          const line = src.slice(0, m.index).split('\n').length;
          missing.push(`${relative(join(ROOT, '..'), file).replace(/\\/g, '/')}:${line}`);
        }
      }
    }
    expect(missing, `Add cancelledAt: null to these project lists:\n  ${missing.join('\n  ')}`).toEqual([]);
  });
});
